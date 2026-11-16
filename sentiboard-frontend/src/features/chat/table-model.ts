/* Pure table-model helpers for DataTable — no React, no network, no side effects. */

export const KNOWN_COLUMNS: readonly string[] = [
  "datatake_id",
  "status",
  "completeness_percentage",
  "observation_time_start",
  "observation_time_stop",
  "expected_sensing",
  "available_sensing",
  "last_attached_ticket",
  "anomaly_category",
  "mission",
];

export const COLUMN_LABELS: Record<string, string> = {
  datatake_id: "Datatake",
  status: "Status",
  completeness_percentage: "Completeness",
  observation_time_start: "Start (UTC)",
  observation_time_stop: "Stop (UTC)",
  expected_sensing: "Expected sensing",
  available_sensing: "Available sensing",
  last_attached_ticket: "Ticket",
  anomaly_category: "Anomaly category",
  mission: "Mission",
};

// Pairwise hiding: suppress the raw column when its readable counterpart is present.
export const HIDDEN_WHEN_READABLE: readonly [string, string][] = [
  ["expected", "expected_sensing"],
  ["available", "available_sensing"],
];

/** Returns columns in display order (known first, then unknown), with raw microsecond
 *  columns suppressed when their readable counterparts are present. */
export function orderedColumns(columns: string[]): string[] {
  const colSet = new Set(columns);
  const hidden = new Set<string>();
  for (const [rawCol, readableCol] of HIDDEN_WHEN_READABLE) {
    if (colSet.has(rawCol) && colSet.has(readableCol)) hidden.add(rawCol);
  }
  const knownSet = new Set(KNOWN_COLUMNS);
  const result: string[] = [];
  for (const col of KNOWN_COLUMNS) {
    if (colSet.has(col) && !hidden.has(col)) result.push(col);
  }
  for (const col of columns) {
    if (!knownSet.has(col) && !hidden.has(col)) result.push(col);
  }
  return result;
}

/** Human-readable label for a column.  Known columns return their mapped label;
 *  unknown columns are humanised from snake_case. */
export function labelFor(col: string): string {
  if (col in COLUMN_LABELS) return COLUMN_LABELS[col];
  return col.replace(/_/g, " ").replace(/^(.)/, (c) => c.toUpperCase());
}

// Strict ISO 8601 UTC date-time (the shape we detect for display formatting).
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

/** Format a cell value for display.  Detection is by value shape for dates. */
export function formatCell(col: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (col === "completeness_percentage" && typeof value === "number") {
    return `${value.toFixed(1)} %`;
  }
  if (typeof value === "string" && ISO_DATETIME_RE.test(value)) {
    return `${value.slice(0, 10)} ${value.slice(11, 16)} UTC`;
  }
  return String(value);
}

/** Stable sort on raw values.  Numbers compared numerically; mixed types compared as strings;
 *  nulls always last regardless of direction. */
export function sortRows(
  rows: readonly Record<string, unknown>[],
  col: string,
  order: "asc" | "desc",
): Record<string, unknown>[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[col] ?? null;
    const bv = b[col] ?? null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "number" && typeof bv === "number") {
      return order === "asc" ? av - bv : bv - av;
    }
    const cmp = String(av).localeCompare(String(bv));
    return order === "asc" ? cmp : -cmp;
  });
  return copy;
}

const CSV_INJECTION_STARTS = /^[=+\-@\t\r]/;

/** Prefix `'` to string cells that could be interpreted as formulas by spreadsheet apps. */
export function safeCsvCell(value: string): string {
  return CSV_INJECTION_STARTS.test(value) ? `'${value}` : value;
}

function rfcCsvQuote(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Generate a RFC 4180 CSV string with a UTF-8 BOM.
 *  Header uses readable labels; values are raw (numbers as numbers, dates as ISO). */
export function toCsv(rows: readonly Record<string, unknown>[], columns: string[]): string {
  const BOM = "﻿";

  const encodeCell = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return rfcCsvQuote(safeCsvCell(val));
    return rfcCsvQuote(String(val));
  };

  const header = columns.map((col) => rfcCsvQuote(labelFor(col))).join(",");
  const dataRows = rows.map((row) => columns.map((col) => encodeCell(row[col])).join(","));
  return BOM + [header, ...dataRows].join("\r\n");
}

/** Derive a filesystem-safe filename stem from a table title. */
export function safeFilename(title: string): string {
  return title
    .replace(/[^A-Za-z0-9_\- ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Compute the initial sort from a marker's hint.  Returns null when the column is absent. */
export function computeInitialSort(
  columns: string[],
  sortColumn: string | undefined,
  sortOrder: "asc" | "desc" | undefined,
): { col: string; order: "asc" | "desc" } | null {
  if (!sortColumn || !columns.includes(sortColumn)) return null;
  return { col: sortColumn, order: sortOrder ?? "asc" };
}
