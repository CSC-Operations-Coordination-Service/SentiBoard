/* Runtime configuration of the chatbot integration, read from server-only env variables.

     CHATBOT_ENABLED     "true" turns the widget and the server action on; anything else = off
     CHATBOT_URL         base URL of the chatbot service (no trailing slash needed)
     CHATBOT_TIMEOUT_MS  how long to wait for one answer, default 60 000

   Read per call (not at import) and only from code that runs at request time, so the flag can be
   flipped with an environment change and a restart, without a rebuild. */

import "server-only";
import { logger } from "@/lib/log";

const log = logger("chat");

const DEFAULT_TIMEOUT_MS = 60_000;

let warnedMissingUrl = false;

/** Base URL of the chatbot, without trailing slashes, or null when unset. */
export function chatbotUrl(): string | null {
  const url = process.env.CHATBOT_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

/** True when CHATBOT_ENABLED is exactly "true" and CHATBOT_URL is set. A flag without a URL is
 *  treated as off, with one warning, so a half-configured deployment shows no broken widget. */
export function chatbotEnabled(): boolean {
  if (process.env.CHATBOT_ENABLED !== "true") return false;
  if (chatbotUrl()) return true;
  if (!warnedMissingUrl) {
    warnedMissingUrl = true;
    log.warn("CHATBOT_ENABLED is true but CHATBOT_URL is not set; the chatbot stays off");
  }
  return false;
}

/** Timeout for one chat request, in ms. Invalid or non-positive values fall back to the default. */
export function chatbotTimeoutMs(): number {
  const n = Number(process.env.CHATBOT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

/** For tests: forget that the missing-URL warning was logged. */
export function resetChatbotConfigWarnings(): void {
  warnedMissingUrl = false;
}
