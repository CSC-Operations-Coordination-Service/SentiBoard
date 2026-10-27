/* Filter and navigation state of the Events page, as URL search params.

     year           integer (≥ 2014)                    default: current UTC year
     month          1-12                                 default: current UTC month
     typesOff       comma-separated EventCategory codes default: "" (all on)
     missionsOff    comma-separated MissionId codes      default: "" (all on)
     satellitesOff  comma-separated satellite codes      default: "" (all on)
     q              free text                            default: ""
     event          <anomaly id>                         default: null (no selection)

   Multi-select toggles: every item starts ON; the URL stores what is OFF so the default URL
   stays clean. The satellite list shows only satellites of missions that are on; its count is
   over those visible satellites.

   Legacy URL params (read-only, never written):
     category=A,B    → typesOff = all categories not in {A,B}
     mission=s1      → missionsOff = all missions except s1
     satellite=S1A   → (used with mission=s1) satellitesOff = other satellites of s1

   Defaults are left out of the URL. Unknown values fall back to defaults. When year differs from
   now, month is always included in the URL so links are stable across months. An event whose
   startDate is not in the current year/month switches to that event's start month. Legacy
   ?showDayEvents=<date> opens that date's month and highlights the day.
*/

import type { EventCard } from "./model";
import {
  CATEGORIES,
  MISSIONS,
  MISSION_ORDER,
  ALL_SATELLITES_SET,
  type EventCategory,
  type MissionId,
} from "./model";

export interface EventsView {
  year: number;
  month: number;
  /** Categories currently OFF (toggled off by the user). Empty = all on. */
  typesOff: ReadonlySet<EventCategory>;
  /** Mission IDs currently OFF. Empty = all on. */
  missionsOff: ReadonlySet<MissionId>;
  /** Satellite codes currently OFF. Empty = all on. */
  satellitesOff: ReadonlySet<string>;
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

function parseOffSet<T extends string>(
  raw: string,
  validate: (v: string) => v is T,
): Set<T> {
  if (!raw) return new Set();
  return new Set(raw.split(",").map((s) => s.trim()).filter((s): s is T => validate(s)));
}

export function parseView(src: ParamSource, now: { year: number; month: number }): EventsView {
  const get = reader(src);
  const { year: nowYear, month: nowMonth } = now;

  const yearRaw = parseInt(get("year") ?? "", 10);
  const monthRaw = parseInt(get("month") ?? "", 10);
  const year = Number.isFinite(yearRaw) && yearRaw >= 2014 && yearRaw <= 2100 ? yearRaw : nowYear;
  const month = Number.isFinite(monthRaw) && monthRaw >= 1 && monthRaw <= 12 ? monthRaw : nowMonth;

  // Legacy ?showDayEvents=YYYY-MM-DD: normalise to year/month
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
          typesOff: new Set(),
          missionsOff: new Set(),
          satellitesOff: new Set(),
          q: get("q") ?? "",
          event: get("event") || null,
        };
      }
    }
  }

  let typesOff: Set<EventCategory>;
  let missionsOff: Set<MissionId>;
  let satellitesOff: Set<string>;

  const hasNewParams =
    get("typesOff") !== null || get("missionsOff") !== null || get("satellitesOff") !== null;
  const hasLegacyParams = get("category") !== null || get("mission") !== null;

  if (hasNewParams || !hasLegacyParams) {
    // New-style params
    typesOff = parseOffSet(
      get("typesOff") ?? "",
      (v): v is EventCategory => CATEGORY_SET.has(v as EventCategory),
    );
    missionsOff = parseOffSet(
      get("missionsOff") ?? "",
      (v): v is MissionId => MISSION_IDS.has(v as MissionId),
    );
    satellitesOff = parseOffSet(
      get("satellitesOff") ?? "",
      (v): v is string => ALL_SATELLITES_SET.has(v),
    );
  } else {
    // Legacy params → convert to off-sets
    const mRaw = (get("mission") ?? "").toLowerCase() as MissionId;
    const legacyMission = MISSION_IDS.has(mRaw) ? mRaw : null;

    if (legacyMission) {
      missionsOff = new Set(MISSION_ORDER.filter((m) => m !== legacyMission) as MissionId[]);
      const legacySat = get("satellite") ?? "";
      if (legacySat && MISSIONS[legacyMission].includes(legacySat)) {
        satellitesOff = new Set(MISSIONS[legacyMission].filter((s) => s !== legacySat));
      } else {
        satellitesOff = new Set();
      }
    } else {
      missionsOff = new Set();
      satellitesOff = new Set();
    }

    const catRaw = get("category") ?? "";
    if (catRaw) {
      const onCats = new Set(
        catRaw
          .split(",")
          .map((c) => c.trim() as EventCategory)
          .filter((c) => CATEGORY_SET.has(c)),
      );
      typesOff =
        onCats.size > 0
          ? new Set(CATEGORIES.filter((c) => !onCats.has(c)))
          : new Set();
    } else {
      typesOff = new Set();
    }
  }

  return {
    year,
    month,
    typesOff,
    missionsOff,
    satellitesOff,
    q: get("q") ?? "",
    event: get("event") || null,
  };
}

/** Serialise a view to search params; defaults (empty off-sets) are left out.
 *  When year differs from now, month is always included so the link means the same thing next month. */
export function viewParams(view: EventsView, now: { year: number; month: number }): URLSearchParams {
  const { year: nowYear, month: nowMonth } = now;
  const p = new URLSearchParams();
  if (view.year !== nowYear) {
    p.set("year", String(view.year));
    p.set("month", String(view.month));
  } else if (view.month !== nowMonth) {
    p.set("month", String(view.month));
  }
  if (view.typesOff.size > 0) p.set("typesOff", [...view.typesOff].join(","));
  if (view.missionsOff.size > 0) p.set("missionsOff", [...view.missionsOff].join(","));
  if (view.satellitesOff.size > 0) p.set("satellitesOff", [...view.satellitesOff].join(","));
  if (view.q) p.set("q", view.q);
  if (view.event) p.set("event", view.event);
  return p;
}

export function viewHref(view: EventsView, now: { year: number; month: number }): string {
  const qs = viewParams(view, now).toString();
  return qs ? `${EVENTS_PATH}?${qs}` : EVENTS_PATH;
}

/** If `view.event` is not in the event's start month, switch to that start month.
 *  An unknown event id is dropped. */
export function resolveView(view: EventsView, events: EventCard[]): EventsView {
  if (!view.event) return view;
  const ev = events.find((e) => e.id === view.event);
  if (!ev) return { ...view, event: null };
  const [syStr, smStr] = ev.startDate.split("-");
  const sy = parseInt(syStr, 10);
  const sm = parseInt(smStr, 10);
  if (view.year === sy && view.month === sm) return view;
  return { ...view, year: sy, month: sm };
}

/** Filter EventCard[] to those that START in (year, month) and match the active toggle filters.
 *  An event passes if its type, mission, and satellite are all ON (not in the off-sets).
 *  Unknown-mission events (mission === null) always pass the mission filter. */
export function filterEvents(events: EventCard[], view: EventsView): EventCard[] {
  const q = view.q.trim().toLowerCase();
  return events.filter((e) => {
    const [syStr, smStr] = e.startDate.split("-");
    if (parseInt(syStr, 10) !== view.year || parseInt(smStr, 10) !== view.month) return false;
    if (e.mission !== null && view.missionsOff.has(e.mission)) return false;
    if (view.typesOff.has(e.category)) return false;
    if (view.satellitesOff.has(e.satellite)) return false;
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
