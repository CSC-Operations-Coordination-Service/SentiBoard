import { describe, expect, it } from "vitest";
import type { TabularPayload, TemporalPlotMarker, CountHistogramMarker } from "./types";
import {
  buildCountModel,
  buildTemporalModel,
  countReadoutText,
  detectGaps,
  formatDateLabel,
  inferInterval,
  niceYAxis,
  roundDisplay,
  seriesColorClass,
  statusColorToken,
  temporalReadoutText,
  xAxisTicks,
} from "./chart-model";

// ---- Fixtures ---------------------------------------------------------------

const temporalFixture = (await import("./__fixtures__/chatbot-sample-temporal.json", {
  with: { type: "json" },
})).default as TabularPayload;

const histogramFixture = (await import("./__fixtures__/chatbot-sample-histogram.json", {
  with: { type: "json" },
})).default as TabularPayload;

const temporalMarker: TemporalPlotMarker = {
  kind: "temporal-plot",
  data_id: "artifact_6852056cc5804bf5a0307055b7d9eb32",
  date_column: "bucket_start",
  numeric_column: "completeness_percentage",
};

const histogramMarker: CountHistogramMarker = {
  kind: "count-histogram",
  data_id: "artifact_b7ef5d9e82b64e03b270c8b31e9d768c",
  count_column: "record_count",
  category_column: "status",
};

// Minimal payload helpers
function minPayload(overrides?: Partial<TabularPayload>): TabularPayload {
  return {
    data_id: "artifact_test",
    title: "Test title",
    description: "",
    columns: [],
    rows: [],
    ...overrides,
  };
}

// ---- buildTemporalModel — fixture -------------------------------------------

describe("buildTemporalModel — temporal fixture", () => {
  it("builds one series with 29 points from the fixture", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    expect(result).not.toBe("invalid");
    expect(result).not.toBe("too-many-series");
    const model = result as Exclude<typeof result, string>;
    expect(model.series).toHaveLength(1);
    const totalPoints = model.series[0].segments.flat().length;
    expect(totalPoints).toBe(29);
  });

  it("names the single series 'all' (from group_key)", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.series[0].name).toBe("all");
  });

  it("sets isPercentage=true for a _percentage column", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.isPercentage).toBe(true);
  });

  it("y-axis is 0–100 for a percentage column", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.yAxis.min).toBe(0);
    expect(model.yAxis.max).toBe(100);
    expect(model.yAxis.ticks).toEqual([0, 25, 50, 75, 100]);
  });

  it("produces at most 5 x-axis labels", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.xLabels.length).toBeLessThanOrEqual(5);
  });

  it("title falls back to payload.title when marker has no title", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.title).toBe(temporalFixture.title);
  });

  it("marker.title takes precedence over payload.title", () => {
    const markerWithTitle = { ...temporalMarker, title: "Custom title" };
    const result = buildTemporalModel(temporalFixture, markerWithTitle);
    const model = result as Exclude<typeof result, string>;
    expect(model.title).toBe("Custom title");
  });

  it("tablePayload has no 'all' column — single series uses date + numeric columns only", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.tablePayload.columns).not.toContain("all");
    expect(model.tablePayload.columns).not.toContain("group_key");
    expect(model.tablePayload.columns).toContain("bucket_start");
    expect(model.tablePayload.columns).toContain("completeness_percentage");
  });

  it("tablePayload has 29 rows", () => {
    const result = buildTemporalModel(temporalFixture, temporalMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.tablePayload.rows).toHaveLength(29);
  });
});

// ---- buildTemporalModel — validation ----------------------------------------

describe("buildTemporalModel — validation", () => {
  it("returns 'invalid' when temporal_rows is empty or absent", () => {
    expect(buildTemporalModel(minPayload(), temporalMarker)).toBe("invalid");
    expect(buildTemporalModel(minPayload({ temporal_rows: [] }), temporalMarker)).toBe("invalid");
  });

  it("returns 'invalid' when date_column is missing from temporal_rows", () => {
    const payload = minPayload({
      temporal_rows: [{ other_col: "2026-06-01T00:00:00Z", completeness_percentage: 99 }],
    });
    expect(buildTemporalModel(payload, temporalMarker)).toBe("invalid");
  });

  it("returns 'invalid' when numeric_column is not a number", () => {
    const payload = minPayload({
      temporal_rows: [{ bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: "not-a-number" }],
    });
    expect(buildTemporalModel(payload, temporalMarker)).toBe("invalid");
  });

  it("returns 'invalid' when date values do not parse", () => {
    const payload = minPayload({
      temporal_rows: [{ bucket_start: "not-a-date", completeness_percentage: 99 }],
    });
    expect(buildTemporalModel(payload, temporalMarker)).toBe("invalid");
  });

  it("returns 'too-many-series' when categorical_column has more than 6 distinct values", () => {
    const rows = ["A", "B", "C", "D", "E", "F", "G"].map((k) => ({
      bucket_start: "2026-06-01T00:00:00Z",
      completeness_percentage: 99,
      mission: k,
    }));
    const payload = minPayload({ temporal_rows: rows });
    const marker: TemporalPlotMarker = {
      ...temporalMarker,
      categorical_column: "mission",
    };
    expect(buildTemporalModel(payload, marker)).toBe("too-many-series");
  });
});

// ---- buildTemporalModel — multi-series / mission colours --------------------

describe("buildTemporalModel — multi-series", () => {
  it("legend with 2 series: model has 2 series entries", () => {
    const rows = [
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 98, mission: "S1A" },
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 99, mission: "S2B" },
    ];
    const payload = minPayload({ temporal_rows: rows });
    const marker: TemporalPlotMarker = {
      ...temporalMarker,
      categorical_column: "mission",
    };
    const result = buildTemporalModel(payload, marker);
    const model = result as Exclude<typeof result, string>;
    expect(model.series).toHaveLength(2);
  });
});

// ---- seriesColorClass -------------------------------------------------------

describe("seriesColorClass — mission token detection", () => {
  it("maps S1A to mis1", () => expect(seriesColorClass("S1A", 0)).toBe("mis1"));
  it("maps S1 to mis1", () => expect(seriesColorClass("S1", 0)).toBe("mis1"));
  it("maps S2B to mis2", () => expect(seriesColorClass("S2B", 1)).toBe("mis2"));
  it("maps S3A to mis3", () => expect(seriesColorClass("S3A", 2)).toBe("mis3"));
  it("maps S5P to mis5p", () => expect(seriesColorClass("S5P", 3)).toBe("mis5p"));
  it("maps non-mission to neutral class by index", () => {
    expect(seriesColorClass("all", 0)).toBe("c0");
    expect(seriesColorClass("some_category", 2)).toBe("c2");
  });
  it("cycles neutral classes beyond index 5", () => {
    expect(seriesColorClass("any", 6)).toBe("c0");
  });
});

// ---- inferInterval ----------------------------------------------------------

describe("inferInterval", () => {
  it("returns median spacing for the temporal fixture (~1 day in ms)", () => {
    const dates = (temporalFixture.temporal_rows ?? []).map(
      (r) => Date.parse(r["bucket_start"] as string),
    );
    const interval = inferInterval(dates);
    const ONE_DAY_MS = 86_400_000;
    expect(interval).toBeGreaterThanOrEqual(ONE_DAY_MS * 0.99);
    expect(interval).toBeLessThanOrEqual(ONE_DAY_MS * 1.01);
  });

  it("returns default 1 day for a single date", () => {
    expect(inferInterval([Date.now()])).toBe(86_400_000);
  });
});

// ---- detectGaps -------------------------------------------------------------

describe("detectGaps", () => {
  const ONE_DAY = 86_400_000;

  it("consecutive daily points produce a single segment", () => {
    const pts = [
      { date: 0, value: 1 },
      { date: ONE_DAY, value: 2 },
      { date: 2 * ONE_DAY, value: 3 },
    ];
    const segs = detectGaps(pts, ONE_DAY);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(3);
  });

  it("missing day breaks the series into two segments", () => {
    const pts = [
      { date: 0, value: 1 },
      { date: 2 * ONE_DAY, value: 3 }, // day 1 missing → gap > 1.5 × interval
    ];
    const segs = detectGaps(pts, ONE_DAY);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(1);
    expect(segs[1]).toHaveLength(1);
  });

  it("empty input returns empty array", () => {
    expect(detectGaps([], ONE_DAY)).toEqual([]);
  });
});

// ---- niceYAxis --------------------------------------------------------------

describe("niceYAxis", () => {
  it("_percentage column → 0–100, 5 ticks", () => {
    const { min, max, ticks } = niceYAxis([98.9, 99.0, 100], true);
    expect(min).toBe(0);
    expect(max).toBe(100);
    expect(ticks).toEqual([0, 25, 50, 75, 100]);
  });

  it("non-percentage range → tick count ≤ 5", () => {
    const { ticks } = niceYAxis([1000, 2000, 3000, 4000, 5000], false);
    expect(ticks.length).toBeLessThanOrEqual(5);
  });

  it("empty array does not throw", () => {
    expect(() => niceYAxis([], false)).not.toThrow();
  });
});

// ---- xAxisTicks -------------------------------------------------------------

describe("xAxisTicks", () => {
  it("30 dates → at most 5 labels", () => {
    const dates = Array.from({ length: 30 }, (_, i) => i * 86_400_000);
    expect(xAxisTicks(dates, 5)).toHaveLength(5);
  });

  it("3 dates with maxCount=5 → 3 labels (no duplicates)", () => {
    const dates = [0, 86_400_000, 2 * 86_400_000];
    expect(xAxisTicks(dates, 5)).toHaveLength(3);
  });
});

// ---- roundDisplay -----------------------------------------------------------

describe("roundDisplay", () => {
  it("rounds floating noise to 1 decimal: 100.00000001707465 → 100.0", () => {
    expect(roundDisplay(100.00000001707465)).toBe(100.0);
  });

  it("rounds 1.0736398608112694 → 1.1", () => {
    expect(roundDisplay(1.0736398608112694)).toBe(1.1);
  });

  it("rounds 98.92636013918873 → 98.9", () => {
    expect(roundDisplay(98.92636013918873)).toBe(98.9);
  });
});

// ---- statusColorToken -------------------------------------------------------

describe("statusColorToken", () => {
  it("maps Complete → ok", () => expect(statusColorToken("Complete")).toBe("ok"));
  it("maps Partial → warn", () => expect(statusColorToken("Partial")).toBe("warn"));
  it("maps Missing → crit", () => expect(statusColorToken("Missing")).toBe("crit"));
  it("maps Unknown → text-dim", () => expect(statusColorToken("Unknown")).toBe("text-dim"));
  it("maps anything else → accent", () => expect(statusColorToken("Foo")).toBe("accent"));
});

// ---- buildCountModel — fixture ----------------------------------------------

describe("buildCountModel — histogram fixture", () => {
  it("builds category model with 3 bars", () => {
    const result = buildCountModel(histogramFixture, histogramMarker);
    expect(result).not.toBe("invalid");
    const model = result as Exclude<typeof result, string>;
    expect(model.kind).toBe("category");
    if (model.kind === "category") {
      expect(model.bars).toHaveLength(3);
    }
  });

  it("bar values are 3728, 37, 6 in received order", () => {
    const result = buildCountModel(histogramFixture, histogramMarker);
    const model = result as Exclude<typeof result, string>;
    if (model.kind === "category") {
      expect(model.bars[0].value).toBe(3728);
      expect(model.bars[1].value).toBe(37);
      expect(model.bars[2].value).toBe(6);
    }
  });

  it("each status bar gets its status color token", () => {
    const result = buildCountModel(histogramFixture, histogramMarker);
    const model = result as Exclude<typeof result, string>;
    if (model.kind === "category") {
      expect(model.bars[0].colorToken).toBe("ok");   // Complete
      expect(model.bars[1].colorToken).toBe("warn");  // Partial
      expect(model.bars[2].colorToken).toBe("crit");  // Missing
    }
  });

  it("title falls back to payload title", () => {
    const result = buildCountModel(histogramFixture, histogramMarker);
    const model = result as Exclude<typeof result, string>;
    expect(model.title).toBe(histogramFixture.title);
  });
});

// ---- buildCountModel — validation / table-fallback -------------------------

describe("buildCountModel — validation", () => {
  it("returns 'invalid' when count_column is not numeric", () => {
    const payload = minPayload({
      rows: [{ status: "Complete", record_count: "not-a-number" }],
      columns: ["status", "record_count"],
    });
    const marker: CountHistogramMarker = {
      kind: "count-histogram",
      data_id: "artifact_test",
      count_column: "record_count",
      category_column: "status",
    };
    expect(buildCountModel(payload, marker)).toBe("invalid");
  });

  it("returns table-fallback when both date_column and category_column are set", () => {
    const payload = minPayload({
      rows: [{ date: "2026-06-01", status: "Complete", count: 10 }],
      columns: ["date", "status", "count"],
    });
    const marker: CountHistogramMarker = {
      kind: "count-histogram",
      data_id: "artifact_test",
      count_column: "count",
      date_column: "date",
      category_column: "status",
    };
    const result = buildCountModel(payload, marker);
    expect(result).not.toBe("invalid");
    if (result !== "invalid") {
      expect(result.kind).toBe("table-fallback");
    }
  });

  it("returns 'invalid' when neither date_column nor category_column is set", () => {
    const payload = minPayload({
      rows: [{ count: 5 }],
      columns: ["count"],
    });
    const marker: CountHistogramMarker = {
      kind: "count-histogram",
      data_id: "artifact_test",
      count_column: "count",
    };
    expect(buildCountModel(payload, marker)).toBe("invalid");
  });
});

// ---- formatDateLabel -------------------------------------------------------

describe("formatDateLabel", () => {
  it("formats 2026-06-01 UTC as '1 Jun'", () => {
    expect(formatDateLabel(Date.parse("2026-06-01T00:00:00Z"))).toBe("1 Jun");
  });
});

// ---- readout text helpers ---------------------------------------------------

describe("temporalReadoutText", () => {
  it("formats percentage point as '01 Jun 2026 · 98.9 %'", () => {
    expect(temporalReadoutText(Date.parse("2026-06-01T00:00:00Z"), 98.926, true)).toBe(
      "01 Jun 2026 · 98.9 %",
    );
  });

  it("formats non-percentage point without % suffix", () => {
    expect(temporalReadoutText(Date.parse("2026-06-01T00:00:00Z"), 1234.5, false)).toBe(
      "01 Jun 2026 · 1234.5",
    );
  });
});

describe("countReadoutText", () => {
  it("formats label and count as 'Complete · 3,728'", () => {
    expect(countReadoutText("Complete", 3728)).toBe("Complete · 3,728");
  });

  it("uses full label (not truncated) in readout", () => {
    const long = "A very long category label name";
    expect(countReadoutText(long, 42)).toBe(`${long} · 42`);
  });
});
