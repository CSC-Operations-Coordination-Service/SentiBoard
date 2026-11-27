import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  minutesFromMidnight,
  prepDatatake,
  subPoint,
  dest,
  bearing,
  buildFootprint,
  buildFootprintFill,
  FILL_R,
  pointerToNdc,
  simSecondsForDatatake,
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

  it("left and right have n+1 points each (n=12 for DT_BASE's 60 s sensing)", () => {
    // trackKm ≈ 395 km → n = max(MIN_ROWS=12, ceil(395/100)=4) = 12 → 13 points
    expect(fp.left).toHaveLength(13);
    expect(fp.right).toHaveLength(13);
  });

  it("ring has 2(n+1)+1 = 27 points", () => {
    expect(fp.ring).toHaveLength(27);
  });

  it("ring closes (first and last point equal)", () => {
    const first = fp.ring[0];
    const last = fp.ring[fp.ring.length - 1];
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
    // Mid-track point of left vs right should be ≈ swathKm apart
    const D2R = Math.PI / 180;
    const R = 6371;
    const mid = Math.floor(fp.left.length / 2);
    const lMid = fp.left[mid];
    const rMid = fp.right[mid];
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
 * Chord-midpoint sag: a chord between two vertices at FILL_R must not pierce
 * the globe sphere (radius 1.0 scene units).  Max safe arc per edge = 1138 km
 * (FILL_R × cos(α/2) = 1.0 → L = 2 × acos(1/1.004) × 6371 ≈ 1138 km).
 * Adaptive row/step sizes (≤ MAX_ROW_KM 100 km and ≤ MAX_STEP_KM 500 km)
 * keep every edge well inside this limit.  We test chord midpoint ≥ 1.0
 * (with 1e-9 slack) so any regression immediately fails.
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

      it("vertex count matches adaptive row/column formula", () => {
        // DT_FILL has 60 s sensing → trackKm ≈ 395 km → n = MAX(MIN_ROWS=12, 4) = 12 → 13 rows
        const expectedSlerpSteps = Math.max(1, Math.ceil(swathKm / 500));
        const expectedCols = expectedSlerpSteps + 1;
        const expectedRows = 13;
        expect(vertexCount).toBe(expectedRows * expectedCols);
      });

      it("index buffer references only valid vertex indices", () => {
        for (let i = 0; i < idx.length; i++) {
          expect(idx[i]).toBeGreaterThanOrEqual(0);
          expect(idx[i]).toBeLessThan(vertexCount);
        }
      });
    });
  });
});

// ── Long-sensing fixtures: along-track sag fix ────────────────────────────────
//
// S3A-146-117 and S5P-47055 (5820 s sensing) produced bow-tie / hourglass fill
// artefacts because the old fixed 24-row grid gave ~1600 km per row, whose chord
// midpoint sags ~25 km below the earth sphere — beyond the 25.5 km FILL_R margin.
// The adaptive row count (≤ MAX_ROW_KM 100 km) brings every row to ≤ 100 km,
// well inside the 1138 km safe limit (FILL_R × cos(α/2) ≥ 1.0).

const LONG_SENSING_CASES: Array<{
  label: string;
  swathKm: number;
  sensingS: number;
  periodMin: number;
  expectedRows: number;   // fp.left.length after buildFootprint
  expectedSlerpSteps: number;
}> = [
  {
    label: "S3 long (1270 km swath, 5820 s sensing, like S3A-146-117)",
    swathKm: 1270,
    sensingS: 5820,
    periodMin: 100.98,
    // trackKm = (5820/60)/100.98 × 40030 ≈ 38 449 km
    // n = min(500, max(12, ceil(38449/100))) = 385 → rows = 386
    expectedRows: 386,
    expectedSlerpSteps: 3, // ceil(1270/500) = 3
  },
  {
    label: "S5P full-orbit (2600 km swath, 5820 s sensing, like S5P-47055)",
    swathKm: 2600,
    sensingS: 5820,
    periodMin: 100.5,
    // trackKm = (5820/60)/100.5 × 40030 ≈ 38 635 km
    // n = min(500, max(12, ceil(38635/100))) = 387 → rows = 388
    expectedRows: 388,
    expectedSlerpSteps: 6, // ceil(2600/500) = 6
  },
];

describe("buildFootprintFill — long sensing (along-track sag fix)", () => {
  LONG_SENSING_CASES.forEach(({ label, swathKm, sensingS, periodMin, expectedRows, expectedSlerpSteps }) => {
    describe(label, () => {
      let pos: Float32Array;
      let idx: Uint16Array;
      let vertexCount: number;

      beforeAll(() => {
        const prep = prepDatatake({ ...DT_BASE, swathKm, sensingS, periodMin }, TODAY_MS);
        const fp = buildFootprint(prep);
        ({ positions: pos, indices: idx } = buildFootprintFill(fp, swathKm));
        vertexCount = pos.length / 3;
      });

      it("has no NaN or Infinity in positions", () => {
        for (let i = 0; i < pos.length; i++) {
          expect(Number.isFinite(pos[i])).toBe(true);
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

      it("vertex count matches adaptive formula", () => {
        expect(vertexCount).toBe(expectedRows * (expectedSlerpSteps + 1));
      });

      it("all indices fit Uint16Array (< 65 536)", () => {
        for (let i = 0; i < idx.length; i++) {
          expect(idx[i]).toBeLessThan(65536);
        }
      });

      it("index buffer references only valid vertex indices", () => {
        for (let i = 0; i < idx.length; i++) {
          expect(idx[i]).toBeGreaterThanOrEqual(0);
          expect(idx[i]).toBeLessThan(vertexCount);
        }
      });
    });
  });
});

// ---------------------------------------------------------------------------
// pointerToNdc
// ---------------------------------------------------------------------------
describe("pointerToNdc", () => {
  // Simulated canvas: 800×600, top-left at screen (100, 50)
  const rect = { left: 100, top: 50, width: 800, height: 600 };
  const W = rect.width, H = rect.height;

  it("maps top-left corner to NDC (-1, +1)", () => {
    const { x, y } = pointerToNdc(rect.left, rect.top, rect);
    expect(x).toBeCloseTo(-1);
    expect(y).toBeCloseTo(1);
  });

  it("maps bottom-right corner to NDC (+1, -1)", () => {
    const { x, y } = pointerToNdc(rect.left + W, rect.top + H, rect);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(-1);
  });

  it("maps canvas centre to NDC (0, 0)", () => {
    const { x, y } = pointerToNdc(rect.left + W / 2, rect.top + H / 2, rect);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
  });

  it("maps an asymmetric interior point correctly on both axes", () => {
    // 1/4 from left → x = -0.5; 3/4 from top → y = -0.5
    const { x, y } = pointerToNdc(rect.left + W * 0.25, rect.top + H * 0.75, rect);
    expect(x).toBeCloseTo(-0.5);
    expect(y).toBeCloseTo(-0.5);
  });

  // -------------------------------------------------------------------------
  // Round-trip with a real PerspectiveCamera that has setViewOffset applied.
  //
  // Why this matters: setViewOffset(W, H, 0, 0.04*H, W, H) modifies the
  // camera's projection matrix.  raycaster.setFromCamera unprojets via
  // projectionMatrixInverse, so the view offset is already captured in the
  // camera — pointerToNdc must return standard NDC (+1, not +0.92).
  // Using +0.92 would shift ndcY by -0.08 and cause each assertion below to
  // fail (the ray would miss the original world point by ~0.1 globe-radii).
  // -------------------------------------------------------------------------
  describe("round-trip through setViewOffset camera", () => {
    // Camera setup that matches the component (§applyView in AcquisitionsGlobe).
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.01, 100);
    cam.position.set(0, 0, 3);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    // Apply the same view offset the component uses (shifts globe centre up 4%)
    cam.setViewOffset(W, H, 0, 0.04 * H, W, H);

    // Three world points on a unit globe, all visible from z=3
    const GLOBE_R = 1.0;
    const worldPoints = [
      new THREE.Vector3(0, 0, GLOBE_R),                                                             // centre
      new THREE.Vector3(0.5, 0.3, Math.sqrt(Math.max(0, GLOBE_R ** 2 - 0.5 ** 2 - 0.3 ** 2))),   // upper-right
      new THREE.Vector3(-0.4, -0.35, Math.sqrt(Math.max(0, GLOBE_R ** 2 - 0.4 ** 2 - 0.35 ** 2))), // lower-left
    ];

    for (const wp of worldPoints) {
      it(`ray through (${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)}) passes within 1e-4`, () => {
        // Project the world point to view-offset-adjusted NDC
        const proj = wp.clone().project(cam);

        // Convert that NDC to fake screen-pixel coordinates (inverse of pointerToNdc)
        const screenX = ((proj.x + 1) / 2) * W + rect.left;
        const screenY = ((1 - proj.y) / 2) * H + rect.top;

        // Convert back and cast a ray — must recover the original world point
        const ndc = pointerToNdc(screenX, screenY, rect);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), cam);

        expect(raycaster.ray.distanceToPoint(wp)).toBeLessThan(1e-4);
      });
    }
  });
});

// ---------------------------------------------------------------------------
// simSecondsForDatatake
// ---------------------------------------------------------------------------
describe("simSecondsForDatatake", () => {
  it("returns tc*60 for a normal daytime datatake", () => {
    // start 10:00:00Z, sensing 120s → tc = 600 + 1 = 601 min → 36060 s
    const p = prepDatatake({ ...DT_BASE, startIso: "2024-06-15T10:00:00Z", sensingS: 120 }, TODAY_MS);
    expect(simSecondsForDatatake(p)).toBeCloseTo(p.tc * 60, 3);
  });

  it("clamps to 86399 when mid-sensing crosses midnight", () => {
    // start 23:59:00Z, sensing 120s → tc = 1439 + 1 = 1440 min → 86400 s → clamp to 86399
    const p = prepDatatake({ ...DT_BASE, startIso: "2024-06-15T23:59:00Z", sensingS: 120 }, TODAY_MS);
    expect(simSecondsForDatatake(p)).toBe(86399);
  });

  it("satellite subPoint at simSecondsForDatatake is near footprint centre", () => {
    // subPoint at tc should return near the datatake's centroid lat/lon
    const p = prepDatatake(DT_BASE, TODAY_MS);
    const tcMin = simSecondsForDatatake(p) / 60;
    const [lon, lat] = subPoint(p, tcMin);
    expect(lat).toBeCloseTo(DT_BASE.lat, 0);
    expect(lon).toBeCloseTo(DT_BASE.lon, 0);
  });
});
