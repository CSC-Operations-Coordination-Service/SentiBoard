import { describe, expect, it } from "vitest";
import {
  parseView,
  viewParams,
  viewHref,
  DEFAULT_VIEW,
  AVAILABILITY_PATH,
  type AvailabilityView,
} from "./url-state";

function params(qs: string) {
  return new URLSearchParams(qs);
}

// ---------------------------------------------------------------------------
// parseView — defaults
// ---------------------------------------------------------------------------

describe("parseView defaults", () => {
  it("parses empty params as the default view", () => {
    const v = parseView(params(""));
    expect(v.range).toBe(30);
    expect(v.offset).toBe(0);
    expect(v.customFrom).toBeNull();
    expect(v.customTo).toBeNull();
    expect(v.missionsOff.size).toBe(0);
    expect(v.statusesOff.size).toBe(0);
    expect(v.q).toBe("");
    expect(v.pick).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseView — range
// ---------------------------------------------------------------------------

describe("parseView range", () => {
  it("parses range=1", () => {
    expect(parseView(params("range=1")).range).toBe(1);
  });

  it("parses range=7", () => {
    expect(parseView(params("range=7")).range).toBe(7);
  });

  it("parses range=30", () => {
    expect(parseView(params("range=30")).range).toBe(30);
  });

  it("parses range=custom as null", () => {
    expect(parseView(params("range=custom")).range).toBeNull();
  });

  it("falls back to default for unknown range", () => {
    expect(parseView(params("range=14")).range).toBe(DEFAULT_VIEW.range);
  });

  it("falls back to default for negative range", () => {
    expect(parseView(params("range=-7")).range).toBe(DEFAULT_VIEW.range);
  });
});

// ---------------------------------------------------------------------------
// parseView — offset
// ---------------------------------------------------------------------------

describe("parseView offset", () => {
  it("parses a positive offset", () => {
    expect(parseView(params("offset=5")).offset).toBe(5);
  });

  it("falls back to 0 for negative offset", () => {
    expect(parseView(params("offset=-1")).offset).toBe(0);
  });

  it("falls back to 0 for non-numeric offset", () => {
    expect(parseView(params("offset=abc")).offset).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseView — custom from/to
// ---------------------------------------------------------------------------

describe("parseView custom dates", () => {
  it("parses valid from/to", () => {
    const v = parseView(params("range=custom&from=2026-10-01&to=2026-10-31"));
    expect(v.range).toBeNull();
    expect(v.customFrom).toBe("2026-10-01");
    expect(v.customTo).toBe("2026-10-31");
  });

  it("ignores non-date strings for from/to", () => {
    const v = parseView(params("from=not-a-date&to=yesterday"));
    expect(v.customFrom).toBeNull();
    expect(v.customTo).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseView — missionsOff / statusesOff
// ---------------------------------------------------------------------------

describe("parseView missionsOff", () => {
  it("parses known mission ids", () => {
    const v = parseView(params("missionsOff=S1,S3"));
    expect(v.missionsOff).toEqual(new Set(["S1", "S3"]));
  });

  it("ignores unknown mission ids", () => {
    const v = parseView(params("missionsOff=S1,UNKNOWN,S2"));
    expect(v.missionsOff).toEqual(new Set(["S1", "S2"]));
  });

  it("empty missionsOff stays empty", () => {
    expect(parseView(params("missionsOff=")).missionsOff.size).toBe(0);
  });
});

describe("parseView statusesOff", () => {
  it("parses known status values", () => {
    const v = parseView(params("statusesOff=Planned,Partial"));
    expect(v.statusesOff).toEqual(new Set(["Planned", "Partial"]));
  });

  it("ignores unknown status values", () => {
    const v = parseView(params("statusesOff=Planned,Delayed"));
    expect(v.statusesOff).toEqual(new Set(["Planned"]));
  });
});

// ---------------------------------------------------------------------------
// parseView — q and pick
// ---------------------------------------------------------------------------

describe("parseView q and pick", () => {
  it("parses q", () => {
    expect(parseView(params("q=S2A-10001")).q).toBe("S2A-10001");
  });

  it("parses pick", () => {
    expect(parseView(params("pick=S2A-10001")).pick).toBe("S2A-10001");
  });

  it("empty pick → null", () => {
    expect(parseView(params("pick=")).pick).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// viewParams round-trip
// ---------------------------------------------------------------------------

describe("viewParams", () => {
  it("omits defaults from the URL", () => {
    const p = viewParams(DEFAULT_VIEW);
    expect(p.toString()).toBe("");
  });

  it("includes range when not 30", () => {
    expect(viewParams({ ...DEFAULT_VIEW, range: 7 }).get("range")).toBe("7");
  });

  it("encodes custom range as 'custom'", () => {
    expect(viewParams({ ...DEFAULT_VIEW, range: null }).get("range")).toBe("custom");
  });

  it("includes from/to only when range is custom", () => {
    const p = viewParams({ ...DEFAULT_VIEW, range: null, customFrom: "2026-10-01", customTo: "2026-10-31" });
    expect(p.get("from")).toBe("2026-10-01");
    expect(p.get("to")).toBe("2026-10-31");
  });

  it("omits from/to when range is not custom", () => {
    const p = viewParams({ ...DEFAULT_VIEW, range: 30, customFrom: "2026-10-01", customTo: "2026-10-31" });
    expect(p.get("from")).toBeNull();
    expect(p.get("to")).toBeNull();
  });

  it("includes offset when non-zero", () => {
    expect(viewParams({ ...DEFAULT_VIEW, offset: 3 }).get("offset")).toBe("3");
  });

  it("includes missionsOff as comma-separated", () => {
    const v: AvailabilityView = {
      ...DEFAULT_VIEW,
      missionsOff: new Set(["S1", "S2"]),
    };
    expect(viewParams(v).get("missionsOff")).toMatch(/S1|S2/);
  });

  it("includes statusesOff", () => {
    const v: AvailabilityView = {
      ...DEFAULT_VIEW,
      statusesOff: new Set(["Planned"]),
    };
    expect(viewParams(v).get("statusesOff")).toBe("Planned");
  });

  it("omits pick when null", () => {
    expect(viewParams(DEFAULT_VIEW).get("pick")).toBeNull();
  });

  it("includes pick when set", () => {
    expect(viewParams({ ...DEFAULT_VIEW, pick: "S1A-10001" }).get("pick")).toBe("S1A-10001");
  });
});

// ---------------------------------------------------------------------------
// viewHref
// ---------------------------------------------------------------------------

describe("viewHref", () => {
  it("returns bare path for default view", () => {
    expect(viewHref(DEFAULT_VIEW)).toBe(AVAILABILITY_PATH);
  });

  it("appends a query string for a non-default view", () => {
    const href = viewHref({ ...DEFAULT_VIEW, range: 7 });
    expect(href).toBe(`${AVAILABILITY_PATH}?range=7`);
  });
});

// ---------------------------------------------------------------------------
// parseView → viewParams round-trip
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  it("parse → serialise → parse gives the same view", () => {
    const original: AvailabilityView = {
      range: 7,
      offset: 3,
      customFrom: null,
      customTo: null,
      missionsOff: new Set(["S1", "S3"]),
      statusesOff: new Set(["Partial"]),
      q: "S2A-55555",
      pick: "S1A-20000",
    };
    const roundTripped = parseView(viewParams(original));
    expect(roundTripped.range).toBe(original.range);
    expect(roundTripped.offset).toBe(original.offset);
    expect(roundTripped.missionsOff).toEqual(original.missionsOff);
    expect(roundTripped.statusesOff).toEqual(original.statusesOff);
    expect(roundTripped.q).toBe(original.q);
    expect(roundTripped.pick).toBe(original.pick);
  });
});
