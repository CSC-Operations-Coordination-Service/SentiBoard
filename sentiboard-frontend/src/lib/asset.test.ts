import { afterEach, describe, expect, it, vi } from "vitest";

describe("asset", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns the path unchanged when the site is served at the root", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "");
    const { asset } = await import("./asset");
    expect(asset("/assets/img/esa_logo.png")).toBe("/assets/img/esa_logo.png");
  });

  it("withBasePath prefixes routes for raw anchors and the history API", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/sentiboard/frontend");
    const { withBasePath } = await import("./asset");
    expect(withBasePath("/processors?mission=s2")).toBe("/sentiboard/frontend/processors?mission=s2");
  });

  it("puts the base path in front of it", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/sentiboard/frontend");
    const { asset } = await import("./asset");
    expect(asset("/assets/mv/home.mp4")).toBe("/sentiboard/frontend/assets/mv/home.mp4");
  });
});
