import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiProcessor } from "./adapter";

// Outside Next, cacheLife/cacheTag would throw and "use cache" is an inert string: the function
// under test runs uncached, which is what these tests want.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { getProcessors } = await import("./data");

/** A hostname that cannot resolve: should a test ever reach the network, it fails. */
const BACKEND = "http://backend.invalid.test";

const record = (i: number, over: Partial<ApiProcessor> = {}): ApiProcessor => ({
  id: `r${i}`,
  mission: "S1",
  satellite_units: ["S1A"],
  target_ipfs: ["S1_L0:1.0"],
  processing_baseline: null,
  release_date: null,
  validity_start_date: "2024-01-01T00:00:00Z",
  validity_end_date: null,
  release_notes: null,
  ...over,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("BACKEND_URL", `${BACKEND}/`);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("getProcessors — success", () => {
  it("returns the adapted groups, the notes and the fetch time", async () => {
    fetchMock.mockResolvedValueOnce(json([record(1, { release_notes: "<p>Notes</p>" })]));
    const before = Date.now();
    const result = await getProcessors();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.groups.map((g) => g.ipf)).toEqual(["S1_L0"]);
    expect(result.notes).toEqual({ r1: "<p>Notes</p>" });
    expect(result.now).toBeGreaterThanOrEqual(before);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("asks the backend for JSON, with a timeout, at BACKEND_URL without its trailing slash", async () => {
    fetchMock.mockResolvedValueOnce(json([]));
    await getProcessors();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BACKEND}/processor/?offset=0&limit=1000`);
    expect(init.headers).toEqual({ Accept: "application/json" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("reads the list page by page until a page comes back short", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => record(i));
    fetchMock.mockResolvedValueOnce(json(page1)).mockResolvedValueOnce(json([record(1000)]));
    const result = await getProcessors();

    expect(fetchMock.mock.calls.map(([url]) => new URL(url as string).search)).toEqual([
      "?offset=0&limit=1000",
      "?offset=1000&limit=1000",
    ]);
    expect(result.ok && result.groups[0].releases.length).toBe(1001);
  });

  it("warns about records that cannot be put on a lane, naming them", async () => {
    fetchMock.mockResolvedValueOnce(json([record(1), record(2, { target_ipfs: [] })]));
    const result = await getProcessors();
    expect(result.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0].join(" ")).toMatch(/1 of 2 releases have no target IPF.*r2/);
  });
});

describe("getProcessors — backend failures give the degraded result, never a throw", () => {
  it.each([
    ["a network error", () => Promise.reject(new TypeError("fetch failed")), "unreachable"],
    ["a timeout", () => Promise.reject(new DOMException("timed out", "TimeoutError")), "unreachable"],
    ["502 from a gateway", () => Promise.resolve(new Response("Bad Gateway", { status: 502 })), "unreachable"],
    ["503", () => Promise.resolve(new Response("", { status: 503 })), "unreachable"],
    ["504", () => Promise.resolve(new Response("", { status: 504 })), "unreachable"],
    ["500 from the backend", () => Promise.resolve(json({ detail: "boom" }, 500)), "http"],
    ["404", () => Promise.resolve(json({ detail: "Not Found" }, 404)), "http"],
    ["a 200 body that is not JSON", () => Promise.resolve(new Response("<html>oops</html>", { status: 200 })), "parse"],
  ])("%s → %s", async (_, respond, kind) => {
    fetchMock.mockImplementationOnce(respond);
    const result = await getProcessors();
    expect(result).toMatchObject({ ok: false, kind });
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("names the status in the message of an HTTP error", async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500));
    const result = await getProcessors();
    expect(!result.ok && result.message).toMatch(/HTTP 500/);
  });

  it("fails a later page the same way, not with a partial list", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => record(i));
    fetchMock.mockResolvedValueOnce(json(page1)).mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await getProcessors()).toMatchObject({ ok: false, kind: "unreachable" });
  });

  it("degrades, without calling fetch, when BACKEND_URL is not set", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const result = await getProcessors();
    expect(result).toMatchObject({ ok: false, kind: "unknown" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
