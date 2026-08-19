/* Processors proposal 3 — "Release log". Grouping, filtering and search over the shared releases.

   The releases themselves live in @/data/processor-releases, shared with the "Version matrix"
   proposal so the two cannot disagree about the data. That module carries a baseline version, a
   release date, release notes and satellite units, because that is all the feed carries — THERE IS
   NO STATUS FIELD, and this concept adds nothing of the kind.

   Unlike the matrix, this file derives almost nothing. A log is a reading order, so what it needs is
   ordering, bucketing, a date range and text matching over the three real fields. There is
   deliberately no notion of "current" or "superseded" here: the newest entry is simply the one at
   the top. */

import {
  MISSION_NAMES, MISSION_ORDER, PROCESSOR_GROUPS, RELEASE_FEED,
  type MissionId, type ReleaseRecord,
  fmtMonthYear,
} from "@/data/processor-releases";

export { MISSION_NAMES, MISSION_ORDER, RELEASE_FEED, type MissionId, type ReleaseRecord };

/** How the feed is bucketed. Both orderings are reverse-chronological within a bucket. */
export type GroupBy = "date" | "processor";

export interface LogGroup {
  /** Stable React key. */
  key: string;
  /** "July 2026", or "S1 SAR L1/L2". */
  title: string;
  /** Secondary line: the mission for a date bucket, the products for a processor bucket. */
  meta: string;
  entries: ReleaseRecord[];
}

/** yyyy-mm-dd, the value format a native date input wants. */
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The span the feed actually covers, so the date inputs can bound themselves to it rather than
 *  letting someone pick 1994. RELEASE_FEED is newest first, so the ends are its first and last. */
export const FEED_BOUNDS = {
  min: RELEASE_FEED.length ? isoDay(RELEASE_FEED[RELEASE_FEED.length - 1].ms) : "",
  max: RELEASE_FEED.length ? isoDay(RELEASE_FEED[0].ms) : "",
};

/** Everything a search query is matched against, lowercased once per record.
 *
 *  The notes are the bulk of it and the reason this view exists, but the processor, its products,
 *  the baseline version and the mission are in here too, so the search box can stand in for the
 *  mission buttons when that is quicker than reaching for them. */
function haystack(r: ReleaseRecord): string {
  return [
    r.label, r.sub, r.proc, r.baseline,
    MISSION_NAMES[r.mission], `S${r.mission}`,
    r.sats.join(" "),
    r.notes ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** Mission, release-date range and free-text search, all composing. Any of them may be inert.
 *
 *  `from` / `to` are yyyy-mm-dd as a native date input gives them, and both ends are inclusive —
 *  `to` covers the whole of its day, so picking the same date for both returns that day's releases
 *  rather than nothing. */
export function filterFeed(
  feed: ReleaseRecord[],
  mission: MissionId | "All",
  query: string,
  from = "",
  to = "",
): ReleaseRecord[] {
  const q = query.trim().toLowerCase();
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : NaN;
  const toMs = to ? Date.parse(`${to}T23:59:59Z`) : NaN;

  return feed.filter((r) => {
    if (mission !== "All" && r.mission !== mission) return false;
    if (!isNaN(fromMs) && r.ms < fromMs) return false;
    if (!isNaN(toMs) && r.ms > toMs) return false;
    if (!q) return true;
    return haystack(r).includes(q);
  });
}

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Bucket the feed for display. Entries arrive newest first and stay that way inside each bucket. */
export function groupFeed(entries: ReleaseRecord[], by: GroupBy): LogGroup[] {
  if (by === "date") {
    /* One bucket per calendar month a release landed in. Months with nothing in them are skipped
       rather than rendered empty — a log should not pad itself with silence. */
    const buckets = new Map<string, ReleaseRecord[]>();
    for (const r of entries) {
      const d = new Date(r.ms);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      buckets.set(key, [...(buckets.get(key) ?? []), r]);
    }
    return [...buckets.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest month first
      .map(([key, list]) => {
        const d = new Date(list[0].ms);
        const missions = [...new Set(list.map((r) => MISSION_NAMES[r.mission]))];
        return {
          key,
          title: `${MONTH_FULL[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
          meta: missions.join(" · "),
          entries: list,
        };
      });
  }

  /* One bucket per processor, in the roster's processing-chain order rather than by how recently it
     released — so the reading order matches the matrix's rows and the timeline's lanes. */
  return PROCESSOR_GROUPS.flatMap((g) => {
    const list = entries.filter((r) => r.ipf === g.ipf);
    if (!list.length) return [];
    return [{ key: g.ipf, title: g.label, meta: g.sub, entries: list }];
  });
}

/** One segment of a release note: a run of text, and whether it matched the search query. */
export interface Segment {
  text: string;
  hit: boolean;
}

/** Split text on the query so the matched runs can be marked. Returns one plain segment when there
 *  is no query, so the caller never needs to special-case an empty search. */
export function highlight(text: string, query: string): Segment[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lower = q.toLowerCase();
  return text
    .split(new RegExp(`(${escaped})`, "gi"))
    .filter((part) => part !== "")
    .map((part) => ({ text: part, hit: part.toLowerCase() === lower }));
}

/** Counters. Every figure is read off the release dates, the processors, or the notes. */
export function tally(entries: ReleaseRecord[]) {
  const stamps = entries.map((r) => r.ms);
  return {
    releases: entries.length,
    processors: new Set(entries.map((r) => r.ipf)).size,
    withNotes: entries.filter((r) => r.notes).length,
    /** Oldest and newest release date in the selection, as month-year. */
    span: stamps.length
      ? { from: fmtMonthYear(Math.min(...stamps)), to: fmtMonthYear(Math.max(...stamps)) }
      : null,
  };
}
