/* Server-side client for the chatbot service (contract in api/chatbot-openapi.json, types
   generated into ./schema.d.ts by `pnpm gen:api`). Server-only: the chatbot has no
   authentication, so its URL must never reach the browser.

   Failures surface as ApiError (src/lib/api/client.ts) with the same kinds as the backend:
     · "unreachable" — network error, timeout, or a gateway answering 502-504
     · "http"        — any other non-2xx status (422 = the request did not match the contract)
     · "parse"       — a 2xx body that is not JSON */

import "server-only";
import { context, propagation } from "@opentelemetry/api";
import { ApiError } from "@/lib/api/client";
import { chatbotTimeoutMs, chatbotUrl } from "./config";
import type { components } from "./schema";

export type ChatRequest = components["schemas"]["ChatRequest"];
export type ChatResponse = components["schemas"]["ChatResponse"];
export type ChatMessage = components["schemas"]["ChatMessage"];
export type SentiBoardContext = components["schemas"]["SentiBoardContext"];

const SERVICE = "Chatbot";
const GATEWAY_DOWN = new Set([502, 503, 504]);

/** Ask the chatbot for one answer to the last user message of `body.messages`. */
export async function postChat(body: ChatRequest): Promise<ChatResponse> {
  const base = chatbotUrl();
  if (!base) throw new Error("CHATBOT_URL is not set (see .env.sample)");
  const url = `${base}/chat`;

  // W3C trace context, so an instrumented chatbot joins this request's trace.
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  propagation.inject(context.active(), headers);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(chatbotTimeoutMs()),
      cache: "no-store",
    });
  } catch (err) {
    throw new ApiError("unreachable", url, undefined, err, SERVICE);
  }

  if (!res.ok) {
    const kind = GATEWAY_DOWN.has(res.status) ? "unreachable" : "http";
    throw new ApiError(kind, url, res.status, undefined, SERVICE);
  }

  try {
    return (await res.json()) as ChatResponse;
  } catch (err) {
    throw new ApiError("parse", url, res.status, err, SERVICE);
  }
}
