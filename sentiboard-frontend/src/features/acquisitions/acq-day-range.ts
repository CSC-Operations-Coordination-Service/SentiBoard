import { DAY_MS } from "@/lib/missions";

/** Days before today that the calendar offers. The range is [today − ACQ_DAY_COUNT, today]
 *  inclusive (ACQ_DAY_COUNT + 1 days total). */
export const ACQ_DAY_COUNT = 15;

/** Returns the first (oldest) and last (today) YYYY-MM-DD keys and all YYYY-MM month
 *  strings covered by the range. */
export function acqDayRange(todayKey: string): { first: string; last: string; months: Set<string> } {
  const todayMs = Date.parse(`${todayKey}T00:00:00Z`);
  const firstMs = todayMs - ACQ_DAY_COUNT * DAY_MS;
  const first = new Date(firstMs).toISOString().slice(0, 10);
  const months = new Set<string>();
  for (let ms = firstMs; ms <= todayMs; ms += DAY_MS) {
    months.add(new Date(ms).toISOString().slice(0, 7));
  }
  return { first, last: todayKey, months };
}

/** True if dayKey is a valid YYYY-MM-DD in [today − ACQ_DAY_COUNT, today]. */
export function isValidAcqDay(dayKey: string, todayKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return false;
  const { first, last } = acqDayRange(todayKey);
  return dayKey >= first && dayKey <= last;
}

/** Returns dayRaw if it is a valid in-range YYYY-MM-DD, else todayKey. */
export function resolveAcqDay(dayRaw: string | null, todayKey: string): string {
  if (dayRaw && isValidAcqDay(dayRaw, todayKey)) return dayRaw;
  return todayKey;
}
