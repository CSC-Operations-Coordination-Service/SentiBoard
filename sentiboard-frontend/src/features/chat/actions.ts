"use server";

/* The only way the browser reaches the chatbot: a Server Action that checks the flag, validates
   the input (an action is a public endpoint, callable without the widget), forwards the
   conversation and page context to the chatbot, and returns a result that never throws.

   Logs carry the request id, model, duration and token totals, never the message text. */

import { ApiError } from "@/lib/api/client";
import { chatbotEnabled } from "@/lib/chatbot/config";
import { postChat, type ChatMessage, type SentiBoardContext } from "@/lib/chatbot/client";
import { logger } from "@/lib/log";
import {
  MAX_CONTENT_CHARS,
  MAX_CONTEXT_BYTES,
  MAX_MESSAGES,
  MAX_PAGE_ID_CHARS,
} from "./limits";

const log = logger("chat");

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
