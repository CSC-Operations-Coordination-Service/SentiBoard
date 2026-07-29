"use client";
import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { CalEvent, IssueType } from "@/lib/data";
import EventsCalendar from "./EventsCalendar";

// The event-type chips (same icons/colours as the static bar they replace).
const TYPE_CHIPS: { key: IssueType | "all"; label: string; icon: ReactNode }[] = [
  { key: "all", label: "All Events", icon: null },
  { key: "acquisition", label: "Acquisition", icon: <span className="faico broadcast" style={{ color: "#3DD68C" }} /> },
  { key: "calibration", label: "Calibration", icon: <span className="faico compass" style={{ color: "#00C7D6" }} /> },
  { key: "manoeuvre", label: "Manoeuvre", icon: <span className="ic-joy" style={{ color: "#2E7DF6" }} /> },
  { key: "production", label: "Production", icon: <span className="faico cog" style={{ color: "#FFB020" }} /> },
  { key: "satellite", label: "Satellite", icon: <span className="faico satellite" style={{ color: "#FF5C6C" }} /> },
];

// "S2A" → "2", "Sentinel-1A" → "1", "S5P" / "Sentinel-5P" → "5P".
function missionOf(sat: string): string {
  const s = sat.toUpperCase();
  if (s.includes("5P") || s.includes("5-P")) return "5P";
  const m = s.match(/S(?:ENTINEL-?)?([1-5])/);
  return m ? m[1] : "";
}
function matchesMission(ev: CalEvent, mission: string): boolean {
  if (mission === "all") return true;
  return (ev.satellites ?? "").split(/[,\s]+/).filter(Boolean).some((tok) => missionOf(tok) === mission);
}
function matchesSearch(ev: CalEvent, q: string): boolean {
  if (!q) return true;
  const hay = [ev.label, ev.satellites ?? "", ev.dateLabel, ...(ev.datatakes ?? []).map((d) => d.id)]
    .join(" ")
    .toLowerCase();
  return hay.includes(q.toLowerCase());
}

export default function EventsView({
  events,
  year,
  month,
  monthLabel,
  todayDay,
}: {
  events: CalEvent[];
  year: number;
  month: number; // 1–12
  monthLabel: string;
  todayDay: number | null;
}) {
  const router = useRouter();
  const [type, setType] = useState<IssueType | "all">("all");
  const [mission, setMission] = useState("all");
  const [query, setQuery] = useState("");

  // Previous/next month, rolling the year over at the boundaries.
  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 };
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  // router.push changes the URL → the server component re-runs getCalendarEvents for that month.
  const goTo = (y: number, m: number) => router.push(`/v1/events?year=${y}&month=${m}`);

  // Derived list — recomputed only when the events or a filter changes.
  const filtered = useMemo(
    () =>
      events.filter(
        (e) => (type === "all" || e.type === type) && matchesMission(e, mission) && matchesSearch(e, query),
      ),
    [events, type, mission, query],
  );

  const active = type !== "all" || mission !== "all" || query !== "";
  const reset = () => {
    setType("all");
    setMission("all");
    setQuery("");
  };

  return (
    <>
      <div className="cal-head reveal">
        <div className="cal-nav">
          <button aria-label="Previous month" onClick={() => goTo(prev.y, prev.m)}>‹</button>
          <span className="month">{monthLabel}</span>
          <button aria-label="Next month" onClick={() => goTo(next.y, next.m)}>›</button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select className="select" value={mission} onChange={(e) => setMission(e.target.value)}>
            <option value="all">All Missions</option>
            <option value="1">Sentinel 1</option>
            <option value="2">Sentinel 2</option>
            <option value="3">Sentinel 3</option>
            <option value="5P">Sentinel 5P</option>
          </select>
          <input
            className="select"
            type="text"
            placeholder="Search ..."
            style={{ backgroundImage: "none" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn" onClick={reset} disabled={!active}>
            Reset
          </button>
        </div>
      </div>

      <div className="evfilters reveal">
        {TYPE_CHIPS.map((c) => (
          <span
            key={c.key}
            className={"evchip" + (type === c.key ? " on" : "")}
            onClick={() => setType(c.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setType(c.key);
            }}
          >
            {c.icon}
            {c.label}
          </span>
        ))}
      </div>

      <div style={{ margin: "10px 2px 0", fontSize: "12.5px", opacity: 0.6 }}>
        Showing {filtered.length} of {events.length} events{active ? " · filtered" : ""}
      </div>

      <EventsCalendar events={filtered} year={year} month={month} todayDay={todayDay} />
    </>
  );
}
