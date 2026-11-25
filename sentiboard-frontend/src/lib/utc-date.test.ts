import { describe, expect, it } from "vitest";
import { utcNewsHeaderDate } from "./utc-date";

describe("utcNewsHeaderDate", () => {
  it("formats the reference example from production", () =>
    expect(utcNewsHeaderDate("2026-10-07T09:20:00Z")).toBe("07-Oct-2026 at 09:20"));

  it("formats a typical date", () =>
    expect(utcNewsHeaderDate("2026-11-17T14:26:00Z")).toBe("17-Nov-2026 at 14:26"));

  it("zero-pads day 1 and midnight", () =>
    expect(utcNewsHeaderDate("2026-01-01T00:00:00Z")).toBe("01-Jan-2026 at 00:00"));

  it("handles last day of year at 23:59", () =>
    expect(utcNewsHeaderDate("2026-12-31T23:59:00Z")).toBe("31-Dec-2026 at 23:59"));

  it("zero-pads single-digit day and minute", () =>
    expect(utcNewsHeaderDate("2026-07-07T09:05:00Z")).toBe("07-Jul-2026 at 09:05"));
});
