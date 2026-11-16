import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { postChat, type ChatRequest, type ChatResponse } from "./client";

const CHATBOT = "http://chatbot.invalid.test";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const REQUEST: ChatRequest = {
  messages: [{ role: "user", content: "What is shown here?" }],
  context: { page_id: "events", filters: { url: "https://x.test/events" }, selection: null },
};

const ANSWER: ChatResponse = {
  response: "The events calendar.",
  model_name: "test-model",
  request_id: "11111111-1111-4111-8111-111111111111",
  thread_id: "t-1",
  tool_calls: [],
  token_usage: null,
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("CHATBOT_URL", `${CHATBOT}//`);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const err = await promise.catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  return err as ApiError;
}

describe("postChat", () => {
  it("POSTs the request as JSON to /chat and returns the answer", async () => {
    fetchMock.mockResolvedValueOnce(json(ANSWER));
    await expect(postChat(REQUEST)).resolves.toEqual(ANSWER);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CHATBOT}/chat`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(REQUEST);
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // Tracing is off in tests: no traceparent, and nothing breaks.
    expect(init.headers).not.toHaveProperty("traceparent");
  });

  it("maps a network error to unreachable", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    const err = await failure(postChat(REQUEST));
    expect(err.kind).toBe("unreachable");
    expect(err.message).toMatch(/^Chatbot unreachable/);
  });

  it.each([502, 503, 504])("maps a gateway %i to unreachable", async (status) => {
    fetchMock.mockResolvedValueOnce(json({}, status));
    expect((await failure(postChat(REQUEST))).kind).toBe("unreachable");
  });

  it("maps 422 (contract mismatch) to http", async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: [] }, 422));
    const err = await failure(postChat(REQUEST));
    expect(err.kind).toBe("http");
    expect(err.status).toBe(422);
    expect(err.message).toMatch(/^Chatbot returned HTTP 422/);
  });

  it("maps a non-JSON body to parse", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect((await failure(postChat(REQUEST))).kind).toBe("parse");
  });

  it("fails without calling anything when CHATBOT_URL is unset", async () => {
    vi.stubEnv("CHATBOT_URL", "");
    await expect(postChat(REQUEST)).rejects.toThrow(/CHATBOT_URL is not set/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
