import { describe, expect, it } from "vitest";
import { parseResponse, TEXT_ATTR_MAX_LEN } from "./parse-response";
import type { Segment, WidgetSegment } from "./types";
import {
  RES_KPI_DIRECT,
  RES_KPI_ARTIFACT,
  RES_TABULAR,
  RES_TEMPORAL_PLOT,
  RES_COUNT_HISTOGRAM,
  RES_EVENT_CALENDAR,
  RES_MIXED,
  RES_PROSE_AROUND,
  RES_MALFORMED_UNKNOWN_TAG,
  RES_MALFORMED_DUPLICATE_ATTR,
  RES_MALFORMED_MISSING_REQUIRED,
  RES_MALFORMED_BAD_DATA_ID_CASE,
  RES_MALFORMED_BAD_DATA_ID_PREFIX,
  RES_MALFORMED_BAD_COLUMN_DIGIT,
  RES_MALFORMED_BAD_COLUMN_LONG,
  RES_MALFORMED_BAD_SORT_ORDER,
  RES_MALFORMED_BAD_KPI_COLOR,
  RES_MALFORMED_DOUBLE_QUOTE_IN_VALUE,
  RES_MALFORMED_HISTOGRAM_NO_GROUP,
  RES_MALFORMED_KPI_MIXED_FORMS,
  RES_MALFORMED_UNKNOWN_ATTR,
  RES_MALFORMED_EMPTY_REQUIRED,
  RES_EMPTY,
  RES_ONLY_WHITESPACE,
  RES_ONLY_MARKER,
  RES_ONLY_MARKERS,
  RES_UNCLOSED_TAG,
  RES_HUGE_STRING,
} from "./__fixtures__/responses";

function widget(segs: Segment[], idx = 0): WidgetSegment {
  const ws = segs.filter((s): s is WidgetSegment => s.kind === "widget");
  return ws[idx];
}

function markdowns(segs: Segment[]): string[] {
  return segs.filter((s) => s.kind === "markdown").map((s) => s.text);
}

// ---------------------------------------------------------------------------
// Each marker type parses
// ---------------------------------------------------------------------------

describe("parseResponse — tabular marker", () => {
  it("produces a widget segment with correct fields", () => {
    const segs = parseResponse(RES_TABULAR);
    const w = widget(segs);
    expect(w.marker.kind).toBe("tabular");
    if (w.marker.kind !== "tabular") return;
    expect(w.marker.data_id).toBe("artifact_ABC123");
    expect(w.marker.title).toBe("Partial datatakes");
    expect(w.marker.sort_column).toBe("completeness_percentage");
    expect(w.marker.sort_order).toBe("asc");
  });

  it("parses tabular with only data_id", () => {
    const segs = parseResponse(`<tabular data_id="artifact_xyz" />`);
    const w = widget(segs);
    expect(w.marker.kind).toBe("tabular");
    if (w.marker.kind !== "tabular") return;
    expect(w.marker.title).toBeUndefined();
    expect(w.marker.sort_column).toBeUndefined();
  });
});

describe("parseResponse — temporal-plot marker", () => {
  it("produces a widget segment with all fields", () => {
    const segs = parseResponse(RES_TEMPORAL_PLOT);
    const w = widget(segs);
    expect(w.marker.kind).toBe("temporal-plot");
    if (w.marker.kind !== "temporal-plot") return;
    expect(w.marker.data_id).toBe("artifact_ABC123");
    expect(w.marker.date_column).toBe("bucket_start");
    expect(w.marker.numeric_column).toBe("mean_completeness_percentage");
    expect(w.marker.categorical_column).toBe("mission");
    expect(w.marker.event_data_id).toBe("artifact_DEF456");
    expect(w.marker.context_event_data_id).toBe("artifact_GHI789");
  });

  it("parses temporal-plot with only required fields", () => {
    const raw = `<temporal-plot data_id="artifact_A" date_column="dt" numeric_column="val" />`;
    const segs = parseResponse(raw);
    const w = widget(segs);
    expect(w.marker.kind).toBe("temporal-plot");
    if (w.marker.kind !== "temporal-plot") return;
    expect(w.marker.categorical_column).toBeUndefined();
    expect(w.marker.event_data_id).toBeUndefined();
  });
});

describe("parseResponse — count-histogram marker", () => {
  it("produces a widget segment with date_column", () => {
    const segs = parseResponse(RES_COUNT_HISTOGRAM);
    const w = widget(segs);
    expect(w.marker.kind).toBe("count-histogram");
    if (w.marker.kind !== "count-histogram") return;
    expect(w.marker.count_column).toBe("record_count");
    expect(w.marker.date_column).toBe("bucket_start");
    expect(w.marker.category_column).toBe("mission");
  });

  it("parses count-histogram with only category_column (no date_column)", () => {
    const raw = `<count-histogram data_id="artifact_A" count_column="n" category_column="cat" />`;
    const segs = parseResponse(raw);
    expect(widget(segs).marker.kind).toBe("count-histogram");
  });

  it("parses count-histogram with only date_column (no category_column)", () => {
    const raw = `<count-histogram data_id="artifact_A" count_column="n" date_column="dt" />`;
    const segs = parseResponse(raw);
    expect(widget(segs).marker.kind).toBe("count-histogram");
  });
});

describe("parseResponse — event-calendar marker", () => {
  it("produces a widget segment", () => {
    const segs = parseResponse(RES_EVENT_CALENDAR);
    const w = widget(segs);
    expect(w.marker.kind).toBe("event-calendar");
    if (w.marker.kind !== "event-calendar") return;
    expect(w.marker.data_id).toBe("artifact_ABC123");
    expect(w.marker.title).toBe("CAMS events");
  });
});

describe("parseResponse — KPI markers", () => {
  it("parses direct KPI with all fields", () => {
    const segs = parseResponse(RES_KPI_DIRECT);
    const w = widget(segs);
    expect(w.marker.kind).toBe("kpi-direct");
    if (w.marker.kind !== "kpi-direct") return;
    expect(w.marker.label).toBe("Completeness");
    expect(w.marker.value).toBe("98.5%");
    expect(w.marker.color).toBe("green");
    expect(w.marker.delta).toBe("up 1.2 points");
  });

  it("parses artifact-backed KPI", () => {
    const segs = parseResponse(RES_KPI_ARTIFACT);
    const w = widget(segs);
    expect(w.marker.kind).toBe("kpi-artifact");
    if (w.marker.kind !== "kpi-artifact") return;
    expect(w.marker.data_id).toBe("artifact_ABC123");
    expect(w.marker.title).toBe("Availability overview");
  });

  it("distinguishes direct from artifact-backed by presence of data_id", () => {
    const direct = parseResponse(`<kpi label="L" value="V" />`);
    expect(widget(direct).marker.kind).toBe("kpi-direct");
    const artifact = parseResponse(`<kpi data_id="artifact_X" />`);
    expect(widget(artifact).marker.kind).toBe("kpi-artifact");
  });

  it("parses all five valid direct KPI colors", () => {
    for (const color of ["green", "orange", "red", "blue", "gray"] as const) {
      const segs = parseResponse(`<kpi label="L" value="V" color="${color}" />`);
      const m = widget(segs).marker;
      expect(m.kind).toBe("kpi-direct");
      if (m.kind === "kpi-direct") expect(m.color).toBe(color);
    }
  });

  it("parses direct KPI without optional fields", () => {
    const segs = parseResponse(`<kpi label="L" value="V" />`);
    const m = widget(segs).marker;
    expect(m.kind).toBe("kpi-direct");
    if (m.kind === "kpi-direct") {
      expect(m.color).toBeUndefined();
      expect(m.delta).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Segment order and merging
// ---------------------------------------------------------------------------

describe("parseResponse — segment order", () => {
  it("preserves source order across marker types", () => {
    const segs = parseResponse(RES_MIXED);
    const kinds = segs.map((s) => s.kind);
    // markdown, widget(kpi-direct), markdown, widget(temporal-plot), markdown, widget(tabular)
    expect(kinds).toEqual([
      "markdown", "widget", "markdown", "widget", "markdown", "widget",
    ]);
    expect(segs[1].kind === "widget" && segs[1].marker.kind).toBe("kpi-direct");
    expect(segs[3].kind === "widget" && segs[3].marker.kind).toBe("temporal-plot");
    expect(segs[5].kind === "widget" && segs[5].marker.kind).toBe("tabular");
  });

  it("produces prose before and after a widget", () => {
    const segs = parseResponse(RES_PROSE_AROUND);
    expect(segs[0].kind).toBe("markdown");
    expect(segs[1].kind).toBe("widget");
    expect(segs[2].kind).toBe("markdown");
    if (segs[2].kind === "markdown") {
      expect(segs[2].text).toContain("review the events carefully");
    }
  });

  it("merges adjacent markdown pieces into one segment", () => {
    // Two prose paragraphs with a malformed (non-widget) marker between them
    const raw = `First para\n<unknown_tag />\nSecond para`;
    const segs = parseResponse(raw);
    // All text should end up in one markdown segment (the bad tag is not a candidate)
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("markdown");
  });

  it("merges text around a rejected marker into one segment", () => {
    const raw = `Before text <kpi label="" value="V" /> after text`;
    const segs = parseResponse(raw);
    // empty label = invalid, so the whole thing is one markdown segment
    const mds = markdowns(segs);
    expect(mds.join("")).toContain("Before text");
    expect(mds.join("")).toContain("after text");
    expect(segs.every((s) => s.kind === "markdown")).toBe(true);
  });

  it("drops whitespace-only markdown segments", () => {
    const raw = `<kpi label="A" value="1" /><event-calendar data_id="artifact_abc" />`;
    const segs = parseResponse(raw);
    expect(segs.every((s) => s.kind === "widget")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Rejection rules — each stays as markdown text
// ---------------------------------------------------------------------------

describe("parseResponse — rejection rules", () => {
  function expectAllMarkdown(raw: string): void {
    const segs = parseResponse(raw);
    expect(segs.every((s) => s.kind === "markdown")).toBe(true);
  }

  it("rejects unknown tag name", () => {
    expectAllMarkdown(RES_MALFORMED_UNKNOWN_TAG);
  });

  it("rejects duplicate attribute", () => {
    expectAllMarkdown(RES_MALFORMED_DUPLICATE_ATTR);
  });

  it("rejects missing required attribute", () => {
    expectAllMarkdown(RES_MALFORMED_MISSING_REQUIRED);
  });

  it("rejects data_id with wrong case prefix (Artifact_ instead of artifact_)", () => {
    expectAllMarkdown(RES_MALFORMED_BAD_DATA_ID_CASE);
  });

  it("rejects data_id without artifact_ prefix", () => {
    expectAllMarkdown(RES_MALFORMED_BAD_DATA_ID_PREFIX);
  });

  it("rejects column name starting with a digit", () => {
    expectAllMarkdown(RES_MALFORMED_BAD_COLUMN_DIGIT);
  });

  it("rejects column name exceeding 64 characters", () => {
    expectAllMarkdown(RES_MALFORMED_BAD_COLUMN_LONG);
  });

  it("rejects sort_order not in {asc, desc}", () => {
    expectAllMarkdown(RES_MALFORMED_BAD_SORT_ORDER);
  });

  it("rejects KPI color not in the allowed set", () => {
    expectAllMarkdown(RES_MALFORMED_BAD_KPI_COLOR);
  });

  it("rejects apparent double quote inside a value", () => {
    expectAllMarkdown(RES_MALFORMED_DOUBLE_QUOTE_IN_VALUE);
  });

  it("rejects count-histogram with neither date_column nor category_column", () => {
    expectAllMarkdown(RES_MALFORMED_HISTOGRAM_NO_GROUP);
  });

  it("rejects KPI with both data_id and label (mixed forms)", () => {
    expectAllMarkdown(RES_MALFORMED_KPI_MIXED_FORMS);
  });

  it("rejects unknown attribute on a known tag", () => {
    expectAllMarkdown(RES_MALFORMED_UNKNOWN_ATTR);
  });

  it("rejects empty required attribute", () => {
    expectAllMarkdown(RES_MALFORMED_EMPTY_REQUIRED);
  });

  it("rejects data_id that is only artifact_ with no suffix", () => {
    expectAllMarkdown(`<tabular data_id="artifact_" />`);
  });

  it("rejects ARTIFACT_ in uppercase", () => {
    expectAllMarkdown(`<tabular data_id="ARTIFACT_abc" />`);
  });

  it("rejects sort_order ascending (verbose form)", () => {
    expectAllMarkdown(
      `<tabular data_id="artifact_A" sort_column="col" sort_order="ascending" />`
    );
  });

  it("rejects temporal-plot missing date_column", () => {
    expectAllMarkdown(
      `<temporal-plot data_id="artifact_A" numeric_column="val" />`
    );
  });

  it("rejects temporal-plot missing numeric_column", () => {
    expectAllMarkdown(
      `<temporal-plot data_id="artifact_A" date_column="dt" />`
    );
  });

  it("rejects kpi-artifact with extra direct-only attr (color)", () => {
    expectAllMarkdown(`<kpi data_id="artifact_A" color="green" />`);
  });

  it("rejects kpi-direct with extra artifact-only attr (title is not in direct allowed set)", () => {
    expectAllMarkdown(`<kpi label="L" value="V" title="T" />`);
  });

  it("rejects text attr exceeding TEXT_ATTR_MAX_LEN", () => {
    const longTitle = "a".repeat(TEXT_ATTR_MAX_LEN + 1);
    expectAllMarkdown(`<event-calendar data_id="artifact_A" title="${longTitle}" />`);
  });

  it("accepts text attr at exactly TEXT_ATTR_MAX_LEN", () => {
    const maxTitle = "a".repeat(TEXT_ATTR_MAX_LEN);
    const segs = parseResponse(
      `<event-calendar data_id="artifact_A" title="${maxTitle}" />`
    );
    expect(segs.some((s) => s.kind === "widget")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// No-throw guarantee
// ---------------------------------------------------------------------------

describe("parseResponse — never throws", () => {
  it("handles empty string", () => {
    expect(() => parseResponse(RES_EMPTY)).not.toThrow();
    expect(parseResponse(RES_EMPTY)).toEqual([]);
  });

  it("handles whitespace-only input", () => {
    expect(() => parseResponse(RES_ONLY_WHITESPACE)).not.toThrow();
    expect(parseResponse(RES_ONLY_WHITESPACE)).toHaveLength(0);
  });

  it("handles input that is only a valid marker", () => {
    expect(() => parseResponse(RES_ONLY_MARKER)).not.toThrow();
    expect(parseResponse(RES_ONLY_MARKER)).toHaveLength(1);
  });

  it("handles input that is only markers with no prose", () => {
    expect(() => parseResponse(RES_ONLY_MARKERS)).not.toThrow();
    const segs = parseResponse(RES_ONLY_MARKERS);
    expect(segs.every((s) => s.kind === "widget")).toBe(true);
  });

  it("handles unclosed tag", () => {
    expect(() => parseResponse(RES_UNCLOSED_TAG)).not.toThrow();
    const segs = parseResponse(RES_UNCLOSED_TAG);
    expect(segs.every((s) => s.kind === "markdown")).toBe(true);
  });

  it("handles a very large string", () => {
    expect(() => parseResponse(RES_HUGE_STRING)).not.toThrow();
    const segs = parseResponse(RES_HUGE_STRING);
    expect(segs.some((s) => s.kind === "widget")).toBe(true);
  });

  it("handles a string with only prose (no markers)", () => {
    const raw = "This is a long answer with no widgets at all.\nJust text.\n\n## A heading\n\nMore text.";
    expect(() => parseResponse(raw)).not.toThrow();
    expect(parseResponse(raw)).toHaveLength(1);
  });
});
