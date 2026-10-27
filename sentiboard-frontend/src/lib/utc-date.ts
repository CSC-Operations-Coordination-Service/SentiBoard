/* Shared UTC date/time formatting helpers used by server-side adapters.
   Pure functions; not server-only so they can be tested in plain Node. */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" in UTC — used by the events adapter for startDate / startDay keys. */
export function utcDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "HH:MM" in UTC. */
export function utcTimeStr(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "D Mon YYYY" in UTC, e.g. "20 Jul 2026" — used by the home news bar. */
export function utcDayMonthYearStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
