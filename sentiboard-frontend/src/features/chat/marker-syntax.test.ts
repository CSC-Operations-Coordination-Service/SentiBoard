import { describe, expect, it } from "vitest";
import { findMarkerCandidates, parseAttributes } from "./marker-syntax";

// ---------------------------------------------------------------------------
// findMarkerCandidates
// ---------------------------------------------------------------------------

describe("findMarkerCandidates — basic detection", () => {
  it("finds a simple kpi tag", () => {
    const raw = `<kpi label="X" value="1" />`;
    const [c] = findMarkerCandidates(raw);
    expect(c).toBeDefined();
    expect(c.tagName).toBe("kpi");
    expect(c.start).toBe(0);
    expect(c.end).toBe(raw.length);
  });

  it("finds each supported tag name", () => {
    const tags = [
      `<tabular data_id="artifact_a" />`,
      `<temporal-plot data_id="artifact_a" date_column="d" numeric_column="n" />`,
      `<count-histogram data_id="artifact_a" count_column="c" date_column="d" />`,
      `<event-calendar data_id="artifact_a" />`,
      `<kpi label="L" value="V" />`,
    ];
    for (const tag of tags) {
      const cs = findMarkerCandidates(tag);
      expect(cs).toHaveLength(1);
    }
  });

  it("finds multiple tags and reports correct positions", () => {
    const raw = `before <kpi label="A" value="1" /> middle <event-calendar data_id="artifact_x" /> after`;
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(2);
    expect(cs[0].tagName).toBe("kpi");
    expect(cs[1].tagName).toBe("event-calendar");
    expect(raw.slice(cs[0].start, cs[0].end)).toContain("kpi");
    expect(raw.slice(cs[1].start, cs[1].end)).toContain("event-calendar");
  });

  it("returns empty array for plain prose", () => {
    expect(findMarkerCandidates("Hello, this is plain text.")).toHaveLength(0);
  });

  it("does not match unknown tag names", () => {
    expect(findMarkerCandidates(`<unknown data_id="artifact_a" />`)).toHaveLength(0);
  });

  it("matches tag with no space before />", () => {
    const raw = `<kpi label="L" value="V"/>`;
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(1);
  });

  it("matches tag with optional space before />", () => {
    const raw = `<kpi label="L" value="V" />`;
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(1);
  });
});

describe("findMarkerCandidates — quote-aware boundaries", () => {
  it("handles > inside a quoted value without ending the tag", () => {
    const raw = `<kpi label="a > b" value="1" />`;
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(1);
    expect(cs[0].tagName).toBe("kpi");
  });

  it("includes the full tag when value contains >", () => {
    const raw = `before <kpi label="x > y" value="2" /> after`;
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(1);
    expect(raw.slice(cs[0].start, cs[0].end)).toBe(`<kpi label="x > y" value="2" />`);
  });
});

describe("findMarkerCandidates — code block exclusion", () => {
  it("skips markers inside a fenced code block (backticks)", () => {
    const raw = "```\n<kpi label=\"L\" value=\"V\" />\n```";
    expect(findMarkerCandidates(raw)).toHaveLength(0);
  });

  it("skips markers inside a fenced code block (tildes)", () => {
    const raw = "~~~\n<kpi label=\"L\" value=\"V\" />\n~~~";
    expect(findMarkerCandidates(raw)).toHaveLength(0);
  });

  it("skips markers inside an inline code span", () => {
    const raw = "Use `<kpi label=\"L\" value=\"V\" />` to show a KPI.";
    expect(findMarkerCandidates(raw)).toHaveLength(0);
  });

  it("finds markers outside a code block but not inside", () => {
    const raw = [
      "Outside: <kpi label=\"A\" value=\"1\" />",
      "```",
      "<kpi label=\"B\" value=\"2\" />",
      "```",
      "Also outside: <event-calendar data_id=\"artifact_z\" />",
    ].join("\n");
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(2);
    expect(cs[0].tagName).toBe("kpi");
    expect(cs[1].tagName).toBe("event-calendar");
  });

  it("finds a marker immediately after a code block", () => {
    const raw = "```\ncode\n```\n<tabular data_id=\"artifact_a\" />";
    const cs = findMarkerCandidates(raw);
    expect(cs).toHaveLength(1);
    expect(cs[0].tagName).toBe("tabular");
  });
});

// ---------------------------------------------------------------------------
// parseAttributes
// ---------------------------------------------------------------------------

describe("parseAttributes — valid inputs", () => {
  it("parses empty body as empty map", () => {
    expect(parseAttributes("")).toEqual(new Map());
  });

  it("parses a single space body as empty map", () => {
    expect(parseAttributes(" ")).toEqual(new Map());
  });

  it("parses a single attribute", () => {
    const m = parseAttributes(` data_id="artifact_abc"`);
    expect(m).not.toBeNull();
    expect(m!.get("data_id")).toBe("artifact_abc");
  });

  it("parses multiple attributes in order", () => {
    const m = parseAttributes(` label="A" value="1" color="green"`);
    expect(m).not.toBeNull();
    expect(m!.get("label")).toBe("A");
    expect(m!.get("value")).toBe("1");
    expect(m!.get("color")).toBe("green");
  });

  it("strips exactly one trailing space", () => {
    const m = parseAttributes(` label="A" value="1" `);
    expect(m).not.toBeNull();
    expect(m!.size).toBe(2);
  });

  it("parses attribute names with hyphens", () => {
    const m = parseAttributes(` sort-order="asc"`);
    expect(m).not.toBeNull();
    expect(m!.get("sort-order")).toBe("asc");
  });

  it("parses values containing > (the quote-aware check)", () => {
    const m = parseAttributes(` label="a > b" value="1"`);
    expect(m).not.toBeNull();
    expect(m!.get("label")).toBe("a > b");
  });
});

describe("parseAttributes — rejection cases", () => {
  it("returns null for double space between attributes", () => {
    expect(parseAttributes(` label="A"  value="1"`)).toBeNull();
  });

  it("returns null for missing leading space before first attribute", () => {
    expect(parseAttributes(`label="A"`)).toBeNull();
  });

  it("returns null for trailing garbage after last attribute", () => {
    expect(parseAttributes(` label="A" extra`)).toBeNull();
  });

  it("returns null for duplicate attribute names", () => {
    expect(parseAttributes(` label="A" label="B"`)).toBeNull();
  });

  it("returns null for two trailing spaces", () => {
    expect(parseAttributes(` label="A"  `)).toBeNull();
  });

  it("returns null for attribute with no value", () => {
    expect(parseAttributes(` label`)).toBeNull();
  });

  it("returns null for attribute with unquoted value", () => {
    expect(parseAttributes(` label=foo`)).toBeNull();
  });
});
