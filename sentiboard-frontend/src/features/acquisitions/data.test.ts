import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiAcquisitionPass, ApiDatatake, ApiOrbit } from "./adapter";

// Outside Next, cacheLife/cacheTag would throw and "use cache" is an inert string: the function
// under test runs uncached, which is what these tests want.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

const { acqWindow, getAcquisitions } = await import("./data");

/** A hostname that cannot resolve: should a test ever reach the network, it fails. */
const BACKEND = "http://backend.invalid.test";

const ORBIT: ApiOrbit = {
  name: "SENTINEL-1A",
  satellite_unit: "S1A",
  norad_id: "39634",
  epoch: "2026-11-17T04:06:03Z",
  line1: "1 39634U 14016A   26321.17087910  .00000593  00000+0  13269-3 0  9994",
  line2: "2 39634  98.1586 326.2825 0001348  88.0012 272.1343 14.60165340672330",
};

const DATATAKE: ApiDatatake = {
  id: "S1A-1",
  mission: "S1",
  satellite_unit: "S1A",
  observation_time_start: "2026-11-17T06:00:00Z",
  observation_time_stop: "2026-11-17T06:02:00Z",
  instrument_mode: "IW",
  products: [{ product_type: "IW_RAW__0S", product_level: "L0", percentage: 100 }],
  completeness: { L0: 100 },
  completeness_status: {
    acquisition: { status: "ACQUIRED", percentage: 100 },
    publication: { status: "PUBLISHED", percentage: 100 },
  },
  cams_tickets: [],
};

const PASS: ApiAcquisitionPass = {
  id: "p1",
  satellite_id: "S1A",
  ground_station: "NSG",
  downlink_start: "2026-11-17T06:20:00Z",
  downlink_stop: "2026-11-17T06:30:00Z",
  cams_tickets: [],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Routes = Partial<Record<"/datatake/" | "/acquisition-pass/" | "/orbit/", () => Response>>;

let fetchMock: ReturnType<typeof vi.fn>;

function serve(routes: Routes) {
  fetchMock.mockImplementation(async (url: string) => {
    const path = new URL(url).pathname as keyof Routes;
    const route = routes[path];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route();
  });
}

const ok: Routes = {
  "/datatake/": () => json([DATATAKE]),
  "/acquisition-pass/": () => json([PASS]),
  "/orbit/": () => json([ORBIT]),
};

beforeEach(() => {
  vi.stubEnv("BACKEND_URL", BACKEND);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("acqWindow", () => {
  it("covers the day before and the day itself", () => {
    expect(acqWindow("2026-11-17")).toEqual({
      from: "2026-11-16T00:00:00.000Z",
      to: "2026-11-18T00:00:00.000Z",
    });
  });
});

describe("getAcquisitions", () => {
  it("returns placed datatakes with their station, and the fixed stations", async () => {
    serve(ok);
    const result = await getAcquisitions("2026-11-17");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.datatakes.map((d) => [d.id, d.station, d.status])).toEqual([
      ["S1A-1", "Neustrelitz", "Published"],
    ]);
    expect(result.stations.map((s) => s.name)).toContain("Svalbard");
  });

  it("asks for the window, and for passes 12 h past it", async () => {
    serve(ok);
    await getAcquisitions("2026-11-17");
    const urls = fetchMock.mock.calls.map(([u]) => new URL(u as string));
    const dt = urls.find((u) => u.pathname === "/datatake/")!;
    expect(dt.searchParams.get("date_from")).toBe("2026-11-16T00:00:00.000Z");
    expect(dt.searchParams.get("date_to")).toBe("2026-11-18T00:00:00.000Z");
    expect(dt.searchParams.get("limit")).toBe("1000");
    const ps = urls.find((u) => u.pathname === "/acquisition-pass/")!;
    expect(ps.searchParams.get("date_to")).toBe("2026-11-18T12:00:00.000Z");
  });

  it("still renders, without station names, when passes fail", async () => {
    serve({ ...ok, "/acquisition-pass/": () => json({ detail: "boom" }, 500) });
    const result = await getAcquisitions("2026-11-17");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.datatakes[0].station).toBe("");
  });

  it("degrades when orbits are unavailable", async () => {
    serve({ ...ok, "/orbit/": () => json({ detail: "Orbit data unavailable" }, 503) });
    const result = await getAcquisitions("2026-11-17");
    expect(result).toMatchObject({ ok: false, kind: "unreachable" });
  });

  it("degrades when datatakes fail", async () => {
    serve({ ...ok, "/datatake/": () => json({ detail: "bad" }, 422) });
    const result = await getAcquisitions("2026-11-17");
    expect(result).toMatchObject({ ok: false, kind: "http" });
  });

  it("degrades when the backend cannot be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const result = await getAcquisitions("2026-11-17");
    expect(result).toMatchObject({ ok: false, kind: "unreachable" });
  });
});
