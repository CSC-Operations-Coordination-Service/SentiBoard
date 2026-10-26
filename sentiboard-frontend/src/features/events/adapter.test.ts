import { describe, expect, it } from "vitest";
import {
  adaptEvents,
  isFullyRecovered,
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

/* ---- isFullyRecovered ---- */

describe("isFullyRecovered", () => {
  it("returns true when every real datatake has mean ≥ 90 % (ACQUIRED)", () => {
    const dts = [
      { datatakeId: "S1A-1", L0: 100, L1: 95, L2: null, noData: false }, // mean 97.5
      { datatakeId: "S1A-2", L0: 90,  L1: 100, L2: 92,  noData: false }, // mean 94
    ];
    expect(isFullyRecovered(dts)).toBe(true);
  });

  it("returns false when no datatakes", () => {
    expect(isFullyRecovered([])).toBe(false);
  });

  it("returns false when all datatakes are noData", () => {
    const dts = [
      { datatakeId: "S2B-1", L0: null, L1: null, L2: null, noData: true },
    ];
    expect(isFullyRecovered(dts)).toBe(false);
  });

  it("returns false when a real datatake has mean < 90 %", () => {
    // mean(100, 75) = 87.5 → PARTIAL
    const dts = [
      { datatakeId: "S1A-1", L0: 100, L1: 75, L2: null, noData: false },
    ];
    expect(isFullyRecovered(dts)).toBe(false);
  });

  it("returns false when real and noData datatakes are mixed and the real one is PARTIAL", () => {
    const dts = [
      { datatakeId: "S1A-1", L0: 100, L1: 50, L2: null, noData: false }, // mean 75 → PARTIAL
      { datatakeId: "S1A-2", L0: null, L1: null, L2: null, noData: true },
    ];
    expect(isFullyRecovered(dts)).toBe(false);
  });

  it("single non-null level ≥ 90 % is ACQUIRED — qualifies as fully recovered", () => {
    const dts = [
      { datatakeId: "S1A-1", L0: 100, L1: null, L2: null, noData: false },
    ];
    expect(isFullyRecovered(dts)).toBe(true);
  });
});

/* ---- adaptEvents — fully-recovered filter ---- */

describe("adaptEvents — fully-recovered filter", () => {
  it("excludes an event when every real datatake has all non-null levels ≥ 90 %", () => {
    const fullyOk = {
      ...RECORDS[0]!,
      id: "FR-EXCL",
      datatakes_completeness: [
        { datatakeID: "S1A-111111", L0_: 100.0, L1_: 92.5, L2_: null },
        { datatakeID: "S1A-111112", L0_: 100.0, L1_: 90.0, L2_: 95.0 },
      ],
    };
    const { events } = adaptEvents([fullyOk]);
    expect(events).toHaveLength(0);
  });

  it("keeps an event with no datatakes (cannot be fully recovered)", () => {
    const noDt = { ...RECORDS[3]!, id: "FR-KEEP-EMPTY" }; // EVT-004 has 0 datatakes
    const { events } = adaptEvents([noDt]);
    expect(events).toHaveLength(1);
  });

  it("keeps an event whose datatakes are all noData", () => {
    const allNoData = {
      ...RECORDS[0]!,
      id: "FR-KEEP-NODATA",
      datatakes_completeness: [
        { datatakeID: "S1A-222222", L0_: null, L1_: null, L2_: null },
      ],
    };
    const { events } = adaptEvents([allNoData]);
    expect(events).toHaveLength(1);
  });

  it("keeps an event where one real datatake has mean < 90 %", () => {
    const partial = {
      ...RECORDS[0]!,
      id: "FR-KEEP-PARTIAL",
      datatakes_completeness: [
        { datatakeID: "S1A-333333", L0_: 100.0, L1_: 95.0, L2_: null }, // mean 97.5 — acquired
        { datatakeID: "S1A-333334", L0_: 100.0, L1_: 50.0, L2_: null }, // mean 75 — partial
      ],
    };
    const { events } = adaptEvents([partial]);
    expect(events).toHaveLength(1);
  });

  it("keeps an event mixing noData and a partial real datatake", () => {
    const mixed = {
      ...RECORDS[0]!,
      id: "FR-KEEP-MIXED",
      datatakes_completeness: [
        { datatakeID: "S1A-444444", L0_: null, L1_: null, L2_: null }, // noData
        { datatakeID: "S1A-444445", L0_: 100.0, L1_: 50.0, L2_: null }, // partial
      ],
    };
    const { events } = adaptEvents([mixed]);
    expect(events).toHaveLength(1);
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
    // RECORDS covers Acquisition, Production, Manoeuvre, Calibration, Platform (→ Satellite).
    // EVT-005 (Platform) is fully recovered, so we supply a partial variant to prove the whitelist.
    const partialPlatform = {
      ...RECORDS[4]!, // EVT-005
      id: "EVT-005-PARTIAL",
      datatakes_completeness: [
        { datatakeID: "S1A-358100", L0_: 100.0, L1_: 50.0, L2_: null },
      ],
    };
    const input = [...RECORDS.slice(0, 4), partialPlatform];
    const { events } = adaptEvents(input);
    expect(events).toHaveLength(input.length);
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
    // EVT-005 is fully recovered in the fixture; use a partial variant so it passes the filter.
    const partial = {
      ...RECORDS[4]!,
      id: "EVT-005-P",
      datatakes_completeness: [{ datatakeID: "S1A-358100", L0_: 50.0, L1_: null, L2_: null }],
    };
    const { events } = adaptEvents([partial]);
    expect(events[0]?.category).toBe("Satellite");
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
    // EVT-005 is fully recovered in the fixture; use a partial variant so it passes the filter.
    const partial = {
      ...RECORDS[4]!,
      id: "EVT-005-P",
      datatakes_completeness: [
        { datatakeID: "S1A-358100", L0_: 50.0, L1_: null, L2_: null }, // partial — kept
        { datatakeID: "No", L0_: null, L1_: null, L2_: null },
        { datatakeID: "impact", L0_: null, L1_: null, L2_: null },
      ],
    };
    const { events } = adaptEvents([partial]);
    // S1A-358100 → S1A, fake tokens filtered out → single satellite → S1A
    expect(events[0]?.satellite).toBe("S1A");
    expect(events[0]?.mission).toBe("s1");
  });

  it("filters out fake datatake IDs", () => {
    // EVT-005 is fully recovered in the fixture; use a partial variant so it passes the filter.
    const partial = {
      ...RECORDS[4]!,
      id: "EVT-005-P",
      datatakes_completeness: [
        { datatakeID: "S1A-358100", L0_: 50.0, L1_: null, L2_: null },
        { datatakeID: "No", L0_: null, L1_: null, L2_: null },
        { datatakeID: "impact", L0_: null, L1_: null, L2_: null },
      ],
    };
    const { events } = adaptEvents([partial]);
    expect(events[0]?.datatakes).toHaveLength(1);
    expect(events[0]?.datatakes[0]?.datatakeId).toBe("S1A-358100");
  });

  it("marks datatake noData=true when all levels are null", () => {
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-002");
    const dt = e?.datatakes[0];
    expect(dt?.noData).toBe(true);
    expect(dt?.L0).toBeNull();
  });

  it("uses publication_date for startDate, startTime and month", () => {
    const { events } = adaptEvents(RECORDS);
    // EVT-001: start="2023-04-10T06:00:00Z", publication_date="2023-04-10T09:00:00Z"
    const e1 = events.find((e) => e.id === "EVT-001");
    expect(e1?.startDate).toBe("2023-04-10");
    expect(e1?.startTime).toBe("09:00");
    expect(e1?.months).toEqual([{ year: 2023, month: 4 }]);
    // EVT-002: start="2023-04-10T22:00:00Z", publication_date="2023-04-11T03:00:00Z" → Apr 11
    const e2 = events.find((e) => e.id === "EVT-002");
    expect(e2?.startDate).toBe("2023-04-11");
    expect(e2?.startTime).toBe("03:00");
    expect(e2?.months).toEqual([{ year: 2023, month: 4 }]);
  });

  it("event with start/end spanning Apr–May is bucketed to its publication_date month only", () => {
    // EVT-003: start=Apr 27, end=May 3, publication_date=Apr 27 → April only
    const { events } = adaptEvents(RECORDS);
    const e = events.find((e) => e.id === "EVT-003");
    expect(e?.months).toEqual([{ year: 2023, month: 4 }]);
    expect(e?.months).not.toContainEqual({ year: 2023, month: 5 });
  });

  it("falls back to start when publication_date is null", () => {
    const noOccDate = {
      ...RECORDS[0]!,
      id: "EVT-FALLBACK",
      start: "2023-06-15T08:00:00Z",
      publication_date: null,
    };
    const { events } = adaptEvents([noOccDate]);
    expect(events[0]?.startDate).toBe("2023-06-15");
    expect(events[0]?.startTime).toBe("08:00");
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
        { datatakeID: "S1A-111111", L0_: 50.0, L1_: null, L2_: null }, // mean 50 → partial (kept)
        { datatakeID: "S1A-111111", L0_: 80.0, L1_: null, L2_: null }, // duplicate — dropped
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
    // EVT-001: S1A-357888 mean(100,98.3)=99.15 → acquired; S1A-357890 mean(100,0)=50 → partial.
    // Neither is LOST (mean < 10), so lostDatatakeCount = 0.
    expect(card.datatakeCount).toBe(2);
    expect(card.lostDatatakeCount).toBe(0);
  });
});
