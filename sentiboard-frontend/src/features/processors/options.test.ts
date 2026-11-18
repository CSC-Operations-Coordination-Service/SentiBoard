import { describe, it, expect } from "vitest";
import { pinnedFirstBy, filterHeaderLabel } from "./options";

describe("pinnedFirstBy", () => {
  it("moves the selected item to index 0", () => {
    expect(pinnedFirstBy(["1", "2", "3", "5P"], (x) => x === "2")).toEqual(["2", "1", "3", "5P"]);
  });

  it("already-first selected item stays first without duplication", () => {
    expect(pinnedFirstBy(["1", "2", "3", "5P"], (x) => x === "1")).toEqual(["1", "2", "3", "5P"]);
  });

  it("no item satisfies predicate returns the list unchanged", () => {
    expect(pinnedFirstBy(["1", "2", "3", "5P"], (x) => x === "6")).toEqual(["1", "2", "3", "5P"]);
  });

  it("works with Baseline-shaped objects", () => {
    const opts = [
      { value: "all", label: "All releases" },
      { value: "current", label: "Current baselines" },
    ] as const;
    expect(pinnedFirstBy(opts, (o) => o.value === "current")).toEqual([
      { value: "current", label: "Current baselines" },
      { value: "all", label: "All releases" },
    ]);
  });

  it("Baseline already-first returns unchanged", () => {
    const opts = [
      { value: "all", label: "All releases" },
      { value: "current", label: "Current baselines" },
    ] as const;
    expect(pinnedFirstBy(opts, (o) => o.value === "all")).toEqual([...opts]);
  });
});

describe("filterHeaderLabel", () => {
  const opts = [
    { value: "all", label: "All releases" },
    { value: "current", label: "Current baselines" },
  ] as const;

  it("returns the matching option label", () => {
    expect(filterHeaderLabel(opts, "current")).toBe("Current baselines");
    expect(filterHeaderLabel(opts, "all")).toBe("All releases");
  });

  it("falls back to the raw value when not found", () => {
    expect(filterHeaderLabel(opts, "unknown" as "all" | "current")).toBe("unknown");
  });
});
