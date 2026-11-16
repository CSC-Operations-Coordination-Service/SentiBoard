import { describe, expect, it } from "vitest";
import { buildPageContext, normaliseMission, pageIdOf } from "./page-context";

const NOW = new Date("2026-11-13T09:30:00Z");
const ORIGIN = "https://dashboard.example.test";
const ctx = (path: string, basePath = "", tz?: string) =>
  buildPageContext(`${ORIGIN}${path}`, basePath, NOW, tz);

describe("normaliseMission", () => {
  it.each([
    ["s1", "S1"],
    ["1", "S1"],
    ["S2", "S2"],
    ["5P", "S5P"],
    ["s5p", "S5P"],
  ])("%s → %s", (raw, expected) => expect(normaliseMission(raw)).toBe(expected));
});

describe("pageIdOf", () => {
  it("maps known paths, ignoring a trailing slash", () => {
    expect(pageIdOf("/")).toBe("home");
    expect(pageIdOf("/events")).toBe("events");
    expect(pageIdOf("/events/")).toBe("events");
    expect(pageIdOf("/acquisitions-globe-earth")).toBe("acquisitionsEarth");
  });

  it("returns null for unknown paths", () => {
    expect(pageIdOf("/nope")).toBeNull();
    expect(pageIdOf("/events/123")).toBeNull();
  });
});

describe("buildPageContext — common fields", () => {
  it("always carries url, path, title, now and the time zone", () => {
    const c = ctx("/events?q=x", "", "Europe/Paris");
    expect(c.page_id).toBe("events");
    expect(c.filters).toMatchObject({
      url: `${ORIGIN}/events?q=x`,
      path: "/events",
      page_title: "Events",
      now: "2026-11-13T09:30:00.000Z",
      time_zone: "Europe/Paris",
    });
  });

  it("omits the time zone when unknown", () => {
    expect(ctx("/").filters).not.toHaveProperty("time_zone");
  });

  it("strips the base path before matching the route, but keeps it in the url", () => {
    const c = ctx("/sentiboard/frontend/processors", "/sentiboard/frontend");
    expect(c.page_id).toBe("processors");
    expect(c.filters?.path).toBe("/processors");
    expect(c.filters?.url).toBe(`${ORIGIN}/sentiboard/frontend/processors`);
  });

  it("maps the bare base path to home", () => {
    expect(ctx("/base", "/base").page_id).toBe("home");
  });

  it("does not strip a path that only starts with the base path's letters", () => {
    expect(ctx("/based/events", "/base").page_id).toBeNull();
  });

  it("gives an unknown page no id, no title and no page filters", () => {
    const c = ctx("/somewhere?mission=s2");
    expect(c.page_id).toBeNull();
    expect(c.filters?.page_title).toBeNull();
    expect(c.filters).not.toHaveProperty("mission");
    expect(c.selection).toBeNull();
  });

  it("gives pages without URL state only the common fields", () => {
    const c = ctx("/terms-conditions");
    expect(c.page_id).toBe("terms");
    expect(Object.keys(c.filters ?? {}).sort()).toEqual(["now", "page_title", "path", "url"]);
  });
});

describe("buildPageContext — processors", () => {
  it("sends the defaults as the effective view", () => {
    const c = ctx("/processors");
    expect(c.filters).toMatchObject({ mission: "S1", range: "ALL", baseline: "all" });
    expect(c.filters).not.toHaveProperty("search");
    expect(c.selection).toBeNull();
  });

  it("reads filters and the selected release", () => {
    const c = ctx("/processors?mission=s5p&range=1y&baseline=current&q=L2&release=abc:IPF-1.2");
    expect(c.filters).toMatchObject({
      mission: "S5P",
      range: "1Y",
      baseline: "current",
      search: "L2",
    });
    expect(c.selection).toEqual({ release: "abc:IPF-1.2" });
  });
});

describe("buildPageContext — events", () => {
  it("defaults to the current UTC month", () => {
    const c = ctx("/events");
    expect(c.filters).toMatchObject({
      year: 2026,
      month: 11,
      categories_off: [],
      missions_off: [],
      satellites_off: [],
    });
    expect(c.selection).toBeNull();
  });

  it("reads month, off-lists (missions normalised, sorted) and the selected event", () => {
    const c = ctx("/events?year=2025&month=3&missionsOff=s3,s1&q=orbit&event=ANO-42");
    expect(c.filters).toMatchObject({
      year: 2025,
      month: 3,
      missions_off: ["S1", "S3"],
      search: "orbit",
    });
    expect(c.selection).toEqual({ event: "ANO-42" });
  });
});

describe("buildPageContext — acquisitions", () => {
  it("defaults to all satellites and today (UTC)", () => {
    const c = ctx("/acquisitions-globe-earth");
    expect(c.page_id).toBe("acquisitionsEarth");
    expect(c.filters).toMatchObject({ satellite: "all", day: "2026-11-13" });
    expect(c.filters).not.toHaveProperty("mission");
  });

  it("reads satellite (with its mission), day and datatake on both globe routes", () => {
    for (const path of ["/acquisitions-globe", "/acquisitions-globe-earth"]) {
      const c = ctx(`${path}?satellite=S2A&day=2026-11-01&datatake=DT-1`);
      expect(c.filters).toMatchObject({ satellite: "S2A", mission: "S2", day: "2026-11-01" });
      expect(c.selection).toEqual({ datatake: "DT-1" });
    }
  });

  it("maps S5P to its own mission", () => {
    expect(ctx("/acquisitions-globe?satellite=S5P").filters?.mission).toBe("S5P");
  });

  it("ignores an unknown satellite", () => {
    expect(ctx("/acquisitions-globe?satellite=XYZ").filters?.satellite).toBe("all");
  });
});

describe("buildPageContext — availability", () => {
  it("sends the default 30-day window", () => {
    const c = ctx("/availability");
    expect(c.filters).toMatchObject({ range_days: 30, missions_off: [], statuses_off: [] });
    expect(c.filters).not.toHaveProperty("offset_days");
    expect(c.filters).not.toHaveProperty("from");
  });

  it("sends a custom range with its dates and the picked datatake", () => {
    const c = ctx("/availability?range=custom&from=2026-10-01&to=2026-10-15&pick=DT-9");
    expect(c.filters).toMatchObject({ range_days: "custom", from: "2026-10-01", to: "2026-10-15" });
    expect(c.selection).toEqual({ datatake: "DT-9" });
  });
});

describe("buildPageContext — size", () => {
  it("stays far below the server action's 8 KB limit for a typical page", () => {
    const c = ctx("/events?missionsOff=s1,s2,s3&satellitesOff=S1A,S2B&q=something");
    expect(JSON.stringify(c).length).toBeLessThan(2048);
  });
});
