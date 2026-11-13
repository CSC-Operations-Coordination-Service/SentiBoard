// Marker syntax layer — isolates the delimiter form (<tag ... />) from validation rules.
// When the partner changes the delimiter, only this module and its tests change.

export interface MarkerCandidate {
  start: number;
  end: number;
  tagName: string;
  /** The raw string between the tag name and the closing ">" — may include a trailing space. */
  rawAttrBody: string;
}

const TAG_NAMES = [
  "tabular",
  "temporal-plot",
  "count-histogram",
  "event-calendar",
  "kpi",
] as const;

// Quote-aware: "..." absorbs any character including ">", so ">" inside a value does not
// end the tag. The [\s]? before "/> " covers the guide's optional space before "/>".
// [^">/] matches any char except quote, ">", or "/" — the "> " and "/" are delimiter
// sentinels outside quoted values.
const TAG_RE_SOURCE =
  `<(${TAG_NAMES.join("|")})((?:"[^"]*"|[^">/])*)\\s?\\/>`;

// Returns [start, end) ranges of fenced code blocks and inline code spans in `raw`.
function codeRanges(raw: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];

  // Fenced code blocks: ```...``` or ~~~...~~~ (backreference ensures matching fence).
  const fencedRe = /(```+|~~~+)[^\n]*\n[\s\S]*?\n\1/g;
  let m: RegExpExecArray | null;
  while ((m = fencedRe.exec(raw)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }

  // Inline code: `...` (single backtick, no newline inside), only outside fenced blocks.
  const inlineRe = /`[^`\n]+`/g;
  while ((m = inlineRe.exec(raw)) !== null) {
    const s = m.index;
    if (!ranges.some(([rs, re]) => s >= rs && s < re)) {
      ranges.push([s, s + m[0].length]);
    }
  }

  return ranges;
}

/**
 * Finds all marker candidates in `raw`, skipping any that fall inside fenced code blocks
 * or inline code spans. Each candidate's rawAttrBody is NOT yet validated — call
 * `parseAttributes` for that.
 */
export function findMarkerCandidates(raw: string): MarkerCandidate[] {
  const blocked = codeRanges(raw);
  const re = new RegExp(TAG_RE_SOURCE, "g");
  const results: MarkerCandidate[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!blocked.some(([s, e]) => start < e && end > s)) {
      results.push({ start, end, tagName: m[1], rawAttrBody: m[2] });
    }
  }
  return results;
}

/**
 * Parses the raw attribute body (the string captured between the tag name and ">" or "/>")
 * into a Map of name → value pairs.
 *
 * Rules enforced here (syntax only):
 * - Each pair must be preceded by exactly one space.
 * - Values cannot contain double quotes (guaranteed by the regex; reinforced here).
 * - Duplicate attribute names → null.
 * - Any gap between pairs or trailing content that is not a single space → null.
 *
 * Returns null on any syntax error so the caller keeps the candidate as plain markdown text.
 */
export function parseAttributes(rawAttrBody: string): Map<string, string> | null {
  // Strip exactly one optional trailing space (the guide allows it before "/>").
  const body =
    rawAttrBody.length > 0 && rawAttrBody[rawAttrBody.length - 1] === " "
      ? rawAttrBody.slice(0, -1)
      : rawAttrBody;

  const pairs = new Map<string, string>();
  if (body === "") return pairs;

  // Strictly consume " name="value"" pairs left to right, with no gaps.
  const pairRe = / ([A-Za-z_][A-Za-z0-9_-]*)="([^"]*)"/g;
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(body)) !== null) {
    if (match.index !== lastEnd) return null; // gap = bad spacing
    const name = match[1];
    if (pairs.has(name)) return null; // duplicate attribute
    pairs.set(name, match[2]);
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd !== body.length) return null; // trailing garbage

  return pairs;
}
