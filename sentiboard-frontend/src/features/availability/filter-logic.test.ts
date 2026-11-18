import { describe, expect, it } from "vitest";
import {
  toggleOption,
  selectAll,
  isAllSelected,
  selectedLabel,
} from "./filter-logic";

const display = (id: string) => id.toUpperCase();
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

describe("selectedLabel", () => {
  it("returns null when nothing is off (all on)", () => {
    expect(selectedLabel(ORDER, new Set<Opt>(), display)).toBeNull();
  });

  it("returns the remaining ON names when one option is off", () => {
    // "a" is off → b and c are on
    expect(selectedLabel(ORDER, new Set<Opt>(["a"]), display)).toBe("B, C");
  });

  it("follows `order`, not Set insertion order", () => {
    // insert c then a into the off-set; on set is {b} at index 1 — just b
    const off = new Set<Opt>(["c", "a"]);
    expect(selectedLabel(ORDER, off, display)).toBe("B");
  });

  it("uses the displayName mapping", () => {
    const named = (id: Opt) => ({ a: "Alpha", b: "Beta", c: "Gamma" }[id]);
    expect(selectedLabel(ORDER, new Set<Opt>(["a"]), named)).toBe("Beta, Gamma");
  });

  it('returns "none" when every option is off', () => {
    const allOff = new Set<Opt>(["a", "b", "c"]);
    expect(selectedLabel(ORDER, allOff, display)).toBe("none");
  });
});
