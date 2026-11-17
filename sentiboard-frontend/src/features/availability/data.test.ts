import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiDatatake } from "./adapter";

// Outside Next, cacheLife/cacheTag would throw and "use cache" is an inert string: the function
// under test runs uncached, which is what these tests want.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { getDatatakes, windowSlices } = await import("./data");

/** A hostname that cannot resolve: should a test ever reach the network, it fails. */
const BACKEND = "http://backend.invalid.test";

const record = (id: string, start: string): ApiDatatake => ({
  id,
  satellite_unit: "S2B",
  observation_time_start: start,
  observation_time_stop: new Date(Date.parse(start) + 5 * 60_000).toISOString(),
  instrument_mode: "NOBS",
  products: [],
  completeness: { L1: 100 },
  completeness_status: {
    acquisition: { status: "ACQUIRED", percentage: 100 },
    publication: { status: "PUBLISHED", percentage: 100 },
  },
  cams_tickets: [],
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("BACKEND_URL", BACKEND);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("windowSlices", () => {
  it("covers three months back to the end of tomorrow in slices of at most 31 days", () => {
    const slices = windowSlices("2026-11-17");
    expect(slices[0].from).toBe("2026-08-17T00:00:00.000Z");
    expect(slices.at(-1)!.to).toBe("2026-11-19T00:00:00.000Z");
    for (let i = 0; i < slices.length; i++) {
      const span = Date.parse(slices[i].to) - Date.parse(slices[i].from);
      expect(span).toBeGreaterThan(0);
      expect(span).toBeLessThanOrEqual(31 * 86_400_000);
      if (i > 0) expect(slices[i].from).toBe(slices[i - 1].to); // contiguous, no overlap
    }
    expect(slices).toHaveLength(4); // 94 days: 31 + 31 + 31 + 1
  });
});

describe("getDatatakes", () => {
  it("reads every slice and returns the adapted datatakes, oldest first", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const from = new URL(url).searchParams.get("date_from")!;
      return json(from.startsWith("2026-10-18") ? [record("b", "2026-11-16T10:00:00Z"), record("a", "2026-11-01T10:00:00Z")] : []);
    });

    const result = await getDatatakes("2026-11-17");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.datatakes.map((d) => d.id)).toEqual(["a", "b"]);
    expect(result.datatakes[0]).toMatchObject({ missionId: "S2", status: "Acquired", completeness: 100 });
    const paths = fetchMock.mock.calls.map(([u]) => new URL(u as string));
    expect(paths.every((u) => u.pathname === "/datatake/")).toBe(true);
    expect(paths).toHaveLength(windowSlices("2026-11-17").length);
  });

  it("degrades when the backend cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await getDatatakes("2026-11-17")).toMatchObject({ ok: false, kind: "unreachable" });
  });

  it("degrades on an HTTP error", async () => {
    fetchMock.mockResolvedValue(json({ detail: "the window may span at most 31 days" }, 422));
    expect(await getDatatakes("2026-11-17")).toMatchObject({ ok: false, kind: "http" });
  });
});
