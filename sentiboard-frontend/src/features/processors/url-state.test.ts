import { describe, expect, it } from "vitest";
import type { ProcessorGroup } from "./model";
import {
  DEFAULT_VIEW,
  parseView,
  resolveView,
  viewHref,
  viewParams,
  type ProcessorsView,
} from "./url-state";

const view = (over: Partial<ProcessorsView> = {}): ProcessorsView => ({ ...DEFAULT_VIEW, ...over });
const parse = (qs: string) => parseView(new URLSearchParams(qs));

describe("parseView", () => {
  it("gives the default view for an empty query", () => {
    expect(parse("")).toEqual(DEFAULT_VIEW);
    expect(DEFAULT_VIEW).toEqual({ mission: "1", range: "ALL", baseline: "all", q: "", release: null });
  });

  it.each([
    ["s1", "1"],
    ["s2", "2"],
    ["s3", "3"],
    ["s5p", "5P"],
    ["S5P", "5P"],
  ])("reads mission=%s", (param, mission) => {
    expect(parse(`mission=${param}`).mission).toBe(mission);
  });

  it.each([
    ["1y", "1Y"],
    ["2y", "2Y"],
    ["all", "ALL"],
    ["ALL", "ALL"],
  ])("reads range=%s", (param, range) => {
    expect(parse(`range=${param}`).range).toBe(range);
  });

  it.each([
    ["current", "current"],
    ["CURRENT", "current"],
    ["all", "all"],
  ])("reads baseline=%s", (param, baseline) => {
    expect(parse(`baseline=${param}`).baseline).toBe(baseline);
  });

  it("reads the search text and the selected release as given", () => {
    expect(parse("q=OL1%20cal&release=abc_123%3AS3_OL1")).toMatchObject({
      q: "OL1 cal",
      release: "abc_123:S3_OL1",
    });
  });

  it.each([
    ["mission=s4", "mission", "1"],
    ["mission=2", "mission", "1"], // the bare number is not a mission param
    ["mission=", "mission", "1"],
    ["range=5y", "range", "ALL"],
    ["range=", "range", "ALL"],
    ["baseline=foo", "baseline", "all"],
    ["release=", "release", null],
    ["q=", "q", ""],
  ])("falls back to the default for %s", (qs, key, expected) => {
    expect(parse(qs)[key as keyof ProcessorsView]).toBe(expected);
  });

  it("reads Next's searchParams record the same way, taking the first of repeated values", () => {
    expect(
      parseView({ mission: ["s3", "s1"], range: "2y", baseline: "current", q: undefined, release: "x:S3_OL1" }),
    ).toEqual({ mission: "3", range: "2Y", baseline: "current", q: "", release: "x:S3_OL1" });
  });
});

describe("viewParams / viewHref", () => {
  it("leaves every default out of the URL", () => {
    expect(viewParams(DEFAULT_VIEW).toString()).toBe("");
    expect(viewHref(DEFAULT_VIEW)).toBe("/processors");
  });

  it("writes every non-default param", () => {
    const v = view({ mission: "5P", range: "1Y", baseline: "current", q: "ch4", release: "id1:S5P_L2_CH4" });
    expect(Object.fromEntries(viewParams(v))).toEqual({
      mission: "s5p",
      range: "1y",
      baseline: "current",
      q: "ch4",
      release: "id1:S5P_L2_CH4",
    });
  });

  it("round-trips every view through the URL", () => {
    const views: ProcessorsView[] = [
      DEFAULT_VIEW,
      view({ mission: "2" }),
      view({ mission: "3", range: "2Y" }),
      view({ mission: "5P", baseline: "current" }),
      view({ q: "a & b / c?d=e" }),
      view({ release: "15cc6ca8_b04c_11f1_953a_0242ac110002:S3_OL1" }),
    ];
    for (const v of views) {
      const href = viewHref(v);
      expect(parse(href.split("?")[1] ?? "")).toEqual(v);
    }
  });

  it("percent-encodes the search text", () => {
    expect(viewHref(view({ q: "a & b" }))).toBe("/processors?q=a+%26+b");
  });
});

describe("resolveView", () => {
  const groups: ProcessorGroup[] = [
    { mission: "1", ipf: "S1_L0", label: "S1 L0", sub: "", releases: [release("a:S1_L0")] },
    { mission: "3", ipf: "S3_OL1", label: "S3 OL1", sub: "", releases: [release("b:S3_OL1")] },
  ];

  it("switches to the mission of a release from another mission", () => {
    expect(resolveView(view({ mission: "1", release: "b:S3_OL1" }), groups)).toEqual(
      view({ mission: "3", release: "b:S3_OL1" }),
    );
  });

  it("keeps a view whose release belongs to its mission", () => {
    const v = view({ mission: "1", release: "a:S1_L0", range: "2Y" });
    expect(resolveView(v, groups)).toBe(v);
  });

  it("drops a release that does not exist", () => {
    expect(resolveView(view({ mission: "3", release: "nope" }), groups)).toEqual(view({ mission: "3" }));
  });

  it("leaves a view without a release untouched", () => {
    const v = view({ mission: "2" });
    expect(resolveView(v, groups)).toBe(v);
  });
});

function release(id: string): ProcessorGroup["releases"][number] {
  return { id, baseline: "1.0", ms: 0, sats: [], changes: "—", isCurrent: true, searchText: "" };
}
