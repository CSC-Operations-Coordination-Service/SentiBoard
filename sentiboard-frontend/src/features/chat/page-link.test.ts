import { describe, it, expect } from "vitest";
import { buildPageLink } from "./page-link";

describe("buildPageLink", () => {
  it("drops unknown pages", () => {
    expect(buildPageLink({ page: "nope" })).toBeNull();
  });

  it("builds a custom availability range with positive missions", () => {
    const url = buildPageLink({ page: "availability", missions: "S2", from: "2026-07-01", to: "2026-07-07" });
    const q = new URL(url!, "http://x").searchParams;
    expect(q.get("range")).toBe("custom");
    expect(q.get("from")).toBe("2026-07-01");
    expect(q.get("missionsOff")).toBe("S1,S3,S5P");
  });

  it("uses lowercase missions on processors and adds the base path", () => {
    expect(buildPageLink({ page: "processors", mission: "S2", range: "1y" }, "/sentiboard"))
      .toBe("/sentiboard/processors?mission=s2&range=1y");
  });

  it("links home with no params", () => {
    expect(buildPageLink({ page: "home" })).toBe("/");
  });
});