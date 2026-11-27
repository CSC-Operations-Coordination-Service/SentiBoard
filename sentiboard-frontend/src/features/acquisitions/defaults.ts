import { ALL_SATELLITES } from "@/lib/missions";
import type { AcqDatatake } from "./types";
import type { AcqView } from "./url-state";

/** Comparator used in the Datatake dropdown, [ ] key cycle, and default-pick. */
export function compareDatatakes(a: AcqDatatake, b: AcqDatatake): number {
  const ga = a.sat.replace(/-[A-Z]$/, "");
  const gb = b.sat.replace(/-[A-Z]$/, "");
  if (ga < gb) return -1;
  if (ga > gb) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/** Default satellite: first unit in ALL_SATELLITES order that has at least one datatake. */
function defaultSatellite(datatakes: AcqDatatake[]): string | null {
  const present = new Set(datatakes.map((d) => d.unit));
  return ALL_SATELLITES.find((u) => present.has(u)) ?? null;
}

/** Default day for a satellite: todayKey if it has data, else latest day with data. */
function defaultDay(datatakes: AcqDatatake[], sat: string, todayKey: string): string | null {
  const days = datatakes.filter((d) => d.unit === sat).map((d) => d.startIso.slice(0, 10));
  if (!days.length) return null;
  if (days.includes(todayKey)) return todayKey;
  return days.reduce((a, b) => (a > b ? a : b));
}

/** First datatake (by compareDatatakes) for the given sat+day pair. */
function defaultDatatake(datatakes: AcqDatatake[], sat: string, day: string): string | null {
  const pool = datatakes.filter((d) => d.unit === sat && d.startIso.slice(0, 10) === day);
  if (!pool.length) return null;
  return pool.sort(compareDatatakes)[0].id;
}

/**
 * Compute the arrival view.
 *
 * Rules:
 * - If current.datatake exists in the data, derive satellite and day from that
 *   datatake (overrides any conflicting satellite/day params in the URL).
 * - Otherwise, resolve satellite from current.satellite if valid, else default;
 *   then day from current.day if valid for that satellite, else default; then
 *   pick the first datatake.
 * - If nothing changed from current, return null.
 * - If there are no datatakes at all, return null.
 */
export function pickArrivalView(
  datatakes: AcqDatatake[],
  todayKey: string,
  current: AcqView,
): AcqView | null {
  if (!datatakes.length) return null;

  // Deep-link with a datatake id: satellite and day come from the datatake itself.
  if (current.datatake) {
    const dtk = datatakes.find((d) => d.id === current.datatake);
    if (dtk) {
      const sat = dtk.unit;
      const day = dtk.startIso.slice(0, 10);
      if (sat === current.satellite && day === current.day && current.datatake === dtk.id) {
        return null;
      }
      return { satellite: sat, day, datatake: dtk.id };
    }
    // datatake param present but not in data (e.g. outside the window) — fall through to defaults
  }

  // Resolve satellite
  const sat =
    current.satellite && datatakes.some((d) => d.unit === current.satellite)
      ? current.satellite
      : defaultSatellite(datatakes);
  if (!sat) return null;

  // Resolve day
  const day =
    current.day && datatakes.some((d) => d.unit === sat && d.startIso.slice(0, 10) === current.day)
      ? current.day
      : defaultDay(datatakes, sat, todayKey);
  if (!day) return null;

  // Resolve datatake
  const datatake = defaultDatatake(datatakes, sat, day);

  // If nothing changed, return null (caller skips the replaceState)
  if (sat === current.satellite && day === current.day && datatake === current.datatake) {
    return null;
  }

  return { satellite: sat, day, datatake };
}

/**
 * View after the user picks a specific satellite.
 * Keeps current day if the satellite has data that day, else uses that satellite's default day.
 * Always picks the first datatake of the resulting sat+day pair.
 */
export function pickViewForSatellite(
  datatakes: AcqDatatake[],
  todayKey: string,
  sat: string,
  currentDay: string | null,
): AcqView {
  const day =
    currentDay && datatakes.some((d) => d.unit === sat && d.startIso.slice(0, 10) === currentDay)
      ? currentDay
      : defaultDay(datatakes, sat, todayKey);
  const datatake = day ? defaultDatatake(datatakes, sat, day) : null;
  return { satellite: sat, day, datatake };
}

/**
 * View after the user picks a specific day.
 * Picks the first datatake (by compareDatatakes) for sat+day.
 */
export function pickViewForDay(
  datatakes: AcqDatatake[],
  sat: string,
  day: string,
): AcqView {
  const pool = datatakes.filter((d) => d.unit === sat && d.startIso.slice(0, 10) === day);
  const datatake = pool.length ? pool.sort(compareDatatakes)[0].id : null;
  return { satellite: sat, day, datatake };
}
