/* Backend Anomaly records → EventCard / EventDetail UI model. Server-only.

   Satellite names in the backend are long ("Copernicus Sentinel-1A") and mapped to short codes
   (S1A, S1B, …). When impacted_satellite is null, the satellite is derived from the datatake IDs
   when they all agree, else "Unknown".

   Datatake IDs that are split free text ("No", "impact", "on"…) are filtered out by requiring
   an ID starting with S + digit. Remaining entries are deduplicated. */

import "server-only";
import type { components } from "@/lib/api/schema";
import {
  MISSIONS,
  MISSION_ORDER,
  type EventCard,
  type EventCategory,
  type EventDatatake,
  type EventDetail,
  type MissionId,
  type TextSegment,
} from "./model";

export type ApiAnomaly = components["schemas"]["Anomaly"];

/* ---- satellite mapping ---- */

const SAT_NAME_MAP: Record<string, string> = {
  "Copernicus Sentinel-1A": "S1A",
  "Copernicus Sentinel-1B": "S1B",
  "Copernicus Sentinel-1C": "S1C",
  "Copernicus Sentinel-1D": "S1D",
  "Copernicus Sentinel-2A": "S2A",
  "Copernicus Sentinel-2B": "S2B",
  "Copernicus Sentinel-2C": "S2C",
  "Copernicus Sentinel-3A": "S3A",
  "Copernicus Sentinel-3B": "S3B",
  "Copernicus Sentinel-5p": "S5P",
};

const MISSION_OF: Record<string, MissionId> = {};
for (const m of MISSION_ORDER) {
  for (const s of MISSIONS[m]) MISSION_OF[s] = m;
}

/* ---- category mapping ---- */

const CATEGORY_MAP: Record<string, EventCategory> = {
  Acquisition: "Acquisition",
  Production: "Production",
  Platform: "Satellite", // Platform anomalies are classified as Satellite in the UI model.
  Manoeuvre: "Manoeuvre",
  Calibration: "Calibration",
  Satellite: "Satellite",
};

/** Returns the UI EventCategory for a raw feed value, or null when the record is excluded.
 *  Only Acquisition, Calibration, Manoeuvre, Production and Satellite are shown; all other
 *  categories (Data access, Archive, DD, MP, unknown values, empty or null) are excluded.
 *  The raw value is trimmed before matching so leading/trailing whitespace is never an issue. */
function mapCategory(raw: string | null | undefined): EventCategory | null {
  return CATEGORY_MAP[(raw ?? "").trim()] ?? null;
}

/* ---- date / time helpers ---- */

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function utcDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function utcTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/* ---- month overlap ---- */

/** All calendar months (year, 1-based month) whose period overlaps [startMs, endMs].
 *  An event belongs to every month its range touches, not only the start month. */
export function monthsOverlapped(
  startMs: number,
  endMs: number,
): { year: number; month: number }[] {
  const s = new Date(startMs);
  const e = new Date(endMs);
  const sy = s.getUTCFullYear(),
    sm = s.getUTCMonth() + 1;
  const ey = e.getUTCFullYear(),
    em = e.getUTCMonth() + 1;
  const months: { year: number; month: number }[] = [];
  let y = sy,
    m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

/* ---- datatake filtering ---- */

/** Keep only IDs starting with S + digit (real datatake IDs). Filters out split free-text tokens
 *  like "No", "impact", "on" that were accidentally stored as IDs. */
export function isRealDatatakeId(id: string): boolean {
  return /^S\d/.test(id);
}

function adaptDatatakes(
  raw: components["schemas"]["AnomalyDatatakesCompleteness"][],
): EventDatatake[] {
  const seen = new Set<string>();
  const result: EventDatatake[] = [];
  for (const d of raw) {
    if (!isRealDatatakeId(d.datatakeID)) continue;
    if (seen.has(d.datatakeID)) continue;
    seen.add(d.datatakeID);
    const L0 = d.L0_ ?? null;
    const L1 = d.L1_ ?? null;
    const L2 = d.L2_ ?? null;
    result.push({ datatakeId: d.datatakeID, L0, L1, L2, noData: L0 === null && L1 === null && L2 === null });
  }
  return result;
}

/* ---- satellite derivation from datatake IDs ---- */

function deriveSatellite(
  datatakes: components["schemas"]["AnomalyDatatakesCompleteness"][],
): string | null {
  const sats = new Set<string>();
  for (const d of datatakes) {
    if (!isRealDatatakeId(d.datatakeID)) continue;
    const m = d.datatakeID.match(/^(S\d[A-Z0-9])/);
    if (m) sats.add(m[1]);
  }
  if (sats.size === 1) return [...sats][0];
  return null;
}

/* ---- text parsing ---- */

const BLOCK_RE =
  /\{code(?::[^}]*)?\}([\s\S]*?)\{code\}|\{noformat\}([\s\S]*?)\{noformat\}/g;

function pushTextLines(out: TextSegment[], text: string): void {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]) out.push({ type: "text", text: lines[i] });
    if (i < lines.length - 1) out.push({ type: "br" });
  }
}

/** Parse an anomaly text into segments (text, line break, code block). Never produces HTML. */
export function parseTextSegments(text: string): TextSegment[] {
  if (!text || !text.trim()) return [];
  const out: TextSegment[] = [];
  BLOCK_RE.lastIndex = 0;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = BLOCK_RE.exec(text)) !== null) {
    const before = text.slice(last, match.index);
    if (before) pushTextLines(out, before);
    const codeText = (match[1] ?? match[2] ?? "").trim();
    out.push({ type: "code", text: codeText });
    last = match.index + match[0].length;
  }
  const tail = text.slice(last);
  if (tail) pushTextLines(out, tail);
  return out.filter((s) => s.type !== "text" || (s as { type: "text"; text: string }).text !== "");
}

/* ---- main adapter ---- */

export interface AdaptedEvents {
  events: EventDetail[];
  unresolved: string[];
}

export function adaptEvents(records: ApiAnomaly[]): AdaptedEvents {
  const events: EventDetail[] = [];
  const unresolved: string[] = [];
  const excludedByCategory = new Map<string, number>();

  for (const r of records) {
    if (!r.start || !r.end) {
      unresolved.push(r.id ?? r.key);
      continue;
    }
    const startMs = new Date(r.start).getTime();
    const endMs = new Date(r.end).getTime();
    if (isNaN(startMs) || isNaN(endMs)) {
      unresolved.push(r.id ?? r.key);
      continue;
    }

    const category = mapCategory(r.category);
    if (category === null) {
      const raw = (r.category ?? "").trim() || "(empty)";
      excludedByCategory.set(raw, (excludedByCategory.get(raw) ?? 0) + 1);
      continue;
    }

    let satellite: string;
    if (r.impacted_satellite) {
      satellite = SAT_NAME_MAP[r.impacted_satellite] ?? r.impacted_satellite;
    } else {
      satellite = deriveSatellite(r.datatakes_completeness ?? []) ?? "Unknown";
    }
    const mission = MISSION_OF[satellite] ?? null;

    events.push({
      id: r.id ?? r.key,
      key: r.key,
      title: r.title,
      category,
      satellite,
      mission,
      startDate: utcDateStr(r.start),
      endDate: utcDateStr(r.end),
      startDay: new Date(r.start).getUTCDate(),
      startTime: utcTimeStr(r.start),
      months: monthsOverlapped(startMs, endMs),
      textSegments: parseTextSegments(r.text ?? ""),
      datatakes: adaptDatatakes(r.datatakes_completeness ?? []),
      newsLink: r.news_link ?? null,
      newsTitle: r.news_title ?? null,
      impactedItem: r.impacted_item ?? null,
      // computed after datatakes are built, so we inline them here
      get datatakeCount() { return this.datatakes.length; },
      get lostDatatakeCount() { return this.datatakes.filter(isDatatakeLost).length; },
    });
  }

  if (excludedByCategory.size > 0) {
    const total = [...excludedByCategory.values()].reduce((a, b) => a + b, 0);
    const detail = [...excludedByCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, n]) => `${cat}: ${n}`)
      .join(", ");
    console.info(`[events] excluded ${total} records with non-shown categories — ${detail}`);
  }

  return { events, unresolved };
}

/** True when any non-null completeness level is below 100 % (partial or unavailable). */
function isDatatakeLost(dt: EventDatatake): boolean {
  const levels = [dt.L0, dt.L1, dt.L2].filter((v): v is number => v !== null);
  return levels.some((v) => v < 100);
}

/** Strip EventDetail to EventCard (removes text, datatakes, newsLink, etc.). */
export function toEventCard(e: EventDetail): EventCard {
  return {
    id: e.id,
    title: e.title,
    category: e.category,
    satellite: e.satellite,
    mission: e.mission,
    startDate: e.startDate,
    endDate: e.endDate,
    startDay: e.startDay,
    startTime: e.startTime,
    months: e.months,
    datatakeCount: e.datatakes.length,
    lostDatatakeCount: e.datatakes.filter(isDatatakeLost).length,
  };
}
