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
 * - If current.datatake is found and either no URL day is set or the datatake
 *   is on the URL day, derive satellite and day from that datatake.
 * - If current.day is set (server fetched for it), it wins: only resolve
 *   satellite and datatake for that day. Switches satellite if the current one
 *   has no data for that day; drops a stale datatake when no data exists.
 * - Otherwise (no URL day): resolve satellite → defaultDay → defaultDatatake.
 * - Returns null when nothing needs to change.
 * - Returns null when there are no datatakes at all.
 */
export function pickArrivalView(
  datatakes: AcqDatatake[],
  todayKey: string,
  current: AcqView,
): AcqView | null {
  if (!datatakes.length) return null;

  // Deep-link with a datatake id: satellite and day come from the datatake,
  // unless a URL day is also set that differs (URL day wins in that case).
  if (current.datatake) {
    const dtk = datatakes.find((d) => d.id === current.datatake);
    if (dtk) {
      const dtkDay = dtk.startIso.slice(0, 10);
      if (!current.day || current.day === dtkDay) {
        const sat = dtk.unit;
        if (sat === current.satellite && dtkDay === current.day && current.datatake === dtk.id) {
          return null;
        }
        return { satellite: sat, day: dtkDay, datatake: dtk.id };
      }
      // datatake is on a different day than current.day → fall through to day-wins path
    }
    // datatake param present but not in data — fall through
  }

  // When a URL day is set, it must win (the server fetched for it). Only resolve satellite+datatake.
  if (current.day) {
    const dayData = datatakes.filter((d) => d.startIso.slice(0, 10) === current.day);

    const sat =
      current.satellite && dayData.some((d) => d.unit === current.satellite)
        ? current.satellite
        : defaultSatellite(dayData);

    if (!sat) {
      // No data for this day at all: keep sat/day, drop stale datatake.
      if (current.datatake === null) return null;
      return { satellite: current.satellite, day: current.day, datatake: null };
    }

    const datatake = defaultDatatake(datatakes, sat, current.day);
    if (sat === current.satellite && datatake === current.datatake) return null;
    return { satellite: sat, day: current.day, datatake };
  }

  // No URL day: resolve satellite → defaultDay → defaultDatatake.
  const sat =
    current.satellite && datatakes.some((d) => d.unit === current.satellite)
      ? current.satellite
      : defaultSatellite(datatakes);
  if (!sat) return null;

  const day = defaultDay(datatakes, sat, todayKey);
  if (!day) return null;

  const datatake = defaultDatatake(datatakes, sat, day);
  if (sat === current.satellite && day === current.day && datatake === current.datatake) return null;
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
