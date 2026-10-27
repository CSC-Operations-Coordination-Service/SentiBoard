/* The Events resource, server-side: backend → adapter → cached UI model.
   Mirrors the Processors data layer (docs/memory/DECISIONS.md). A failure is never cached. */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, type ApiErrorKind } from "@/lib/api/client";
import { fetchAll } from "@/lib/api/paginate";
import { adaptEvents } from "./adapter";
import type { EventDetail } from "./model";

export type EventsResult =
  | { ok: true; events: EventDetail[]; now: number }
  | { ok: false; kind: ApiErrorKind | "unknown"; message: string };

async function loadEvents(): Promise<{ events: EventDetail[]; now: number }> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("events");

  const records = await fetchAll("/anomaly/");
  const now = Date.now();
  const { events, unresolved } = adaptEvents(records);
  if (unresolved.length) {
    console.warn(
      `[events] ${unresolved.length} of ${records.length} anomalies have no valid dates and are not shown:`,
      unresolved.slice(0, 10).join(", "),
    );
  }
  return { events, now };
}

/** Every adapted event, or the reason it could not be loaded. Never throws. */
export async function getEvents(): Promise<EventsResult> {
  try {
    return { ok: true, ...(await loadEvents()) };
  } catch (err) {
    console.error("[events] could not load anomalies:", err);
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}
