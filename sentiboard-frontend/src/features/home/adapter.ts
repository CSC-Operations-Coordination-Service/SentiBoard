/* Backend Instantmessage records → InstantMessage UI model. Server-only.
   Sorted by publication_date descending (the API has no sort parameter).
   Records with a null publication_date are excluded and logged. */

import "server-only";
import type { components } from "@/lib/api/schema";
import { logger } from "@/lib/log";
import { utcDayMonthYearStr, utcTimeStr, utcNewsHeaderDate } from "@/lib/utc-date";
import { normalizeNewsText } from "@/features/news/news-format";

export type ApiInstantMessage = components["schemas"]["Instantmessage"];

/** Maximum number of instant messages shown in the home news bar. */
export const MAX_NEWS = 5;

export interface InstantMessage {
  id: string;          // r.id ?? String(loop-index)
  title: string;
  text: string;        // normalised body text (normalizeNewsText)
  link: string;        // may be ""
  messageType: string; // raw lowercase value from backend
  date: string;        // "D Mon YYYY" UTC — ticker
  time: string;        // "HH:MM" UTC — ticker
  headerDate: string;  // "DD-Mon-YYYY at HH:MM" UTC — card header
}

export function adaptInstantMessages(records: ApiInstantMessage[]): InstantMessage[] {
  const dated: { ms: number; item: InstantMessage }[] = [];
  let nullCount = 0;

  for (let i = 0; i < records.length; i++) {
    const r = records[i]!;
    if (!r.publication_date) {
      nullCount++;
      continue;
    }
    dated.push({
      ms: new Date(r.publication_date).getTime(),
      item: {
        id: r.id ?? String(i),
        title: r.title,
        text: normalizeNewsText(r.text),
        link: r.link,
        messageType: r.message_type,
        date: utcDayMonthYearStr(r.publication_date),
        time: utcTimeStr(r.publication_date),
        headerDate: utcNewsHeaderDate(r.publication_date),
      },
    });
  }

  if (nullCount > 0) {
    logger("home").info(
      `${nullCount} instant message${nullCount === 1 ? "" : "s"} have no publication_date and are not shown.`,
    );
  }

  dated.sort((a, b) => b.ms - a.ms);
  return dated.slice(0, MAX_NEWS).map((d) => d.item);
}
