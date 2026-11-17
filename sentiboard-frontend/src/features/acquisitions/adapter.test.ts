import { describe, expect, it } from "vitest";
import {
  adaptAcquisitions,
  buildDatatakes,
  downlinkStation,
  groupLevels,
  passesByUnit,
  satelliteName,
  stationName,
  statusLabel,
  swathKm,
  toneOf,
  type ApiAcquisitionPass,
  type ApiDatatake,
  type ApiOrbit,
  type RawAcqDatatake,
} from "./adapter";
import { satrecsByUnit, subSatellitePoint } from "./orbit";
import type { Station } from "./types";

// ---------------------------------------------------------------------------
// Fixtures — the TLE is real (Celestrak, 2026-11-17); the records follow the backend contract.
// ---------------------------------------------------------------------------

const S1A_TLE: ApiOrbit = {
  name: "SENTINEL-1A",
  satellite_unit: "S1A",
  norad_id: "39634",
  epoch: "2026-11-17T04:06:03Z",
  line1: "1 39634U 14016A   26321.17087910  .00000593  00000+0  13269-3 0  9994",
  line2: "2 39634  98.1586 326.2825 0001348  88.0012 272.1343 14.60165340672330",
};

const status = (pub: string, pct: number): ApiDatatake["completeness_status"] => ({
  acquisition: { status: "ACQUIRED", percentage: 100 },
  publication: { status: pub as "PUBLISHED", percentage: pct },
});

function record(over: Partial<ApiDatatake> = {}): ApiDatatake {
  return {
    id: "S1A-414433",
    datatake_id: "414433",
    mission: "S1",
    satellite_unit: "S1A",
    observation_time_start: "2026-11-17T06:00:00Z",
    observation_time_stop: "2026-11-17T06:02:00Z",
    instrument_mode: "IW",
    polarization: "DV",
    absolute_orbit: "61234",
    products: [
      { product_type: "IW_RAW__0S", product_level: "L0", percentage: 100 },
      { product_type: "IW_SLC__1S", product_level: "L1", percentage: 80 },
      { product_type: "AUX_X", product_level: null, percentage: null },
    ],
    completeness: { L0: 100, L1: 80, L2: null },
    completeness_status: status("PUBLISHED", 90),
    cams_tickets: [],
    ...over,
  };
}

function pass(over: Partial<ApiAcquisitionPass> = {}): ApiAcquisitionPass {
  return {
    id: "p",
    satellite_id: "S1A",
    ground_station: "SGS",
    downlink_start: "2026-11-17T06:30:00Z",
    downlink_stop: "2026-11-17T06:40:00Z",
    cams_tickets: [],
    ...over,
  };
}

function mkRaw(over: Partial<RawAcqDatatake> = {}): RawAcqDatatake {
  return {
    id: "S2A-00001",
    sat: "Sentinel-2A",
    unit: "S2A",
    station: "Svalbard",
    lat: 48.2,
    lon: 11.6,
    swathKm: 290,
    periodMin: 100.6,
    startIso: "2026-11-08T23:36:00.000Z",
    sensingS: 200,
    status: "Published",
    mode: "MSI",
    absOrbit: "000001",
    levels: [{ level: "L1", products: [{ type: "MSI_L1C_TC", pct: 100 }] }],
    pubPct: 100,
    ...over,
  };
}

const NOW = Date.parse("2026-11-17T12:00:00Z");
const NO_STATIONS: Station[] = [];

// ---------------------------------------------------------------------------
// buildDatatakes
// ---------------------------------------------------------------------------

describe("buildDatatakes", () => {
  it("places a datatake at its satellite's mid-sensing sub-point", () => {
    const { datatakes, skipped } = buildDatatakes([record()], [pass()], [S1A_TLE]);
    expect(skipped).toEqual([]);
    const [d] = datatakes;

    const satrec = satrecsByUnit([S1A_TLE]).get("S1A")!;
    const mid = subSatellitePoint(satrec, new Date("2026-11-17T06:01:00Z"))!;
    expect(d.lat).toBeCloseTo(mid.lat, 2);
    expect(d.lon).toBeCloseTo(mid.lon, 2);
    // 14.6017 revolutions per day → 1440 / 14.6017 ≈ 98.62 min
    expect(d.periodMin).toBeCloseTo(98.62, 1);
  });

  it("maps the record fields for the page", () => {
    const [d] = buildDatatakes([record()], [pass()], [S1A_TLE]).datatakes;
    expect(d).toMatchObject({
      id: "S1A-414433",
      sat: "Sentinel-1A",
      unit: "S1A",
      station: "Svalbard",
      swathKm: 250,
      startIso: "2026-11-17T06:00:00.000Z",
      sensingS: 120,
      status: "Published",
      mode: "IW · DV",
      absOrbit: "61234",
      pubPct: 90,
    });
    expect(d.levels.map((l) => l.level)).toEqual(["L0", "L1", "UNKNOWN"]);
  });

  it("skips records it cannot place, with the reason", () => {
    const { datatakes, skipped } = buildDatatakes(
      [
        record({ id: "no-stop", observation_time_stop: null }),
        record({ id: "reversed", observation_time_stop: "2026-11-17T05:00:00Z" }),
        record({ id: "no-unit", satellite_unit: null }),
        record({ id: "no-orbit", satellite_unit: "S2A" }),
      ],
      [],
      [S1A_TLE],
    );
    expect(datatakes).toEqual([]);
    expect(skipped).toEqual([
      { id: "no-stop", reason: "no-time" },
      { id: "reversed", reason: "no-time" },
      { id: "no-unit", reason: "no-time" },
      { id: "no-orbit", reason: "no-orbit" },
    ]);
  });

  it("leaves the station empty without a matching pass, and the PUB % null without status", () => {
    const [d] = buildDatatakes(
      [record({ completeness_status: null, polarization: null })],
      [pass({ satellite_id: "S1C" })],
      [S1A_TLE],
    ).datatakes;
    expect(d.station).toBe("");
    expect(d.pubPct).toBeNull();
    expect(d.status).toBe("Processing");
    expect(d.mode).toBe("IW");
  });
});

// ---------------------------------------------------------------------------
// downlink station heuristic
// ---------------------------------------------------------------------------

describe("downlinkStation", () => {
  const t = (iso: string) => Date.parse(iso);
  const start = t("2026-11-17T06:00:00Z");
  const stop = t("2026-11-17T06:02:00Z");
  const spans = (...ps: ApiAcquisitionPass[]) => passesByUnit(ps).get("S1A");

  it("takes the first pass after the sensing", () => {
    const passes = spans(
      pass({ ground_station: "MTI", downlink_start: "2026-11-17T08:00:00Z", downlink_stop: "2026-11-17T08:10:00Z" }),
      pass({ ground_station: "INS", downlink_start: "2026-11-17T07:00:00Z", downlink_stop: "2026-11-17T07:10:00Z" }),
      pass({ ground_station: "NSG", downlink_start: "2026-11-17T05:00:00Z", downlink_stop: "2026-11-17T05:10:00Z" }),
    );
    expect(downlinkStation(passes, start, stop)).toBe("Inuvik");
  });

  it("takes a pass running during the sensing (real-time downlink)", () => {
    const passes = spans(
      pass({ ground_station: "MPS_", downlink_start: "2026-11-17T05:58:00Z", downlink_stop: "2026-11-17T06:05:00Z" }),
    );
    expect(downlinkStation(passes, start, stop)).toBe("Maspalomas");
  });

  it("ignores a pass more than 12 h after the sensing", () => {
    const passes = spans(
      pass({ downlink_start: "2026-11-17T18:03:00Z", downlink_stop: "2026-11-17T18:10:00Z" }),
    );
    expect(downlinkStation(passes, start, stop)).toBe("");
    expect(downlinkStation(undefined, start, stop)).toBe("");
  });

  it("drops passes without satellite, station or valid times", () => {
    const index = passesByUnit([
      pass({ satellite_id: null }),
      pass({ ground_station: null }),
      pass({ downlink_stop: null }),
      pass({ downlink_start: "not a date" }),
    ]);
    expect(index.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// small mappings
// ---------------------------------------------------------------------------

describe("page mappings", () => {
  it("names stations from CADIP codes, keeping unknown codes", () => {
    expect(stationName("SGS")).toBe("Svalbard");
    expect(stationName("MPS_")).toBe("Maspalomas");
    expect(stationName("ins")).toBe("Inuvik");
    expect(stationName("KIR")).toBe("KIR");
    expect(stationName(null)).toBe("");
  });

  it("maps PUB statuses to the page labels", () => {
    expect(statusLabel(status("PUBLISHED", 95))).toBe("Published");
    expect(statusLabel(status("PARTIAL", 50))).toBe("Partial");
    expect(statusLabel(status("UNAVAILABLE", 0))).toBe("Failed");
    for (const s of ["PLANNED", "PROCESSING", "DELAYED"]) {
      expect(statusLabel(status(s, 0))).toBe("Processing");
    }
    expect(statusLabel(null)).toBe("Processing");
  });

  it("sizes the swath by S1 mode or by mission", () => {
    expect(swathKm("S1", "EW")).toBe(400);
    expect(swathKm("S1", "XX")).toBe(250);
    expect(swathKm("S2", "INS-NOBS")).toBe(290);
    expect(swathKm("S3", null)).toBe(1270);
    expect(swathKm("S5", null)).toBe(2600);
    expect(swathKm(null, null)).toBe(250);
  });

  it("names satellites", () => {
    expect(satelliteName("S1A")).toBe("Sentinel-1A");
    expect(satelliteName("S5P")).toBe("Sentinel-5P");
  });

  it("groups products by level in L0, L1, L2, UNKNOWN order", () => {
    expect(
      groupLevels([
        { product_type: "c", product_level: null, percentage: 1 },
        { product_type: "b", product_level: "L2", percentage: null },
        { product_type: "a", product_level: "L0", percentage: 100 },
      ]),
    ).toEqual([
      { level: "L0", products: [{ type: "a", pct: 100 }] },
      { level: "L2", products: [{ type: "b", pct: null }] },
      { level: "UNKNOWN", products: [{ type: "c", pct: 1 }] },
    ]);
    expect(groupLevels([])).toEqual([]);
  });

  it("tones footprints by status, then completeness", () => {
    expect(toneOf("Failed", 9)).toBe("crit");
    expect(toneOf("Published", 95)).toBe("ok");
    expect(toneOf("Partial", 60)).toBe("warn");
    expect(toneOf("Processing", 0)).toBe("warn");
  });
});

// ---------------------------------------------------------------------------
// adaptAcquisitions (per request)
// ---------------------------------------------------------------------------

describe("adaptAcquisitions", () => {
  it("uses the PUB % as completeness, rounded to one decimal", () => {
    const { datatakes } = adaptAcquisitions(
      { datatakes: [mkRaw({ pubPct: 93.25 })], stations: NO_STATIONS },
      NOW,
    );
    expect(datatakes[0].comp).toBe(93.3);
    expect(datatakes[0].cls).toBe("warn");
    expect(datatakes[0]).not.toHaveProperty("pubPct");
  });

  it("falls back to the mean of the products when the PUB % is unknown", () => {
    const levels = [{ level: "L1" as const, products: [{ type: "A", pct: 100 }, { type: "B", pct: 90 }] }];
    const { datatakes } = adaptAcquisitions(
      { datatakes: [mkRaw({ pubPct: null, levels })], stations: NO_STATIONS },
      NOW,
    );
    expect(datatakes[0].comp).toBe(95);
    expect(datatakes[0].cls).toBe("ok");
  });

  it("hides datatakes that have not started at request time", () => {
    const { datatakes } = adaptAcquisitions(
      {
        datatakes: [
          mkRaw({ id: "past", startIso: "2026-11-17T11:00:00.000Z" }),
          mkRaw({ id: "now", startIso: "2026-11-17T12:00:00.000Z" }),
          mkRaw({ id: "future", startIso: "2026-11-17T12:00:01.000Z" }),
        ],
        stations: NO_STATIONS,
      },
      NOW,
    );
    expect(datatakes.map((d) => d.id)).toEqual(["past", "now"]);
  });

  it("passes stations through unchanged", () => {
    const stations: Station[] = [{ name: "Svalbard", lat: 78.23, lon: 15.4 }];
    expect(adaptAcquisitions({ datatakes: [], stations }, NOW).stations).toBe(stations);
  });
});
