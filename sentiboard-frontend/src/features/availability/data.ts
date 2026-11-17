/* The Data Availability resource, server-side: backend GET /datatake/ → adapter → cached model.
   Mirrors the Processors/Events/Acquisitions data layer (docs/memory/DECISIONS.md). A failure is
   never cached. connection() is called by AvailabilityData in page.tsx before this runs. */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, type ApiErrorKind } from "@/lib/api/client";
import { fetchAll } from "@/lib/api/paginate";
import { logger } from "@/lib/log";
import { DAY_MS } from "@/lib/missions";
import { adaptDatatakes } from "./adapter";
import { computeDataWindow, type Datatake } from "./model";

export type DatatakesResult =
  | { ok: true; datatakes: Datatake[] }
  | { ok: false; kind: ApiErrorKind | "unknown"; message: string };

const log = logger("availability");

/** The backend serves at most 31 days per request. */
const MAX_SLICE_MS = 31 * DAY_MS;

/** The page's window for `dayKey` (YYYY-MM-DD, UTC) as [from, to) ISO strings, cut into slices
 *  the backend accepts: three months back to the end of tomorrow (model.ts computeDataWindow). */
export function windowSlices(dayKey: string): { from: string; to: string }[] {
  const { windowStart, windowLast } = computeDataWindow(new Date(`${dayKey}T12:00:00Z`));
  const end = windowLast.getTime() + 1000; // windowLast is 23:59:59 → exclusive midnight
  const slices: { from: string; to: string }[] = [];
  for (let t = windowStart.getTime(); t < end; t += MAX_SLICE_MS) {
    slices.push({
      from: new Date(t).toISOString(),
      to: new Date(Math.min(t + MAX_SLICE_MS, end)).toISOString(),
    });
  }
  return slices;
}

async function loadDatatakes(dayKey: string): Promise<Datatake[]> {
  "use cache";
  // Statuses move (PROCESSING → PUBLISHED) within hours: refresh as the other data pages do.
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("datatakes");

  const records = [];
  for (const { from, to } of windowSlices(dayKey)) {
    // One slice at a time: the backend builds each window once and pages it from memory.
    records.push(...(await fetchAll("/datatake/", { date_from: from, date_to: to })));
  }
  const { datatakes, skipped } = adaptDatatakes(records);
  if (skipped.length) {
    log.warn(`${skipped.length} of ${records.length} datatakes have no satellite or times and are not shown`, {
      ids: skipped.slice(0, 10),
    });
  }
  return datatakes;
}

/** Every datatake of the page's window, or the reason they could not be loaded. Never throws. */
export async function getDatatakes(dayKey: string): Promise<DatatakesResult> {
  try {
    return { ok: true, datatakes: await loadDatatakes(dayKey) };
  } catch (err) {
    log.error("could not load datatakes", { err });
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}
