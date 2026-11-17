import { describe, expect, it } from "vitest";
import { periodMinutes, satrecsByUnit, subSatellitePoint } from "./orbit";

// Real TLEs (Celestrak, 2026-11-17).
const S1A = {
  satellite_unit: "S1A",
  line1: "1 39634U 14016A   26321.17087910  .00000593  00000+0  13269-3 0  9994",
  line2: "2 39634  98.1586 326.2825 0001348  88.0012 272.1343 14.60165340672330",
};
const S2A = {
  satellite_unit: "S2A",
  line1: "1 40697U 15028A   26321.15163228  .00000074  00000+0  44715-4 0  9999",
  line2: "2 40697  98.5662  33.7568 0001154  95.7581 264.3733 14.30817467595606",
};

describe("satrecsByUnit", () => {
  it("indexes TLEs by unit, skipping those without one or rejected by SGP4", () => {
    const map = satrecsByUnit([
      S1A,
      S2A,
      { ...S2A, satellite_unit: null },
      { satellite_unit: "BAD", line1: "1 garbage", line2: "2 garbage" },
    ]);
    expect([...map.keys()]).toEqual(["S1A", "S2A"]);
  });

  it("keeps the first TLE of a unit", () => {
    const map = satrecsByUnit([S1A, { ...S2A, satellite_unit: "S1A" }]);
    expect(map.get("S1A")!.satnum).toBe("39634");
  });
});

describe("propagation", () => {
  const s1a = satrecsByUnit([S1A]).get("S1A")!;
  const s2a = satrecsByUnit([S2A]).get("S2A")!;

  it("gives the period from the mean motion", () => {
    expect(periodMinutes(s1a)).toBeCloseTo(1440 / 14.6016534, 2);
    expect(periodMinutes(s2a)).toBeCloseTo(1440 / 14.30817467, 2);
  });

  it("stays within the latitudes a 98° orbit reaches, over a full orbit", () => {
    const epoch = Date.parse("2026-11-17T04:06:00Z");
    let maxLat = 0;
    for (let m = 0; m <= 100; m += 1) {
      const p = subSatellitePoint(s1a, new Date(epoch + m * 60_000))!;
      expect(p.lon).toBeGreaterThanOrEqual(-180);
      expect(p.lon).toBeLessThanOrEqual(180);
      maxLat = Math.max(maxLat, Math.abs(p.lat));
    }
    // inclination 98.16° → the ground track turns at about 81.8° (geodetic, slightly higher)
    expect(maxLat).toBeGreaterThan(81);
    expect(maxLat).toBeLessThan(83);
  });

  it("moves about 360° of argument of latitude per period", () => {
    const t0 = new Date("2026-11-17T06:00:00Z");
    const a = subSatellitePoint(s1a, t0)!;
    const b = subSatellitePoint(s1a, new Date(t0.getTime() + periodMinutes(s1a) * 60_000))!;
    expect(b.lat).toBeCloseTo(a.lat, 0); // same latitude one orbit later
  });
});
