/* The Processors resource, server-side: backend → adapter → sanitized UI model, cached for 300 s
   (docs/memory/DECISIONS.md). A failure is never cached: the cached scope throws, and only the
   uncached wrapper turns the error into the degraded result the page renders. */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, type ApiErrorKind } from "@/lib/api/client";
import { fetchAll } from "@/lib/api/paginate";
import { adaptProcessors } from "./adapter";
import type { ProcessorGroup, ProcessorNotes } from "./model";

export type ProcessorsResult =
  | {
      ok: true;
      groups: ProcessorGroup[];
      notes: ProcessorNotes;
      /** When the data was fetched (ms). The page's "now" — the current-baseline rule, the stats
       *  and the timeline's TODAY all use it, so server HTML and hydration agree. */
      now: number;
    }
  | { ok: false; kind: ApiErrorKind | "unknown"; message: string };

async function loadProcessors(): Promise<{
  groups: ProcessorGroup[];
  notes: ProcessorNotes;
  now: number;
}> {
  "use cache";
  // New releases appear within 5 minutes (stale-while-revalidate after `revalidate`).
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("processors");

  const records = await fetchAll("/processor/");
  const now = Date.now();
  const { groups, notes, unplaced } = adaptProcessors(records, now);
  if (unplaced.length) {
    console.warn(
      `[processors] ${unplaced.length} of ${records.length} releases have no target IPF and are not shown:`,
      unplaced.map((r) => r.id).join(", "),
    );
  }
  return { groups, notes, now };
}

/** Every processor with its releases, or the reason it could not be loaded. Never throws. */
export async function getProcessors(): Promise<ProcessorsResult> {
  try {
    return { ok: true, ...(await loadProcessors()) };
  } catch (err) {
    console.error("[processors] could not load releases:", err);
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}
