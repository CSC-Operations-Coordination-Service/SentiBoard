import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import type { ChatInput } from "./actions";
import { MAX_CONTENT_CHARS, MAX_CONTEXT_BYTES, MAX_MESSAGES } from "./limits";

const postChat = vi.fn();
vi.mock("@/lib/chatbot/client", () => ({ postChat: (...a: unknown[]) => postChat(...a) }));

const { sendChatMessage, getChatData } = await import("./actions");

const SECRET = "my private question about S1A";
const ANSWER = {
  response: "An answer.",
  model_name: "test-model",
  request_id: "22222222-2222-4222-8222-222222222222",
  thread_id: "t",
  tool_calls: [{ tool: "search" }],
  token_usage: { input_tokens: 10, output_tokens: 5, steps: [] },
};

const valid = (): ChatInput => ({
  messages: [{ role: "user", content: SECRET }],
  context: { page_id: "events", filters: { url: "https://x.test/events" }, selection: null },
});

let logged: string[];

beforeEach(() => {
  vi.stubEnv("CHATBOT_ENABLED", "true");
  vi.stubEnv("CHATBOT_URL", "http://chatbot.invalid.test");
  postChat.mockReset();
  logged = [];
  for (const level of ["debug", "info", "warn", "error", "log"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

describe("sendChatMessage — flag", () => {
  it("refuses when the chatbot is disabled, without calling it", async () => {
    vi.stubEnv("CHATBOT_ENABLED", "false");
    await expect(sendChatMessage(valid())).resolves.toEqual({ ok: false, kind: "disabled" });
    expect(postChat).not.toHaveBeenCalled();
  });
});

describe("sendChatMessage — success", () => {
  it("forwards messages and context and returns the answer", async () => {
    postChat.mockResolvedValueOnce(ANSWER);
    const result = await sendChatMessage(valid());
    expect(result).toEqual({ ok: true, answer: "An answer.", requestId: ANSWER.request_id });
    expect(postChat).toHaveBeenCalledWith({
      messages: valid().messages,
      context: valid().context,
    });
  });

  it("sends a null context when none is given", async () => {
    postChat.mockResolvedValueOnce(ANSWER);
    await sendChatMessage({ messages: valid().messages });
    expect(postChat.mock.calls[0][0].context).toBeNull();
  });

  it("logs metadata but never the message text", async () => {
    postChat.mockResolvedValueOnce(ANSWER);
    await sendChatMessage(valid());
    const all = logged.join("\n");
    expect(all).toContain(ANSWER.request_id);
    expect(all).not.toContain(SECRET);
    expect(all).not.toContain("An answer.");
  });
});

describe("sendChatMessage — validation", () => {
  const cases: [string, unknown][] = [
    ["not an object", "hello"],
    ["no messages", { messages: [] }],
    ["too many messages", {
      messages: Array.from({ length: MAX_MESSAGES + 1 }, () => ({ role: "user", content: "x" })),
    }],
    ["a bad role", { messages: [{ role: "system", content: "x" }] }],
    ["an empty message", { messages: [{ role: "user", content: "   " }] }],
    ["a message too long", { messages: [{ role: "user", content: "x".repeat(MAX_CONTENT_CHARS + 1) }] }],
    ["an extra message field", { messages: [{ role: "user", content: "x", name: "y" }] }],
    ["last message from the assistant", { messages: [
      { role: "user", content: "x" },
      { role: "assistant", content: "y" },
    ] }],
    ["an extra context field", { ...valid(), context: { page_id: "events", url: "x" } }],
    ["a non-string page_id", { ...valid(), context: { page_id: 5 } }],
    ["a page_id too long", { ...valid(), context: { page_id: "p".repeat(65) } }],
    ["array filters", { ...valid(), context: { filters: [] } }],
    ["a string selection", { ...valid(), context: { selection: "x" } }],
    ["a context too large", {
      ...valid(),
      context: { filters: { blob: "x".repeat(MAX_CONTEXT_BYTES) } },
    }],
  ];

  it.each(cases)("rejects %s", async (_, input) => {
    await expect(sendChatMessage(input as ChatInput)).resolves.toEqual({
      ok: false,
      kind: "invalid",
    });
    expect(postChat).not.toHaveBeenCalled();
  });

  it("accepts a conversation with earlier assistant answers", async () => {
    postChat.mockResolvedValueOnce(ANSWER);
    const result = await sendChatMessage({
      messages: [
        { role: "user", content: "a" },
        { role: "assistant", content: "b" },
        { role: "user", content: "c" },
      ],
    });
    expect(result.ok).toBe(true);
  });
});

describe("sendChatMessage — failures", () => {
  it("maps an unreachable chatbot to unreachable", async () => {
    postChat.mockRejectedValueOnce(new ApiError("unreachable", "http://c/chat", undefined, undefined, "Chatbot"));
    await expect(sendChatMessage(valid())).resolves.toEqual({ ok: false, kind: "unreachable" });
  });

  it("maps other failures to error", async () => {
    postChat.mockRejectedValueOnce(new ApiError("http", "http://c/chat", 422, undefined, "Chatbot"));
    await expect(sendChatMessage(valid())).resolves.toEqual({ ok: false, kind: "error" });
    postChat.mockRejectedValueOnce(new Error("boom"));
    await expect(sendChatMessage(valid())).resolves.toEqual({ ok: false, kind: "error" });
  });
});

// ---------------------------------------------------------------------------
// getChatData
// ---------------------------------------------------------------------------

const VALID_DATA_ID = "artifact_abc123";
const VALID_REQUEST_ID = "22222222-2222-4222-8222-222222222222";

const TABULAR_BODY = {
  data_id: VALID_DATA_ID,
  title: "Test table",
  description: "desc",
  columns: ["status", "mission"],
  rows: [{ status: "Missing", mission: "S3" }],
};

const CALENDAR_BODY = {
  data_id: VALID_DATA_ID,
  title: "Events",
  description: "desc",
  events: [
    {
      key: "evt-1",
      occurred_at: "2026-07-01T00:00:00Z",
      title: "An event",
      description: "",
      category: "satellite",
      category_basis: "native_origin",
      origin: null,
      status: null,
      criticality: null,
      affected_systems: [],
      datatake_ids: [],
      associated_datatake_count: 0,
    },
  ],
};

describe("getChatData — flag and validation", () => {
  it("returns disabled when chatbot is off", async () => {
    vi.stubEnv("CHATBOT_ENABLED", "false");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const result = await getChatData(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid for a dataId that does not match ^artifact_[A-Za-z0-9]+$", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const bad of ["", "artifact_bad!", "not_artifact_prefix", "artifact_"]) {
      const result = await getChatData(bad, VALID_REQUEST_ID);
      expect(result, `expected invalid for dataId "${bad}"`).toEqual({ ok: false, reason: "invalid" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns invalid for a requestId that is not a UUID", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const bad of ["", "not-a-uuid", "12345", "22222222222242228222222222222222"]) {
      const result = await getChatData(VALID_DATA_ID, bad);
      expect(result, `expected invalid for requestId "${bad}"`).toEqual({ ok: false, reason: "invalid" });
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getChatData — HTTP errors", () => {
  it("returns not_found on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) }));
    await expect(getChatData(VALID_DATA_ID, VALID_REQUEST_ID)).resolves.toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("returns unavailable on 502/503/504 or other non-2xx", async () => {
    for (const status of [502, 503, 504, 500]) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status, json: async () => ({}) }));
      const r = await getChatData(VALID_DATA_ID, VALID_REQUEST_ID);
      expect(r, `status ${status}`).toEqual({ ok: false, reason: "unavailable" });
    }
  });

  it("returns unavailable on network error (fetch throws)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new TypeError("network error")));
    await expect(getChatData(VALID_DATA_ID, VALID_REQUEST_ID)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("returns unavailable on timeout (AbortError with name TimeoutError)", async () => {
    const err = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(err));
    await expect(getChatData(VALID_DATA_ID, VALID_REQUEST_ID)).resolves.toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("returns invalid when the 2xx body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError("bad JSON"); },
    }));
    await expect(getChatData(VALID_DATA_ID, VALID_REQUEST_ID)).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("returns invalid when the shape has neither columns nor events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data_id: VALID_DATA_ID, title: "X", description: "" }),
    }));
    await expect(getChatData(VALID_DATA_ID, VALID_REQUEST_ID)).resolves.toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("getChatData — success", () => {
  it("returns tabular when the body has columns", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => TABULAR_BODY,
    }));
    const result = await getChatData(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(result).toEqual({ ok: true, kind: "tabular", data: TABULAR_BODY });
  });

  it("returns event-calendar when the body has events", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => CALENDAR_BODY,
    }));
    const result = await getChatData(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(result).toMatchObject({ ok: true, kind: "event-calendar" });
  });

  it("logs data_id and duration, never row contents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => TABULAR_BODY,
    }));
    await getChatData(VALID_DATA_ID, VALID_REQUEST_ID);
    const all = logged.join("\n");
    expect(all).toContain(VALID_DATA_ID);
    expect(all).not.toContain("Missing"); // row cell value
    expect(all).not.toContain("S3");      // row cell value
  });
});
