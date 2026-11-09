import { describe, expect, it } from "vitest";
import { adaptAcquisitions } from "./adapter";
import type { AcqLevel, Station } from "./types";
import type { RawAcqDatatake } from "./adapter";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mkRaw(overrides: Partial<RawAcqDatatake> = {}): RawAcqDatatake {
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
    mode: "MSI · NOBS",
    absOrbit: "000001",
    levels: [
      {
        level: "L1",
        products: [{ type: "MSI_L1C_TC", pct: 100 }],
      },
    ],
    ...overrides,
  };
}

const NO_STATIONS: Station[] = [];

// ---------------------------------------------------------------------------
// cls derivation (thresholds from design/react-mockups/src/data/mock.ts:591)
// ---------------------------------------------------------------------------

describe("adaptAcquisitions cls", () => {
  it("cls is 'ok' when comp >= 95", () => {
    const raw = mkRaw({
      levels: [{ level: "L1", products: [{ type: "A", pct: 95 }] }],
    });
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].cls).toBe("ok");
  });

  it("cls is 'warn' when 0 < comp < 95", () => {
    const raw = mkRaw({
      levels: [{ level: "L1", products: [{ type: "A", pct: 50 }] }],
    });
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].cls).toBe("warn");
  });

  it("cls is 'crit' when comp === 0", () => {
    const raw = mkRaw({
      levels: [{ level: "L0", products: [{ type: "A", pct: 0 }] }],
    });
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].cls).toBe("crit");
  });

  it("cls is 'crit' when all pcts are null (comp = 0)", () => {
    const raw = mkRaw({
      levels: [{ level: "L2", products: [{ type: "A", pct: null }] }],
    });
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].cls).toBe("crit");
  });
});

// ---------------------------------------------------------------------------
// comp derivation
// ---------------------------------------------------------------------------

describe("adaptAcquisitions comp", () => {
  it("comp is 95 when mean pct is exactly 95", () => {
    const raw = mkRaw({
      levels: [{ level: "L1", products: [{ type: "A", pct: 95 }] }],
    });
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].comp).toBe(95);
  });

  it("comp is rounded to one decimal", () => {
    const levels: AcqLevel[] = [
      { level: "L1", products: [{ type: "A", pct: 92.4 }, { type: "B", pct: 94.1 }] },
    ];
    const raw = mkRaw({ levels });
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    // mean = (92.4 + 94.1) / 2 = 93.25 → rounded to 93.3
    expect(datatakes[0].comp).toBe(93.3);
  });
});

// ---------------------------------------------------------------------------
// passthrough and stations
// ---------------------------------------------------------------------------

describe("adaptAcquisitions passthrough", () => {
  it("preserves all raw fields", () => {
    const raw = mkRaw();
    const { datatakes } = adaptAcquisitions({ datatakes: [raw], stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].id).toBe(raw.id);
    expect(datatakes[0].startIso).toBe(raw.startIso);
    expect(datatakes[0].status).toBe(raw.status);
    expect(datatakes[0].levels).toBe(raw.levels);
  });

  it("passes stations through unchanged", () => {
    const stations: Station[] = [{ name: "Svalbard", lat: 78.23, lon: 15.4 }];
    const { stations: out } = adaptAcquisitions({ datatakes: [], stations }, "2026-11-09");
    expect(out).toBe(stations);
  });

  it("handles multiple datatakes independently", () => {
    const raw = [
      mkRaw({ id: "A", levels: [{ level: "L1", products: [{ type: "X", pct: 100 }] }] }),
      mkRaw({ id: "B", levels: [{ level: "L1", products: [{ type: "X", pct: 0 }] }] }),
    ];
    const { datatakes } = adaptAcquisitions({ datatakes: raw, stations: NO_STATIONS }, "2026-11-09");
    expect(datatakes[0].cls).toBe("ok");
    expect(datatakes[1].cls).toBe("crit");
  });
});
