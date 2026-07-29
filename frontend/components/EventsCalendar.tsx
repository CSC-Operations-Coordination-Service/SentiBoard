"use client";
import { useState } from "react";
import type { CalEvent, IssueType, Completion } from "@/lib/data";

const EV_CLASS: Record<IssueType, string> = {
  acquisition: "acq", calibration: "info", manoeuvre: "maint", production: "warn", satellite: "crit",
};
function EvIcon({ type }: { type: IssueType }) {
  if (type === "manoeuvre") return <span className="ic-joy" />;
  const cls = { acquisition: "broadcast", calibration: "compass", production: "cog", satellite: "satellite" }[type];
  return <span className={"faico " + cls} />;
}

// Completeness status → colour + label (the legend from the current app).
const COMP: Record<Completion, { label: string; color: string }> = {
  plan: { label: "Planned", color: "#8792a8" },
  proc: { label: "Processing", color: "#00C7D6" },
  ok: { label: "Acquired", color: "#3DD68C" },
  warn: { label: "Partial", color: "#FFB020" },
  un: { label: "Unavailable", color: "#FF5C6C" },
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function EventsCalendar({
  events,
  year,
  month,
  todayDay,
}: {
  events: CalEvent[];
  year: number;
  month: number; // 1–12
  todayDay: number | null;
}) {
  const byDay = new Map<number, CalEvent[]>();
  events.forEach((e) => byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]));
  const eventDays = [...byDay.keys()].sort((a, b) => a - b);
  const [selDay, setSelDay] = useState<number>(eventDays[0] ?? todayDay ?? 1);

  // Build the grid for the given month: leading days from the previous month,
  // the month's own days, then trailing days to complete the final week.
  const daysInMonth = new Date(year, month, 0).getDate(); // day 0 of next month = last of this
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Monday = 0
  const prevMonthLast = new Date(year, month - 1, 0).getDate();
  const cells: { day: number; dim: boolean }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: prevMonthLast - firstDow + 1 + i, dim: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dim: false });
  for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ day: d, dim: true });

  const dayEvents = byDay.get(selDay) ?? [];
  const selLabel = dayEvents[0]?.dateLabel ?? `${selDay} ${MON_SHORT[month - 1]} ${year}`;

  return (
    <div className="ev-layout">
      {/* calendar */}
      <div>
        <div className="calendar reveal">
          <div className="cal-dow">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cal-grid">
            {cells.map((c, i) => {
              const evs = !c.dim ? byDay.get(c.day) ?? [] : [];
              // A day often holds several events of the same kind — three separate acquisition
              // anomalies, each with its own satellites and datatakes. The cell is a summary, so it
              // shows one chip per kind; the sidebar still lists every event individually.
              // Deduped on `label`, not `type`: toIssue() funnels every unmapped category into
              // "satellite", so Platform and Data access share a type while reading differently.
              const chips = evs.filter((e, j) => evs.findIndex((o) => o.label === e.label) === j);
              const cls = "cal-cell" + (c.dim ? " dim" : "") + (!c.dim && c.day === todayDay ? " today" : "") + (!c.dim && c.day === selDay ? " sel-day" : "");
              return (
                <div key={i} className={cls} onClick={() => { if (!c.dim) setSelDay(c.day); }}>
                  <div className="num">{c.day}</div>
                  {chips.length > 0 && (
                    <div className="cal-evs">
                      {chips.map((e) => (
                        // Icon only — the label lives in the tooltip and in the sidebar, so the
                        // grid stays scannable. title carries it for hover, aria-label for readers.
                        <span
                          key={e.label}
                          className={"ev " + EV_CLASS[e.type]}
                          title={e.label}
                          aria-label={e.label}
                        >
                          <EvIcon type={e.type} />
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* details sidebar */}
      <aside>
        <div className="comp-legend">
          <h4>Completeness Status</h4>
          <div className="rows">
            {(Object.keys(COMP) as Completion[]).map((k) => (
              <span className="row" key={k}><i style={{ background: COMP[k].color }} />{COMP[k].label}</span>
            ))}
          </div>
        </div>

        <div className="ev-details">
          <div className="edh">Event Details · {selLabel}</div>
          <div className="edbody">
            {dayEvents.length === 0 && <p className="ed-empty">No events on this date. Select a highlighted day.</p>}
            {dayEvents.map((e, i) => (
              <div className="ev-card" key={i}>
                <div className="eic"><EvIcon type={e.type} /></div>
                <div className="ec-body">
                  <div><b>Occurrence date:</b> {e.dateLabel}{e.time ? ` ${e.time}` : ""}</div>
                  <div><b>Impacted satellite(s):</b> {e.satellites || "—"}</div>
                  <div><b>Issue type:</b> {e.label}</div>
                  {e.datatakes && e.datatakes.length > 0 && (
                    <>
                      <div style={{ marginTop: 6 }}><b>List of impacted datatakes:</b></div>
                      {e.datatakes.map((dt, k) => (
                        <div className="ev-dt" key={k}>
                          <a href="#">{dt.id}</a>
                          <i style={{ background: COMP[dt.comp].color }} title={COMP[dt.comp].label} />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
