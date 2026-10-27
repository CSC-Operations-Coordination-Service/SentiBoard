/* The InstantMessages resource, server-side: backend → adapter → cached UI model.
   Mirrors the Events data layer (docs/memory/DECISIONS.md). A failure is never cached. */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, type ApiErrorKind } from "@/lib/api/client";
import { fetchAll } from "@/lib/api/paginate";
import { adaptInstantMessages } from "./adapter";
import type { InstantMessage } from "./adapter";

export type InstantMessagesResult =
  | { ok: true; items: InstantMessage[] }
  | { ok: false; kind: ApiErrorKind | "unknown"; message: string };

async function loadInstantMessages(): Promise<InstantMessage[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("instantmessages");

  const records = await fetchAll("/instantmessage/");
  return adaptInstantMessages(records);
}

/** Every adapted instant message, or the reason they could not be loaded. Never throws. */
export async function getInstantMessages(): Promise<InstantMessagesResult> {
  try {
    return { ok: true, items: await loadInstantMessages() };
  } catch (err) {
    console.error("[home] could not load instant messages:", err);
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}
