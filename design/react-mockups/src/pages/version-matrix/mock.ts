/* Processors proposal 2 — "Version matrix". The matrix's own derivations.

   The releases themselves live in @/data/processor-releases, shared with the "Release log" proposal
   so the two cannot disagree about the data. That module parses the feed and stops: it carries a
   baseline version, a release date, release notes and satellite units, because that is all the feed
   carries. THERE IS NO STATUS FIELD.

   What this file adds is what the MATRIX concludes from the dates, and nothing more:

     · `kind: "cur" | "old"` — for each processor the most recently released baseline is the one in
       force, and every earlier release has been replaced by a later one. Named as the timeline names
       it, and derived the same way;
     · `prev` / `next` — the baseline this one replaced, and the one that replaced it, which is just
       its neighbours in date order;
     · `untilMs` / `months` — how long a baseline has been, or was, in force. Taken from the
       SUCCESSOR's release date rather than a validity-end field: the feed's end dates are not what
       the legacy viewer reads, and the day a replacement shipped is the day this one stopped being
       current. */

import {
  MISSION_NAMES, MISSION_ORDER, PROCESSOR_GROUPS,
  type MissionId, type ProcessorGroup, type ReleaseRecord,
  ageLabel, monthsBetween,
} from "@/data/processor-releases";

// Re-exported so this module stays the single import for the matrix component.
export { MISSION_NAMES, MISSION_ORDER, ageLabel, monthsBetween, type MissionId };

/** Derived from release-date ordering, not from any field. Named as the timeline names it. */
export type RelKind = "cur" | "old";

/** One baseline: the feed's fields, plus what the dates imply. */
export interface Release extends ReleaseRecord {
  /** The baseline this one replaced, or "—" for a processor's first record. */
  prev: string;
  /** The baseline that replaced this one, or null while it is the newest on record. */
  next: string | null;
  /** When the successor shipped, i.e. when this baseline stopped being current. Null for the newest. */
  untilMs: number | null;
  /** Whole months this baseline has been, or was, the one in force. */
  months: number;
  /** Whether this is the most recently released baseline for its processor. */
  kind: RelKind;
}

/** One row of the matrix: a processor and its baselines, oldest first. */
export interface MatrixRow {
  mission: MissionId;
  ipf: string;
  label: string;
  sub: string;
  releases: Release[];
}

/** A mission and the processor rows beneath it — the matrix's row groups. */
export interface MatrixMission {
  id: MissionId;
  name: string;
  rows: MatrixRow[];
}

/* Two treatments, because the dates support exactly two. Both come from the shared token set
   (tokens.css → --bl-*), which is theme-tuned: these also colour 9.5px label text on a cell tinted
   with the same hue, and the dark-theme values do not survive that on white. */
export const KIND_COLOR: Record<RelKind, string> = {
  cur: "var(--bl-current)",
  old: "var(--bl-past)",
};

export const KIND_LABEL: Record<RelKind, string> = {
  cur: "In force",
  old: "Superseded",
};

/** Legend order: what is running first. */
export const KIND_ORDER: RelKind[] = ["cur", "old"];

// ---------------------------------------------------------------------------
// Derivation
// ---------------------------------------------------------------------------

function layout(groups: ProcessorGroup[], now: number): MatrixRow[] {
  return groups.map((group) => {
    const sorted = group.releases; // already oldest first

    /* The baseline in force is the most recently RELEASED one. Not blindly the last element: a feed
       that announces a baseline ahead of its release date would otherwise show something that is not
       running yet as the one that is. Nothing in the fixture is future-dated, so this is defensive
       rather than load-bearing — but it is the difference between reading the date and assuming it. */
    let curIdx = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].ms <= now) { curIdx = i; break; }
    }

    const releases: Release[] = sorted.map((rel, i) => {
      const successor = sorted[i + 1];
      // A baseline's time in force ends when its replacement shipped, and runs to now for the newest.
      const untilMs = successor ? successor.ms : null;
      return {
        ...rel,
        prev: sorted[i - 1]?.baseline ?? "—",
        next: successor?.baseline ?? null,
        untilMs,
        months: monthsBetween(rel.ms, untilMs ?? now),
        kind: i === curIdx ? "cur" : "old",
      };
    });

    return { mission: group.mission, ipf: group.ipf, label: group.label, sub: group.sub, releases };
  });
}

export const ROWS: MatrixRow[] = layout(PROCESSOR_GROUPS, Date.now());

/** Group rows into mission blocks, dropping empty missions and keeping S1 → S5P order. */
export function groupByMission(rows: MatrixRow[]): MatrixMission[] {
  return MISSION_ORDER.map((id) => ({
    id,
    name: MISSION_NAMES[id],
    rows: rows.filter((r) => r.mission === id),
  })).filter((g) => g.rows.length > 0);
}

/** The baseline a row is running: its most recently released one. Null when it has none on record. */
export function currentOf(row: MatrixRow): Release | null {
  return row.releases.find((r) => r.kind === "cur") ?? null;
}

/** The longest release history among the given rows — the matrix's column count. */
export function depthOf(rows: MatrixRow[]): number {
  return rows.reduce((n, r) => Math.max(n, r.releases.length), 0);
}

/** How long a row's current baseline has been in force, in months. Null when nothing is on record. */
export function monthsInForce(row: MatrixRow): number | null {
  return currentOf(row)?.months ?? null;
}

/** A year without a new baseline. Not a fault — just the number worth surfacing when the whole
 *  point of the collapsed view is "what is each processor running, and how old is it". */
export const STALE_MONTHS = 12;

/** Aggregates for the counters. Every figure here is read off dates, versions or notes. */
export function tally(rows: MatrixRow[]) {
  const all = rows.flatMap((r) => r.releases);
  const live = rows.map(currentOf).filter((r): r is Release => r !== null);
  const newest = all.reduce<Release | null>((a, b) => (a === null || b.ms > a.ms ? b : a), null);
  return {
    rows: rows.length,
    baselines: all.length,
    live: live.length,
    /** Most recent release across the whole selection. */
    newest,
    /** Rows whose current baseline predates the staleness threshold. */
    stale: live.filter((r) => r.months >= STALE_MONTHS).length,
    /** The row running the oldest baseline — the headline of the collapsed view. */
    oldest: live.reduce<Release | null>((a, b) => (a === null || b.months > a.months ? b : a), null),
  };
}
