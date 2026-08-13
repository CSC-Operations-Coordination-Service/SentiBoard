/* The dashboard's time-range filter, shared by every Data Availability view so the three
   proposals cannot drift apart on what "Last 7 Days" means.

   Production puts this control in the top navigation, not on the page
   (apps/templates/includes/navigation-responsive.html → #time-period-select), which is what the
   page description means by "aligned with the time filter selected at the top of the page". The
   ids and labels below are that control's, verbatim; "custom" is ours, and is what the FROM/TO
   pickers switch the selector to when a date is typed by hand. */

export type PeriodId = "day" | "week" | "month" | "prev-quarter" | "custom";

export const PERIODS: { id: PeriodId; label: string; days: number }[] = [
  { id: "day", label: "Last 24 Hours", days: 1 },
  { id: "week", label: "Last 7 Days", days: 7 },
  { id: "month", label: "Last 30 Days", days: 30 },
  { id: "prev-quarter", label: "Last 3 Months", days: 92 },
];

/** Production opens on "Last 7 Days". */
export const DEFAULT_PERIOD: PeriodId = "week";

export const PERIOD_LABEL: Record<PeriodId, string> = {
  ...Object.fromEntries(PERIODS.map((p) => [p.id, p.label])),
  custom: "Custom range",
} as Record<PeriodId, string>;

const DAY_MS = 86_400_000;

/** The instant a period is measured back from. Its own function so a view can pass a fixed
 *  instant if it ever needs a stable one. */
export function anchorNow(): Date {
  return new Date();
}

/** Lower bound of a period, as a rolling window: "Last 24 Hours" is the 24 hours behind now, not
 *  today-so-far. Counting whole UTC days instead would make the shortest period mean "since
 *  midnight", which at 00:30 is half an hour of data under a label promising a day of it. */
export function periodStart(id: PeriodId, anchor: Date = anchorNow()): Date | null {
  const p = PERIODS.find((x) => x.id === id);
  if (!p) return null; // "custom" — the FROM/TO fields own the bounds instead
  return new Date(anchor.getTime() - p.days * DAY_MS);
}

/** Rows at or after the period's start. The upper bound is deliberately left open: this page is
 *  defined as the past three months PLUS everything scheduled to 23:59:59 of the following day,
 *  so the planned tail stays visible whichever period is chosen — narrowing to "Last 24 Hours"
 *  should not hide what is about to fly. */
export function inPeriod(when: Date, id: PeriodId, anchor: Date = anchorNow()): boolean {
  const from = periodStart(id, anchor);
  return from === null || when >= from;
}
