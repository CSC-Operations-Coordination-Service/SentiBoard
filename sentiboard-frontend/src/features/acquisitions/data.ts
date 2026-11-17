/* The Acquisitions resource, server-side: backend → adapter → cached raw page model.
   Mirrors the Processors/Events data layer (docs/memory/DECISIONS.md). A failure is never cached.

   Three generic backend reads, shaped for the page by adapter.ts:
     GET /datatake/          datatakes sensed in the window, with completeness and status
     GET /acquisition-pass/  downlink passes, to name each datatake's station (optional)
     GET /orbit/             TLEs, to place each datatake on the globe
   Ground stations are fixed positions in stations.ts, not served by the backend. */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, apiGet, type ApiErrorKind } from "@/lib/api/client";
import { fetchAll } from "@/lib/api/paginate";
import { DAY_MS } from "@/lib/missions";
import { logger } from "@/lib/log";
import { buildDatatakes, type ApiAcquisitionPass, type RawAcqDatatake } from "./adapter";
import { COPERNICUS_STATIONS } from "./stations";
import type { Station } from "./types";

export type AcquisitionsResult =
  | { ok: true; datatakes: RawAcqDatatake[]; stations: Station[] }
  | { ok: false; kind: ApiErrorKind | "unknown"; message: string };

const log = logger("acquisitions");

/** Passes are read this long past the window, so a datatake sensed late on the last day still
 *  finds its downlink (adapter.ts: DOWNLINK_WITHIN_MS). */
const PASS_LOOKAHEAD_MS = 12 * 3600 * 1000;

/** The page's window for `dayKey` (YYYY-MM-DD, UTC): the day before and the day itself, as in
 *  model.ts computeAcqWindow. */
export function acqWindow(dayKey: string): { from: string; to: string } {
  const dayStart = Date.parse(`${dayKey}T00:00:00Z`);
  return {
    from: new Date(dayStart - DAY_MS).toISOString(),
    to: new Date(dayStart + DAY_MS).toISOString(),
  };
}

async function loadPasses(from: string, to: string): Promise<ApiAcquisitionPass[]> {
  try {
    return await fetchAll("/acquisition-pass/", { date_from: from, date_to: to });
  } catch (err) {
    // Only the downlink-station label depends on passes: the page still renders without it.
    log.warn("could not load acquisition passes; stations are not named", { err });
    return [];
  }
}

async function loadAcquisitions(
  dayKey: string,
): Promise<{ datatakes: RawAcqDatatake[]; stations: Station[] }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("acquisitions");

  const { from, to } = acqWindow(dayKey);
  const passTo = new Date(Date.parse(to) + PASS_LOOKAHEAD_MS).toISOString();
  const [records, passes, orbits] = await Promise.all([
    fetchAll("/datatake/", { date_from: from, date_to: to }),
    loadPasses(from, passTo),
    apiGet("/orbit/"),
  ]);

  const { datatakes, skipped } = buildDatatakes(records, passes, orbits);
  if (skipped.length) {
    log.warn(`${skipped.length} of ${records.length} datatakes cannot be placed and are not shown`, {
      skipped: skipped.slice(0, 10),
    });
  }
  return { datatakes, stations: COPERNICUS_STATIONS };
}

/** The window's datatakes and the ground stations, or the reason they could not be loaded.
 *  Never throws. */
export async function getAcquisitions(dayKey: string): Promise<AcquisitionsResult> {
  try {
    return { ok: true, ...(await loadAcquisitions(dayKey)) };
  } catch (err) {
    log.error("could not load acquisitions", { err });
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}
