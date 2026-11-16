"use client";

import { useCallback, useEffect, useState } from "react";
import type { EventCalendarMarker, EventCalendarPayload, TabularPayload } from "./types";
import { getChatData, type ChatDataResult } from "./actions";
import {
  buildCalendarModel,
  calendarGridOffset,
  calendarMonthDays,
  formatDayHeading,
  formatTimeUTC,
  CATEGORY_LABEL,
  type DayKey,
  type CalendarModel,
} from "./calendar-model";
import { DataTableView, type TableState } from "./DataTable";
import type { TabularMarker } from "./types";
import s from "./event-calendar.module.css";

// ---- State types ------------------------------------------------------------

export type EventCalendarState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "done"; payload: EventCalendarPayload; model: CalendarModel };

// ---- In-flight / result cache (reuses the same pattern as DataTable) --------

const promiseCache = new Map<string, Promise<ChatDataResult>>();

function fetchOnce(dataId: string, requestId: string): Promise<ChatDataResult> {
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

// ---- Helpers ---------------------------------------------------------------

function critDotClass(c: string | null): string {
  if (c === "Blocking") return s.dotBlocking;
  if (c === "Critical") return s.dotCritical;
  if (c === "Routine") return s.dotRoutine;
  return "";
}

function critBadgeClass(c: string | null): string {
  if (c === "Blocking") return s.critBadgeBlocking;
  if (c === "Critical") return s.critBadgeCritical;
  if (c === "Routine") return s.critBadgeRoutine;
  return s.critBadgeNull;
}

// ---- EventCalendarView (pure: no hooks, testable with renderToStaticMarkup) -

export interface EventCalendarViewProps {
  state: EventCalendarState;
  marker: EventCalendarMarker;
  selectedDay: DayKey;
  currentMonth: string;         // "YYYY-MM"
  showTable: boolean;
  expandedDatatakeKeys?: ReadonlySet<string>;  // event keys whose datatake list is fully expanded
  onSelectDay?: (day: DayKey) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onToggleTable?: () => void;
  onToggleDatatake?: (key: string) => void;
  onRetry?: () => void;
}

const DOW_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function EventCalendarView({
  state,
  marker,
  selectedDay,
  currentMonth,
  showTable,
  expandedDatatakeKeys,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onToggleTable,
  onToggleDatatake,
  onRetry,
}: EventCalendarViewProps) {
  if (state.status === "loading") {
    return <p className={s.msg}>Loading calendar…</p>;
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

  const { payload, model } = state;
  const { byDay, months } = model;
  const title = (marker.title ?? payload.title) || "Event calendar";

  // "Show as table" mode
  if (showTable) {
    const tableRows = [...byDay.entries()]
      .filter(([k]) => k !== "no-date")
      .flatMap(([, info]) =>
        info.events.map((ev) => ({
          "Date (UTC)": ev.occurred_at ? ev.occurred_at.slice(0, 10) : "",
          Key: ev.key,
          Title: ev.title,
          Category: CATEGORY_LABEL[ev.category] ?? ev.category,
          Criticality: ev.criticality ?? "",
          Status: ev.status ?? "",
          Datatakes: ev.datatake_ids.join(", "),
        })),
      );
    const noDateInfo = byDay.get("no-date");
    if (noDateInfo) {
      for (const ev of noDateInfo.events) {
        tableRows.push({
          "Date (UTC)": "",
          Key: ev.key,
          Title: ev.title,
          Category: CATEGORY_LABEL[ev.category] ?? ev.category,
          Criticality: ev.criticality ?? "",
          Status: ev.status ?? "",
          Datatakes: ev.datatake_ids.join(", "),
        });
      }
    }

    const tablePayload: TabularPayload = {
      data_id: payload.data_id,
      title,
      description: "",
      columns: ["Date (UTC)", "Key", "Title", "Category", "Criticality", "Status", "Datatakes"],
      rows: tableRows,
    };
    const tState: TableState = { status: "done", payload: tablePayload, sort: null };
    const tMarker: TabularMarker = { kind: "tabular", data_id: payload.data_id, title };
    return (
      <div className={s.wrap}>
        <DataTableView state={tState} marker={tMarker} />
        <button type="button" className={s.toggle} onClick={onToggleTable}>
          Show calendar
        </button>
      </div>
    );
  }

  // ---- Calendar view --------------------------------------------------------

  const offset = calendarGridOffset(currentMonth);
  const totalDays = calendarMonthDays(currentMonth);
  const monthIdx = months.indexOf(currentMonth);
  const hasPrev = monthIdx > 0;
  const hasNext = monthIdx < months.length - 1;
  const hasNoDate = byDay.has("no-date");

  // "Jun 2026" label
  const [y, m] = currentMonth.split("-").map(Number);
  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
  const monthDisplayLabel = `${monthName} ${y}`;

  // Build grid cells: offset empties + day numbers
  const gridCells: Array<{ day: number } | null> = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: totalDays }, (_, i) => ({ day: i + 1 })),
  ];

  // Build a DayKey for a day number in the current month
  function dayKey(day: number): DayKey {
    return `${currentMonth}-${String(day).padStart(2, "0")}`;
  }

  // ---- Selected day detail -------------------------------------------------
  const selectedInfo = byDay.get(selectedDay);

  return (
    <div className={s.wrap}>
      {/* Title + month nav */}
      <div className={s.head}>
        <p className={s.title}>{title}</p>
        {months.length > 1 && (
          <div className={s.monthNav}>
            <button
              type="button"
              className={s.monthBtn}
              onClick={onPrevMonth}
              disabled={!hasPrev}
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className={s.monthLabel}>{monthDisplayLabel}</span>
            <button
              type="button"
              className={s.monthBtn}
              onClick={onNextMonth}
              disabled={!hasNext}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        )}
      </div>

      {/* Day-of-week header */}
      <div className={s.dowRow}>
        {DOW_LABELS.map((d) => (
          <div key={d} className={s.dowCell}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className={s.grid}>
        {gridCells.map((cell, i) => {
          if (!cell) {
            return <div key={`e-${i}`} className={s.dayCellEmpty} />;
          }
          const dk = dayKey(cell.day);
          const info = byDay.get(dk);
          if (!info) {
            return (
              <div key={dk} className={s.dayCellEmpty} aria-hidden="true">
                <span className={s.dayNum}>{cell.day}</span>
              </div>
            );
          }
          const isSelected = selectedDay === dk;
          const dotCls = critDotClass(info.highest);
          return (
            <button
              key={dk}
              type="button"
              className={s.dayCell}
              aria-pressed={isSelected}
              onClick={() => onSelectDay?.(dk)}
            >
              <span className={s.dayNum}>{cell.day}</span>
              <span className={s.dayCount}>{info.count}</span>
              {dotCls && <span className={`${s.dayDot} ${dotCls}`} aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {/* No-date chip */}
      {hasNoDate && (
        <button
          type="button"
          className={s.noDateChip}
          aria-pressed={selectedDay === "no-date"}
          onClick={() => onSelectDay?.("no-date")}
        >
          No date ({byDay.get("no-date")!.count})
        </button>
      )}

      {/* Day detail */}
      {selectedInfo && (
        <>
          <p className={s.dayHeading}>{formatDayHeading(selectedDay, selectedInfo.count)}</p>
          <ul className={s.eventList}>
            {selectedInfo.events.map((ev) => {
              const timeStr = ev.occurred_at ? `${formatTimeUTC(ev.occurred_at)} UTC` : "";
              const hasDesc = ev.description.length > 0;
              const dtIds = ev.datatake_ids;
              const dtExtra = dtIds.length - 5;

              return (
                <li key={ev.key} className={s.eventItem}>
                  <div className={s.eventTopRow}>
                    {timeStr && <span className={s.eventTime}>{timeStr}</span>}
                    <span className={s.eventKey}>{ev.key}</span>
                  </div>
                  <span className={s.eventTitle}>{ev.title}</span>
                  <div className={s.badgeRow}>
                    <span className={`${s.badge} ${s.neutralBadge}`}>
                      {CATEGORY_LABEL[ev.category] ?? ev.category}
                    </span>
                    {ev.criticality && (
                      <span className={`${s.badge} ${critBadgeClass(ev.criticality)}`}>
                        {ev.criticality}
                      </span>
                    )}
                    {ev.status && (
                      <span className={`${s.badge} ${s.neutralBadge}`}>{ev.status}</span>
                    )}
                  </div>
                  {dtIds.length > 0 && (() => {
                    const isExpanded = expandedDatatakeKeys?.has(ev.key) ?? false;
                    const visible = isExpanded ? dtIds : dtIds.slice(0, 5);
                    return (
                      <span className={s.datatakes}>
                        {dtIds.length} datatake{dtIds.length !== 1 ? "s" : ""}:{" "}
                        {visible.map((id, idx) => (
                          <span key={id}>
                            {idx > 0 && ", "}
                            <span className={s.datatakeId}>{id}</span>
                          </span>
                        ))}
                        {dtExtra > 0 && !isExpanded && (
                          <>
                            {", "}
                            <button
                              type="button"
                              className={s.datatakesMoreBtn}
                              aria-expanded={false}
                              onClick={() => onToggleDatatake?.(ev.key)}
                            >
                              +{dtExtra} more
                            </button>
                          </>
                        )}
                        {isExpanded && (
                          <>
                            {" "}
                            <button
                              type="button"
                              className={s.datatakesMoreBtn}
                              aria-expanded={true}
                              onClick={() => onToggleDatatake?.(ev.key)}
                            >
                              Show less
                            </button>
                          </>
                        )}
                      </span>
                    );
                  })()}
                  {hasDesc && (
                    <details className={s.desc}>
                      <summary className={s.descSummary}>Description</summary>
                      <p className={s.descBody}>{ev.description}</p>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <button type="button" className={s.toggle} onClick={onToggleTable}>
        Show as table
      </button>
    </div>
  );
}

// ---- EventCalendar (fetch + state) -----------------------------------------

interface EventCalendarProps {
  marker: EventCalendarMarker;
  requestId: string | undefined;
}

export default function EventCalendar({ marker, requestId }: EventCalendarProps) {
  const [state, setState] = useState<EventCalendarState>({ status: "loading" });
  const [selectedDay, setSelectedDay] = useState<DayKey>("");
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [showTable, setShowTable] = useState(false);
  const [expandedDatatakeKeys, setExpandedDatatakeKeys] = useState<ReadonlySet<string>>(new Set());

  const startFetch = useCallback(() => {
    if (!requestId) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "loading" });
    fetchOnce(marker.data_id, requestId).then((result) => {
      if (!result.ok) {
        const status = result.reason === "disabled" ? "unavailable" : result.reason;
        setState({ status });
        return;
      }
      if (result.kind !== "event-calendar") {
        setState({ status: "invalid" });
        return;
      }
      const model = buildCalendarModel(result.data);
      setState({ status: "done", payload: result.data, model });
      setSelectedDay(model.initialSelection);
      setCurrentMonth(model.months[0] ?? "");
    });
  }, [marker.data_id, requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startFetch();
  }, [startFetch]);

  const handlePrevMonth = useCallback(() => {
    if (state.status !== "done") return;
    const idx = state.model.months.indexOf(currentMonth);
    if (idx > 0) setCurrentMonth(state.model.months[idx - 1]);
  }, [state, currentMonth]);

  const handleNextMonth = useCallback(() => {
    if (state.status !== "done") return;
    const idx = state.model.months.indexOf(currentMonth);
    if (idx < state.model.months.length - 1) setCurrentMonth(state.model.months[idx + 1]);
  }, [state, currentMonth]);

  const handleToggleDatatake = useCallback((key: string) => {
    setExpandedDatatakeKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <EventCalendarView
      state={state}
      marker={marker}
      selectedDay={selectedDay}
      currentMonth={currentMonth}
      showTable={showTable}
      expandedDatatakeKeys={expandedDatatakeKeys}
      onSelectDay={setSelectedDay}
      onPrevMonth={handlePrevMonth}
      onNextMonth={handleNextMonth}
      onToggleTable={() => setShowTable((v) => !v)}
      onToggleDatatake={handleToggleDatatake}
      onRetry={startFetch}
    />
  );
}
