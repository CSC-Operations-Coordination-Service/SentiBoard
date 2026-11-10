import { describe, expect, it } from "vitest";
import {
  computeAcqWindow,
  meanCompleteness,
  missingSeconds,
  kpiStats,
} from "./model";
import type { AcqDatatake, AcqLevel } from "./types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function mkAcq(overrides: Partial<AcqDatatake> = {}): AcqDatatake {
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
    comp: 100,
    cls: "ok",
    status: "Published",
    mode: "MSI · NOBS",
    absOrbit: "000001",
    levels: [
      {
        level: "L1",
        products: [
          { type: "MSI_L1C_TC", pct: 100 },
        ],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeAcqWindow
// ---------------------------------------------------------------------------

describe("computeAcqWindow", () => {
  it("returns yesterday UTC midnight as windowStart", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const { windowStart } = computeAcqWindow(now);
    expect(windowStart.toISOString()).toBe("2026-11-08T00:00:00.000Z");
  });

  it("returns today 23:59:59 UTC as windowEnd", () => {
    const now = new Date("2026-11-09T12:00:00Z");
    const { windowEnd } = computeAcqWindow(now);
    expect(windowEnd.toISOString()).toBe("2026-11-09T23:59:59.000Z");
  });

  it("handles exactly midnight UTC", () => {
    const now = new Date("2026-11-09T00:00:00Z");
    const { windowStart, windowEnd } = computeAcqWindow(now);
    expect(windowStart.toISOString()).toBe("2026-11-08T00:00:00.000Z");
    expect(windowEnd.toISOString()).toBe("2026-11-09T23:59:59.000Z");
  });
});

// ---------------------------------------------------------------------------
// meanCompleteness
// ---------------------------------------------------------------------------

describe("meanCompleteness", () => {
  it("returns 0 for empty levels", () => {
    expect(meanCompleteness([])).toBe(0);
  });

  it("returns 0 when all pcts are null", () => {
    const levels: AcqLevel[] = [
      { level: "L2", products: [{ type: "X", pct: null }] },
    ];
    expect(meanCompleteness(levels)).toBe(0);
  });

  it("ignores null pcts in the mean", () => {
    const levels: AcqLevel[] = [
      {
        level: "L1",
        products: [
          { type: "A", pct: 80 },
          { type: "B", pct: null },
          { type: "C", pct: 60 },
        ],
      },
    ];
    expect(meanCompleteness(levels)).toBe(70);
  });

  it("computes unweighted mean across levels", () => {
    const levels: AcqLevel[] = [
      { level: "L0", products: [{ type: "A", pct: 100 }] },
      { level: "L1", products: [{ type: "B", pct: 80 }] },
      { level: "L2", products: [{ type: "C", pct: 60 }] },
    ];
    expect(meanCompleteness(levels)).toBeCloseTo(80, 5);
  });

  it("returns 100 when all products are 100", () => {
    const levels: AcqLevel[] = [
      { level: "L1", products: [{ type: "A", pct: 100 }, { type: "B", pct: 100 }] },
    ];
    expect(meanCompleteness(levels)).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// missingSeconds
// ---------------------------------------------------------------------------

describe("missingSeconds", () => {
  it("returns 0 when all products are 100%", () => {
    const levels: AcqLevel[] = [
      { level: "L1", products: [{ type: "A", pct: 100 }] },
    ];
    expect(missingSeconds(levels, 200)).toBe(0);
  });

  it("computes missing seconds for partial completeness", () => {
    const levels: AcqLevel[] = [
      { level: "L1", products: [{ type: "A", pct: 80 }] },
    ];
    // 200 * (1 - 0.80) = 40
    expect(missingSeconds(levels, 200)).toBeCloseTo(40, 5);
  });

  it("sums across all non-null products", () => {
    const levels: AcqLevel[] = [
      {
        level: "L1",
        products: [
          { type: "A", pct: 100 },
          { type: "B", pct: 50 },
        ],
      },
    ];
    // 200*(1-1) + 200*(1-0.5) = 0 + 100 = 100
    expect(missingSeconds(levels, 200)).toBeCloseTo(100, 5);
  });

  it("skips null pct products", () => {
    const levels: AcqLevel[] = [
      { level: "L2", products: [{ type: "A", pct: null }] },
    ];
    expect(missingSeconds(levels, 200)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// kpiStats
// ---------------------------------------------------------------------------

describe("kpiStats", () => {
  it("returns nulls for empty list", () => {
    const stats = kpiStats([]);
    expect(stats.total).toBe(0);
    expect(stats.acquiredPct).toBeNull();
    expect(stats.publishedPct).toBeNull();
    expect(stats.failedCount).toBe(0);
  });

  it("counts failed as comp === 0", () => {
    const stats = kpiStats([
      mkAcq({ comp: 0, cls: "crit" }),
      mkAcq({ comp: 95, cls: "ok" }),
    ]);
    expect(stats.failedCount).toBe(1);
  });

  it("acquiredPct is 100 when no failures", () => {
    const stats = kpiStats([mkAcq({ comp: 95, cls: "ok" })]);
    expect(stats.acquiredPct).toBe(100);
  });

  it("acquiredPct is 0 when all have status Failed", () => {
    const stats = kpiStats([mkAcq({ comp: 0, cls: "crit", status: "Failed" })]);
    expect(stats.acquiredPct).toBe(0);
  });

  it("publishedPct is mean comp rounded", () => {
    const stats = kpiStats([
      mkAcq({ comp: 80 }),
      mkAcq({ comp: 60 }),
    ]);
    expect(stats.publishedPct).toBe(70);
  });

  it("total matches the number of datatakes", () => {
    const stats = kpiStats([mkAcq(), mkAcq(), mkAcq()]);
    expect(stats.total).toBe(3);
  });

  it("acquiredPct excludes Failed status even when comp > 0, failedCount counts only comp === 0", () => {
    const stats = kpiStats([
      mkAcq({ comp: 75, status: "Failed" }),   // status Failed, comp > 0
      mkAcq({ comp: 95, status: "Published" }),
    ]);
    expect(stats.acquiredPct).toBe(50);   // 1/2 non-Failed
    expect(stats.failedCount).toBe(0);    // 0 have comp === 0
  });
});
