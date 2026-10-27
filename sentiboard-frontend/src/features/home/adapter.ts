/* Backend Instantmessage records → InstantMessage UI model. Server-only.
   Sorted by publication_date descending (the API has no sort parameter).
   Only the fields shown by the news bar (Decision 5 in home-prototype-ref.md §11) are kept:
   title and the publication date formatted as "D Mon YYYY" + "HH:MM" in UTC.
   Records with a null publication_date are excluded and logged. */

import "server-only";
import type { components } from "@/lib/api/schema";
import { utcDayMonthYearStr, utcTimeStr } from "@/lib/utc-date";

export type ApiInstantMessage = components["schemas"]["Instantmessage"];

/** Maximum number of instant messages shown in the news bar. */
export const MAX_NEWS = 5;

export interface InstantMessage {
  title: string;
  date: string; // "D Mon YYYY", e.g. "20 Jul 2026"
  time: string; // "HH:MM" in UTC
}

export function adaptInstantMessages(records: ApiInstantMessage[]): InstantMessage[] {
  const dated: { ms: number; item: InstantMessage }[] = [];
  let nullCount = 0;

  for (const r of records) {
    if (!r.publication_date) {
      nullCount++;
      continue;
    }
    dated.push({
      ms: new Date(r.publication_date).getTime(),
      item: {
        title: r.title,
        date: utcDayMonthYearStr(r.publication_date),
        time: utcTimeStr(r.publication_date),
      },
    });
  }

  if (nullCount > 0) {
    console.info(
      `[home] ${nullCount} instant message${nullCount === 1 ? "" : "s"} have no publication_date and are not shown.`,
    );
  }

  dated.sort((a, b) => b.ms - a.ms);
  return dated.slice(0, MAX_NEWS).map((d) => d.item);
}
