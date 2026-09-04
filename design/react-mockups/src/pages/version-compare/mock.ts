/* Processors proposal 4 — "Version compare". Selection, deltas and the line diff.

   The releases themselves live in @/data/processor-releases, shared with the "Version matrix" and
   "Release log" proposals so all four concepts read one fixture. That module carries a baseline
   version, a release date, release notes and satellite units, because that is all the feed carries —
   THERE IS NO STATUS FIELD, and nothing here invents one.

   Everything below is either a selection rule or a comparison of two records' real fields. The only
   computation of substance is the line diff, and it is a genuine longest-common-subsequence rather
   than a similarity guess: an LCS never reports a line as changed when it merely moved, which is the
   one thing a reader of a diff has to be able to trust. */

import {
  MISSION_NAMES, MISSION_ORDER, PROCESSOR_GROUPS,
  type MissionId, type ProcessorGroup, type ReleaseRecord,
  monthsBetween,
} from "@/data/processor-releases";

export {
  MISSION_NAMES, MISSION_ORDER, ageLabel, monthsBetween,
  type MissionId, type ProcessorGroup, type ReleaseRecord,
} from "@/data/processor-releases";

/** Only processors with at least two baselines can be compared; one with fewer has nothing to diff.
 *  S3 SRAL L2 is on the roster with no releases at all, so it is absent here rather than offered as
 *  a dead option. */
export const COMPARABLE: ProcessorGroup[] = PROCESSOR_GROUPS.filter((g) => g.releases.length >= 2);

/** The processor picker, grouped into mission optgroups in roster order. */
export const COMPARABLE_BY_MISSION: { id: MissionId; name: string; groups: ProcessorGroup[] }[] =
  MISSION_ORDER.map((id) => ({
    id,
    name: MISSION_NAMES[id],
    groups: COMPARABLE.filter((g) => g.mission === id),
  })).filter((m) => m.groups.length > 0);

export function groupOf(ipf: string): ProcessorGroup | undefined {
  return COMPARABLE.find((g) => g.ipf === ipf);
}

/** The processor the page opens on: S1's L1/L2 chain, which is the headline processor the timeline
 *  concept also opens on, and the one with enough release history for the comparison to show what it
 *  is for. Falls back to whatever is first if the roster ever drops it. */
export const DEFAULT_GROUP: ProcessorGroup | undefined =
  COMPARABLE.find((g) => g.ipf === "S1_L1L2") ?? COMPARABLE[0];

/** The most recently released baseline for a processor — what "compare to current" targets.
 *
 *  Defined by release date rather than array position, so a feed that announces a baseline ahead of
 *  its date cannot make something that is not running yet the comparison target. Same rule the
 *  matrix uses for the baseline in force. */
export function currentOf(group: ProcessorGroup, now = Date.now()): ReleaseRecord {
  const released = group.releases.filter((r) => r.ms <= now);
  const pool = released.length ? released : group.releases;
  return pool[pool.length - 1];
}

/** The pair a processor opens on: its newest release against the one before it — the comparison an
 *  operator actually arrives wanting ("what changed in the latest baseline?"). */
export function defaultPair(group: ProcessorGroup): { from: string; to: string } {
  const to = currentOf(group);
  const idx = group.releases.findIndex((r) => r.baseline === to.baseline);
  const from = group.releases[Math.max(0, idx - 1)];
  return { from: from.baseline, to: to.baseline };
}

export function releaseOf(group: ProcessorGroup, baseline: string): ReleaseRecord | undefined {
  return group.releases.find((r) => r.baseline === baseline);
}

/** Baselines a valid "to" could be, given a "from": everything released after it.
 *
 *  Constraining the picker is what keeps the diff's direction meaningful — "from" is always the
 *  earlier record, so an added line always means the later baseline added it. The alternative,
 *  allowing any pair and inferring direction, produces a view whose +/- flip under you. */
export function laterThan(group: ProcessorGroup, fromBaseline: string): ReleaseRecord[] {
  const from = releaseOf(group, fromBaseline);
  if (!from) return group.releases.slice(1);
  return group.releases.filter((r) => r.ms > from.ms);
}

/** Baselines a valid "from" could be: everything except the very newest, which has nothing after it. */
export function earlierPool(group: ProcessorGroup): ReleaseRecord[] {
  return group.releases.slice(0, -1);
}

/** Releases strictly between the two endpoints — the baselines this comparison skips over. Their
 *  notes are not shown here; naming them is what tells a reader the jump was not a single step. */
export function betweenReleases(
  group: ProcessorGroup,
  from: ReleaseRecord,
  to: ReleaseRecord,
): ReleaseRecord[] {
  return group.releases.filter((r) => r.ms > from.ms && r.ms < to.ms);
}

/** Which satellite units the two releases share, and which each carries alone. */
export function satDelta(from: ReleaseRecord, to: ReleaseRecord) {
  const a = new Set(from.sats);
  const b = new Set(to.sats);
  return {
    both: from.sats.filter((s) => b.has(s)),
    onlyFrom: from.sats.filter((s) => !b.has(s)),
    onlyTo: to.sats.filter((s) => !a.has(s)),
  };
}

/** The headline numbers for a comparison, all read off the two release dates. */
export function summarise(group: ProcessorGroup, from: ReleaseRecord, to: ReleaseRecord) {
  const skipped = betweenReleases(group, from, to);
  return {
    months: monthsBetween(from.ms, to.ms),
    /** How many baselines the jump covers: 1 is consecutive. */
    steps: skipped.length + 1,
    skipped,
    sats: satDelta(from, to),
  };
}

// ---------------------------------------------------------------------------
// The line diff
// ---------------------------------------------------------------------------

export type DiffOp = "same" | "del" | "add";

export interface DiffLine {
  op: DiffOp;
  text: string;
  /** True for a line stripHtml turned into a bullet, so it keeps its hanging indent. */
  bullet: boolean;
}

/** Release notes arrive from the shared module already flattened to lines, with list items prefixed
 *  "• ". A paragraph is a line, which makes the paragraph the natural unit to diff on. */
export function noteLines(notes?: string): string[] {
  return (notes ?? "").split("\n").map((l) => l.trim()).filter((l) => l !== "");
}

/** Longest-common-subsequence line diff, in reading order.
 *
 *  Notes here are a handful of paragraphs, so the O(n·m) table is nothing; the reason for LCS over a
 *  cheaper heuristic is correctness, not speed. A line that both baselines carry is reported as
 *  common even when the lines around it changed, which is exactly what a reader needs in order to
 *  tell "restated" from "reworded". */
export function diffLines(fromLines: string[], toLines: string[]): DiffLine[] {
  const n = fromLines.length;
  const m = toLines.length;

  // lcs[i][j] = length of the longest common subsequence of from[i:] and to[j:]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = fromLines[i] === toLines[j]
        ? lcs[i + 1][j + 1] + 1
        : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const mark = (text: string, op: DiffOp): DiffLine => ({
    op,
    text: text.replace(/^•\s*/, ""),
    bullet: text.startsWith("•"),
  });

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (fromLines[i] === toLines[j]) {
      out.push(mark(fromLines[i], "same"));
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push(mark(fromLines[i], "del"));
      i++;
    } else {
      out.push(mark(toLines[j], "add"));
      j++;
    }
  }
  while (i < n) out.push(mark(fromLines[i++], "del"));
  while (j < m) out.push(mark(toLines[j++], "add"));
  return out;
}

/** The diff split into the two panels. Each side keeps the common lines, so the panels read as two
 *  documents rather than as one diff column pretending to be two. */
export function sideBySide(diff: DiffLine[]) {
  return {
    from: diff.filter((d) => d.op !== "add"),
    to: diff.filter((d) => d.op !== "del"),
    counts: {
      same: diff.filter((d) => d.op === "same").length,
      del: diff.filter((d) => d.op === "del").length,
      add: diff.filter((d) => d.op === "add").length,
    },
  };
}
