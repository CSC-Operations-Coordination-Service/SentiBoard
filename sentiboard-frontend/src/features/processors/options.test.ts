import { describe, it, expect } from "vitest";
import { pinnedFirst } from "./options";

describe("pinnedFirst", () => {
  it("puts selected item first", () => {
    expect(pinnedFirst(["1", "2", "3", "5P"], "2")).toEqual(["2", "1", "3", "5P"]);
  });

  it("already-first item stays first without duplication", () => {
    expect(pinnedFirst(["1", "2", "3", "5P"], "1")).toEqual(["1", "2", "3", "5P"]);
  });

  it("selected value not in the list returns the list unchanged", () => {
    expect(pinnedFirst(["1", "2", "3", "5P"], "6")).toEqual(["1", "2", "3", "5P"]);
  });
});
