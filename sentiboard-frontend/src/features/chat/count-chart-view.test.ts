import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import type { CountHistogramMarker, TabularPayload } from "./types";
import { CountChartView, type CountChartState } from "./CountChart";
import { buildCountModel } from "./chart-model";

// ---- Mocks ------------------------------------------------------------------

vi.mock("./actions", () => ({ getChatData: vi.fn() }));

// ---- Helpers ----------------------------------------------------------------

function parse(html: string): Document {
  return new JSDOM(html).window.document;
}

function render(state: CountChartState, marker = sampleMarker, extraProps?: Partial<{ width: number; showTable: boolean }>): string {
  return renderToStaticMarkup(
    createElement(CountChartView, {
      state,
      marker,
      width: extraProps?.width ?? 360,
      showTable: extraProps?.showTable ?? false,
    }),
  );
}

const sampleMarker: CountHistogramMarker = {
  kind: "count-histogram",
  data_id: "artifact_b7ef5d9e82b64e03b270c8b31e9d768c",
  count_column: "record_count",
  category_column: "status",
};

const histogramFixture = (await import("./__fixtures__/chatbot-sample-histogram.json", {
  with: { type: "json" },
})).default as TabularPayload;

function doneState(): CountChartState & { status: "done" } {
  const model = buildCountModel(histogramFixture, sampleMarker);
  if (model === "invalid") throw new Error("unexpected invalid");
  return { status: "done", model };
}

// ---- Loading / error states -------------------------------------------------

describe("CountChartView — loading/error states", () => {
  it("loading state renders a message", () => {
    expect(render({ status: "loading" })).toContain("Loading chart");
  });

  it("not_found renders a message", () => {
    expect(render({ status: "not_found" })).toContain("no longer available");
  });

  it("unavailable renders message", () => {
    expect(render({ status: "unavailable" })).toContain("Could not load");
  });

  it("invalid renders message", () => {
    expect(render({ status: "invalid" })).toContain("could not be displayed");
  });
});

// ---- Done state — category bars --------------------------------------------

describe("CountChartView — done state (category bars)", () => {
  it("renders 3 bar <rect> elements", () => {
    const html = render(doneState());
    const doc = parse(html);
    // Count rects that are actual bars (have class barOk/barWarn/barCrit/barTextDim/barAccent)
    const rects = doc.querySelectorAll("rect");
    expect(rects.length).toBe(3);
  });

  it("renders an SVG with role=img", () => {
    const html = render(doneState());
    const doc = parse(html);
    expect(doc.querySelector("svg[role='img']")).not.toBeNull();
  });

  it("first bar label is formatted '3,728' (en-GB grouping)", () => {
    const html = render(doneState());
    expect(html).toContain("3,728");
  });

  it("renders 'Show as table' button", () => {
    expect(render(doneState())).toContain("Show as table");
  });

  it("Complete bar has ok status CSS class", () => {
    const html = render(doneState());
    expect(html).toContain("barOk");
  });

  it("Partial bar has warn CSS class", () => {
    const html = render(doneState());
    expect(html).toContain("barWarn");
  });

  it("Missing bar has crit CSS class", () => {
    const html = render(doneState());
    expect(html).toContain("barCrit");
  });
});

// ---- Table fallback --------------------------------------------------------

describe("CountChartView — table fallback (date + category)", () => {
  const payload: TabularPayload = {
    data_id: "artifact_test",
    title: "Date and category",
    description: "",
    columns: ["date", "status", "count"],
    rows: [{ date: "2026-06-01", status: "Complete", count: 100 }],
  };
  const marker: CountHistogramMarker = {
    kind: "count-histogram",
    data_id: "artifact_test",
    count_column: "count",
    date_column: "date",
    category_column: "status",
  };

  it("renders a note about the table fallback", () => {
    const model = buildCountModel(payload, marker);
    if (model === "invalid") throw new Error("unexpected");
    const html = render({ status: "done", model }, marker);
    expect(html).toContain("shown as a table");
  });

  it("renders a table (DataTableView), no SVG bars", () => {
    const model = buildCountModel(payload, marker);
    if (model === "invalid") throw new Error("unexpected");
    const html = render({ status: "done", model }, marker);
    expect(html.toLowerCase()).toContain("<table");
    expect(html).not.toContain("<rect");
  });
});

// ---- Show as table ---------------------------------------------------------

describe("CountChartView — show as table", () => {
  it("showTable=true renders DataTableView (no SVG)", () => {
    const html = render(doneState(), sampleMarker, { showTable: true });
    expect(html.toLowerCase()).toContain("<table");
    expect(html).not.toContain("<rect");
  });

  it("showTable=true renders a 'Show chart' button", () => {
    const html = render(doneState(), sampleMarker, { showTable: true });
    expect(html).toContain("Show chart");
  });

  it("showTable=true table shows 3 data rows from histogram fixture", () => {
    const html = render(doneState(), sampleMarker, { showTable: true });
    const doc = parse(html);
    const rows = doc.querySelectorAll("tbody tr");
    expect(rows.length).toBe(3);
  });
});
