import { describe, it, expect } from "vitest";
import {
  minutesFromMidnight,
  prepDatatake,
  subPoint,
  dest,
  bearing,
  buildFootprint,
  buildFootprintFill,
  FILL_R,
} from "./acqGeometry";
import type { PreparedDatatake } from "./acqGeometry";

// 2024-06-15 00:00:00 UTC
const TODAY_MS = Date.UTC(2024, 5, 15);

const DT_BASE = {
  lat: 45,
  lon: 10,
  swathKm: 290,
  periodMin: 101.3,
  startIso: "2024-06-15T10:00:00Z",
  sensingS: 60,
};

describe("minutesFromMidnight", () => {
  it("returns 0 for midnight", () => {
    expect(minutesFromMidnight("2024-06-15T00:00:00Z", TODAY_MS)).toBeCloseTo(0);
  });

  it("returns 600 for 10:00Z", () => {
    expect(minutesFromMidnight("2024-06-15T10:00:00Z", TODAY_MS)).toBeCloseTo(600);
  });

  it("returns negative for yesterday", () => {
    expect(minutesFromMidnight("2024-06-14T23:00:00Z", TODAY_MS)).toBeCloseTo(-60);
  });
});

describe("prepDatatake", () => {
  it("returns PreparedDatatake with correct t and dur", () => {
    const p = prepDatatake(DT_BASE, TODAY_MS);
    expect(p.t).toBeCloseTo(600);
    expect(p.dur).toBe(60);
    expect(p.lat).toBe(45);
    expect(p.lon).toBe(10);
    expect(p.swathKm).toBe(290);
    expect(p.periodMin).toBe(101.3);
  });

  it("tc is midpoint of sensing interval in minutes", () => {
    const p = prepDatatake(DT_BASE, TODAY_MS);
    // dur = 60s = 1min, half = 0.5min
    expect(p.tc).toBeCloseTo(600.5);
  });

  it("produces finite values for polar orbit crossing", () => {
    const p = prepDatatake({ ...DT_BASE, lat: 80 }, TODAY_MS);
    expect(Number.isFinite(p.uc)).toBe(true);
    expect(Number.isFinite(p.lon0)).toBe(true);
  });

  it("clamps asin argument to [-1, 1] for high-latitude inputs", () => {
    // lat > inclination (98.6°/2 ≈ 49.3° effective coverage); should not throw
    const p = prepDatatake({ ...DT_BASE, lat: 85 }, TODAY_MS);
    expect(Number.isFinite(p.uc)).toBe(true);
  });
});

describe("subPoint", () => {
  let p: PreparedDatatake;
  beforeAll(() => { p = prepDatatake(DT_BASE, TODAY_MS); });

  it("returns a valid [lon, lat] pair at sensing start", () => {
    const [lon, lat] = subPoint(p, p.t);
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
    expect(lat).toBeGreaterThanOrEqual(-90);
    expect(lat).toBeLessThanOrEqual(90);
  });

  it("lat at tc ≈ input centre lat", () => {
    const [, lat] = subPoint(p, p.tc);
    expect(Math.abs(lat - DT_BASE.lat)).toBeLessThan(0.5);
  });

  it("advances along-track over time", () => {
    const [, lat1] = subPoint(p, p.t);
    const [, lat2] = subPoint(p, p.t + 1);
    // Descending or ascending — just ensure it moved
    expect(lat1).not.toBeCloseTo(lat2, 2);
  });

  it("wraps longitude to [-180, 180]", () => {
    // Push lon0 far out of range
    const farEast = prepDatatake({ ...DT_BASE, lon: 170 }, TODAY_MS);
    const [lon] = subPoint(farEast, farEast.t + 10);
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
  });
});

describe("dest", () => {
  it("stays at origin when km = 0", () => {
    const [lon, lat] = dest([10, 45], 90, 0);
    expect(lon).toBeCloseTo(10, 4);
    expect(lat).toBeCloseTo(45, 4);
  });

  it("moves east on bearing 90", () => {
    const [lon] = dest([10, 0], 90, 1000);
    expect(lon).toBeGreaterThan(10);
  });

  it("moves west on bearing 270", () => {
    const [lon] = dest([10, 0], 270, 1000);
    expect(lon).toBeLessThan(10);
  });

  it("moves north on bearing 0", () => {
    const [, lat] = dest([0, 0], 0, 1000);
    expect(lat).toBeGreaterThan(0);
  });

  it("wraps longitude past 180", () => {
    const [lon] = dest([175, 0], 90, 1000);
    expect(lon).toBeLessThan(0); // wrapped
  });
});

describe("bearing", () => {
  it("bearing from equator eastward ≈ 90°", () => {
    expect(bearing([0, 0], [10, 0])).toBeCloseTo(90, 0);
  });

  it("bearing northward ≈ 0°", () => {
    expect(bearing([0, 0], [0, 10])).toBeCloseTo(0, 0);
  });

  it("bearing southward ≈ 180° or -180°", () => {
    const b = bearing([0, 10], [0, 0]);
    expect(Math.abs(Math.abs(b) - 180)).toBeLessThan(1);
  });
});

describe("buildFootprint", () => {
  let fp: ReturnType<typeof buildFootprint>;
  let p: PreparedDatatake;

  beforeAll(() => {
    p = prepDatatake(DT_BASE, TODAY_MS);
    fp = buildFootprint(p);
  });

  it("left and right have 25 points each", () => {
    expect(fp.left).toHaveLength(25);
    expect(fp.right).toHaveLength(25);
  });

  it("ring has 51 points (25 + 25 + 1 close)", () => {
    expect(fp.ring).toHaveLength(51);
  });

  it("ring closes (first and last point equal)", () => {
    const first = fp.ring[0];
    const last = fp.ring[50];
    expect(last[0]).toBeCloseTo(first[0], 4);
    expect(last[1]).toBeCloseTo(first[1], 4);
  });

  it("all ring points have valid lon/lat", () => {
    for (const [lon, lat] of fp.ring) {
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
    }
  });

  it("left and right edges are separated by ≈ swathKm", () => {
    // Middle point of left vs right should be ≈ swathKm apart
    const D2R = Math.PI / 180;
    const R = 6371;
    const lMid = fp.left[12];
    const rMid = fp.right[12];
    const dlat = (rMid[1] - lMid[1]) * D2R;
    const dlon = (rMid[0] - lMid[0]) * D2R;
    const a =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(lMid[1] * D2R) * Math.cos(rMid[1] * D2R) * Math.sin(dlon / 2) ** 2;
    const dist = 2 * R * Math.asin(Math.sqrt(a));
    expect(dist).toBeCloseTo(DT_BASE.swathKm, -1); // within ~10 km
  });
});

// vitest needs beforeAll from vitest
import { beforeAll } from "vitest";

// ── buildFootprintFill ─────────────────────────────────────────────────────────

/**
 * Chord-midpoint sag tolerance: a chord between two vertices at FILL_R must not
 * pierce the globe sphere (radius 1.0 in scene units). With FILL_R = 1.004 and
 * ≤ 6 across-track slerp steps the worst-case sag is ~0.0006 (S5P, 433 km/step),
 * leaving the chord midpoint at ~1.0034 — well above 1.0. We test midpoint radius
 * >= 1.0 (with 1e-9 floating-point slack) so any regression that reintroduces
 * un-subdivided chords on wide swaths immediately fails.
 */
const EARTH_R = 1.0;

function vertRadius(pos: Float32Array, i: number): number {
  const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
  return Math.sqrt(x * x + y * y + z * z);
}

function chordMidRadius(pos: Float32Array, a: number, b: number): number {
  const mx = (pos[a * 3] + pos[b * 3]) / 2;
  const my = (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2;
  const mz = (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2;
  return Math.sqrt(mx * mx + my * my + mz * mz);
}

const WIDE_SWATHS: Array<{ label: string; swathKm: number }> = [
  { label: "normal (290 km)", swathKm: 290 },
  { label: "S3-class (1270 km)", swathKm: 1270 },
  { label: "S5P-class (2600 km)", swathKm: 2600 },
];

describe("buildFootprintFill", () => {
  const DT_FILL = { ...DT_BASE }; // reuse existing fixture (lat 45, lon 10, 290 km swath)

  WIDE_SWATHS.forEach(({ label, swathKm }) => {
    describe(`swath: ${label}`, () => {
      let pos: Float32Array;
      let idx: Uint16Array;
      let vertexCount: number;

      beforeAll(() => {
        const prep = prepDatatake({ ...DT_FILL, swathKm }, TODAY_MS);
        const fp = buildFootprint(prep);
        ({ positions: pos, indices: idx } = buildFootprintFill(fp, swathKm));
        vertexCount = pos.length / 3;
      });

      it("has no NaN or Infinity in positions", () => {
        for (let i = 0; i < pos.length; i++) {
          expect(Number.isFinite(pos[i])).toBe(true);
        }
      });

      it("has no NaN or Infinity in indices", () => {
        for (let i = 0; i < idx.length; i++) {
          expect(Number.isFinite(idx[i])).toBe(true);
        }
      });

      it("every vertex lies at FILL_R within 1e-5", () => {
        for (let v = 0; v < vertexCount; v++) {
          expect(vertRadius(pos, v)).toBeCloseTo(FILL_R, 5);
        }
      });

      it("every triangle edge chord midpoint stays above earth radius", () => {
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t], b = idx[t + 1], c = idx[t + 2];
          expect(chordMidRadius(pos, a, b)).toBeGreaterThanOrEqual(EARTH_R - 1e-9);
          expect(chordMidRadius(pos, b, c)).toBeGreaterThanOrEqual(EARTH_R - 1e-9);
          expect(chordMidRadius(pos, a, c)).toBeGreaterThanOrEqual(EARTH_R - 1e-9);
        }
      });

      if (swathKm <= 500) {
        it("narrow swath: 50 vertices (25 rows × 2 columns, no extra across-track)", () => {
          expect(vertexCount).toBe(50);
        });
      } else {
        it("wide swath: 175 vertices (25 rows × 7 columns, 6 slerp steps)", () => {
          expect(vertexCount).toBe(175);
        });
      }

      it("index buffer references only valid vertex indices", () => {
        for (let i = 0; i < idx.length; i++) {
          expect(idx[i]).toBeGreaterThanOrEqual(0);
          expect(idx[i]).toBeLessThan(vertexCount);
        }
      });
    });
  });
});
