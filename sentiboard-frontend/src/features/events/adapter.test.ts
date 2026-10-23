import { describe, expect, it } from "vitest";
import {
  adaptEvents,
  isRealDatatakeId,
  monthsOverlapped,
  parseTextSegments,
  toEventCard,
} from "./adapter";
import { RECORDS, UNDATED } from "./__fixtures__/anomaly-records";

/* ---- isRealDatatakeId ---- */

describe("isRealDatatakeId", () => {
  it("accepts IDs starting with S + digit", () => {
    expect(isRealDatatakeId("S1A-357888")).toBe(true);
    expect(isRealDatatakeId("S2B-29517-4")).toBe(true);
    expect(isRealDatatakeId("S5P-123456")).toBe(true);
  });
  it("rejects free-text tokens", () => {
    expect(isRealDatatakeId("No")).toBe(false);
    expect(isRealDatatakeId("impact")).toBe(false);
    expect(isRealDatatakeId("on")).toBe(false);
    expect(isRealDatatakeId("")).toBe(false);
    expect(isRealDatatakeId("SAR-1234")).toBe(false);
  });
});

/* ---- monthsOverlapped ---- */

describe("monthsOverlapped", () => {
  it("returns one month for a same-month event", () => {
    const startMs = Date.UTC(2023, 3, 10); // Apr 2023
    const endMs = Date.UTC(2023, 3, 15);
    expect(monthsOverlapped(startMs, endMs)).toEqual([{ year: 2023, month: 4 }]);
  });

  it("returns two months for an event spanning April–May", () => {
    // EVT-003: Apr 27 → May 3
    const startMs = Date.UTC(2023, 3, 27);
    const endMs = Date.UTC(2023, 4, 3);
    expect(monthsOverlapped(startMs, endMs)).toEqual([
      { year: 2023, month: 4 },
      { year: 2023, month: 5 },
    ]);
  });

  it("returns three months for a Dec–Feb cross-year span", () => {
    const startMs = Date.UTC(2023, 11, 25); // Dec 2023
    const endMs = Date.UTC(2024, 1, 5);    // Feb 2024
    expect(monthsOverlapped(startMs, endMs)).toEqual([
      { year: 2023, month: 12 },
      { year: 2024, month: 1 },
      { year: 2024, month: 2 },
    ]);
  });

  it("returns one month when start === end (same day)", () => {
    const ms = Date.UTC(2023, 5, 1);
    expect(monthsOverlapped(ms, ms)).toEqual([{ year: 2023, month: 6 }]);
  });
});

/* ---- parseTextSegments ---- */

describe("parseTextSegments", () => {
  it("returns empty array for blank text", () => {
    expect(parseTextSegments("")).toEqual([]);
    expect(parseTextSegments("   ")).toEqual([]);
  });

  it("produces text and br segments for plain text with CRLF", () => {
    const segs = parseTextSegments("Line one\r\nLine two");
    expect(segs).toEqual([
      { type: "text", text: "Line one" },
      { type: "br" },
      { type: "text", text: "Line two" },
    ]);
  });

  it("parses {code:xml}…{code} blocks into code segments", () => {
    const text = "Before\n{code:xml}\n<foo/>\n{code}\nAfter";
    const segs = parseTextSegments(text);
    expect(segs.some((s) => s.type === "code" && s.text.includes("<foo/>"))).toBe(true);
    expect(segs.some((s) => s.type === "text" && s.text === "Before")).toBe(true);
    expect(segs.some((s) => s.type === "text" && s.text === "After")).toBe(true);
  });

  it("parses {noformat}…{noformat} blocks into code segments", () => {
    const text = "{noformat}\nAffected scenes: 140\n{noformat}";
    const segs = parseTextSegments(text);
    expect(segs).toEqual([{ type: "code", text: "Affected scenes: 140" }]);
  });

  it("does not produce dangerouslySetInnerHTML-unsafe segments", () => {
    const text = "<script>alert(1)</script>";
    const segs = parseTextSegments(text);
    // Every segment must be a plain text/br/code type — no HTML string injection
    for (const s of segs) {
      expect(["text", "br", "code"]).toContain(s.type);
    }
  });
});

/* ---- adaptEvents — category whitelist ---- */

describe("adaptEvents — category whitelist", () => {
  it("excludes records with categories outside the five shown types", () => {
    const excluded = [
      { ...RECORDS[0]!, id: "EX-1", category: "Data access" },
      { ...RECORDS[0]!, id: "EX-2", category: "Archive" },
      { ...RECORDS[0]!, id: "EX-3", category: "DD" },
      { ...RECORDS[0]!, id: "EX-4", category: "" },
      { ...RECORDS[0]!, id: "EX-5", category: "Other" },
    ];
    const { events } = adaptEvents(excluded);
    expect(events).toHaveLength(0);
  });

  it("includes all five allowed category types", () => {
    // RECORDS already covers Acquisition, Production, Manoeuvre, Calibration, Platform (→ Satellite)
    const { events } = adaptEvents(RECORDS);
    expect(events).toHaveLength(RECORDS.length);
  });

  it("maps feed value 'Satellite' directly to Satellite", () => {
    const satRecord = { ...RECORDS[0]!, id: "EX-SAT", category: "Satellite" };
    const { events } = adaptEvents([satRecord]);
    expect(events[0]?.category).toBe("Satellite");
  });

  it("trims leading and trailing whitespace from category before matching", () => {
    const padded = { ...RECORDS[0]!, id: "EX-PAD", category: "  Acquisition  " };
    const { events } = adaptEvents([padded]);
    expect(events[0]?.category).toBe("Acquisition");
    expect(events[0]?.id).toBe("EX-PAD");
  });

  it("trims before excluding: '  Data access  ' is excluded", () => {
    const padded = { ...RECORDS[0]!, id: "EX-TRIM-EX", category: "  Data access  " };
    const { events } = adaptEvents([padded]);
    expect(events).toHaveLength(0);
  });

  it("excluded records are absent from the events list (metrics count only shown events)", () => {
    const excludedRecord = {
      ...RECORDS[0]!,
      id: "EX-EXCL",
      category: "Data access",
      datatakes_completeness: [
        { datatakeID: "S1A-999999", L0_: 50.0, L1_: null, L2_: null },
      ],
    };
    const { events } = adaptEvents([RECORDS[0]!, excludedRecord]);
    const ids = events.map((e) => e.id);
    expect(ids).toContain("EVT-001");
    expect(ids).not.toContain("EX-EXCL");
    expect(events).toHaveLength(1);
  });
});

/* ---- adaptEvents ---- */

describe("adaptEvents", () => {
  it("maps category names to EventCategory", () => {
    const { events } = adaptEvents(RECORDS);
    const acq = events.find((e) => e.id === "EVT-001");
    expect(acq?.category).toBe("Acquisition");
    const prod = events.find((e) => e.id === "EVT-002");
    expect(prod?.category).toBe("Production");
    const man = events.find((e) => e.id === "EVT-003");
    expect(man?.category).toBe("Manoeuvre");
  });

  it("maps Platform category to Satellite (no separate Platform type in the UI model)", () => {
    // EVT-005 has category "Platform" in the backend feed.
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-005");
    expect(e?.category).toBe("Satellite");
  });

  it("maps long satellite names to short codes", () => {
    const { events } = adaptEvents(RECORDS);
    const e1 = events.find((e) => e.id === "EVT-001");
    expect(e1?.satellite).toBe("S1A");
    const e2 = events.find((e) => e.id === "EVT-002");
    expect(e2?.satellite).toBe("S2B");
  });

  it("maps Copernicus Sentinel-5p (lowercase p) to S5P", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-004");
    expect(e?.satellite).toBe("S5P");
    expect(e?.mission).toBe("s5p");
  });

  it("derives satellite from datatake IDs when impacted_satellite is null", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-005");
    // S1A-358100 → S1A, fake tokens filtered out → single satellite → S1A
    expect(e?.satellite).toBe("S1A");
    expect(e?.mission).toBe("s1");
  });

  it("filters out fake datatake IDs", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-005");
    expect(e?.datatakes).toHaveLength(1);
    expect(e?.datatakes[0]?.datatakeId).toBe("S1A-358100");
  });

  it("marks datatake noData=true when all levels are null", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-002");
    const dt = e?.datatakes[0];
    expect(dt?.noData).toBe(true);
    expect(dt?.L0).toBeNull();
  });

  it("computes months for a same-month event", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-001");
    expect(e?.months).toEqual([{ year: 2023, month: 4 }]);
  });

  it("computes months for a cross-month event (Apr–May)", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-003");
    expect(e?.months).toContainEqual({ year: 2023, month: 4 });
    expect(e?.months).toContainEqual({ year: 2023, month: 5 });
  });

  it("drops records with no start/end and reports them in unresolved", () => {
    const { events, unresolved } = adaptEvents([...RECORDS, UNDATED]);
    expect(events.find((e) => e.id === "EVT-UNDATED")).toBeUndefined();
    expect(unresolved).toContain("EVT-UNDATED");
  });

  it("deduplicates datatake IDs within one record", () => {
    const dup = {
      ...RECORDS[0]!,
      id: "EVT-DUP",
      datatakes_completeness: [
        { datatakeID: "S1A-111111", L0_: 100.0, L1_: null, L2_: null },
        { datatakeID: "S1A-111111", L0_: 50.0, L1_: null, L2_: null },
      ],
    };
    const { events } = adaptEvents([dup]);
    expect(events[0]?.datatakes).toHaveLength(1);
  });
});

/* ---- toEventCard ---- */

describe("toEventCard", () => {
  it("strips detail fields from EventDetail", () => {
    const { events } = adaptEvents(RECORDS);
    const detail = events[0]!;
    const card = toEventCard(detail);
    expect("textSegments" in card).toBe(false);
    expect("datatakes" in card).toBe(false);
    expect("newsLink" in card).toBe(false);
    expect(card.id).toBe(detail.id);
    expect(card.title).toBe(detail.title);
    expect(card.months).toEqual(detail.months);
    // EVT-001 has 2 datatakes; both have L1 < 100, so both are "lost"
    expect(card.datatakeCount).toBe(2);
    expect(card.lostDatatakeCount).toBe(2);
  });
});
