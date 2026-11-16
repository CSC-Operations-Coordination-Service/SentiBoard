import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TabularMarker, TabularPayload } from "./types";
import {
  DataTableView,
  type TableState,
  clearDataCache,
  fetchOnce,
} from "./DataTable";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const getChatDataMock = vi.fn();
vi.mock("./actions", () => ({
  getChatData: (...args: unknown[]) => getChatDataMock(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse(html: string): Document {
  return new JSDOM(html).window.document;
}

const sampleMarker: TabularMarker = {
  kind: "tabular",
  data_id: "artifact_abc123",
};

const minimalPayload: TabularPayload = {
  data_id: "artifact_abc123",
  title: "Payload title",
  description: "desc",
  columns: ["datatake_id", "status"],
  rows: [
    { datatake_id: "S3A-001", status: "Missing" },
    { datatake_id: "S3A-002", status: "Complete" },
  ],
};

function render(state: TableState, marker = sampleMarker, onRetry?: () => void, onSort?: (c: string) => void): string {
  return renderToStaticMarkup(createElement(DataTableView, { state, marker, onRetry, onSort }));
}

// ---------------------------------------------------------------------------
// State rendering
// ---------------------------------------------------------------------------

describe("DataTableView — state rendering", () => {
  it("renders loading message", () => {
    expect(render({ status: "loading" })).toContain("Loading table");
  });

  it("renders not_found message", () => {
    const html = render({ status: "not_found" });
    expect(html).toContain("no longer available");
    expect(html).toContain("ask again");
  });

  it("renders unavailable message with Try again button when onRetry is provided", () => {
    const html = render({ status: "unavailable" }, sampleMarker, () => {});
    expect(html).toContain("Could not load the data");
    expect(html).toContain("Try again");
  });

  it("renders unavailable message without Try again button when onRetry is absent", () => {
    const html = render({ status: "unavailable" });
    expect(html).toContain("Could not load the data");
    expect(html).not.toContain("Try again");
  });

  it("renders invalid message", () => {
    const html = render({ status: "invalid" });
    expect(html).toContain("could not be displayed");
  });

  it("renders 'No rows.' when payload has empty rows", () => {
    const state: TableState = {
      status: "done",
      payload: { ...minimalPayload, rows: [] },
      sort: null,
    };
    expect(render(state)).toContain("No rows.");
  });
});

// ---------------------------------------------------------------------------
// Title precedence
// ---------------------------------------------------------------------------

describe("DataTableView — title", () => {
  it("uses marker title over payload title", () => {
    const state: TableState = {
      status: "done",
      payload: { ...minimalPayload, title: "Payload title" },
      sort: null,
    };
    const marker: TabularMarker = { kind: "tabular", data_id: "artifact_abc123", title: "Marker title" };
    const html = render(state, marker);
    expect(html).toContain("Marker title");
    expect(html).not.toContain("Payload title");
  });

  it("uses payload title when marker has none", () => {
    const state: TableState = {
      status: "done",
      payload: { ...minimalPayload, title: "Payload title" },
      sort: null,
    };
    const html = render(state);
    expect(html).toContain("Payload title");
  });
});

// ---------------------------------------------------------------------------
// Column rendering
// ---------------------------------------------------------------------------

describe("DataTableView — columns", () => {
  it("renders readable column headers (not raw field names)", () => {
    const state: TableState = { status: "done", payload: minimalPayload, sort: null };
    const doc = parse(render(state));
    const headers = [...doc.querySelectorAll("th")].map((th) => th.textContent ?? "");
    expect(headers.some((h) => h.includes("Datatake"))).toBe(true);
    expect(headers.every((h) => !h.includes("datatake_id"))).toBe(true);
  });

  it("hides `expected` column when `expected_sensing` is present", () => {
    const state: TableState = {
      status: "done",
      payload: {
        ...minimalPayload,
        columns: ["expected", "expected_sensing", "status"],
        rows: [{ expected: 1000000, expected_sensing: "16 min 40 sec", status: "Missing" }],
      },
      sort: null,
    };
    const doc = parse(render(state));
    const headers = [...doc.querySelectorAll("th")].map((th) => th.textContent ?? "");
    expect(headers.some((h) => h.includes("Expected sensing"))).toBe(true);
    expect(headers.every((h) => !h.trim().toLowerCase().startsWith("expected") || h.includes("sensing"))).toBe(true);
  });

  it("shows the row count", () => {
    const state: TableState = { status: "done", payload: minimalPayload, sort: null };
    expect(render(state)).toContain("2 rows");
  });

  it("renders a Download CSV button", () => {
    const state: TableState = { status: "done", payload: minimalPayload, sort: null };
    expect(render(state)).toContain("Download CSV");
  });
});

// ---------------------------------------------------------------------------
// Sorting — aria-sort attribute
// ---------------------------------------------------------------------------

describe("DataTableView — sorting", () => {
  it("sets aria-sort='ascending' on the sorted column header", () => {
    const state: TableState = {
      status: "done",
      payload: minimalPayload,
      sort: { col: "datatake_id", order: "asc" },
    };
    const doc = parse(render(state));
    const ths = [...doc.querySelectorAll("th")];
    const sortedTh = ths.find((th) => th.getAttribute("aria-sort") === "ascending");
    expect(sortedTh).toBeDefined();
    expect(sortedTh?.textContent).toContain("Datatake");
  });

  it("sets aria-sort='descending' when order is desc", () => {
    const state: TableState = {
      status: "done",
      payload: minimalPayload,
      sort: { col: "status", order: "desc" },
    };
    const doc = parse(render(state));
    const sortedTh = [...doc.querySelectorAll("th")].find(
      (th) => th.getAttribute("aria-sort") === "descending",
    );
    expect(sortedTh).toBeDefined();
    expect(sortedTh?.textContent).toContain("Status");
  });

  it("does not set aria-sort on unsorted columns", () => {
    const state: TableState = {
      status: "done",
      payload: minimalPayload,
      sort: { col: "datatake_id", order: "asc" },
    };
    const doc = parse(render(state));
    const unsortedThs = [...doc.querySelectorAll("th")].filter(
      (th) => !th.getAttribute("aria-sort"),
    );
    expect(unsortedThs.length).toBeGreaterThan(0);
  });

  it("renders initial sort from marker's sort_column/sort_order", () => {
    const state: TableState = {
      status: "done",
      payload: minimalPayload,
      sort: { col: "status", order: "asc" },
    };
    const markerWithSort: TabularMarker = {
      kind: "tabular",
      data_id: "artifact_abc123",
      sort_column: "status",
      sort_order: "asc",
    };
    const doc = parse(render(state, markerWithSort));
    const sortedTh = [...doc.querySelectorAll("th")].find(
      (th) => th.getAttribute("aria-sort") === "ascending",
    );
    expect(sortedTh?.textContent).toContain("Status");
  });
});

// ---------------------------------------------------------------------------
// Fixture smoke test
// ---------------------------------------------------------------------------

describe("DataTableView — fixture smoke test", () => {
  it("renders the real sample: 143 rows, readable headers, no raw microsecond columns", async () => {
    const fixture = (await import("./__fixtures__/chatbot-sample-tabular.json", {
      with: { type: "json" },
    })).default as TabularPayload;

    expect(fixture.rows).toHaveLength(143);

    const state: TableState = { status: "done", payload: fixture, sort: null };
    const doc = parse(render(state));

    // Row count displayed
    const html = renderToStaticMarkup(createElement(DataTableView, { state, marker: sampleMarker }));
    expect(html).toContain("143 rows");

    // Readable headers, no raw snake_case
    const headers = [...doc.querySelectorAll("th")].map((th) => th.textContent?.trim() ?? "");
    expect(headers.some((h) => h.includes("Datatake"))).toBe(true);
    expect(headers.every((h) => !h.includes("datatake_id"))).toBe(true);
    expect(headers.every((h) => !h.includes("observation_time_start"))).toBe(true);

    // Raw microsecond columns hidden (expected_sensing and available_sensing are present)
    const thTexts = headers.map((h) => h.toLowerCase());
    expect(thTexts.every((h) => h !== "expected")).toBe(true);
    expect(thTexts.every((h) => h !== "available")).toBe(true);

    // Download CSV button present
    expect(html).toContain("Download CSV");
  });
});

// ---------------------------------------------------------------------------
// fetchOnce cache behaviour
// ---------------------------------------------------------------------------

describe("fetchOnce cache", () => {
  beforeEach(() => {
    clearDataCache();
    getChatDataMock.mockReset();
  });

  const VALID_DATA_ID = "artifact_abc123";
  const VALID_REQUEST_ID = "22222222-2222-4222-8222-222222222222";

  it("shares the in-flight promise for the same (requestId, dataId)", async () => {
    getChatDataMock.mockResolvedValue({
      ok: true,
      kind: "tabular",
      data: minimalPayload,
    });
    const p1 = fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    const p2 = fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(p1).toBe(p2);
    await p1;
    expect(getChatDataMock).toHaveBeenCalledOnce();
  });

  it("caches ok results so a second call does not re-fetch", async () => {
    getChatDataMock.mockResolvedValue({ ok: true, kind: "tabular", data: minimalPayload });
    await fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    await fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(getChatDataMock).toHaveBeenCalledOnce();
  });

  it("does not cache unavailable — second call re-fetches", async () => {
    getChatDataMock.mockResolvedValue({ ok: false, reason: "unavailable" });
    await fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    await fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(getChatDataMock).toHaveBeenCalledTimes(2);
  });

  it("caches not_found — second call does not re-fetch", async () => {
    getChatDataMock.mockResolvedValue({ ok: false, reason: "not_found" });
    await fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    await fetchOnce(VALID_DATA_ID, VALID_REQUEST_ID);
    expect(getChatDataMock).toHaveBeenCalledOnce();
  });

  it("distinguishes cache keys by (requestId, dataId)", async () => {
    getChatDataMock.mockResolvedValue({ ok: true, kind: "tabular", data: minimalPayload });
    await fetchOnce("artifact_aaa", VALID_REQUEST_ID);
    await fetchOnce("artifact_bbb", VALID_REQUEST_ID);
    expect(getChatDataMock).toHaveBeenCalledTimes(2);
  });
});
