/* Backend Processor records → the ProcessorGroup[] UI model (./model.ts). Components never see the
   backend shape. Ported from the prototype's src/api/adapters/processor.ts; the one change is that
   release notes are sanitized here, on the server, and the tooltip's "Changes" line is precomputed,
   so the browser receives clean HTML and never needs a sanitizer.

   One backend record is one release that can target several IPFs ("S2_L0:06.05", "S2_L1:06.05"),
   so it becomes one ReleaseRecord per target, on that IPF's lane. A record with no target IPF has
   no lane to sit on and is left out (reported in `unplaced`). */

import "server-only";
import type { components } from "@/lib/api/schema";
import { htmlToText, notesSection, sanitizeHtml } from "@/lib/sanitize-html";
import {
  ROSTER,
  ipfLabel,
  type MissionId,
  type ProcessorGroup,
  type ProcessorNotes,
  type ReleaseRecord,
} from "./model";

export type ApiProcessor = components["schemas"]["Processor"];

const MISSION_IDS: Record<string, MissionId> = { S1: "1", S2: "2", S3: "3", S5P: "5P" };

/** Backend IPF keys whose roster entry is filed under another key. */
const ROSTER_ALIASES: Record<string, string> = { S3_SM2_HY: "S3_SM2" };

function toMs(v: string | null | undefined): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? null : ms;
}

/** Versions the feed carries that mean "no version": some records were written with a literal
 *  "undefined" ("S1_L1L2:undefined"), presumably by a client serialising a missing value. */
const NO_VERSION = new Set(["", "undefined", "null", "none"]);

/** "S1_L1L2:002.84" → { ipf: "S1_L1L2", version: "002.84" }. The version may be empty ("S2_L1:"),
 *  a placeholder ("S2_L1:undefined") or the colon missing altogether ("S1_L0"): all give "". */
export function parseTargetIpf(target: string): { ipf: string; version: string } {
  const at = target.indexOf(":");
  if (at < 0) return { ipf: target.trim(), version: "" };
  const version = target.slice(at + 1).trim();
  return {
    ipf: target.slice(0, at).trim(),
    version: NO_VERSION.has(version.toLowerCase()) ? "" : version,
  };
}

/** Mission from the record, or failing that from the IPF key's prefix ("S5P_L2_CO" → "5P"). */
function missionOf(record: ApiProcessor, ipf: string): MissionId | null {
  const fromRecord = record.mission ? MISSION_IDS[record.mission.trim().toUpperCase()] : undefined;
  if (fromRecord) return fromRecord;
  const prefix = ipf.match(/^(S1|S2|S3|S5P)_/)?.[1];
  return prefix ? MISSION_IDS[prefix] : null;
}

/** One lane entry before formatting: what the current-baseline rule and the sort work on. */
interface LaneRelease {
  /** validity_start_date — when the baseline came into force; the timeline's position. */
  startMs: number;
  /** validity_end_date — null while the baseline has no announced end. */
  endMs: number | null;
  record: ApiProcessor;
  index: number;
  version: string;
}

/**
 * CURRENT-BASELINE RULE — which release on one processor's lane is the baseline in force.
 *
 * Rule: of the lane's releases that are valid at `now` (validity_start_date ≤ now, and
 * validity_end_date null or after now), the one that came into force most recently. Returns
 * its index in `lane`, or -1 when none is valid (every release has ended, or only future ones).
 *
 * Why not simply "validity_end_date is null": the feed rarely closes superseded releases, so that
 * test alone would mark most of a lane as current (see docs/memory/DECISIONS.md). Change the rule
 * here; nothing else decides it.
 *
 * `lane` must be sorted by startMs ascending (ties: last one wins).
 */
export function currentBaselineIndex(lane: readonly LaneRelease[], now: number): number {
  for (let i = lane.length - 1; i >= 0; i--) {
    const r = lane[i];
    if (r.startMs <= now && (r.endMs === null || r.endMs > now)) return i;
  }
  return -1;
}

const CHANGES_TITLE = /^changes introduced\s*:?$/i;
const CHANGES_MAX = 120;

function clip(text: string, max = CHANGES_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** The tooltip's "Changes" line: the notes' "Changes introduced" section when they have one —
 *  its first two items and "+ N more" — otherwise the start of the notes. */
export function changesOf(html?: string | null): string {
  const section = notesSection(html, CHANGES_TITLE);
  if (section) {
    const items = section
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("•"))
      .map((l) => l.replace(/^•\s*/, ""));
    if (items.length) {
      const more = items.length > 2 ? ` + ${items.length - 2} more` : "";
      return clip(items.slice(0, 2).join("; ")) + more;
    }
    return clip(section.replace(/\s*\n+\s*/g, " "));
  }
  const text = htmlToText(html);
  return text ? clip(text.replace(/\s*\n+\s*/g, " ").replace(/•\s*/g, "")) : "—";
}

export interface AdaptedProcessors {
  groups: ProcessorGroup[];
  /** Sanitized release notes, once per feed record (ReleaseRecord.notesId). */
  notes: ProcessorNotes;
  /** Records that could not be put on any lane (no target IPF, no mission, or no date). */
  unplaced: ApiProcessor[];
}

export function adaptProcessors(records: ApiProcessor[], now = Date.now()): AdaptedProcessors {
  const rosterOrder = new Map(ROSTER.map((slot, i) => [slot.ipf, i]));
  const lanes = new Map<string, { mission: MissionId; releases: LaneRelease[] }>();
  const unplaced: ApiProcessor[] = [];

  records.forEach((record, index) => {
    const startMs = toMs(record.validity_start_date) ?? toMs(record.release_date);
    let placed = false;
    for (const target of record.target_ipfs ?? []) {
      const { ipf, version } = parseTargetIpf(target);
      const mission = ipf ? missionOf(record, ipf) : null;
      if (!ipf || !mission || startMs === null) continue;
      const lane = lanes.get(ipf) ?? { mission, releases: [] };
      lane.releases.push({ startMs, endMs: toMs(record.validity_end_date), record, index, version });
      lanes.set(ipf, lane);
      placed = true;
    }
    if (!placed) unplaced.push(record);
  });

  // A record on several lanes shares its notes: sanitize them once, and send them once.
  const notes: ProcessorNotes = {};
  const changes = new Map<number, string>();
  const notesOf = (r: LaneRelease) => {
    const notesId = r.record.id ?? `rec${r.index}`;
    if (!changes.has(r.index)) {
      const html = sanitizeHtml(r.record.release_notes);
      if (html) notes[notesId] = html;
      changes.set(r.index, changesOf(r.record.release_notes));
    }
    return { notesId: notes[notesId] ? notesId : undefined, changes: changes.get(r.index)! };
  };

  const groups: ProcessorGroup[] = [];
  for (const [ipf, lane] of lanes) {
    const slot = ROSTER.find((r) => r.ipf === (ROSTER_ALIASES[ipf] ?? ipf));
    // Keys the roster doesn't know get a label from the key itself: "S5P_L2_CO" → "S5P L2_CO".
    const label = slot?.label ?? `S${lane.mission} ${ipfLabel(ipf)}`;
    const sub = slot?.sub ?? "";

    lane.releases.sort((a, b) => a.startMs - b.startMs || a.index - b.index);
    const current = currentBaselineIndex(lane.releases, now);

    groups.push({
      mission: lane.mission,
      ipf,
      label,
      sub,
      releases: lane.releases.map<ReleaseRecord>((r, i) => {
        const n = notesOf(r);
        return {
          id: `${r.record.id ?? `rec${r.index}`}:${ipf}`,
          // An empty IPF version ("S2_L1:") falls back to the record's processing baseline.
          baseline: r.version || r.record.processing_baseline?.trim() || "—",
          ms: r.startMs,
          sats: [...new Set((r.record.satellite_units ?? []).map((s) => s.trim()).filter(Boolean))],
          notesId: n.notesId,
          changes: n.changes,
          processingBaseline: r.record.processing_baseline?.trim() || undefined,
          releasedMs: toMs(r.record.release_date) ?? undefined,
          isCurrent: i === current,
        };
      }),
    });
  }

  // Roster processors first, in the roster's processing-chain order; the rest after, by key.
  const rank = (g: ProcessorGroup) =>
    rosterOrder.get(ROSTER_ALIASES[g.ipf] ?? g.ipf) ?? Number.MAX_SAFE_INTEGER;
  groups.sort((a, b) => rank(a) - rank(b) || a.ipf.localeCompare(b.ipf));

  return { groups, notes, unplaced };
}
