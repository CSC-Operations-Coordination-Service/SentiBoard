"use server";

/* The only way the browser reaches the chatbot: a Server Action that checks the flag, validates
   the input (an action is a public endpoint, callable without the widget), forwards the
   conversation and page context to the chatbot, and returns a result that never throws.

   Logs carry the request id, model, duration and token totals, never the message text. */

import { ApiError } from "@/lib/api/client";
import { chatbotEnabled, chatbotUrl } from "@/lib/chatbot/config";
import { postChat, type ChatMessage, type SentiBoardContext } from "@/lib/chatbot/client";
import { logger } from "@/lib/log";
import {
  MAX_CONTENT_CHARS,
  MAX_CONTEXT_BYTES,
  MAX_MESSAGES,
  MAX_PAGE_ID_CHARS,
} from "./limits";
import { parseEventCalendar } from "./event-calendar";
import type { TabularPayload, EventCalendarPayload } from "./types";

const log = logger("chat");

const DATA_TIMEOUT_MS = 15_000;
const DATA_ID_RE = /^artifact_[A-Za-z0-9]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ChatInput {
  messages: ChatMessage[];
  context?: SentiBoardContext | null;
}

export type ChatResult =
  | { ok: true; answer: string; requestId: string }
  | { ok: false; kind: "disabled" | "invalid" | "unreachable" | "error" };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

function validMessages(v: unknown): v is ChatMessage[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_MESSAGES) return false;
  const shapeOk = v.every(
    (m) =>
      isPlainObject(m) &&
      Object.keys(m).every((k) => k === "role" || k === "content") &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.trim().length > 0 &&
      m.content.length <= MAX_CONTENT_CHARS,
  );
  return shapeOk && v[v.length - 1].role === "user";
}

function validContext(v: unknown): v is SentiBoardContext | null | undefined {
  if (v === null || v === undefined) return true;
  if (!isPlainObject(v)) return false;
  if (!Object.keys(v).every((k) => k === "page_id" || k === "filters" || k === "selection")) {
    return false;
  }
  const { page_id, filters, selection } = v;
  if (page_id != null && (typeof page_id !== "string" || page_id.length > MAX_PAGE_ID_CHARS)) {
    return false;
  }
  if (filters !== undefined && !isPlainObject(filters)) return false;
  if (selection != null && !isPlainObject(selection)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(v)).length <= MAX_CONTEXT_BYTES;
  } catch {
    return false; // not serialisable
  }
}

export type ChatDataResult =
  | { ok: true; kind: "tabular"; data: TabularPayload }
  | { ok: true; kind: "event-calendar"; data: EventCalendarPayload }
  | { ok: false; reason: "not_found" | "unavailable" | "invalid" | "disabled" };

function parseTabularPayload(json: unknown): TabularPayload | null {
  if (!isPlainObject(json)) return null;
  if (typeof json.data_id !== "string" || !json.data_id) return null;
  if (typeof json.title !== "string") return null;
  if (!Array.isArray(json.columns)) return null;
  if (!(json.columns as unknown[]).every((c) => typeof c === "string")) return null;
  if (!Array.isArray(json.rows)) return null;
  if (!(json.rows as unknown[]).every((r) => isPlainObject(r))) return null;
  return {
    data_id: json.data_id as string,
    title: json.title as string,
    description: typeof json.description === "string" ? json.description : "",
    columns: json.columns as string[],
    rows: json.rows as Record<string, unknown>[],
  };
}

/** Fetch the data payload behind a marker.  Returns, never throws.
 *  Logs data_id, status and duration; never row contents. */
export async function getChatData(
  dataId: string,
  requestId: string,
): Promise<ChatDataResult> {
  if (!chatbotEnabled()) return { ok: false, reason: "disabled" };
  if (!DATA_ID_RE.test(dataId) || !UUID_RE.test(requestId)) {
    return { ok: false, reason: "invalid" };
  }

  const base = chatbotUrl();
  if (!base) return { ok: false, reason: "disabled" };

  const url = `${base}/chat/data/${dataId}?request_id=${encodeURIComponent(requestId)}`;
  const started = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      signal: AbortSignal.timeout(DATA_TIMEOUT_MS),
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    log.warn("chat data fetch failed", {
      data_id: dataId,
      status: isTimeout ? "timeout" : "error",
      duration_ms: Date.now() - started,
    });
    return { ok: false, reason: "unavailable" };
  }

  log.info("chat data fetched", {
    data_id: dataId,
    status: res.status,
    duration_ms: Date.now() - started,
  });

  if (res.status === 404) return { ok: false, reason: "not_found" };
  if (!res.ok) return { ok: false, reason: "unavailable" };

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (isPlainObject(json) && "columns" in json) {
    const payload = parseTabularPayload(json);
    if (!payload) return { ok: false, reason: "invalid" };
    return { ok: true, kind: "tabular", data: payload };
  }

  if (isPlainObject(json) && "events" in json) {
    const result = parseEventCalendar(json);
    if (!result.ok) return { ok: false, reason: "invalid" };
    return { ok: true, kind: "event-calendar", data: result.data };
  }

  return { ok: false, reason: "invalid" };
}

/** Send the conversation (last message = the new question) and the page context. */
export async function sendChatMessage(input: ChatInput): Promise<ChatResult> {
  if (!chatbotEnabled()) return { ok: false, kind: "disabled" };
  if (!isPlainObject(input) || !validMessages(input.messages) || !validContext(input.context)) {
    return { ok: false, kind: "invalid" };
  }

  const messages = input.messages.map(({ role, content }) => ({ role, content }));
  const started = Date.now();
  try {
    const res = await postChat({ messages, context: input.context ?? null });
    log.info("chat answered", {
      request_id: res.request_id,
      model: res.model_name,
      page_id: input.context?.page_id ?? null,
      messages: messages.length,
      tool_calls: res.tool_calls?.length ?? 0,
      input_tokens: res.token_usage?.input_tokens ?? null,
      output_tokens: res.token_usage?.output_tokens ?? null,
      duration_ms: Date.now() - started,
    });
    return { ok: true, answer: res.response, requestId: res.request_id };
  } catch (err) {
    log.warn("chat failed", { err, duration_ms: Date.now() - started });
    if (err instanceof ApiError && err.kind === "unreachable") {
      return { ok: false, kind: "unreachable" };
    }
    return { ok: false, kind: "error" };
  }
}
