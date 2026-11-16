/* Pure chart-model helpers — no React, no DOM, no network side effects. */

import type { TabularPayload, TemporalPlotMarker, CountHistogramMarker } from "./types";

// ---- Types -----------------------------------------------------------------

export type ChartPoint = { date: number; value: number };
export type ChartSeries = { name: string; segments: ChartPoint[][] };

export type TemporalChartModel = {
  series: ChartSeries[];
  yAxis: { min: number; max: number; ticks: number[] };
  xLabels: { date: number; label: string }[];
  title: string;
  isPercentage: boolean;
  numericLabel: string;
  tablePayload: TabularPayload;
};

export type CountBar = {
  label: string;
  value: number;
  colorToken: "ok" | "warn" | "crit" | "text-dim" | "accent";
};

export type CountChartModel =
  | { kind: "category"; bars: CountBar[]; title: string }
  | { kind: "date"; bars: CountBar[]; title: string; xLabels: { date: number; label: string }[] }
  | { kind: "table-fallback"; reason: string; title: string; tablePayload: TabularPayload };

// ---- Date formatting -------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDateLabel(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function formatDateLabelFull(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---- Rounding --------------------------------------------------------------

export function roundDisplay(v: number): number {
  return parseFloat(v.toFixed(1));
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-GB").format(Math.round(n));
}

export function truncateLabel(label: string, maxChars = 18): string {
  if (label.length <= maxChars) return label;
  return label.slice(0, maxChars - 1) + "…";
}

export function temporalReadoutText(date: number, value: number, isPercentage: boolean): string {
  return `${formatDateLabelFull(date)} · ${roundDisplay(value)}${isPercentage ? " %" : ""}`;
}

export function countReadoutText(label: string, value: number): string {
  return `${label} · ${formatCount(value)}`;
}

// ---- Gap detection ---------------------------------------------------------

export function inferInterval(dates: number[]): number {
  if (dates.length < 2) return 86_400_000;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(dates[i] - dates[i - 1]);
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps.length % 2 === 0 ? (gaps[mid - 1] + gaps[mid]) / 2 : gaps[mid];
}

export function detectGaps(points: ChartPoint[], interval: number): ChartPoint[][] {
  if (points.length === 0) return [];
  const segments: ChartPoint[][] = [];
  let current: ChartPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    if (points[i].date - points[i - 1].date > 1.5 * interval) {
      segments.push(current);
      current = [];
    }
    current.push(points[i]);
  }
  segments.push(current);
  return segments;
}

// ---- Y-axis ----------------------------------------------------------------

function niceStep(range: number): number {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const mag = Math.pow(10, exp);
  const frac = range / mag;
  if (frac <= 1) return mag;
  if (frac <= 2) return 2 * mag;
  if (frac <= 5) return 5 * mag;
  return 10 * mag;
}

export function niceYAxis(
  values: number[],
  isPercentage: boolean,
): { min: number; max: number; ticks: number[] } {
  if (isPercentage) {
    return { min: 0, max: 100, ticks: [0, 25, 50, 75, 100] };
  }
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  if (dataMin === dataMax) {
    const v = roundDisplay(dataMin);
    return { min: v - 1, max: v + 1, ticks: [v - 1, v, v + 1] };
  }
  const range = dataMax - dataMin;
  const step = niceStep(range / 4);
  const minV = Math.floor(dataMin / step) * step;
  const maxV = Math.ceil(dataMax / step) * step;
  const ticks: number[] = [];
  for (let t = minV; t <= maxV + step * 0.001; t += step) {
    ticks.push(roundDisplay(t));
    if (ticks.length >= 5) break;
  }
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}

// ---- X-axis ticks ----------------------------------------------------------

export function xAxisTicks(
  dates: number[],
  maxCount: number,
): { date: number; label: string }[] {
  if (dates.length === 0) return [];
  if (dates.length <= maxCount) {
    return dates.map((d) => ({ date: d, label: formatDateLabel(d) }));
  }
  const result: { date: number; label: string }[] = [];
  for (let i = 0; i < maxCount; i++) {
    const idx = Math.round((i / (maxCount - 1)) * (dates.length - 1));
    result.push({ date: dates[idx], label: formatDateLabel(dates[idx]) });
  }
  return result;
}

// ---- Status / count bar colors ---------------------------------------------

export function statusColorToken(status: string): CountBar["colorToken"] {
  switch (status) {
    case "Complete":
      return "ok";
    case "Partial":
      return "warn";
    case "Missing":
      return "crit";
    case "Unknown":
      return "text-dim";
    default:
      return "accent";
  }
}

// ---- Series colour class ---------------------------------------------------
// Neutral palette (no status tokens, no mission tokens):
//   c0 → --accent         #00e5ff  13.8:1 vs #141820
//   c1 → --accent-magenta #ff007f   4.8:1
//   c2 → --accent-cyan-alt #06b6d4  7.6:1
//   c3 → --cmp-processing #9d4edd   4.2:1
//   c4 → --accent-grad    #007c93   3.7:1
//   c5 → --planned        #8a99ad   6.3:1
// Mission tokens (applied when series name matches Sentinel mission pattern):
//   mis1  → --pr-mis-1   #FF8F5E   8.1:1
//   mis2  → --pr-mis-2   #4ADE80  10.5:1
//   mis3  → --pr-mis-3   #6FA8FF   7.5:1
//   mis5p → --pr-mis-5P  #A78BFA   7.1:1
// All ratios measured against --bg-3 #141820.

const MISSION_PATTERNS: [RegExp, string][] = [
  [/^s1[a-d]?$/i, "mis1"],
  [/^s2[a-c]?$/i, "mis2"],
  [/^s3[a-b]?$/i, "mis3"],
  [/^s5p$/i, "mis5p"],
];

const NEUTRAL_CLASSES = ["c0", "c1", "c2", "c3", "c4", "c5"] as const;

export function seriesColorClass(name: string, index: number): string {
  for (const [pattern, cls] of MISSION_PATTERNS) {
    if (pattern.test(name)) return cls;
  }
  return NEUTRAL_CLASSES[index % NEUTRAL_CLASSES.length];
}

/** Returns a colour class for each series name.
 *  Mission tokens are used only when EVERY name maps to a distinct mission.
 *  If two names share a mission (e.g. S2A + S2B → both mis2) the neutral
 *  palette is used so every series stays visually distinct. */
export function resolveSeriesColors(names: string[]): string[] {
  if (names.length === 0) return [];
  const missionClasses = names.map((name) => {
    for (const [pattern, cls] of MISSION_PATTERNS) {
      if (pattern.test(name)) return cls as string;
    }
    return null;
  });
  const allMission = missionClasses.every((c) => c !== null);
  const distinct = new Set(missionClasses).size === missionClasses.length;
  if (allMission && distinct) return missionClasses as string[];
  return names.map((_, i) => NEUTRAL_CLASSES[i % NEUTRAL_CLASSES.length]);
}

// ---- Column label ----------------------------------------------------------

function humaniseColumn(col: string): string {
  if (col === "completeness_percentage") return "Completeness";
  if (col === "missing_percentage") return "Missing %";
  return col.replace(/_/g, " ").replace(/^(.)/, (c) => c.toUpperCase());
}

// ---- buildTemporalModel ----------------------------------------------------

export function buildTemporalModel(
  payload: TabularPayload,
  marker: TemporalPlotMarker,
): TemporalChartModel | "invalid" | "too-many-series" {
  const rows = payload.temporal_rows ?? [];
  if (rows.length === 0) return "invalid";

  const { date_column, numeric_column, categorical_column } = marker;

  // Validate required columns exist in temporal_rows
  const sample = rows[0];
  if (!(date_column in sample)) return "invalid";
  if (!(numeric_column in sample)) return "invalid";
  if (categorical_column !== undefined && !(categorical_column in sample)) return "invalid";

  // Validate all rows: dates parse, values are finite numbers
  for (const row of rows) {
    const dateVal = row[date_column];
    if (typeof dateVal !== "string" || Number.isNaN(Date.parse(dateVal))) return "invalid";
    const numVal = row[numeric_column];
    if (typeof numVal !== "number" || !Number.isFinite(numVal)) return "invalid";
  }

  // Group by categorical_column (or single group "all")
  const groups = new Map<string, ChartPoint[]>();
  for (const row of rows) {
    const key =
      categorical_column !== undefined ? String(row[categorical_column] ?? "") : "all";
    const date = Date.parse(row[date_column] as string);
    const value = row[numeric_column] as number;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ date, value });
  }

  if (groups.size > 6) return "too-many-series";

  const allValues: number[] = [];
  const seriesList: ChartSeries[] = [];
  for (const [name, pts] of groups) {
    pts.sort((a, b) => a.date - b.date);
    const interval = inferInterval(pts.map((p) => p.date));
    seriesList.push({ name, segments: detectGaps(pts, interval) });
    for (const p of pts) allValues.push(p.value);
  }

  const isPercentage = numeric_column.endsWith("_percentage");
  const allDates = [
    ...new Set(seriesList.flatMap((s) => s.segments.flat().map((p) => p.date))),
  ].sort((a, b) => a - b);

  const title = marker.title ?? payload.title ?? "";
  const numericLabel = humaniseColumn(numeric_column);
  const isSingleAll = seriesList.length === 1 && seriesList[0].name === "all";

  // Build tablePayload from plotted data (single-series "all" → no "all" column)
  const tableColumns =
    seriesList.length > 1 && categorical_column
      ? [date_column, categorical_column, numeric_column]
      : [date_column, numeric_column];

  const tableRows = seriesList.flatMap((s) =>
    s.segments.flat().map((p) => {
      const row: Record<string, unknown> = {
        [date_column]: new Date(p.date).toISOString().replace("T00:00:00.000Z", ""),
        [numeric_column]: roundDisplay(p.value),
      };
      if (!isSingleAll && categorical_column) {
        row[categorical_column] = s.name;
      }
      return row;
    }),
  );

  const tablePayload: TabularPayload = {
    data_id: payload.data_id,
    title,
    description: "",
    columns: tableColumns,
    rows: tableRows,
  };

  return {
    series: seriesList,
    yAxis: niceYAxis(allValues, isPercentage),
    xLabels: xAxisTicks(allDates, 5),
    title,
    isPercentage,
    numericLabel,
    tablePayload,
  };
}

// ---- buildCountModel -------------------------------------------------------

export function buildCountModel(
  payload: TabularPayload,
  marker: CountHistogramMarker,
): CountChartModel | "invalid" {
  const { count_column, category_column, date_column } = marker;
  const rows = payload.rows;

  // Validate count_column is numeric in all rows
  for (const row of rows) {
    if (typeof row[count_column] !== "number") return "invalid";
  }

  const title = marker.title ?? payload.title ?? "";

  // Both date and category → table fallback
  if (date_column && category_column) {
    return {
      kind: "table-fallback",
      reason: "Date and category together are not yet charted — shown as a table.",
      title,
      tablePayload: { ...payload, title },
    };
  }

  // Category only
  if (category_column) {
    for (const row of rows) {
      if (!(category_column in row)) return "invalid";
    }
    const bars: CountBar[] = rows.map((row) => ({
      label: String(row[category_column] ?? ""),
      value: row[count_column] as number,
      colorToken: statusColorToken(String(row[category_column] ?? "")),
    }));
    return { kind: "category", bars, title };
  }

  // Date only
  if (date_column) {
    for (const row of rows) {
      if (!(date_column in row)) return "invalid";
      const dv = row[date_column];
      if (typeof dv !== "string" || Number.isNaN(Date.parse(dv))) return "invalid";
    }
    const bars: CountBar[] = rows.map((row) => ({
      label: formatDateLabel(Date.parse(row[date_column!] as string)),
      value: row[count_column] as number,
      colorToken: "accent" as const,
    }));
    const dates = rows.map((r) => Date.parse(r[date_column!] as string));
    return { kind: "date", bars, title, xLabels: xAxisTicks(dates, 5) };
  }

  return "invalid";
}
