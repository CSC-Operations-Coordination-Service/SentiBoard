import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import type { TabularPayload, TemporalPlotMarker } from "./types";
import { TemporalChartView, type TemporalChartState } from "./TemporalChart";
import { buildTemporalModel } from "./chart-model";

// ---- Mocks ------------------------------------------------------------------

vi.mock("./actions", () => ({ getChatData: vi.fn() }));

// ---- Helpers ----------------------------------------------------------------

function parse(html: string): Document {
  return new JSDOM(html).window.document;
}

function render(state: TemporalChartState, extraProps?: Partial<{ width: number; showTable: boolean }>): string {
  return renderToStaticMarkup(
    createElement(TemporalChartView, {
      state,
      width: extraProps?.width ?? 360,
      showTable: extraProps?.showTable ?? false,
    }),
  );
}

const sampleMarker: TemporalPlotMarker = {
  kind: "temporal-plot",
  data_id: "artifact_6852056cc5804bf5a0307055b7d9eb32",
  date_column: "bucket_start",
  numeric_column: "completeness_percentage",
};

const temporalFixture = (await import("./__fixtures__/chatbot-sample-temporal.json", {
  with: { type: "json" },
})).default as TabularPayload;

function doneState(): TemporalChartState & { status: "done" } {
  const model = buildTemporalModel(temporalFixture, sampleMarker);
  if (model === "invalid" || model === "too-many-series") throw new Error("unexpected");
  return { status: "done", model };
}

// ---- Loading / error states -------------------------------------------------

describe("TemporalChartView — loading/error states", () => {
  it("loading state renders a message", () => {
    expect(render({ status: "loading" })).toContain("Loading chart");
  });

  it("not_found state renders a message", () => {
    expect(render({ status: "not_found" })).toContain("no longer available");
  });

  it("unavailable state renders message", () => {
    expect(render({ status: "unavailable" })).toContain("Could not load");
  });

  it("invalid state renders message", () => {
    expect(render({ status: "invalid" })).toContain("could not be displayed");
  });
});

// ---- Done state — chart SVG ------------------------------------------------

describe("TemporalChartView — done state (chart)", () => {
  it("renders 29 visible point circles from the temporal fixture", () => {
    const html = render(doneState());
    const doc = parse(html);
    const circles = doc.querySelectorAll("circle");
    expect(circles.length).toBe(29);
  });

  it("renders an SVG with role=img", () => {
    const html = render(doneState());
    const doc = parse(html);
    const svg = doc.querySelector("svg[role='img']");
    expect(svg).not.toBeNull();
  });

  it("includes the chart title in the output", () => {
    const html = render(doneState());
    // title comes from payload (marker has no title attribute)
    expect(html).toContain(temporalFixture.title.slice(0, 20));
  });

  it("renders a 'Show as table' button", () => {
    const html = render(doneState());
    expect(html).toContain("Show as table");
  });

  it("'all' never appears in chart output (single series, no legend)", () => {
    const html = render(doneState());
    // "all" must not appear as a series label, legend entry, or column name
    expect(html).not.toContain(">all<");
    expect(html).not.toContain('"all"');
  });

  it("does not render a legend for a single series", () => {
    const html = render(doneState());
    // No legendItem or legend class expected for single series
    expect(html).not.toContain("legendItem");
  });
});

// ---- Done state — 2 series legend ------------------------------------------

describe("TemporalChartView — 2-series legend", () => {
  it("renders a legend when there are 2 or more named series", () => {
    const rows = [
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 98, mission: "S1A" },
      { bucket_start: "2026-06-02T00:00:00Z", completeness_percentage: 99, mission: "S1A" },
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 97, mission: "S2B" },
      { bucket_start: "2026-06-02T00:00:00Z", completeness_percentage: 96, mission: "S2B" },
    ];
    const payload: TabularPayload = {
      data_id: "artifact_test",
      title: "Test",
      description: "",
      columns: [],
      rows: [],
      temporal_rows: rows,
    };
    const marker: TemporalPlotMarker = {
      ...sampleMarker,
      categorical_column: "mission",
    };
    const model = buildTemporalModel(payload, marker);
    if (model === "invalid" || model === "too-many-series") throw new Error("unexpected");
    const html = render({ status: "done", model });
    expect(html).toContain("S1A");
    expect(html).toContain("S2B");
    expect(html).toContain("legendSwatch");
  });

  it("S2A + S2B + S2C (same mission) all get distinct neutral classes, no mis2", () => {
    const rows = [
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 98, mission: "S2A" },
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 97, mission: "S2B" },
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 96, mission: "S2C" },
    ];
    const payload: TabularPayload = {
      data_id: "artifact_test",
      title: "Test",
      description: "",
      columns: [],
      rows: [],
      temporal_rows: rows,
    };
    const marker: TemporalPlotMarker = { ...sampleMarker, categorical_column: "mission" };
    const model = buildTemporalModel(payload, marker);
    if (model === "invalid" || model === "too-many-series") throw new Error("unexpected");
    const html = render({ status: "done", model });
    // All three series must use the neutral palette, not mission tokens
    expect(html).not.toContain("mis2");
    // Three distinct neutral classes present
    const hasC0 = html.includes("c0");
    const hasC1 = html.includes("c1");
    const hasC2 = html.includes("c2");
    expect(hasC0 && hasC1 && hasC2).toBe(true);
  });

  it("applies mission token class (mis1) to S1A series", () => {
    const rows = [
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 98, mission: "S1A" },
      { bucket_start: "2026-06-01T00:00:00Z", completeness_percentage: 97, mission: "S2B" },
    ];
    const payload: TabularPayload = {
      data_id: "artifact_test",
      title: "Test",
      description: "",
      columns: [],
      rows: [],
      temporal_rows: rows,
    };
    const marker: TemporalPlotMarker = {
      ...sampleMarker,
      categorical_column: "mission",
    };
    const model = buildTemporalModel(payload, marker);
    if (model === "invalid" || model === "too-many-series") throw new Error("unexpected");
    const html = render({ status: "done", model });
    expect(html).toContain("mis1");
    expect(html).toContain("mis2");
  });
});

// ---- Show as table ---------------------------------------------------------

describe("TemporalChartView — show as table", () => {
  it("showTable=true renders DataTableView (no SVG circle)", () => {
    const html = render(doneState(), { showTable: true });
    expect(html).not.toContain("<circle");
    // DataTableView renders a table element
    expect(html.toLowerCase()).toContain("<table");
  });

  it("showTable=true renders a 'Show chart' button", () => {
    const html = render(doneState(), { showTable: true });
    expect(html).toContain("Show chart");
  });

  it("showTable=true table has 29 data rows", () => {
    const html = render(doneState(), { showTable: true });
    const doc = parse(html);
    // tbody rows = data rows (excluding header)
    const rows = doc.querySelectorAll("tbody tr");
    expect(rows.length).toBe(29);
  });
});

// ---- too-many-series → table-only ------------------------------------------

describe("TemporalChartView — table-only state (>6 series)", () => {
  function tooManySeriesState() {
    const rows = ["A", "B", "C", "D", "E", "F", "G"].map((k) => ({
      bucket_start: "2026-06-01T00:00:00Z",
      completeness_percentage: 99,
      mission: k,
    }));
    const payload: TabularPayload = {
      data_id: "artifact_test",
      title: "Too many series",
      description: "",
      columns: [],
      rows: [],
      temporal_rows: rows,
    };
    const marker: TemporalPlotMarker = { ...sampleMarker, categorical_column: "mission" };
    const result = buildTemporalModel(payload, marker);
    if (result !== "too-many-series") throw new Error("expected too-many-series");
    const tablePayload: TabularPayload = {
      data_id: payload.data_id,
      title: payload.title,
      description: "",
      columns: Object.keys(rows[0]),
      rows,
    };
    return { status: "table-only" as const, tablePayload, title: payload.title };
  }

  it(">6 series: buildTemporalModel returns too-many-series", () => {
    const rows = ["A", "B", "C", "D", "E", "F", "G"].map((k) => ({
      bucket_start: "2026-06-01T00:00:00Z",
      completeness_percentage: 99,
      mission: k,
    }));
    const payload: TabularPayload = {
      data_id: "artifact_test",
      title: "Too many",
      description: "",
      columns: [],
      rows: [],
      temporal_rows: rows,
    };
    const marker: TemporalPlotMarker = { ...sampleMarker, categorical_column: "mission" };
    expect(buildTemporalModel(payload, marker)).toBe("too-many-series");
  });

  it(">6 series: table-only state renders a table, not an SVG", () => {
    const html = render(tooManySeriesState());
    expect(html.toLowerCase()).toContain("<table");
    expect(html).not.toContain("<svg");
  });
});
