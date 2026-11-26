import { describe, expect, it } from "vitest";
import { NEWS_PAGE_SIZE, clampPage, pageCount, parsePage, slicePage } from "./url-state";

describe("parsePage", () => {
  it("returns 1 for undefined", () => expect(parsePage(undefined)).toBe(1));
  it("returns 1 for empty string", () => expect(parsePage("")).toBe(1));
  it("returns 1 for non-numeric string", () => expect(parsePage("abc")).toBe(1));
  it("returns 1 for '0'", () => expect(parsePage("0")).toBe(1));
  it("returns 1 for negative string", () => expect(parsePage("-2")).toBe(1));
  it("returns 1 for decimal string", () => expect(parsePage("2.5")).toBe(1));
  it("returns 3 for '3'", () => expect(parsePage("3")).toBe(3));
  it("returns 1 for array input (takes first element, falls back when empty)", () => {
    expect(parsePage([])).toBe(1);
  });
  it("parses first element of an array", () => {
    expect(parsePage(["5", "2"])).toBe(5);
  });
});

describe("pageCount", () => {
  it("returns 1 for 0 items", () => expect(pageCount(0)).toBe(1));
  it("returns 1 for exactly one page of items", () => expect(pageCount(NEWS_PAGE_SIZE)).toBe(1));
  it("returns 2 when items exceed one page by 1", () => expect(pageCount(NEWS_PAGE_SIZE + 1)).toBe(2));
  it("returns 9 for 81 items", () => expect(pageCount(81)).toBe(9));
});

describe("clampPage", () => {
  it("clamps a too-large page down to the last page", () => expect(clampPage(99, 81)).toBe(9));
  it("clamps 0 to 1", () => expect(clampPage(0, 81)).toBe(1));
  it("passes through a valid page", () => expect(clampPage(3, 81)).toBe(3));
  it("handles empty list (last page = 1)", () => expect(clampPage(5, 0)).toBe(1));
});

describe("slicePage", () => {
  const items = Array.from({ length: 81 }, (_, i) => i + 1);

  it("first page returns first 10 items", () => {
    expect(slicePage(items, 1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("last page (9) returns the single remaining item", () => {
    expect(slicePage(items, 9)).toEqual([81]);
  });

  it("page 2 returns items 11–20", () => {
    expect(slicePage(items, 2)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  it("clamped out-of-range page returns last slice", () => {
    expect(slicePage(items, 99)).toEqual([81]);
  });

  it("empty list returns empty array", () => {
    expect(slicePage([], 1)).toEqual([]);
  });
});
