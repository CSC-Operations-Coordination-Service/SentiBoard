/* Data Availability proposal 3 — "Coverage timeline". Mock data and the aggregations the view
   needs. Everything here is derived per DAY per MISSION, because that is the unit this concept
   reads in: the other two proposals answer "what is the state right now", this one answers "where
   did coverage break, and is it getting better or worse".

   The generator matches the other proposals so the three are comparable: the same five
   completeness states, the same three-month window plus the scheduled tail, and the same seeded
   RNG, so the rows never reshuffle between renders. */

import { makeDatatakeId } from "@/data/datatake-id";

export type Status = "Planned" | "Processing" | "Acquired" | "Partial" | "Unavailable";

export interface Datatake {
  id: string;
  satellite: string;
  mission: string;
  sensorMode: string;
  status: Status;
  completeness: number;
  start: Date;
}

export const MISSIONS: Record<string, string[]> = {
  "Sentinel-1": ["S1A", "S1C"],
  "Sentinel-2": ["S2A", "S2B", "S2C"],
  "Sentinel-3": ["S3A", "S3B"],
  "Sentinel-5P": ["S5P"],
};

const SENSOR_MODES: Record<string, string[]> = {
  S1A: ["IW", "EW", "SM", "WV"],
  S1C: ["IW", "EW", "SM", "WV"],
  S2A: ["MSI"],
  S2B: ["MSI"],
  S2C: ["MSI"],
  S3A: ["OLCI", "SLSTR", "SRAL"],
  S3B: ["OLCI", "SLSTR", "SRAL"],
  S5P: ["TROPOMI"],
};

export const MISSION_NAMES = Object.keys(MISSIONS);
export const ALL_SATELLITES = MISSION_NAMES.flatMap((m) => MISSIONS[m]);
const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((s) => [s, m])),
);

export const STATUS_COLOR: Record<Status, string> = {
  Planned: "var(--cmp-planned)",
  Processing: "var(--cmp-processing)",
  Acquired: "var(--cmp-acquired)",
  Partial: "var(--cmp-partial)",
  Unavailable: "var(--cmp-unavailable)",
};

export const DAY_MS = 86_400_000;

/** A coverage GAP: a datatake that flew and did not publish in full. Deliberately not
 *  "completeness < 100" — Processing is mid-publication and Planned has not flown, and counting
 *  either as a gap would put a permanent false positive at the top of the table. */
export function isGap(d: Datatake): boolean {
  return d.status === "Partial" || d.status === "Unavailable";
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
export const dayKey = (d: Date) => fmtDate(d);

/** The window the page describes: three months back plus everything scheduled to 23:59:59 of the
 *  following day, anchored to UTC midnight so the mock set is stable for a whole day. */
export function acquisitionWindow() {
  const n = new Date();
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const start = new Date(today);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 23, 59, 59));
  return { start, end, today: new Date(today) };
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* Coverage is not uniform noise — it comes in runs. A ground-station fault or a processor
   regression degrades a mission for days at a time, and that is exactly the shape this concept
   exists to show. So each mission gets a few OUTAGE WINDOWS, and datatakes falling inside one are
   far more likely to be partial or lost. Scatter the same failures randomly across the quarter and
   the heatmap would be confetti, which would make the view look useless when the real data is not.
*/
interface Outage {
  mission: string;
  fromDay: number; // days back from today
  toDay: number;
  severity: "partial" | "loss";
}

const OUTAGES: Outage[] = [
  { mission: "Sentinel-3", fromDay: 74, toDay: 69, severity: "loss" },
  { mission: "Sentinel-1", fromDay: 58, toDay: 55, severity: "partial" },
  { mission: "Sentinel-2", fromDay: 41, toDay: 39, severity: "partial" },
  { mission: "Sentinel-5P", fromDay: 33, toDay: 28, severity: "partial" },
  { mission: "Sentinel-3", fromDay: 22, toDay: 17, severity: "partial" },
  { mission: "Sentinel-1", fromDay: 12, toDay: 9, severity: "loss" },
  { mission: "Sentinel-2", fromDay: 6, toDay: 4, severity: "partial" },
  { mission: "Sentinel-5P", fromDay: 2, toDay: 1, severity: "loss" },
];

function outageAt(mission: string, daysBack: number): Outage | undefined {
  return OUTAGES.find((o) => o.mission === mission && daysBack <= o.fromDay && daysBack >= o.toDay);
}

function generate(count = 900): Datatake[] {
  const rng = seededRandom(1607);
  const w = acquisitionWindow();
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const rows: Datatake[] = [];

  for (let i = 0; i < count; i++) {
    const sat = pick(ALL_SATELLITES);
    const mission = MISSION_OF[sat];
    const mode = pick(SENSOR_MODES[sat]);

    // Spread across the window, with a small scheduled tail ahead of today.
    const daysBack = Math.floor(rng() * 93) - 1; // -1 → tomorrow, 91 → three months ago
    const start = new Date(w.today.getTime() - daysBack * DAY_MS + rng() * DAY_MS);

    let status: Status;
    let completeness: number;

    if (start > w.today) {
      status = "Planned";
      completeness = 0;
    } else if (daysBack < 1) {
      status = "Processing";
      completeness = Math.round(20 + rng() * 60);
    } else {
      const outage = outageAt(mission, daysBack);
      const roll = rng();
      if (outage?.severity === "loss" && roll < 0.62) {
        status = "Unavailable";
        completeness = Math.round(rng() * 8);
      } else if (outage && roll < 0.85) {
        status = "Partial";
        completeness = Math.round(25 + rng() * 50);
      } else if (roll < 0.965) {
        /* Acquired means every expected product was published, so it is 100 exactly. Letting it
           drift to 94-99 would make almost every day contain a "gap" and the whole concept — the
           gap counter, the gap-first sort, days-since-last-gap — would be reporting noise. */
        status = "Acquired";
        completeness = 100;
      } else {
        status = "Partial";
        completeness = Math.round(55 + rng() * 40);
      }
    }

    const id = makeDatatakeId(sat, rng);

    rows.push({ id, satellite: sat, mission, sensorMode: mode, status, completeness, start });
  }

  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

export const DATA = generate();
export const WINDOW = acquisitionWindow();

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface DayCell {
  key: string;
  date: Date;
  count: number;
  /** Mean publication completeness across the day's datatakes, or null when nothing flew. */
  mean: number | null;
  worst: Status | null;
  lost: number;
}

/** The days of a range, oldest first — the heatmap's columns. */
export function daysOf(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  for (let t = start; t <= end; t += DAY_MS) days.push(new Date(t));
  return days;
}

const SEVERITY: Record<Status, number> = {
  Unavailable: 4, Partial: 3, Processing: 2, Planned: 1, Acquired: 0,
};

/** One row of the heatmap: a mission's day-by-day coverage over the visible range. */
export function missionRow(rows: Datatake[], mission: string, days: Date[]): DayCell[] {
  const byDay = new Map<string, Datatake[]>();
  rows.forEach((r) => {
    if (r.mission !== mission) return;
    const k = dayKey(r.start);
    byDay.set(k, [...(byDay.get(k) ?? []), r]);
  });

  return days.map((date) => {
    const key = dayKey(date);
    const list = byDay.get(key) ?? [];
    if (list.length === 0) return { key, date, count: 0, mean: null, worst: null, lost: 0 };
    const mean = Math.round(list.reduce((s, r) => s + r.completeness, 0) / list.length);
    const worst = list.reduce((a, b) => (SEVERITY[b.status] > SEVERITY[a.status] ? b : a)).status;
    return { key, date, count: list.length, mean, worst, lost: list.filter(isGap).length };
  });
}

/** Daily means for a mission over the last n days — the sparkline series. */
export function trendSeries(rows: Datatake[], mission: string, days: number, today: Date): (number | null)[] {
  const from = new Date(today.getTime() - (days - 1) * DAY_MS);
  return missionRow(rows, mission, daysOf(from, today)).map((c) => c.mean);
}

/** How long ago this mission last dropped below full publication, in days. The headline number on
 *  each trend chip: "days since the last gap" is the one figure an operator can act on. */
export function daysSinceGap(rows: Datatake[], mission: string, today: Date): number | null {
  const gaps = rows
    .filter((r) => r.mission === mission && isGap(r) && r.start <= today)
    .sort((a, b) => b.start.getTime() - a.start.getTime());
  if (!gaps.length) return null;
  return Math.floor((today.getTime() - gaps[0].start.getTime()) / DAY_MS);
}
