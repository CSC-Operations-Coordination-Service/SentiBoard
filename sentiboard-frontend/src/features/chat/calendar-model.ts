import type { CalendarEvent, EventCalendarPayload, EventCriticality } from "./types";

export type DayKey = string; // "YYYY-MM-DD" UTC or "no-date"

export type DayInfo = {
  events: CalendarEvent[];  // sorted ascending by occurred_at time within the day
  count: number;
  highest: EventCriticality; // null only when every event has null criticality
};

export type CalendarModel = {
  byDay: Map<DayKey, DayInfo>;
  months: string[];          // "YYYY-MM" in order, from first to last event's month
  initialSelection: DayKey;  // first day with events chronologically; "no-date" if only null-date events
};

const CRIT_RANK: Record<NonNullable<EventCriticality>, number> = {
  Blocking: 3,
  Critical: 2,
  Routine: 1,
};

function critRank(c: EventCriticality): number {
  return c === null ? 0 : CRIT_RANK[c];
}

function highestCriticality(events: CalendarEvent[]): EventCriticality {
  let highest: EventCriticality = null;
  for (const e of events) {
    if (critRank(e.criticality) > critRank(highest)) highest = e.criticality;
  }
  return highest;
}

export function utcDayKey(isoString: string): DayKey {
  return isoString.slice(0, 10);
}

export function buildCalendarModel(payload: EventCalendarPayload): CalendarModel {
  const grouped = new Map<DayKey, CalendarEvent[]>();

  for (const ev of payload.events) {
    const key: DayKey = ev.occurred_at ? utcDayKey(ev.occurred_at) : "no-date";
    const existing = grouped.get(key) ?? [];
    existing.push({ ...ev, title: ev.title.trim(), description: ev.description.trim() });
    grouped.set(key, existing);
  }

  const byDay = new Map<DayKey, DayInfo>();
  for (const [key, events] of grouped) {
    const sorted = [...events].sort((a, b) => {
      if (!a.occurred_at && !b.occurred_at) return 0;
      if (!a.occurred_at) return 1;
      if (!b.occurred_at) return -1;
      return a.occurred_at < b.occurred_at ? -1 : a.occurred_at > b.occurred_at ? 1 : 0;
    });
    byDay.set(key, {
      events: sorted,
      count: sorted.length,
      highest: highestCriticality(sorted),
    });
  }

  const datedKeys = [...byDay.keys()].filter((k) => k !== "no-date").sort();

  const monthsSet = new Set<string>();
  for (const key of datedKeys) {
    monthsSet.add(key.slice(0, 7));
  }
  const months = [...monthsSet].sort();

  const initialSelection: DayKey = datedKeys.length > 0 ? datedKeys[0] : "no-date";

  return { byDay, months, initialSelection };
}

export function formatDayHeading(isoDay: DayKey, count: number): string {
  if (isoDay === "no-date") {
    return `No date · ${count} ticket${count !== 1 ? "s" : ""}`;
  }
  const d = new Date(isoDay + "T00:00:00Z");
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const day = d.getUTCDate();
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${dow} ${day} ${mon} ${year} · ${count} ticket${count !== 1 ? "s" : ""}`;
}

export function calendarGridOffset(isoMonth: string): number {
  // Monday-first: 0 = Monday, 1 = Tuesday, ... 6 = Sunday
  const d = new Date(isoMonth + "-01T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  return (dow + 6) % 7;
}

export function calendarMonthDays(isoMonth: string): number {
  const [y, m] = isoMonth.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function formatTimeUTC(isoString: string): string {
  // "2026-06-01T03:00:00.000Z" → "03:00"
  return isoString.slice(11, 16);
}

export const CATEGORY_LABEL: Record<string, string> = {
  acquisition: "Acquisition",
  production: "Production",
  rfi: "RFI",
  satellite: "Satellite",
  other: "Other",
};
