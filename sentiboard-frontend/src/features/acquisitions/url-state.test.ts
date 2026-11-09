import { describe, expect, it } from "vitest";
import {
  parseAcqView,
  acqViewParams,
  acqViewHref,
  DEFAULT_ACQ_VIEW,
  ACQUISITIONS_EARTH_PATH,
  type AcqView,
} from "./url-state";

function params(qs: string) {
  return new URLSearchParams(qs);
}

// ---------------------------------------------------------------------------
// parseAcqView — defaults
// ---------------------------------------------------------------------------

describe("parseAcqView defaults", () => {
  it("parses empty params as the default view", () => {
    const v = parseAcqView(params(""));
    expect(v.satellite).toBeNull();
    expect(v.day).toBeNull();
    expect(v.datatake).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseAcqView — satellite (single-select)
// ---------------------------------------------------------------------------

describe("parseAcqView satellite", () => {
  it("accepts a known satellite unit", () => {
    expect(parseAcqView(params("satellite=S2A")).satellite).toBe("S2A");
  });

  it("accepts S1A", () => {
    expect(parseAcqView(params("satellite=S1A")).satellite).toBe("S1A");
  });

  it("accepts S5P", () => {
    expect(parseAcqView(params("satellite=S5P")).satellite).toBe("S5P");
  });

  it("rejects an unknown satellite", () => {
    expect(parseAcqView(params("satellite=S99")).satellite).toBeNull();
  });

  it("absent satellite → null", () => {
    expect(parseAcqView(params("")).satellite).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseAcqView — day
// ---------------------------------------------------------------------------

describe("parseAcqView day", () => {
  it("accepts a valid YYYY-MM-DD date", () => {
    expect(parseAcqView(params("day=2026-11-09")).day).toBe("2026-11-09");
  });

  it("rejects a non-date string", () => {
    expect(parseAcqView(params("day=today")).day).toBeNull();
  });

  it("rejects a partial date", () => {
    expect(parseAcqView(params("day=2026-11")).day).toBeNull();
  });

  it("absent day → null", () => {
    expect(parseAcqView(params("")).day).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseAcqView — datatake
// ---------------------------------------------------------------------------

describe("parseAcqView datatake", () => {
  it("passes through any non-empty datatake id", () => {
    expect(parseAcqView(params("datatake=S2A-00001")).datatake).toBe("S2A-00001");
  });

  it("empty datatake string → null", () => {
    expect(parseAcqView(params("datatake=")).datatake).toBeNull();
  });

  it("absent datatake → null", () => {
    expect(parseAcqView(params("")).datatake).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// acqViewParams round-trip
// ---------------------------------------------------------------------------

describe("acqViewParams", () => {
  it("omits defaults from the URL", () => {
    const p = acqViewParams(DEFAULT_ACQ_VIEW);
    expect(p.toString()).toBe("");
  });

  it("includes satellite when set", () => {
    expect(acqViewParams({ ...DEFAULT_ACQ_VIEW, satellite: "S3A" }).get("satellite")).toBe("S3A");
  });

  it("includes day when set", () => {
    expect(acqViewParams({ ...DEFAULT_ACQ_VIEW, day: "2026-11-08" }).get("day")).toBe("2026-11-08");
  });

  it("includes datatake when set", () => {
    expect(acqViewParams({ ...DEFAULT_ACQ_VIEW, datatake: "S2A-99" }).get("datatake")).toBe("S2A-99");
  });

  it("omits satellite when null", () => {
    expect(acqViewParams(DEFAULT_ACQ_VIEW).get("satellite")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// acqViewHref
// ---------------------------------------------------------------------------

describe("acqViewHref", () => {
  it("returns bare path for default view", () => {
    expect(acqViewHref(DEFAULT_ACQ_VIEW)).toBe(ACQUISITIONS_EARTH_PATH);
  });

  it("appends a query string for a non-default view", () => {
    const href = acqViewHref({ ...DEFAULT_ACQ_VIEW, satellite: "S2A" });
    expect(href).toBe(`${ACQUISITIONS_EARTH_PATH}?satellite=S2A`);
  });

  it("accepts a custom base path", () => {
    const href = acqViewHref(DEFAULT_ACQ_VIEW, "/acquisitions-globe");
    expect(href).toBe("/acquisitions-globe");
  });
});

// ---------------------------------------------------------------------------
// parseAcqView → acqViewParams round-trip
// ---------------------------------------------------------------------------

describe("round-trip", () => {
  it("parse → serialise → parse gives the same view", () => {
    const original: AcqView = {
      satellite: "S1C",
      day: "2026-11-08",
      datatake: "S1C-57622",
    };
    const roundTripped = parseAcqView(acqViewParams(original));
    expect(roundTripped.satellite).toBe(original.satellite);
    expect(roundTripped.day).toBe(original.day);
    expect(roundTripped.datatake).toBe(original.datatake);
  });
});
