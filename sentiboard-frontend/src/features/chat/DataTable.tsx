"use client";

import { useCallback, useEffect, useState } from "react";
import type { TabularMarker, TabularPayload } from "./types";
import { getChatData, type ChatDataResult } from "./actions";
import {
  computeInitialSort,
  formatCell,
  labelFor,
  orderedColumns,
  safeFilename,
  sortRows,
  toCsv,
} from "./table-model";
import s from "./data-table.module.css";

// ---- State types ----------------------------------------------------------------

type SortState = { col: string; order: "asc" | "desc" };

export type TableState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "done"; payload: TabularPayload; sort: SortState | null };

// ---- In-flight / result cache ---------------------------------------------------
// Caches ok and not_found; removes unavailable entries so retry re-fetches.

const promiseCache = new Map<string, Promise<ChatDataResult>>();

export function fetchOnce(dataId: string, requestId: string): Promise<ChatDataResult> {
  const key = `${requestId}:${dataId}`;
  const cached = promiseCache.get(key);
  if (cached) return cached;
  const p = getChatData(dataId, requestId).then((result) => {
    if (!result.ok && result.reason === "unavailable") promiseCache.delete(key);
    return result;
  });
  promiseCache.set(key, p);
  return p;
}

export function clearDataCache(): void {
  promiseCache.clear();
}

// ---- DataTableView (pure: no hooks, testable with renderToStaticMarkup) ---------

export interface DataTableViewProps {
  state: TableState;
  marker: TabularMarker;
  onRetry?: () => void;
  onSort?: (col: string) => void;
}

export function DataTableView({ state, marker, onRetry, onSort }: DataTableViewProps) {
  if (state.status === "loading") {
    return <p className={s.msg}>Loading table…</p>;
  }
  if (state.status === "not_found") {
    return <p className={s.msg}>This data is no longer available, please ask again.</p>;
  }
  if (state.status === "unavailable") {
    return (
      <div className={s.msg}>
        <span>Could not load the data.</span>
        {onRetry && (
          <button type="button" className={s.retryBtn} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (state.status === "invalid") {
    return <p className={s.msg}>The data could not be displayed.</p>;
  }

  const { payload, sort } = state;
  const cols = orderedColumns(payload.columns);
  const title = (marker.title ?? payload.title) || "Table";

  if (payload.rows.length === 0) {
    return (
      <div className={s.wrap}>
        <div className={s.head}>
          <span className={s.title}>{title}</span>
        </div>
        <p className={s.msg}>No rows.</p>
      </div>
    );
  }

  const sortedRows = sort ? sortRows(payload.rows, sort.col, sort.order) : [...payload.rows];

  function handleDownload() {
    const csv = toCsv(sortedRows, cols);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFilename(title) || "data"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className={s.wrap}>
      <div className={s.head}>
        <span className={s.title}>{title}</span>
        <span className={s.count}>{payload.rows.length} rows</span>
        <button type="button" className={s.download} onClick={handleDownload}>
          Download CSV
        </button>
      </div>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead>
            <tr>
              {cols.map((col) => {
                const isSorted = sort?.col === col;
                const ariaSort = isSorted
                  ? sort!.order === "asc"
                    ? ("ascending" as const)
                    : ("descending" as const)
                  : undefined;
                return (
                  <th key={col} aria-sort={ariaSort} className={s.th}>
                    <button
                      type="button"
                      className={s.sortBtn}
                      onClick={() => onSort?.(col)}
                    >
                      {labelFor(col)}
                      {isSorted && (
                        <span aria-hidden="true">{sort!.order === "asc" ? " ↑" : " ↓"}</span>
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i} className={s.tr}>
                {cols.map((col) => (
                  <td key={col} className={s.td}>
                    {formatCell(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- DataTable (fetch + state) --------------------------------------------------

interface DataTableProps {
  marker: TabularMarker;
  requestId: string | undefined;
}

export default function DataTable({ marker, requestId }: DataTableProps) {
  const [state, setState] = useState<TableState>({ status: "loading" });

  const startFetch = useCallback(() => {
    if (!requestId) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "loading" });
    fetchOnce(marker.data_id, requestId).then((result) => {
      if (result.ok) {
        if (result.kind !== "tabular") {
          setState({ status: "invalid" });
          return;
        }
        const sort = computeInitialSort(
          result.data.columns,
          marker.sort_column,
          marker.sort_order,
        );
        setState({ status: "done", payload: result.data, sort });
      } else {
        const status =
          result.reason === "disabled" ? "unavailable" : result.reason;
        setState({ status });
      }
    });
  }, [marker.data_id, marker.sort_column, marker.sort_order, requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startFetch();
  }, [startFetch]);

  const handleSort = useCallback((col: string) => {
    setState((prev) => {
      if (prev.status !== "done") return prev;
      const newOrder =
        prev.sort?.col === col
          ? prev.sort.order === "asc"
            ? ("desc" as const)
            : ("asc" as const)
          : ("asc" as const);
      return { ...prev, sort: { col, order: newOrder } };
    });
  }, []);

  return (
    <DataTableView
      state={state}
      marker={marker}
      onRetry={startFetch}
      onSort={handleSort}
    />
  );
}
