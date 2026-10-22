/* Filter and navigation state of the Events page, as URL search params.

     year      integer (≥ 2014)          default: current UTC year
     month     1-12                      default: current UTC month
     mission   s1|s2|s3|s5p             default: "" (all)
     satellite <code>                   default: "" (all)
     category  comma-separated codes    default: "" (all)
     q         free text                default: ""
     event     <anomaly id>             default: null (no selection)

   Defaults are left out of the URL. Unknown values fall back to defaults. Changing mission clears
   satellite. An event whose months[] does not include the current year/month switches to that
   event's first month. Legacy ?showDayEvents=<date> opens that date's month and highlights the day.
*/

import type { EventCard } from "./model";
import { CATEGORIES, type EventCategory, type MissionId } from "./model";

export interface EventsView {
  year: number;
  month: number;
  mission: MissionId | "";
  satellite: string;
  categories: EventCategory[];
  q: string;
  event: string | null;
}

export const EVENTS_PATH = "/events";

type ParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function reader(src: ParamSource): (name: string) => string | null {
  if (typeof (src as URLSearchParams).get === "function") {
    return (name) => (src as URLSearchParams).get(name);
  }
  return (name) => {
    const v = (src as Record<string, string | string[] | undefined>)[name];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
}

const MISSION_IDS: Set<MissionId> = new Set(["s1", "s2", "s3", "s5p"]);
const CATEGORY_SET: Set<EventCategory> = new Set(CATEGORIES);

/** Return the current UTC year/month. Exported so callers in dynamic server components can
 *  compute it once and pass it as `now` to parseView / viewParams. */
export function nowYM(): { year: number; month: number } {
  const d = new Date();
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function parseView(src: ParamSource, now?: { year: number; month: number }): EventsView {
  const get = reader(src);
  const { year: nowYear, month: nowMonth } = now ?? nowYM();

  const yearRaw = parseInt(get("year") ?? "", 10);
  const monthRaw = parseInt(get("month") ?? "", 10);
  const year = Number.isFinite(yearRaw) && yearRaw >= 2014 && yearRaw <= 2100 ? yearRaw : nowYear;
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : nowMonth;

  const mRaw = (get("mission") ?? "").toLowerCase() as MissionId;
  const mission: MissionId | "" = MISSION_IDS.has(mRaw) ? mRaw : "";

  const satellite = mission ? get("satellite") ?? "" : "";

  const catRaw = get("category") ?? "";
  const categories: EventCategory[] = catRaw
    ? catRaw
        .split(",")
        .map((c) => c.trim() as EventCategory)
        .filter((c) => CATEGORY_SET.has(c))
    : [...CATEGORIES];
  const finalCategories = categories.length > 0 ? categories : [...CATEGORIES];

  // Legacy ?showDayEvents=YYYY-MM-DD: normalise to year/month; the day is handled client-side
  const showDay = get("showDayEvents");
  if (showDay && !get("year") && !get("month")) {
    const parts = showDay.split("-");
    if (parts.length >= 2) {
      const sy = parseInt(parts[0], 10);
      const sm = parseInt(parts[1], 10);
      if (Number.isFinite(sy) && Number.isFinite(sm) && sm >= 1 && sm <= 12) {
        return {
          year: sy,
          month: sm,
          mission: "",
          satellite: "",
          categories: finalCategories,
          q: get("q") ?? "",
          event: get("event") || null,
        };
      }
    }
  }

  return {
    year,
    month,
    mission,
    satellite,
    categories: finalCategories,
    q: get("q") ?? "",
    event: get("event") || null,
  };
}

/** Serialise a view to search params; defaults are left out. */
export function viewParams(view: EventsView, now?: { year: number; month: number }): URLSearchParams {
  const { year: nowYear, month: nowMonth } = now ?? nowYM();
  const p = new URLSearchParams();
  if (view.year !== nowYear) p.set("year", String(view.year));
  if (view.month !== nowMonth) p.set("month", String(view.month));
  if (view.mission) p.set("mission", view.mission);
  if (view.satellite) p.set("satellite", view.satellite);
  if (view.categories.length < CATEGORIES.length) {
    p.set("category", view.categories.join(","));
  }
  if (view.q) p.set("q", view.q);
  if (view.event) p.set("event", view.event);
  return p;
}

export function viewHref(view: EventsView): string {
  const qs = viewParams(view).toString();
  return qs ? `${EVENTS_PATH}?${qs}` : EVENTS_PATH;
}

/** If `view.event` belongs to a different month, switch to that event's first month.
 *  An unknown event id is dropped. */
export function resolveView(view: EventsView, events: EventCard[]): EventsView {
  if (!view.event) return view;
  const ev = events.find((e) => e.id === view.event);
  if (!ev) return { ...view, event: null };
  const inCurrent = ev.months.some((m) => m.year === view.year && m.month === view.month);
  if (inCurrent) return view;
  const first = ev.months[0];
  return first ? { ...view, year: first.year, month: first.month } : view;
}

/** Filter EventCard[] to those that overlap (year, month) and match the mission/satellite/category/q
 *  filters. */
export function filterEvents(events: EventCard[], view: EventsView): EventCard[] {
  const q = view.q.trim().toLowerCase();
  const catSet = new Set(view.categories);
  return events.filter((e) => {
    if (!e.months.some((m) => m.year === view.year && m.month === view.month)) return false;
    if (view.mission && e.mission !== view.mission) return false;
    if (view.satellite && e.satellite !== view.satellite) return false;
    if (!catSet.has(e.category)) return false;
    if (q) {
      const s =
        e.title.toLowerCase() +
        " " +
        e.satellite.toLowerCase() +
        " " +
        e.category.toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  });
}

/** Calendar cells for a Monday-first month grid, padded to whole weeks. */
export type CalendarCell = { day: number; dim: boolean };

export function calendarCells(year: number, month: number): CalendarCell[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const prevLast = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: prevLast - firstDow + 1 + i, dim: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dim: false });
  for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ day: d, dim: true });
  return cells;
}
