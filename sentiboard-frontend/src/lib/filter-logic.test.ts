import { describe, expect, it } from "vitest";
import {
  toggleOption,
  selectAll,
  isAllSelected,
  selectedIds,
} from "@/lib/filter-logic";

const ORDER = ["a", "b", "c"] as const;
type Opt = (typeof ORDER)[number];

describe("toggleOption", () => {
  it("adds an item that is on (turns it off)", () => {
    const result = toggleOption(new Set<Opt>(), "a");
    expect(result).toEqual(new Set(["a"]));
  });

  it("removes an item that is already off (turns it back on)", () => {
    const result = toggleOption(new Set<Opt>(["a", "b"]), "a");
    expect(result).toEqual(new Set(["b"]));
  });
});

describe("selectAll", () => {
  it("returns an empty set regardless of input (call with no arg)", () => {
    const result = selectAll<Opt>();
    expect(result.size).toBe(0);
  });
});

describe("isAllSelected", () => {
  it("returns true when the off-set is empty", () => {
    expect(isAllSelected(new Set<Opt>())).toBe(true);
  });

  it("returns false when at least one item is off", () => {
    expect(isAllSelected(new Set<Opt>(["a"]))).toBe(false);
  });
});

describe("selectedIds", () => {
  it("returns null when nothing is off (all on)", () => {
    expect(selectedIds(ORDER, new Set<Opt>())).toBeNull();
  });

  it("returns the ON ids in order when one option is off", () => {
    expect(selectedIds(ORDER, new Set<Opt>(["a"]))).toEqual(["b", "c"]);
  });

  it("follows `order`, not Set insertion order", () => {
    const off = new Set<Opt>(["c", "a"]);
    expect(selectedIds(ORDER, off)).toEqual(["b"]);
  });

  it("returns [] when every option is off", () => {
    expect(selectedIds(ORDER, new Set<Opt>(["a", "b", "c"]))).toEqual([]);
  });
});
