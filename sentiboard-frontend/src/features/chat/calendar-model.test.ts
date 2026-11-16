import { describe, expect, it } from "vitest";
import type { CalendarEvent, EventCalendarPayload } from "./types";
import {
  buildCalendarModel,
  calendarGridOffset,
  calendarMonthDays,
  formatDayHeading,
  formatTimeUTC,
  utcDayKey,
  CATEGORY_LABEL,
} from "./calendar-model";

// ---- Helpers ----------------------------------------------------------------

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
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

function makePayload(events: CalendarEvent[]): EventCalendarPayload {
  return { data_id: "artifact_test", title: "Test calendar", description: "", events };
}

// ---- utcDayKey --------------------------------------------------------------

describe("utcDayKey", () => {
  it("extracts the UTC date portion (event at 23:30Z stays on its UTC day)", () => {
    expect(utcDayKey("2026-06-01T23:30:00.000Z")).toBe("2026-06-01");
  });

  it("extracts date for a midnight event", () => {
    expect(utcDayKey("2026-06-15T00:00:00Z")).toBe("2026-06-15");
  });
});

// ---- buildCalendarModel: grouping ------------------------------------------

describe("buildCalendarModel — grouping", () => {
  it("groups an event with occurred_at null into the 'no-date' group", () => {
    const model = buildCalendarModel(makePayload([makeEvent({ occurred_at: null })]));
    expect(model.byDay.has("no-date")).toBe(true);
    expect(model.byDay.get("no-date")!.count).toBe(1);
  });

  it("event at 23:30Z maps to its UTC day key (not rolled forward)", () => {
    const model = buildCalendarModel(
      makePayload([makeEvent({ occurred_at: "2026-06-01T23:30:00.000Z" })]),
    );
    expect(model.byDay.has("2026-06-01")).toBe(true);
    expect(model.byDay.has("2026-06-02")).toBe(false);
  });

  it("counts events correctly per day", () => {
    const events = [
      makeEvent({ key: "A", occurred_at: "2026-06-01T03:00:00Z" }),
      makeEvent({ key: "B", occurred_at: "2026-06-01T06:00:00Z" }),
      makeEvent({ key: "C", occurred_at: "2026-06-02T10:00:00Z" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.byDay.get("2026-06-01")!.count).toBe(2);
    expect(model.byDay.get("2026-06-02")!.count).toBe(1);
  });
});

// ---- buildCalendarModel: highest criticality --------------------------------

describe("buildCalendarModel — highest criticality", () => {
  it("Blocking beats Critical and Routine", () => {
    const events = [
      makeEvent({ key: "a", criticality: "Critical" }),
      makeEvent({ key: "b", criticality: "Blocking" }),
      makeEvent({ key: "c", criticality: "Routine" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.byDay.get("2026-06-01")!.highest).toBe("Blocking");
  });

  it("Critical beats Routine and null", () => {
    const events = [
      makeEvent({ key: "a", criticality: "Routine" }),
      makeEvent({ key: "b", criticality: "Critical" }),
      makeEvent({ key: "c", criticality: null }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.byDay.get("2026-06-01")!.highest).toBe("Critical");
  });

  it("Routine beats null", () => {
    const events = [
      makeEvent({ key: "a", criticality: null }),
      makeEvent({ key: "b", criticality: "Routine" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.byDay.get("2026-06-01")!.highest).toBe("Routine");
  });

  it("null when all events have null criticality", () => {
    const events = [makeEvent({ key: "a", criticality: null })];
    const model = buildCalendarModel(makePayload(events));
    expect(model.byDay.get("2026-06-01")!.highest).toBeNull();
  });
});

// ---- buildCalendarModel: month range ----------------------------------------

describe("buildCalendarModel — month range", () => {
  it("single-month payload produces one month", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: "2026-06-01T00:00:00Z" }),
      makeEvent({ key: "b", occurred_at: "2026-06-15T00:00:00Z" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.months).toEqual(["2026-06"]);
  });

  it("events spanning two months produce both months in order", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: "2026-05-31T00:00:00Z" }),
      makeEvent({ key: "b", occurred_at: "2026-06-01T00:00:00Z" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.months).toEqual(["2026-05", "2026-06"]);
  });
});

// ---- calendarGridOffset (Monday-first) ------------------------------------

describe("calendarGridOffset", () => {
  it("June 2026 starts on Monday → offset 0", () => {
    expect(calendarGridOffset("2026-06")).toBe(0);
  });

  it("July 2026 starts on Wednesday → offset 2", () => {
    expect(calendarGridOffset("2026-07")).toBe(2);
  });

  it("Sunday start → offset 6", () => {
    // 2026-11 starts on Sunday
    expect(calendarGridOffset("2026-11")).toBe(6);
  });
});

// ---- buildCalendarModel: initialSelection -----------------------------------

describe("buildCalendarModel — initialSelection", () => {
  it("returns the first chronological day key for dated events", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: "2026-06-10T00:00:00Z" }),
      makeEvent({ key: "b", occurred_at: "2026-06-05T00:00:00Z" }),
      makeEvent({ key: "c", occurred_at: "2026-06-01T00:00:00Z" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.initialSelection).toBe("2026-06-01");
  });

  it("returns 'no-date' when all events have null occurred_at", () => {
    const events = [
      makeEvent({ key: "a", occurred_at: null }),
      makeEvent({ key: "b", occurred_at: null }),
    ];
    const model = buildCalendarModel(makePayload(events));
    expect(model.initialSelection).toBe("no-date");
  });
});

// ---- Day list ordering -------------------------------------------------------

describe("buildCalendarModel — day event ordering", () => {
  it("events within a day are sorted ascending by occurred_at", () => {
    const events = [
      makeEvent({ key: "late",  occurred_at: "2026-06-01T20:00:00Z" }),
      makeEvent({ key: "early", occurred_at: "2026-06-01T03:00:00Z" }),
      makeEvent({ key: "mid",   occurred_at: "2026-06-01T12:00:00Z" }),
    ];
    const model = buildCalendarModel(makePayload(events));
    const keys = model.byDay.get("2026-06-01")!.events.map((e) => e.key);
    expect(keys).toEqual(["early", "mid", "late"]);
  });
});

// ---- formatDayHeading -------------------------------------------------------

describe("formatDayHeading", () => {
  it("formats a dated day correctly with plural", () => {
    expect(formatDayHeading("2026-06-02", 4)).toBe("Tue 2 Jun 2026 · 4 tickets");
  });

  it("uses singular 'ticket' for count of 1", () => {
    expect(formatDayHeading("2026-06-01", 1)).toBe("Mon 1 Jun 2026 · 1 ticket");
  });

  it("formats 'no-date' group heading", () => {
    expect(formatDayHeading("no-date", 3)).toBe("No date · 3 tickets");
  });
});

// ---- formatTimeUTC ----------------------------------------------------------

describe("formatTimeUTC", () => {
  it("extracts HH:MM from ISO string", () => {
    expect(formatTimeUTC("2026-06-01T03:45:00.000Z")).toBe("03:45");
  });
});

// ---- CATEGORY_LABEL ---------------------------------------------------------

describe("CATEGORY_LABEL", () => {
  it("maps rfi to RFI", () => {
    expect(CATEGORY_LABEL["rfi"]).toBe("RFI");
  });

  it("maps other to Other", () => {
    expect(CATEGORY_LABEL["other"]).toBe("Other");
  });

  it("maps acquisition to Acquisition", () => {
    expect(CATEGORY_LABEL["acquisition"]).toBe("Acquisition");
  });

  it("maps production to Production", () => {
    expect(CATEGORY_LABEL["production"]).toBe("Production");
  });

  it("maps satellite to Satellite", () => {
    expect(CATEGORY_LABEL["satellite"]).toBe("Satellite");
  });
});

// ---- calendarMonthDays -------------------------------------------------------

describe("calendarMonthDays", () => {
  it("June has 30 days", () => {
    expect(calendarMonthDays("2026-06")).toBe(30);
  });

  it("February 2026 has 28 days (not a leap year)", () => {
    expect(calendarMonthDays("2026-02")).toBe(28);
  });
});

// ---- Titles trimmed ---------------------------------------------------------

describe("buildCalendarModel — titles trimmed", () => {
  it("trims trailing spaces from event titles", () => {
    const model = buildCalendarModel(
      makePayload([makeEvent({ title: "My Event   " })]),
    );
    const ev = model.byDay.get("2026-06-01")!.events[0];
    expect(ev.title).toBe("My Event");
  });
});

// ---- Fixture smoke test: 30 days, 106 events --------------------------------

const calendarFixture = (await import("./__fixtures__/chatbot-sample-calendar.json", {
  with: { type: "json" },
})).default as EventCalendarPayload;

describe("buildCalendarModel — real fixture", () => {
  it("fixture has 106 events", () => {
    expect(calendarFixture.events).toHaveLength(106);
  });

  it("builds 30 dated day entries from the fixture", () => {
    const model = buildCalendarModel(calendarFixture);
    const datedDays = [...model.byDay.keys()].filter((k) => k !== "no-date");
    expect(datedDays).toHaveLength(30);
  });
});
