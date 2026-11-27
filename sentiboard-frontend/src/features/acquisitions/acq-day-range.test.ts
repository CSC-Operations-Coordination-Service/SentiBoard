import { describe, expect, it } from "vitest";
import { acqDayRange, isValidAcqDay, resolveAcqDay } from "./acq-day-range";

const TODAY = "2026-11-26";

describe("acqDayRange", () => {
  it("last equals todayKey", () => {
    expect(acqDayRange(TODAY).last).toBe(TODAY);
  });

  it("first is today minus 15 days", () => {
    expect(acqDayRange(TODAY).first).toBe("2026-11-11");
  });

  it("range spans 16 days inclusive", () => {
    const { first, last } = acqDayRange(TODAY);
    const firstMs = Date.parse(`${first}T00:00:00Z`);
    const lastMs = Date.parse(`${last}T00:00:00Z`);
    expect((lastMs - firstMs) / 86_400_000 + 1).toBe(16);
  });

  it("months contains only 2026-11 when range stays in one month", () => {
    expect(acqDayRange(TODAY).months).toEqual(new Set(["2026-11"]));
  });

  it("months spans two months when range crosses a month boundary", () => {
    // today = 2026-12-05 → first = 2026-11-20 → spans Nov + Dec
    const { months } = acqDayRange("2026-12-05");
    expect(months.has("2026-11")).toBe(true);
    expect(months.has("2026-12")).toBe(true);
  });
});

describe("isValidAcqDay", () => {
  it("accepts today", () => {
    expect(isValidAcqDay(TODAY, TODAY)).toBe(true);
  });

  it("accepts today minus 15 (first day)", () => {
    expect(isValidAcqDay("2026-11-11", TODAY)).toBe(true);
  });

  it("rejects today minus 16", () => {
    expect(isValidAcqDay("2026-11-10", TODAY)).toBe(false);
  });

  it("rejects tomorrow", () => {
    expect(isValidAcqDay("2026-11-27", TODAY)).toBe(false);
  });

  it("rejects non-date strings", () => {
    expect(isValidAcqDay("today", TODAY)).toBe(false);
    expect(isValidAcqDay("2026-11", TODAY)).toBe(false);
    expect(isValidAcqDay("", TODAY)).toBe(false);
  });
});

describe("resolveAcqDay", () => {
  it("returns dayRaw when it is in range", () => {
    expect(resolveAcqDay("2026-11-15", TODAY)).toBe("2026-11-15");
  });

  it("returns todayKey for null", () => {
    expect(resolveAcqDay(null, TODAY)).toBe(TODAY);
  });

  it("returns todayKey for a date before the range", () => {
    expect(resolveAcqDay("2026-11-10", TODAY)).toBe(TODAY);
  });

  it("returns todayKey for a future date", () => {
    expect(resolveAcqDay("2026-12-01", TODAY)).toBe(TODAY);
  });

  it("returns todayKey for an invalid string", () => {
    expect(resolveAcqDay("not-a-date", TODAY)).toBe(TODAY);
  });
});
