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
    expect(v.typesOff.size).toBe(0);
    expect(v.missionsOff.size).toBe(0);
    expect(v.satellitesOff.size).toBe(0);
    expect(v.q).toBe("");
    expect(v.event).toBeNull();
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

  it("parses explicit year and month", () => {
    const v = parseView(params("year=2023&month=4"), { year: 2023, month: 1 });
    expect(v.year).toBe(2023);
    expect(v.month).toBe(4);
  });

  it("parses typesOff param", () => {
    const v = parseView(params("typesOff=Calibration,Production"), { year: 2023, month: 1 });
    expect(v.typesOff).toEqual(new Set(["Calibration", "Production"]));
    expect(v.missionsOff.size).toBe(0);
  });

  it("parses missionsOff param", () => {
    const v = parseView(params("missionsOff=s2,s3"), { year: 2023, month: 1 });
    expect(v.missionsOff).toEqual(new Set(["s2", "s3"]));
    expect(v.typesOff.size).toBe(0);
  });

  it("parses satellitesOff param", () => {
    const v = parseView(params("satellitesOff=S1B,S2A"), { year: 2023, month: 1 });
    expect(v.satellitesOff).toEqual(new Set(["S1B", "S2A"]));
  });

  it("ignores unknown values in typesOff/missionsOff/satellitesOff", () => {
    const v = parseView(params("typesOff=Unknown,Calibration&missionsOff=s99,s1"), { year: 2023, month: 1 });
    expect(v.typesOff).toEqual(new Set(["Calibration"]));
    expect(v.missionsOff).toEqual(new Set(["s1"]));
  });

  it("defaults to all on when new params are all empty", () => {
    const v = parseView(params("typesOff=&missionsOff="), { year: 2023, month: 1 });
    expect(v.typesOff.size).toBe(0);
    expect(v.missionsOff.size).toBe(0);
  });

  // Legacy param conversion tests
  it("converts legacy mission=s1 to missionsOff (all except s1)", () => {
    const v = parseView(params("mission=s1"), { year: 2023, month: 1 });
    expect(v.missionsOff).toEqual(new Set(["s2", "s3", "s5p"]));
    expect(v.satellitesOff.size).toBe(0);
  });

  it("converts legacy mission=s1&satellite=S1A to missionsOff and satellitesOff", () => {
    const v = parseView(params("mission=s1&satellite=S1A"), { year: 2023, month: 1 });
    expect(v.missionsOff).toEqual(new Set(["s2", "s3", "s5p"]));
    expect(v.satellitesOff).toEqual(new Set(["S1B", "S1C", "S1D"]));
  });

  it("ignores legacy satellite when mission is not set", () => {
    const v = parseView(params("satellite=S1A"), { year: 2023, month: 1 });
    expect(v.missionsOff.size).toBe(0);
    expect(v.satellitesOff.size).toBe(0);
  });

  it("ignores legacy satellite that doesn't belong to the legacy mission", () => {
    const v = parseView(params("mission=s1&satellite=S2A"), { year: 2023, month: 1 });
    expect(v.missionsOff).toEqual(new Set(["s2", "s3", "s5p"]));
    expect(v.satellitesOff.size).toBe(0);
  });

  it("converts legacy category=Acquisition,Production to typesOff", () => {
    const v = parseView(params("category=Acquisition,Production"), { year: 2023, month: 1 });
    expect(v.typesOff).toEqual(new Set(["Manoeuvre", "Calibration", "Satellite"]));
  });

  it("converts legacy category with a single value", () => {
    const v = parseView(params("category=Acquisition"), { year: 2023, month: 1 });
    expect(v.typesOff).toEqual(new Set(["Production", "Manoeuvre", "Calibration", "Satellite"]));
  });

  it("falls back to all on for legacy category=Other (excluded category)", () => {
    const v = parseView(params("category=Other"), { year: 2023, month: 1 });
    expect(v.typesOff.size).toBe(0);
  });

  it("keeps valid legacy categories when mixed with excluded ones", () => {
    const v = parseView(params("category=Acquisition,Other,Data+access"), { year: 2023, month: 1 });
    // Only Acquisition is valid → typesOff = all others
    expect(v.typesOff).toEqual(new Set(["Production", "Manoeuvre", "Calibration", "Satellite"]));
  });

  it("new params take precedence over legacy params when both present", () => {
    const v = parseView(params("typesOff=Calibration&category=Acquisition"), { year: 2023, month: 1 });
    // typesOff (new) wins over category (legacy)
    expect(v.typesOff).toEqual(new Set(["Calibration"]));
  });

  it("normalises ?showDayEvents=YYYY-MM-DD to year/month", () => {
    const v = parseView(params("showDayEvents=2022-11-15"), { year: 2023, month: 1 });
    expect(v.year).toBe(2022);
    expect(v.month).toBe(11);
    expect(v.typesOff.size).toBe(0);
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
      typesOff: new Set(),
      missionsOff: new Set(),
      satellitesOff: new Set(),
      q: "",
      event: null,
    };
    const p = viewParams(view, ym);
    expect(p.toString()).toBe("");
    expect(viewHref(view, ym)).toBe("/events");
  });

  it("includes non-default typesOff and missionsOff values", () => {
    const view: EventsView = {
      year: 2023,
      month: 4,
      typesOff: new Set(["Calibration"] as const),
      missionsOff: new Set(["s2", "s3"] as const),
      satellitesOff: new Set(["S1B"]),
      q: "platform",
      event: "EVT-001",
    };
    const p = viewParams(view, { year: 2026, month: 10 });
    expect(p.get("year")).toBe("2023");
    expect(p.get("month")).toBe("4");
    expect(p.get("typesOff")).toBe("Calibration");
    expect(p.get("missionsOff")).toBe("s2,s3");
    expect(p.get("satellitesOff")).toBe("S1B");
    expect(p.get("q")).toBe("platform");
    expect(p.get("event")).toBe("EVT-001");
    // legacy params NOT emitted
    expect(p.get("category")).toBeNull();
    expect(p.get("mission")).toBeNull();
    expect(p.get("satellite")).toBeNull();
  });

  it("always includes month when year differs from now, even if month matches now", () => {
    const view: EventsView = {
      year: 2025,
      month: 10,
      typesOff: new Set(),
      missionsOff: new Set(),
      satellitesOff: new Set(),
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
      typesOff: new Set(["Production", "Satellite"] as const),
      missionsOff: new Set(["s3", "s5p"] as const),
      satellitesOff: new Set(["S1B"]),
      q: "reset",
      event: "EVT-002",
    };
    const now = { year: 2026, month: 10 };
    const back = parseView(viewParams(view, now), now);
    expect(back.year).toBe(2023);
    expect(back.month).toBe(4);
    expect(back.typesOff).toEqual(new Set(["Production", "Satellite"]));
    expect(back.missionsOff).toEqual(new Set(["s3", "s5p"]));
    expect(back.satellitesOff).toEqual(new Set(["S1B"]));
    expect(back.q).toBe("reset");
    expect(back.event).toBe("EVT-002");
  });
});

/* ---- resolveView ---- */

describe("resolveView", () => {
  const baseView: EventsView = {
    year: 2023, month: 4,
    typesOff: new Set(), missionsOff: new Set(), satellitesOff: new Set(),
    q: "", event: null,
  };

  it("returns the view unchanged when event is null", () => {
    expect(resolveView(baseView, allCards)).toEqual(baseView);
  });

  it("drops unknown event ids", () => {
    const v = { ...baseView, event: "UNKNOWN" };
    expect(resolveView(v, allCards).event).toBeNull();
  });

  it("keeps the view when the event belongs to the current month", () => {
    const v = { ...baseView, event: "EVT-001" };
    const resolved = resolveView(v, allCards);
    expect(resolved.year).toBe(2023);
    expect(resolved.month).toBe(4);
    expect(resolved.event).toBe("EVT-001");
  });

  it("switches to the event's start month when the current month is not the start month", () => {
    const v = { ...baseView, year: 2023, month: 12, event: "EVT-001" };
    const resolved = resolveView(v, allCards);
    expect(resolved.year).toBe(2023);
    expect(resolved.month).toBe(4);
  });

  it("switches to the event's start month for a cross-month event viewed in a later month", () => {
    const v = { ...baseView, year: 2023, month: 5, event: "EVT-003" };
    const resolved = resolveView(v, allCards);
    expect(resolved.year).toBe(2023);
    expect(resolved.month).toBe(4);
    expect(resolved.event).toBe("EVT-003");
  });
});

/* ---- filterEvents ---- */

describe("filterEvents", () => {
  const baseView: EventsView = {
    year: 2023, month: 4,
    typesOff: new Set(), missionsOff: new Set(), satellitesOff: new Set(),
    q: "", event: null,
  };

  it("returns only events whose startDate is in the selected month", () => {
    const filtered = filterEvents(allCards, baseView);
    expect(filtered.every((e) => e.startDate.startsWith("2023-04"))).toBe(true);
  });

  it("places a cross-month event only in its start month, not in later months it spans", () => {
    const aprilView = { ...baseView, year: 2023, month: 4 };
    const mayView = { ...baseView, year: 2023, month: 5 };
    const inApril = filterEvents(allCards, aprilView);
    const inMay = filterEvents(allCards, mayView);
    expect(inApril.find((e) => e.id === "EVT-003")).toBeTruthy();
    expect(inMay.find((e) => e.id === "EVT-003")).toBeUndefined();
  });

  it("filters by mission (missionsOff excludes other missions)", () => {
    // Only s1 events: missionsOff = {s2, s3, s5p}
    const v = { ...baseView, missionsOff: new Set(["s2", "s3", "s5p"] as const) };
    const filtered = filterEvents(allCards, v);
    expect(filtered.every((e) => e.mission === "s1" || e.mission === null)).toBe(true);
  });

  it("filters by satellite (satellitesOff excludes those satellites)", () => {
    // Only S2B events
    const allSatsExceptS2B = ["S1A","S1B","S1C","S1D","S2A","S2C","S3A","S3B","S5P"];
    const v = { ...baseView, satellitesOff: new Set(allSatsExceptS2B) };
    const filtered = filterEvents(allCards, v);
    expect(filtered.every((e) => e.satellite === "S2B")).toBe(true);
  });

  it("filters by typesOff (excludes those categories)", () => {
    // Only Acquisition: typesOff = all others
    const v = {
      ...baseView,
      typesOff: new Set(["Production", "Manoeuvre", "Calibration", "Satellite"] as const),
    };
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
    // share startDate. With only Acquisition on, EVT-002 must be absent.
    const allDetails = adaptEvents(RECORDS).events;
    const allCards = allDetails.map(toEventCard);
    const view: EventsView = {
      year: 2023, month: 4,
      typesOff: new Set(["Production", "Manoeuvre", "Calibration", "Satellite"] as const),
      missionsOff: new Set(), satellitesOff: new Set(),
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

/* ---- legacy URL conversion sanity ---- */

describe("legacy URL backward compatibility", () => {
  it("?mission=s2 → missionsOff contains s1, s3, s5p", () => {
    const v = parseView(params("mission=s2"), { year: 2023, month: 1 });
    expect(v.missionsOff.has("s1")).toBe(true);
    expect(v.missionsOff.has("s2")).toBe(false);
    expect(v.missionsOff.has("s3")).toBe(true);
    expect(v.missionsOff.has("s5p")).toBe(true);
  });

  it("?mission=s3&satellite=S3A → satellitesOff contains S3B only", () => {
    const v = parseView(params("mission=s3&satellite=S3A"), { year: 2023, month: 1 });
    expect(v.satellitesOff).toEqual(new Set(["S3B"]));
  });

  it("?mission=s9 (unknown) → all missions on", () => {
    const v = parseView(params("mission=s9"), { year: 2023, month: 1 });
    expect(v.missionsOff.size).toBe(0);
  });

  it("viewParams never emits legacy category/mission/satellite params", () => {
    const view: EventsView = {
      year: 2023, month: 4,
      typesOff: new Set(["Calibration"] as const),
      missionsOff: new Set(["s2"] as const),
      satellitesOff: new Set(["S1B"]),
      q: "", event: null,
    };
    const p = viewParams(view, { year: 2026, month: 10 });
    expect(p.get("category")).toBeNull();
    expect(p.get("mission")).toBeNull();
    expect(p.get("satellite")).toBeNull();
  });
});
