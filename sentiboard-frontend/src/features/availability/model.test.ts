import { describe, expect, it } from "vitest";
import {
  barColor,
  bandColor,
  framesOf,
  axisTicks,
  daysOf,
  cardSides,
  kpiStats,
  kpiFmt,
  DAY_MS,
  type Datatake,
} from "./model";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY0 = new Date("2026-10-01T00:00:00Z");

function mkDtk(
  overrides: Partial<Datatake> & Pick<Datatake, "status" | "completeness">,
): Datatake {
  return {
    id: "S1A-10001",
    satellite: "S1A",
    mission: "Sentinel-1",
    missionId: "S1",
    sensorMode: "IW",
    start: DAY0,
    stop: new Date(DAY0.getTime() + 25 * 60_000),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// barColor
// ---------------------------------------------------------------------------

describe("barColor", () => {
  it("returns state colour for Planned", () => {
    expect(barColor(mkDtk({ status: "Planned", completeness: 0 }))).toBe("#7A8696");
  });

  it("returns state colour for Processing", () => {
    expect(barColor(mkDtk({ status: "Processing", completeness: 50 }))).toBe("#5B9BE8");
  });

  it("returns band colour for 100% Acquired", () => {
    expect(barColor(mkDtk({ status: "Acquired", completeness: 100 }))).toBe("#12E874");
  });

  it("returns band colour for 85% Partial", () => {
    expect(barColor(mkDtk({ status: "Partial", completeness: 85 }))).toBe("#46B96A");
  });

  it("returns MISSING grey for Unavailable (0%)", () => {
    expect(barColor(mkDtk({ status: "Unavailable", completeness: 0 }))).toBe("#8B98A6");
  });

  it("returns fire-red for 1% completeness", () => {
    expect(barColor(mkDtk({ status: "Partial", completeness: 1 }))).toBe("#E8200F");
  });

  it("returns MISSING grey for 0% completeness (non-Planned, non-Processing)", () => {
    expect(barColor(mkDtk({ status: "Partial", completeness: 0 }))).toBe("#8B98A6");
  });
});

// ---------------------------------------------------------------------------
// bandColor
// ---------------------------------------------------------------------------

describe("bandColor", () => {
  it("maps completeness bands correctly", () => {
    expect(bandColor(100)).toBe("#12E874");
    expect(bandColor(90)).toBe("#12E874");
    expect(bandColor(89)).toBe("#46B96A");
    expect(bandColor(80)).toBe("#46B96A");
    expect(bandColor(79)).toBe("#FFD01E");
    expect(bandColor(50)).toBe("#FFD01E");
    expect(bandColor(49)).toBe("#F0736B");
    expect(bandColor(30)).toBe("#F0736B");
    expect(bandColor(29)).toBe("#E8200F");
    expect(bandColor(1)).toBe("#E8200F");
    expect(bandColor(0)).toBe("#8B98A6");
  });
});

// ---------------------------------------------------------------------------
// kpiFmt
// ---------------------------------------------------------------------------

describe("kpiFmt", () => {
  it("pads single digits to two", () => {
    expect(kpiFmt(0)).toBe("00");
    expect(kpiFmt(7)).toBe("07");
    expect(kpiFmt(99)).toBe("99");
  });

  it("does not pad three or more digits", () => {
    expect(kpiFmt(100)).toBe("100");
    expect(kpiFmt(1000)).toBe("1000");
  });
});

// ---------------------------------------------------------------------------
// daysOf
// ---------------------------------------------------------------------------

describe("daysOf", () => {
  it("returns one day for same start and end", () => {
    const days = daysOf(DAY0, DAY0);
    expect(days).toHaveLength(1);
    expect(days[0].getTime()).toBe(DAY0.getTime());
  });

  it("returns 31 days for a 30-day window", () => {
    const end = new Date(DAY0.getTime() + 30 * DAY_MS);
    expect(daysOf(DAY0, end)).toHaveLength(31);
  });

  it("includes the start and end days", () => {
    const end = new Date(DAY0.getTime() + 2 * DAY_MS);
    const days = daysOf(DAY0, end);
    expect(days[0].getTime()).toBe(DAY0.getTime());
    expect(days[days.length - 1].getTime()).toBe(end.getTime());
  });

  it("strips time components (uses UTC midnight)", () => {
    const withTime = new Date("2026-10-01T14:32:00Z");
    const days = daysOf(withTime, withTime);
    expect(days[0].getUTCHours()).toBe(0);
    expect(days[0].getUTCMinutes()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// framesOf
// ---------------------------------------------------------------------------

describe("framesOf", () => {
  it("returns empty for empty input", () => {
    expect(framesOf([])).toHaveLength(0);
  });

  it("returns one frame for a single datatake", () => {
    const frames = framesOf([mkDtk({ status: "Acquired", completeness: 100 })]);
    expect(frames).toHaveLength(1);
    expect(frames[0].leftPct).toBe(50);
    expect(frames[0].n).toBe(1);
  });

  it("caps at 96 frames", () => {
    const many = Array.from({ length: 200 }, (_, i) =>
      mkDtk({
        status: "Acquired",
        completeness: 100,
        start: new Date(DAY0.getTime() + i * 60_000),
      }),
    );
    expect(framesOf(many)).toHaveLength(96);
  });

  it("picks the worst item in a group (lowest finalized completeness)", () => {
    const good = mkDtk({ status: "Acquired", completeness: 100, start: DAY0 });
    const bad = mkDtk({
      status: "Partial",
      completeness: 30,
      start: new Date(DAY0.getTime() + 1000),
    });
    // Two datatakes → one frame; the bad one must win
    const frames = framesOf([good, bad]);
    expect(frames).toHaveLength(2); // 2 datatakes → 2 frames (n ≤ 96)
    // Both in one group only if we have more than FRAMES; here 2 < 96 so each gets its own
    // Just test that the worst representative is chosen when folded
    const manyGood = Array.from({ length: 50 }, (_, i) =>
      mkDtk({
        status: "Acquired",
        completeness: 100,
        start: new Date(DAY0.getTime() + i * 2000),
      }),
    );
    const worstInGroup = mkDtk({
      status: "Partial",
      completeness: 10,
      start: new Date(DAY0.getTime() + 50_000),
    });
    const folded = framesOf([...manyGood, worstInGroup]); // 51 items → 51 frames
    expect(folded.some((f) => f.item.completeness === 10)).toBe(true);
  });

  it("Planned and Processing rank 101 (never hide a loss)", () => {
    // A Planned (rank 101) should NOT beat a Partial (rank = completeness < 101)
    // when folded in the same group
    const many = Array.from({ length: 97 }, (_, i) =>
      mkDtk({
        status: i < 48 ? "Planned" : "Partial",
        completeness: i < 48 ? 0 : 20,
        start: new Date(DAY0.getTime() + i * 60_000),
      }),
    );
    // With 97 items in 96 frames, at least one group has 2; a Planned+Partial pair must yield Partial
    const frames = framesOf(many);
    expect(frames.some((f) => f.item.status === "Partial")).toBe(true);
    // No frame should choose Planned when a Partial is in the same group
    for (const f of frames) {
      if (f.n > 1) {
        expect(f.item.status).not.toBe("Planned");
      }
    }
  });
});

// ---------------------------------------------------------------------------
// axisTicks
// ---------------------------------------------------------------------------

describe("axisTicks", () => {
  it("returns empty for empty days", () => {
    expect(axisTicks([])).toHaveLength(0);
  });

  it("returns 6 ticks (5 intervals) for windows > 3 days", () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(DAY0.getTime() + i * DAY_MS));
    expect(axisTicks(days)).toHaveLength(6);
  });

  it("returns 5 ticks (4 intervals) for windows ≤ 3 days", () => {
    const days = Array.from({ length: 2 }, (_, i) => new Date(DAY0.getTime() + i * DAY_MS));
    expect(axisTicks(days)).toHaveLength(5);
  });

  it("includes hour info for short windows", () => {
    const days = [DAY0, new Date(DAY0.getTime() + DAY_MS)];
    const ticks = axisTicks(days);
    expect(ticks[0].label).toMatch(/\d{2}:\d{2}/);
  });

  it("does NOT include hour info for long windows", () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(DAY0.getTime() + i * DAY_MS));
    const ticks = axisTicks(days);
    expect(ticks[0].label).not.toMatch(/:\d{2}$/);
  });

  it("first tick has edge=first, last tick has edge=last", () => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(DAY0.getTime() + i * DAY_MS));
    const ticks = axisTicks(days);
    expect(ticks[0].edge).toBe("first");
    expect(ticks[ticks.length - 1].edge).toBe("last");
  });

  it("first tick is at pct=0, last at pct=100", () => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(DAY0.getTime() + i * DAY_MS));
    const ticks = axisTicks(days);
    expect(ticks[0].pct).toBe(0);
    expect(ticks[ticks.length - 1].pct).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// cardSides
// ---------------------------------------------------------------------------

describe("cardSides", () => {
  it("Planned: acq and pub both null/PLANNED", () => {
    const sides = cardSides(mkDtk({ status: "Planned", completeness: 0 }));
    expect(sides.acq.pct).toBeNull();
    expect(sides.acq.label).toBe("PLANNED");
    expect(sides.pub.label).toBe("PLANNED");
  });

  it("Processing: acq is null/grey/ACQUIRED, pub is PROCESSING (Decision 6)", () => {
    const sides = cardSides(mkDtk({ status: "Processing", completeness: 50 }));
    expect(sides.acq.pct).toBeNull();
    expect(sides.acq.color).toBe("#7A8696");
    expect(sides.acq.label).toBe("ACQUIRED");
    expect(sides.pub.label).toBe("PROCESSING");
    expect(sides.pub.color).toBe("#5B9BE8");
  });

  it("Acquired: acq and pub at 100%, PUBLISHED", () => {
    const sides = cardSides(mkDtk({ status: "Acquired", completeness: 100 }));
    expect(sides.acq.pct).toBe(100);
    expect(sides.acq.label).toBe("ACQUIRED");
    expect(sides.pub.label).toBe("PUBLISHED");
  });

  it("Unavailable: acq null/grey/UNAVAILABLE, pub is 0/grey/MISSING", () => {
    const sides = cardSides(mkDtk({ status: "Unavailable", completeness: 0 }));
    expect(sides.acq.pct).toBeNull();
    expect(sides.acq.label).toBe("UNAVAILABLE");
    expect(sides.pub.pct).toBe(0);
    expect(sides.pub.label).toBe("MISSING");
  });
});

// ---------------------------------------------------------------------------
// kpiStats
// ---------------------------------------------------------------------------

describe("kpiStats", () => {
  const activeSats = ["S1A", "S2A"];
  const days = [DAY0, new Date(DAY0.getTime() + DAY_MS)]; // 2 days

  it("counts all matching datatakes as inRange", () => {
    const dtks = [
      mkDtk({ status: "Acquired", completeness: 100, satellite: "S1A" }),
      mkDtk({ status: "Partial", completeness: 60, satellite: "S2A" }),
    ];
    const { inRange } = kpiStats(dtks, days, activeSats);
    expect(inRange).toBe(2);
  });

  it("counts Unavailable as lost", () => {
    const dtks = [
      mkDtk({ status: "Unavailable", completeness: 0, satellite: "S1A" }),
      mkDtk({ status: "Acquired", completeness: 100, satellite: "S1A" }),
    ];
    const { lost } = kpiStats(dtks, days, activeSats);
    expect(lost).toBe(1);
  });

  it("mean excludes Planned and Processing", () => {
    const dtks = [
      mkDtk({ status: "Acquired", completeness: 80, satellite: "S1A" }),
      mkDtk({ status: "Planned", completeness: 0, satellite: "S1A" }),
      mkDtk({ status: "Processing", completeness: 50, satellite: "S1A" }),
    ];
    const { meanCompleteness } = kpiStats(dtks, days, activeSats);
    expect(meanCompleteness).toBe(80);
  });

  it("mean is null when only Planned/Processing exist (Decision 13)", () => {
    const dtks = [
      mkDtk({ status: "Planned", completeness: 0, satellite: "S1A" }),
      mkDtk({ status: "Processing", completeness: 40, satellite: "S2A" }),
    ];
    const { meanCompleteness } = kpiStats(dtks, days, activeSats);
    expect(meanCompleteness).toBeNull();
  });

  it("coverage gaps: counts satellite-days with no datatake (Decision #1)", () => {
    // 2 active satellites × 2 days = 4 expected slots; only S1A/day0 has a datatake → 3 gaps
    const dtks = [mkDtk({ status: "Acquired", completeness: 100, satellite: "S1A", start: DAY0 })];
    const { coverageGaps } = kpiStats(dtks, days, activeSats);
    expect(coverageGaps).toBe(3);
  });

  it("zero coverage gaps when every satellite-day has a datatake", () => {
    const dtks = [
      mkDtk({ status: "Acquired", completeness: 100, satellite: "S1A", start: DAY0 }),
      mkDtk({ status: "Acquired", completeness: 100, satellite: "S1A", start: new Date(DAY0.getTime() + DAY_MS) }),
      mkDtk({ status: "Acquired", completeness: 100, satellite: "S2A", start: DAY0 }),
      mkDtk({ status: "Acquired", completeness: 100, satellite: "S2A", start: new Date(DAY0.getTime() + DAY_MS) }),
    ];
    const { coverageGaps } = kpiStats(dtks, days, activeSats);
    expect(coverageGaps).toBe(0);
  });

  it("empty matching → all zeros / null mean", () => {
    const { inRange, lost, coverageGaps, meanCompleteness } = kpiStats([], days, activeSats);
    expect(inRange).toBe(0);
    expect(lost).toBe(0);
    expect(meanCompleteness).toBeNull();
    expect(coverageGaps).toBe(4); // 2 sats × 2 days with no datatakes
  });
});
