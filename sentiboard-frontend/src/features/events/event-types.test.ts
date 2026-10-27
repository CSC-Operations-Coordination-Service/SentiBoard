import { describe, expect, it } from "vitest";
import { classifyDatatake, classifyImpact, meanCompleteness } from "./event-types";
import type { EventDatatake } from "./model";

function dt(L0: number | null, L1: number | null, L2: number | null): EventDatatake {
  return {
    datatakeId: "S1A-000000",
    L0,
    L1,
    L2,
    noData: L0 === null && L1 === null && L2 === null,
  };
}

/* ---- meanCompleteness ---- */

describe("meanCompleteness", () => {
  it("returns null when all levels are null (no data)", () => {
    expect(meanCompleteness(dt(null, null, null))).toBeNull();
  });

  it("returns the single non-null value as the mean", () => {
    expect(meanCompleteness(dt(9.9, null, null))).toBeCloseTo(9.9);
    expect(meanCompleteness(dt(10.0, null, null))).toBeCloseTo(10.0);
    expect(meanCompleteness(dt(89.9, null, null))).toBeCloseTo(89.9);
    expect(meanCompleteness(dt(90.0, null, null))).toBeCloseTo(90.0);
  });

  it("returns the mean of all three non-null values (100/0/0 → ~33.3 %)", () => {
    expect(meanCompleteness(dt(100, 0, 0))).toBeCloseTo(100 / 3);
  });

  it("ignores null when computing mean of two values", () => {
    expect(meanCompleteness(dt(100, 80, null))).toBeCloseTo(90);
  });
});

/* ---- classifyDatatake ---- */

describe("classifyDatatake", () => {
  it("classifies 9.9 % as lost (< 10)", () => {
    expect(classifyDatatake(dt(9.9, null, null))).toBe("lost");
  });

  it("classifies 10 % as partial (boundary: ≥ 10)", () => {
    expect(classifyDatatake(dt(10, null, null))).toBe("partial");
  });

  it("classifies 89.9 % as partial (< 90)", () => {
    expect(classifyDatatake(dt(89.9, null, null))).toBe("partial");
  });

  it("classifies 90 % as acquired (boundary: ≥ 90)", () => {
    expect(classifyDatatake(dt(90, null, null))).toBe("acquired");
  });

  it("classifies mean(100/0/0) ≈ 33.3 % as partial", () => {
    expect(classifyDatatake(dt(100, 0, 0))).toBe("partial");
  });

  it("classifies no-data datatake as noData", () => {
    expect(classifyDatatake(dt(null, null, null))).toBe("noData");
  });

  it("classifies 100 % as acquired", () => {
    expect(classifyDatatake(dt(100, 100, 100))).toBe("acquired");
  });
});

/* ---- classifyImpact ---- */

describe("classifyImpact", () => {
  it("returns noData for an empty datatake list", () => {
    expect(classifyImpact([])).toBe("noData");
  });

  it("returns noData when all datatakes are noData", () => {
    expect(classifyImpact([dt(null, null, null), dt(null, null, null)])).toBe("noData");
  });

  it("returns acquired when all datatakes are acquired", () => {
    expect(classifyImpact([dt(100, null, null), dt(95, null, null)])).toBe("acquired");
  });

  it("returns partial when there are partial and acquired datatakes but no lost", () => {
    expect(classifyImpact([dt(100, null, null), dt(50, null, null)])).toBe("partial");
  });

  it("returns lost when any datatake is lost, even if others are acquired", () => {
    expect(classifyImpact([dt(100, null, null), dt(5, null, null)])).toBe("lost");
  });

  it("returns lost for mixed lost/partial/acquired (lost takes priority)", () => {
    expect(classifyImpact([dt(100, null, null), dt(50, null, null), dt(5, null, null)])).toBe("lost");
  });

  it("returns partial when acquired and noData datatakes are mixed (no partial or lost)", () => {
    // noData is skipped; acquired datatakes remain → partial wins over noData only if there is
    // no partial/lost, so result is acquired (not partial).
    expect(classifyImpact([dt(100, null, null), dt(null, null, null)])).toBe("acquired");
  });
});
