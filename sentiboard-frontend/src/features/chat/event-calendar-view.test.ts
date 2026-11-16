import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import type { EventCalendarMarker, EventCalendarPayload } from "./types";
import { EventCalendarView, type EventCalendarState } from "./EventCalendar";
import { buildCalendarModel } from "./calendar-model";

// ---- Mocks ------------------------------------------------------------------

vi.mock("./actions", () => ({ getChatData: vi.fn() }));

// ---- Helpers ----------------------------------------------------------------

function parse(html: string): Document {
  return new JSDOM(html).window.document;
}

const baseMarker: EventCalendarMarker = {
  kind: "event-calendar",
  data_id: "artifact_abc",
};

function makeEvent(overrides: Partial<EventCalendarPayload["events"][0]> = {}): EventCalendarPayload["events"][0] {
  return {
    key: "GSANOM-1",
    occurred_at: "2026-06-01T03:00:00.000Z",
    title: "Test event",
    description: "",
    category: "acquisition",
    category_basis: "native_origin",
    origin: null,
    status: "Open",
    criticality: "Routine",
    affected_systems: [],
    datatake_ids: [],
    associated_datatake_count: 0,
    ...overrides,
  };
}

function makePayload(events: EventCalendarPayload["events"]): EventCalendarPayload {
  return { data_id: "artifact_abc", title: "My calendar", description: "", events };
}

function doneState(payload: EventCalendarPayload): EventCalendarState & { status: "done" } {
  const model = buildCalendarModel(payload);
  return { status: "done", payload, model };
}

function render(
  state: EventCalendarState,
  opts: {
    marker?: EventCalendarMarker;
    selectedDay?: string;
    currentMonth?: string;
    showTable?: boolean;
    expandedDatatakeKeys?: ReadonlySet<string>;
  } = {},
): string {
  const payload = state.status === "done" ? state.payload : makePayload([makeEvent()]);
  const model = state.status === "done" ? state.model : buildCalendarModel(payload);
  const sel = opts.selectedDay ?? model.initialSelection;
  const month = opts.currentMonth ?? (model.months[0] ?? "2026-06");

  return renderToStaticMarkup(
    createElement(EventCalendarView, {
      state,
      marker: opts.marker ?? baseMarker,
      selectedDay: sel,
      currentMonth: month,
      showTable: opts.showTable ?? false,
      expandedDatatakeKeys: opts.expandedDatatakeKeys,
    }),
  );
}

// ---- Loading / error states -------------------------------------------------

describe("EventCalendarView — loading/error states", () => {
  it("loading renders a message", () => {
    expect(render({ status: "loading" })).toContain("Loading calendar");
  });

  it("not_found renders a message", () => {
    expect(render({ status: "not_found" })).toContain("no longer available");
  });

  it("unavailable renders message and Try again when onRetry provided", () => {
    const html = renderToStaticMarkup(
      createElement(EventCalendarView, {
        state: { status: "unavailable" },
        marker: baseMarker,
        selectedDay: "",
        currentMonth: "2026-06",
        showTable: false,
        onRetry: () => {},
      }),
    );
    expect(html).toContain("Could not load");
    expect(html).toContain("Try again");
  });

  it("invalid renders message", () => {
    expect(render({ status: "invalid" })).toContain("could not be displayed");
  });
});

// ---- Title fallback ---------------------------------------------------------

describe("EventCalendarView — title fallback", () => {
  it("marker.title overrides payload title", () => {
    const payload = makePayload([makeEvent()]);
    const state = doneState(payload);
    const markerWithTitle: EventCalendarMarker = { ...baseMarker, title: "Marker title" };
    const html = render(state, { marker: markerWithTitle });
    expect(html).toContain("Marker title");
    expect(html).not.toContain("My calendar");
  });

  it("payload title shown when marker has no title", () => {
    const payload = makePayload([makeEvent()]);
    const state = doneState(payload);
    const html = render(state, { marker: baseMarker });
    expect(html).toContain("My calendar");
  });
});

// ---- Empty description → no <details> ---------------------------------------

describe("EventCalendarView — description", () => {
  it("empty description → no <details> element", () => {
    const payload = makePayload([makeEvent({ description: "" })]);
    const state = doneState(payload);
    const doc = parse(render(state));
    expect(doc.querySelector("details")).toBeNull();
  });

  it("non-empty description → <details> element present", () => {
    const payload = makePayload([makeEvent({ description: "Some info about this anomaly." })]);
    const state = doneState(payload);
    const doc = parse(render(state));
    expect(doc.querySelector("details")).not.toBeNull();
  });

  it("description containing HTML tags renders as plain text, not elements", () => {
    const payload = makePayload([makeEvent({ description: "<b>important</b> note" })]);
    const state = doneState(payload);
    const doc = parse(render(state));
    // The <b> must NOT appear as an element inside the description body
    const descBody = doc.querySelector("details p");
    expect(descBody).not.toBeNull();
    expect(descBody!.querySelector("b")).toBeNull();
    expect(descBody!.textContent).toContain("<b>important</b>");
  });
});

// ---- Datatake collapsing ----------------------------------------------------

describe("EventCalendarView — datatake collapsing", () => {
  it("7 datatakes: shows 5 visible + '+2 more' button with aria-expanded=false", () => {
    const ids = ["DT-1", "DT-2", "DT-3", "DT-4", "DT-5", "DT-6", "DT-7"];
    const payload = makePayload([makeEvent({ datatake_ids: ids })]);
    const state = doneState(payload);
    const doc = parse(render(state));
    expect(doc.documentElement.innerHTML).toContain("DT-1");
    expect(doc.documentElement.innerHTML).toContain("DT-5");
    const moreBtn = doc.querySelector("button[aria-expanded='false']");
    expect(moreBtn).not.toBeNull();
    expect(moreBtn!.textContent).toContain("+2 more");
    // DT-6 and DT-7 not shown before expansion
    expect(doc.documentElement.innerHTML).not.toContain("DT-6");
  });

  it("5 datatakes: shows all 5, no '+N more' button", () => {
    const ids = ["DT-1", "DT-2", "DT-3", "DT-4", "DT-5"];
    const payload = makePayload([makeEvent({ datatake_ids: ids })]);
    const state = doneState(payload);
    const html = render(state);
    expect(html).toContain("DT-5");
    expect(html).not.toContain("aria-expanded");
  });

  it("expanded: shows all IDs and 'Show less' button with aria-expanded=true", () => {
    const ids = ["DT-1", "DT-2", "DT-3", "DT-4", "DT-5", "DT-6", "DT-7"];
    const payload = makePayload([makeEvent({ key: "GSANOM-1", datatake_ids: ids })]);
    const state = doneState(payload);
    const doc = parse(render(state, { expandedDatatakeKeys: new Set(["GSANOM-1"]) }));
    expect(doc.documentElement.innerHTML).toContain("DT-6");
    expect(doc.documentElement.innerHTML).toContain("DT-7");
    const lessBtn = doc.querySelector("button[aria-expanded='true']");
    expect(lessBtn).not.toBeNull();
    expect(lessBtn!.textContent).toContain("Show less");
  });
});

// ---- aria-pressed -----------------------------------------------------------

describe("EventCalendarView — aria-pressed", () => {
  it("aria-pressed=true only on the selected day button", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: "2026-06-01T00:00:00Z" }),
      makeEvent({ key: "b", occurred_at: "2026-06-02T00:00:00Z" }),
    ];
    const payload = makePayload(events);
    const state = doneState(payload);
    const doc = parse(render(state, { selectedDay: "2026-06-01" }));
    const pressedBtns = [...doc.querySelectorAll("button[aria-pressed='true']")];
    expect(pressedBtns).toHaveLength(1);
    // The pressed button is the day cell for June 1
  });

  it("no-date chip: aria-pressed=true when selected", () => {
    const events = [makeEvent({ occurred_at: null })];
    const payload = makePayload(events);
    const state = doneState(payload);
    const doc = parse(render(state, { selectedDay: "no-date" }));
    const pressedBtns = [...doc.querySelectorAll("button[aria-pressed='true']")];
    expect(pressedBtns).toHaveLength(1);
  });
});

// ---- Month navigation buttons -----------------------------------------------

describe("EventCalendarView — prev/next month buttons", () => {
  it("only one month → prev/next buttons not rendered", () => {
    const payload = makePayload([makeEvent({ occurred_at: "2026-06-01T00:00:00Z" })]);
    const state = doneState(payload);
    const html = render(state);
    expect(html).not.toContain("Previous month");
    expect(html).not.toContain("Next month");
  });

  it("two months → prev/next buttons rendered", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: "2026-06-01T00:00:00Z" }),
      makeEvent({ key: "b", occurred_at: "2026-07-01T00:00:00Z" }),
    ];
    const payload = makePayload(events);
    const state = doneState(payload);
    const html = render(state, { currentMonth: "2026-06" });
    expect(html).toContain("Previous month");
    expect(html).toContain("Next month");
  });
});

// ---- No-date chip -----------------------------------------------------------

describe("EventCalendarView — no-date chip", () => {
  it("no-date chip absent when no null-date events", () => {
    const payload = makePayload([makeEvent({ occurred_at: "2026-06-01T00:00:00Z" })]);
    const state = doneState(payload);
    const doc = parse(render(state));
    expect(doc.querySelector("button[aria-pressed]")).toBeTruthy(); // day button exists
    // No chip with "No date" text at the top level
    const noDateBtns = [...doc.querySelectorAll("button")].filter((b) =>
      b.textContent?.includes("No date"),
    );
    expect(noDateBtns).toHaveLength(0);
  });

  it("no-date chip present when null-date events exist", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: "2026-06-01T00:00:00Z" }),
      makeEvent({ key: "b", occurred_at: null }),
    ];
    const payload = makePayload(events);
    const state = doneState(payload);
    const html = render(state);
    expect(html).toContain("No date");
  });
});

// ---- Time rendered as HH:MM UTC ---------------------------------------------

describe("EventCalendarView — time display", () => {
  it("event time displayed as HH:MM UTC", () => {
    const payload = makePayload([makeEvent({ occurred_at: "2026-06-01T14:35:00.000Z" })]);
    const state = doneState(payload);
    const html = render(state);
    expect(html).toContain("14:35 UTC");
  });
});

// ---- Category labels --------------------------------------------------------

describe("EventCalendarView — category labels", () => {
  it("rfi → RFI badge", () => {
    const payload = makePayload([makeEvent({ category: "rfi" })]);
    const state = doneState(payload);
    const html = render(state);
    expect(html).toContain("RFI");
  });

  it("other → Other badge", () => {
    const payload = makePayload([makeEvent({ category: "other" })]);
    const state = doneState(payload);
    const html = render(state);
    expect(html).toContain("Other");
  });

  it("acquisition → Acquisition badge", () => {
    const html = render(doneState(makePayload([makeEvent({ category: "acquisition" })])));
    expect(html).toContain("Acquisition");
  });
});

// ---- selectedDay shows the correct day's events ----------------------------

describe("EventCalendarView — selectedDay prop", () => {
  it("shows only the events of the selectedDay", () => {
    const events = [
      makeEvent({ key: "day1-ev", occurred_at: "2026-06-01T00:00:00Z", title: "Day one event" }),
      makeEvent({ key: "day2-ev", occurred_at: "2026-06-02T00:00:00Z", title: "Day two event" }),
    ];
    const payload = makePayload(events);
    const state = doneState(payload);
    const html = render(state, { selectedDay: "2026-06-02" });
    expect(html).toContain("Day two event");
    expect(html).not.toContain("Day one event");
  });
});

// ---- Show as table: fixture with 106 tickets --------------------------------

const calendarFixture = (await import("./__fixtures__/chatbot-sample-calendar.json", {
  with: { type: "json" },
})).default as EventCalendarPayload;

describe("EventCalendarView — show as table", () => {
  it("'Show as table' renders exactly 106 rows from the real fixture", () => {
    const state = doneState(calendarFixture);
    const html = render(state, { showTable: true });
    const doc = parse(html);
    const rows = doc.querySelectorAll("tbody tr");
    expect(rows.length).toBe(106);
  });

  it("'Show calendar' button present in table mode", () => {
    const state = doneState(calendarFixture);
    const html = render(state, { showTable: true });
    expect(html).toContain("Show calendar");
  });
});

// ---- Full fixture: 30 day buttons in calendar view -------------------------

describe("EventCalendarView — full fixture calendar", () => {
  it("renders exactly 30 day buttons (one per day with events)", () => {
    const state = doneState(calendarFixture);
    const doc = parse(render(state));
    // Day buttons have aria-pressed attribute (day cells with events)
    const dayBtns = [...doc.querySelectorAll("button[aria-pressed]")].filter(
      (b) => !b.classList.contains("noDateChip"),
    );
    expect(dayBtns).toHaveLength(30);
  });
});
