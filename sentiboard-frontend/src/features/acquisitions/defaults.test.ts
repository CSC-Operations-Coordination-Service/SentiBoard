import { describe, expect, it } from "vitest";
import {
  compareDatatakes,
  pickArrivalView,
  pickViewForSatellite,
  pickViewForDay,
} from "./defaults";
import type { AcqDatatake } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mkDtk(overrides: Partial<AcqDatatake> & { id: string; unit: string; startIso: string }): AcqDatatake {
  return {
    sat: `Sentinel-${overrides.unit.slice(1)}`,
    station: "SGS",
    lat: 0,
    lon: 0,
    swathKm: 290,
    periodMin: 100,
    sensingS: 100,
    comp: 100,
    cls: "ok",
    status: "Published",
    mode: "IW · DV",
    absOrbit: "00001",
    levels: [],
    ...overrides,
  };
}

const TODAY = "2026-11-25";
const YESTERDAY = "2026-11-24";

// A set that includes both today and yesterday, two satellites
const MIXED: AcqDatatake[] = [
  mkDtk({ id: "S1A-00001", unit: "S1A", startIso: `${TODAY}T10:00:00Z` }),
  mkDtk({ id: "S1A-00002", unit: "S1A", startIso: `${TODAY}T12:00:00Z` }),
  mkDtk({ id: "S1A-00003", unit: "S1A", startIso: `${YESTERDAY}T08:00:00Z` }),
  mkDtk({ id: "S2A-00001", unit: "S2A", startIso: `${TODAY}T09:00:00Z` }),
];

// Only yesterday data
const ONLY_YESTERDAY: AcqDatatake[] = [
  mkDtk({ id: "S1A-00010", unit: "S1A", startIso: `${YESTERDAY}T05:00:00Z` }),
  mkDtk({ id: "S1A-00011", unit: "S1A", startIso: `${YESTERDAY}T18:00:00Z` }),
];

// ---------------------------------------------------------------------------
// compareDatatakes
// ---------------------------------------------------------------------------

describe("compareDatatakes", () => {
  it("orders by satellite group then id", () => {
    const a = mkDtk({ id: "S1A-00001", unit: "S1A", startIso: `${TODAY}T10:00:00Z` });
    const b = mkDtk({ id: "S2A-00001", unit: "S2A", startIso: `${TODAY}T10:00:00Z` });
    expect(compareDatatakes(a, b)).toBeLessThan(0);
    expect(compareDatatakes(b, a)).toBeGreaterThan(0);
  });

  it("orders by id when same satellite group", () => {
    const a = mkDtk({ id: "S1A-00001", unit: "S1A", startIso: `${TODAY}T10:00:00Z` });
    const b = mkDtk({ id: "S1A-00002", unit: "S1A", startIso: `${TODAY}T12:00:00Z` });
    expect(compareDatatakes(a, b)).toBeLessThan(0);
    expect(compareDatatakes(b, a)).toBeGreaterThan(0);
  });

  it("returns 0 for identical id and sat", () => {
    const a = mkDtk({ id: "S1A-00001", unit: "S1A", startIso: `${TODAY}T10:00:00Z` });
    const b = mkDtk({ id: "S1A-00001", unit: "S1A", startIso: `${TODAY}T10:00:00Z` });
    expect(compareDatatakes(a, b)).toBe(0);
  });

  it("sorts S1 before S2 before S3 before S5P group", () => {
    const s3 = mkDtk({ id: "S3A-00001", unit: "S3A", startIso: `${TODAY}T10:00:00Z` });
    const s1 = mkDtk({ id: "S1A-00001", unit: "S1A", startIso: `${TODAY}T10:00:00Z` });
    const s2 = mkDtk({ id: "S2A-00001", unit: "S2A", startIso: `${TODAY}T10:00:00Z` });
    const sorted = [s3, s1, s2].sort(compareDatatakes);
    expect(sorted.map((d) => d.unit)).toEqual(["S1A", "S2A", "S3A"]);
  });
});

// ---------------------------------------------------------------------------
// pickArrivalView
// ---------------------------------------------------------------------------

describe("pickArrivalView — empty data", () => {
  it("returns null when datatakes is empty", () => {
    expect(pickArrivalView([], TODAY, { satellite: null, day: null, datatake: null })).toBeNull();
  });
});

describe("pickArrivalView — blank URL", () => {
  it("fills satellite, day, datatake when all params are absent", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: null, day: null, datatake: null });
    // S1A is first in ALL_SATELLITES; has data on TODAY; S1A-00001 < S1A-00002
    expect(result).toEqual({ satellite: "S1A", day: TODAY, datatake: "S1A-00001" });
  });

  it("picks todayKey if satellite has data today", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: null, day: null, datatake: null });
    expect(result?.day).toBe(TODAY);
  });

  it("picks latest day when satellite has no data today", () => {
    const result = pickArrivalView(ONLY_YESTERDAY, TODAY, { satellite: null, day: null, datatake: null });
    expect(result?.day).toBe(YESTERDAY);
    expect(result?.datatake).toBe("S1A-00010"); // S1A-00010 < S1A-00011
  });
});

describe("pickArrivalView — partial URL", () => {
  it("satellite valid but day absent → fills day and datatake", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: "S2A", day: null, datatake: null });
    expect(result?.satellite).toBe("S2A");
    expect(result?.day).toBe(TODAY);
    expect(result?.datatake).toBe("S2A-00001");
  });

  it("satellite valid, day valid but datatake absent → fills datatake", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: "S1A", day: TODAY, datatake: null });
    expect(result?.datatake).toBe("S1A-00001");
  });

  it("satellite valid, day outside window → replaces with satellite's default day", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: "S1A", day: "2024-01-01", datatake: null });
    expect(result?.day).toBe(TODAY);
    expect(result?.datatake).toBe("S1A-00001");
  });

  it("satellite invalid → uses first valid satellite", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: "S9Z", day: null, datatake: null });
    expect(result?.satellite).toBe("S1A");
  });
});

describe("pickArrivalView — full valid URL (no change)", () => {
  it("returns null when all params are already correct", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: "S1A", day: TODAY, datatake: "S1A-00001" });
    expect(result).toBeNull();
  });
});

describe("pickArrivalView — datatake deep link", () => {
  it("datatake-only deep link: fills satellite and day from the datatake", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: null, day: null, datatake: "S1A-00003" });
    // S1A-00003 is on YESTERDAY
    expect(result).toEqual({ satellite: "S1A", day: YESTERDAY, datatake: "S1A-00003" });
  });

  it("datatake deep link overrides conflicting satellite param", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: "S2A", day: null, datatake: "S1A-00001" });
    // datatake S1A-00001 belongs to S1A, not S2A
    expect(result?.satellite).toBe("S1A");
    expect(result?.datatake).toBe("S1A-00001");
  });

  it("datatake outside data window → falls through to defaults", () => {
    const result = pickArrivalView(MIXED, TODAY, { satellite: null, day: null, datatake: "S9Z-99999" });
    // Falls back: first satellite S1A, day TODAY, first datatake S1A-00001
    expect(result?.satellite).toBe("S1A");
    expect(result?.datatake).toBe("S1A-00001");
  });
});

// ---------------------------------------------------------------------------
// pickViewForSatellite
// ---------------------------------------------------------------------------

describe("pickViewForSatellite", () => {
  it("keeps currentDay if the new satellite has data that day", () => {
    const result = pickViewForSatellite(MIXED, TODAY, "S2A", TODAY);
    expect(result.satellite).toBe("S2A");
    expect(result.day).toBe(TODAY);
    expect(result.datatake).toBe("S2A-00001");
  });

  it("falls back to default day when satellite has no data on currentDay", () => {
    // S2A has no data on YESTERDAY
    const result = pickViewForSatellite(MIXED, TODAY, "S2A", YESTERDAY);
    expect(result.day).toBe(TODAY);
    expect(result.datatake).toBe("S2A-00001");
  });

  it("currentDay null → uses default day", () => {
    const result = pickViewForSatellite(MIXED, TODAY, "S1A", null);
    expect(result.day).toBe(TODAY);
    expect(result.datatake).toBe("S1A-00001");
  });

  it("picks first datatake by compareDatatakes order", () => {
    const result = pickViewForSatellite(MIXED, TODAY, "S1A", TODAY);
    // S1A has S1A-00001 and S1A-00002 on TODAY; S1A-00001 sorts first
    expect(result.datatake).toBe("S1A-00001");
  });
});

// ---------------------------------------------------------------------------
// pickViewForDay
// ---------------------------------------------------------------------------

describe("pickViewForDay", () => {
  it("with satellite: picks first datatake by compareDatatakes", () => {
    const result = pickViewForDay(MIXED, "S1A", TODAY);
    expect(result).toEqual({ satellite: "S1A", day: TODAY, datatake: "S1A-00001" });
  });

  it("with satellite: no datatakes for sat+day → datatake null", () => {
    const result = pickViewForDay(MIXED, "S2A", YESTERDAY);
    expect(result).toEqual({ satellite: "S2A", day: YESTERDAY, datatake: null });
  });

  it("with sat === null: returns datatake null (no auto-select in All-satellites mode)", () => {
    const result = pickViewForDay(MIXED, null, TODAY);
    expect(result).toEqual({ satellite: null, day: TODAY, datatake: null });
  });
});
