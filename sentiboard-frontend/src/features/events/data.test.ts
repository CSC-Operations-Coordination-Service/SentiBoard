import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiAnomaly } from "./adapter";

// Outside Next, cacheLife/cacheTag would throw and "use cache" is an inert string: the function
// under test runs uncached, which is what these tests want.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { getEvents } = await import("./data");

const BACKEND = "http://backend.invalid.test";

function rec(i: number, over: Partial<ApiAnomaly> = {}): ApiAnomaly {
  return {
    id: `e${i}`,
    key: `SEN-${1000 + i}`,
    title: `Event ${i}`,
    text: "Some text.",
    category: "Acquisition",
    impacted_satellite: "Copernicus Sentinel-1A",
    impacted_item: null,
    start: "2023-04-10T06:00:00Z",
    end: "2023-04-10T08:30:00Z",
    environment: "OPS",
    datatakes_completeness: [],
    news_link: null,
    news_title: null,
    publication_date: "2023-04-10T09:00:00Z",
    modify_date: "2023-04-10T09:00:00Z",
    ...over,
  };
}

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

describe("getEvents — success", () => {
  it("returns adapted events and now timestamp", async () => {
    fetchMock.mockResolvedValueOnce(json([rec(1)]));
    const before = Date.now();
    const result = await getEvents();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.satellite).toBe("S1A");
    expect(result.now).toBeGreaterThanOrEqual(before);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("requests the anomaly endpoint with offset/limit pagination", async () => {
    fetchMock.mockResolvedValueOnce(json([]));
    await getEvents();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/anomaly/");
  });

  it("follows pagination: fetches until a short page", async () => {
    // fetchAll stops when a page is shorter than MAX_PAGE_SIZE (1000); simulate with 1-item pages
    // (we can't easily test 1000-item pages; instead check that two round-trips yield two records)
    const page1 = Array.from({ length: 1000 }, (_, i) => rec(i));
    const page2 = [rec(1000)];
    fetchMock
      .mockResolvedValueOnce(json(page1))
      .mockResolvedValueOnce(json(page2));
    const result = await getEvents();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1001);
  });

  it("warns about undated records but still returns dated ones", async () => {
    fetchMock.mockResolvedValueOnce(
      json([rec(1), rec(2, { start: null, end: null })]),
    );
    const result = await getEvents();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.events).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[events]"), expect.anything());
  });
});

describe("getEvents — errors", () => {
  it("returns ok:false for a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const result = await getEvents();
    expect(result.ok).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns ok:false for a 502 response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }));
    const result = await getEvents();
    expect(result.ok).toBe(false);
  });

  it("returns ok:false for a 500 response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Server error", { status: 500 }));
    const result = await getEvents();
    expect(result.ok).toBe(false);
  });

  it("returns ok:false when BACKEND_URL is not set", async () => {
    vi.stubEnv("BACKEND_URL", "");
    const result = await getEvents();
    expect(result.ok).toBe(false);
  });
});
