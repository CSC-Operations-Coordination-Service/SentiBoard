/* The InstantMessages resource, server-side: backend → adapter → cached UI model.
   Mirrors the Events data layer (docs/memory/DECISIONS.md). A failure is never cached. */

import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { ApiError, type ApiErrorKind } from "@/lib/api/client";
import { logger } from "@/lib/log";
import { fetchAll } from "@/lib/api/paginate";
import { adaptInstantMessages, MAX_NEWS } from "./adapter";
import type { InstantMessage } from "./adapter";

export type InstantMessagesResult =
  | { ok: true; items: InstantMessage[] }
  | { ok: false; kind: ApiErrorKind | "unknown"; message: string };

/** Fetches and adapts all instant messages; result is cached 5 min stale / 1 h expire.
 *  Returns all items sorted newest-first with no limit — callers slice as needed. */
export async function loadInstantMessages(): Promise<InstantMessage[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag("instantmessages");

  const records = await fetchAll("/instantmessage/");
  return adaptInstantMessages(records);
}

/** Up to MAX_NEWS instant messages for the home news bar, or the reason they could not be loaded. Never throws. */
export async function getInstantMessages(): Promise<InstantMessagesResult> {
  try {
    const all = await loadInstantMessages();
    return { ok: true, items: all.slice(0, MAX_NEWS) };
  } catch (err) {
    logger("home").error("could not load instant messages", { err });
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}

/** All instant messages for the news page, or the reason they could not be loaded. Never throws. */
export async function getAllInstantMessages(): Promise<InstantMessagesResult> {
  try {
    return { ok: true, items: await loadInstantMessages() };
  } catch (err) {
    logger("home").error("could not load instant messages", { err });
    if (err instanceof ApiError) return { ok: false, kind: err.kind, message: err.message };
    return { ok: false, kind: "unknown", message: "Unexpected error." };
  }
}
