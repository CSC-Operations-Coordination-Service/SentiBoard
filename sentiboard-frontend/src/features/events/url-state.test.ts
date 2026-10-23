import { describe, expect, it } from "vitest";
import {
  calendarCells,
  filterEvents,
  parseView,
  resolveView,
  viewHref,
  viewParams,
  type EventsView,
} from "./url-state";
import { adaptEvents, toEventCard } from "./adapter";
import { CATEGORIES } from "./model";
import { RECORDS } from "./__fixtures__/anomaly-records";

/* ---- helpers ---- */

function params(qs: string) {
  return new URLSearchParams(qs);
}

const allCards = adaptEvents(RECORDS).events.map(toEventCard);

/* ---- parseView ---- */

describe("parseView", () => {
  it("falls back to current UTC year/month for missing params", () => {
    const now = new Date();
    const ym = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const v = parseView(params(""), ym);
    expect(v.year).toBe(ym.year);
    expect(v.month).toBe(ym.month);
    expect(v.mission).toBe("");
    expect(v.satellite).toBe("");
    expect(v.categories).toEqual(CATEGORIES);
    expect(v.q).toBe("");
    expect(v.event).toBeNull();
  });

  it("parses explicit year, month, mission, satellite", () => {
    const v = parseView(params("year=2023&month=4&mission=s1&satellite=S1A"), { year: 2023, month: 1 });
    expect(v.year).toBe(2023);
    expect(v.month).toBe(4);
    expect(v.mission).toBe("s1");
    expect(v.satellite).toBe("S1A");
  });

  it("ignores invalid year (< 2014)", () => {
    const now = new Date();
    const ym = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const v = parseView(params("year=2010&month=6"), ym);
    expect(v.year).toBe(ym.year);
  });

  it("ignores invalid month (> 12)", () => {
    const now = new Date();
    const ym = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const v = parseView(params("month=13"), ym);
    expect(v.month).toBe(ym.month);
  });

  it("ignores unknown mission value", () => {
    const v = parseView(params("mission=s9"), { year: 2023, month: 1 });
    expect(v.mission).toBe("");
  });

  it("parses comma-separated category filter", () => {
    const v = parseView(params("category=Acquisition,Production"), { year: 2023, month: 1 });
    expect(v.categories).toEqual(["Acquisition", "Production"]);
  });

  it("falls back to all categories on empty category param", () => {
    const v = parseView(params("category="), { year: 2023, month: 1 });
    expect(v.categories).toEqual(CATEGORIES);
  });

  it("normalises ?showDayEvents=YYYY-MM-DD to year/month", () => {
    const v = parseView(params("showDayEvents=2022-11-15"), { year: 2023, month: 1 });
    expect(v.year).toBe(2022);
    expect(v.month).toBe(11);
    expect(v.mission).toBe("");
  });

  it("ignores ?showDayEvents when year/month are already explicit", () => {
    const v = parseView(params("year=2023&month=4&showDayEvents=2022-11-15"), { year: 2023, month: 1 });
    expect(v.year).toBe(2023);
    expect(v.month).toBe(4);
  });

  it("parses event param", () => {
    const v = parseView(params("event=EVT-001"), { year: 2023, month: 1 });
    expect(v.event).toBe("EVT-001");
  });
});

/* ---- viewParams round-trip ---- */

describe("viewParams / viewHref round-trip", () => {
  it("omits defaults from the serialised params", () => {
    const now = new Date();
    const ym = { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
    const view: EventsView = {
      year: ym.year,
      month: ym.month,
      mission: "",
      satellite: "",
      categories: [...CATEGORIES],
      q: "",
      event: null,
    };
    const p = viewParams(view, ym);
    expect(p.toString()).toBe("");
    expect(viewHref(view, ym)).toBe("/events");
  });

  it("includes non-default values", () => {
    const view: EventsView = {
      year: 2023,
      month: 4,
      mission: "s2",
      satellite: "S2A",
      categories: ["Acquisition"],
      q: "platform",
      event: "EVT-001",
    };
    const p = viewParams(view, { year: 2026, month: 10 });
    expect(p.get("year")).toBe("2023");
    expect(p.get("month")).toBe("4");
    expect(p.get("mission")).toBe("s2");
    expect(p.get("satellite")).toBe("S2A");
    expect(p.get("category")).toBe("Acquisition");
    expect(p.get("q")).toBe("platform");
    expect(p.get("event")).toBe("EVT-001");
  });

  it("always includes month when year differs from now, even if month matches now", () => {
    // month=10 matches now.month=10, but year=2025 != now.year=2026 → month must be explicit
    const view: EventsView = {
      year: 2025,
      month: 10,
      mission: "",
      satellite: "",
      categories: [...CATEGORIES],
      q: "",
      event: null,
    };
    const p = viewParams(view, { year: 2026, month: 10 });
    expect(p.get("year")).toBe("2025");
    expect(p.get("month")).toBe("10");
  });

  it("round-trips a full non-default view", () => {
    const view: EventsView = {
      year: 2023,
      month: 4,
      mission: "s1",
      satellite: "S1A",
      categories: ["Production", "Satellite"],
      q: "reset",
      event: "EVT-002",
    };
    const now = { year: 2026, month: 10 };
    const back = parseView(viewParams(view, now), now);
    expect(back.year).toBe(2023);
    expect(back.month).toBe(4);
    expect(back.mission).toBe("s1");
    expect(back.satellite).toBe("S1A");
    expect(back.categories).toEqual(["Production", "Satellite"]);
    expect(back.q).toBe("reset");
    expect(back.event).toBe("EVT-002");
  });
});

/* ---- resolveView ---- */

describe("resolveView", () => {
  it("returns the view unchanged when event is null", () => {
    const v: EventsView = { year: 2023, month: 4, mission: "", satellite: "", categories: [...CATEGORIES], q: "", event: null };
    expect(resolveView(v, allCards)).toEqual(v);
  });

  it("drops unknown event ids", () => {
    const v: EventsView = { year: 2023, month: 4, mission: "", satellite: "", categories: [...CATEGORIES], q: "", event: "UNKNOWN" };
    const resolved = resolveView(v, allCards);
    expect(resolved.event).toBeNull();
  });

  it("keeps the view when the event belongs to the current month", () => {
    const v: EventsView = { year: 2023, month: 4, mission: "", satellite: "", categories: [...CATEGORIES], q: "", event: "EVT-001" };
    const resolved = resolveView(v, allCards);
    expect(resolved.year).toBe(2023);
    expect(resolved.month).toBe(4);
    expect(resolved.event).toBe("EVT-001");
  });

  it("switches to the event's start month when the current month is not the start month", () => {
    // EVT-001 starts 2023-04-10; viewing December 2023 → should switch to April 2023
    const v: EventsView = { year: 2023, month: 12, mission: "", satellite: "", categories: [...CATEGORIES], q: "", event: "EVT-001" };
    const resolved = resolveView(v, allCards);
    expect(resolved.year).toBe(2023);
    expect(resolved.month).toBe(4);
  });

  it("switches to the event's start month for a cross-month event viewed in a later month", () => {
    // EVT-003 starts 2023-04-27, ends 2023-05-03; viewing May 2023 → should switch to April 2023
    const v: EventsView = { year: 2023, month: 5, mission: "", satellite: "", categories: [...CATEGORIES], q: "", event: "EVT-003" };
    const resolved = resolveView(v, allCards);
    expect(resolved.year).toBe(2023);
    expect(resolved.month).toBe(4);
    expect(resolved.event).toBe("EVT-003");
  });
});

/* ---- filterEvents ---- */

describe("filterEvents", () => {
  const baseView: EventsView = { year: 2023, month: 4, mission: "", satellite: "", categories: [...CATEGORIES], q: "", event: null };

  it("returns only events whose startDate is in the selected month", () => {
    const filtered = filterEvents(allCards, baseView);
    expect(filtered.every((e) => e.startDate.startsWith("2023-04"))).toBe(true);
  });

  it("places a cross-month event only in its start month, not in later months it spans", () => {
    // EVT-003 starts 2023-04-27, ends 2023-05-03 — appears in April only
    const aprilView = { ...baseView, year: 2023, month: 4 };
    const mayView = { ...baseView, year: 2023, month: 5 };
    const inApril = filterEvents(allCards, aprilView);
    const inMay = filterEvents(allCards, mayView);
    expect(inApril.find((e) => e.id === "EVT-003")).toBeTruthy();
    expect(inMay.find((e) => e.id === "EVT-003")).toBeUndefined();
  });

  it("filters by mission", () => {
    const v = { ...baseView, mission: "s1" as const };
    const filtered = filterEvents(allCards, v);
    expect(filtered.every((e) => e.mission === "s1")).toBe(true);
  });

  it("filters by satellite", () => {
    const v = { ...baseView, satellite: "S2B" };
    const filtered = filterEvents(allCards, v);
    expect(filtered.every((e) => e.satellite === "S2B")).toBe(true);
  });

  it("filters by single category", () => {
    const v = { ...baseView, categories: ["Acquisition" as const] };
    const filtered = filterEvents(allCards, v);
    expect(filtered.every((e) => e.category === "Acquisition")).toBe(true);
  });

  it("filters by q text (title match)", () => {
    const v = { ...baseView, q: "manoeuvre" };
    const filtered = filterEvents(allCards, v);
    expect(filtered.every((e) => e.title.toLowerCase().includes("manoeuvre"))).toBe(true);
  });

  it("returns empty when q matches nothing", () => {
    const v = { ...baseView, q: "zzz_no_match_zzz" };
    expect(filterEvents(allCards, v)).toHaveLength(0);
  });
});

/* ---- dayEvents pipeline ---- */

describe("dayEvents pipeline: filterEvents + startDate join", () => {
  it("excludes same-day events that do not pass the active category filter", () => {
    // EVT-001 (Acquisition, 2023-04-10, S1A) and EVT-002 (Production, 2023-04-10, S2B)
    // share startDate. With categories=["Acquisition"], EVT-002 must be absent.
    const allDetails = adaptEvents(RECORDS).events;
    const allCards = allDetails.map(toEventCard);
    const view: EventsView = {
      year: 2023, month: 4,
      mission: "", satellite: "",
      categories: ["Acquisition" as const],
      q: "", event: "EVT-001",
    };
    const monthCards = filterEvents(allCards, view);
    const selectedCard = monthCards.find((c) => c.id === "EVT-001");
    expect(selectedCard).toBeTruthy();
    const dayIds = new Set(
      monthCards.filter((c) => c.startDate === selectedCard!.startDate).map((c) => c.id),
    );
    expect(dayIds.has("EVT-001")).toBe(true);   // Acquisition → passes
    expect(dayIds.has("EVT-002")).toBe(false);  // Production → filtered out
  });
});

/* ---- calendarCells ---- */

describe("calendarCells", () => {
  it("always has a total count that is a multiple of 7", () => {
    for (const [y, m] of [[2023, 1], [2023, 2], [2024, 2], [2023, 12]] as [number, number][]) {
      expect(calendarCells(y, m).length % 7).toBe(0);
    }
  });

  it("has exactly daysInMonth non-dim cells", () => {
    const cells = calendarCells(2023, 4); // April = 30 days
    expect(cells.filter((c) => !c.dim)).toHaveLength(30);
  });

  it("starts on Monday for October 2023 (first day = Sunday ISO weekday 7 → col 6)", () => {
    const cells = calendarCells(2023, 10);
    // Oct 2023: first day is Sunday → 6 dim cells before day 1
    const firstReal = cells.findIndex((c) => !c.dim);
    expect(firstReal).toBe(6);
    expect(cells[firstReal]?.day).toBe(1);
  });

  it("starts on Monday for April 2023 (first day = Saturday → col 5)", () => {
    const cells = calendarCells(2023, 4);
    const firstReal = cells.findIndex((c) => !c.dim);
    expect(firstReal).toBe(5);
    expect(cells[firstReal]?.day).toBe(1);
  });
});
