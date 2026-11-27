/**
 * Orbital-mechanics helpers for the acquisitions globe.
 * Ported verbatim from §5 of docs/acquisitions-prototype-ref.md.
 * All angles in degrees unless noted; [lon, lat] order throughout.
 */

import type { AcqDatatake } from "./types";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** All Sentinel missions are near-polar; prototype uses one shared inclination. */
const INC = 98.6 * D2R;
/** Earth rotation, degrees per sidereal minute. */
const WE = 360 / 1436.07;
/** Earth circumference (km), used to compute along-track distance from sensing duration. */
const EARTH_CIRC_KM = 2 * Math.PI * 6371;
/** Maximum along-track arc per row (km) — keeps every chord midpoint above the FILL_R sphere. */
const MAX_ROW_KM = 100;
/** Maximum across-track arc per slerp step (km). */
const MAX_STEP_KM = 500;
/** Minimum along-track rows; keeps outline and pick area smooth for short datatakes. */
const MIN_ROWS = 12;
/** Maximum along-track rows; bounds the vertex count. */
const MAX_ROWS = 500;

/** [lon, lat] geographic point. */
export type GeoPoint = [lon: number, lat: number];

/** Pre-computed orbital constants for one datatake, derived from its centre lat/lon and t. */
export interface PreparedDatatake {
  t: number;          // minutes from the page's todayMs (negative = yesterday)
  dur: number;        // sensing duration, seconds
  lat: number;
  lon: number;
  swathKm: number;
  periodMin: number;
  tc: number;         // time of sub-point crossing the centre latitude
  uc: number;         // argument of latitude at tc
  lon0: number;       // longitude reference
}

/** Left/right edge points and closed ring describing the swept footprint. */
export interface FootprintGeometry {
  left: GeoPoint[];  // left-edge points  (n+1 for n along-track rows)
  right: GeoPoint[]; // right-edge points (n+1)
  ring: GeoPoint[];  // closed ring: left + reversed(right) + left[0]
}

/**
 * Minutes from the page's todayMs to this datatake's sensing start.
 * Negative when the sensing started yesterday.
 */
export function minutesFromMidnight(startIso: string, todayMs: number): number {
  return (Date.parse(startIso) - todayMs) / 60_000;
}

/**
 * Pre-compute the orbital constants needed by subPoint and buildFootprint.
 * One call per datatake per page load.
 */
export function prepDatatake(
  dt: Pick<AcqDatatake, "lat" | "lon" | "swathKm" | "periodMin" | "startIso" | "sensingS">,
  todayMs: number,
): PreparedDatatake {
  const t = minutesFromMidnight(dt.startIso, todayMs);
  const dur = dt.sensingS;
  const tc = t + dur / 120;
  const su = Math.sin(dt.lat * D2R) / Math.sin(INC);
  const uc = Math.PI - Math.asin(Math.max(-1, Math.min(1, su)));
  const lon0 =
    dt.lon -
    Math.atan2(Math.cos(INC) * Math.sin(uc), Math.cos(uc)) * R2D +
    WE * tc;
  return { t, dur, lat: dt.lat, lon: dt.lon, swathKm: dt.swathKm, periodMin: dt.periodMin, tc, uc, lon0 };
}

/**
 * Sub-satellite point at time t (minutes from todayMs).
 * Returns [lon, lat].
 */
export function subPoint(d: PreparedDatatake, t: number): GeoPoint {
  const u = d.uc + (2 * Math.PI * (t - d.tc)) / d.periodMin;
  const lat = Math.asin(Math.sin(INC) * Math.sin(u)) * R2D;
  const lon =
    d.lon0 +
    Math.atan2(Math.cos(INC) * Math.sin(u), Math.cos(u)) * R2D -
    WE * t;
  return [((lon + 540) % 360) - 180, lat];
}

/**
 * Destination point at distance km along bearing brng from p.
 * Returns [lon, lat].
 */
export function dest(p: GeoPoint, brng: number, km: number): GeoPoint {
  const d = km / 6371;
  const la1 = p[1] * D2R;
  const lo1 = p[0] * D2R;
  const b = brng * D2R;
  const la2 = Math.asin(
    Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b),
  );
  const lo2 =
    lo1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(la1),
      Math.cos(d) - Math.sin(la1) * Math.sin(la2),
    );
  return [((lo2 * R2D + 540) % 360) - 180, la2 * R2D];
}

/**
 * Initial bearing from a to b, in degrees.
 */
export function bearing(a: GeoPoint, b: GeoPoint): number {
  const la1 = a[1] * D2R;
  const la2 = b[1] * D2R;
  const dl = (b[0] - a[0]) * D2R;
  return (
    Math.atan2(
      Math.sin(dl) * Math.cos(la2),
      Math.cos(la1) * Math.sin(la2) -
        Math.sin(la1) * Math.cos(la2) * Math.cos(dl),
    ) * R2D
  );
}

/** Fill radius: just above the earth sphere (1.0) but below the outline. */
export const FILL_R = 1.004;
/** Outline radius: above FILL_R so the outline always draws over the fill. */
export const OUTLINE_R = 1.005;

/**
 * Convert [lon, lat] to earth-local XYZ at radius r.
 * Uses the same (lon + 90) longitude offset as the globe's ThreeEarth coordinate system.
 */
function geoToXyz(lon: number, lat: number, r: number): [number, number, number] {
  const φ = lat * D2R;
  const λ = (lon + 90) * D2R;
  return [Math.cos(φ) * Math.sin(λ) * r, Math.sin(φ) * r, Math.cos(φ) * Math.cos(λ) * r];
}

/**
 * Build the indexed fill mesh for one datatake footprint.
 *
 * Row count is fp.left.length (adaptive from buildFootprint).
 * Across-track slerp steps: ceil(swathKm / MAX_STEP_KM), min 1.
 * Every chord midpoint stays above the earth sphere (radius 1.0 scene units).
 *
 * Returns earth-local XYZ positions at FILL_R and a Uint16 index buffer.
 * No browser or Three.js dependencies — safe to call in Vitest.
 */
export function buildFootprintFill(
  fp: FootprintGeometry,
  swathKm: number,
): { positions: Float32Array; indices: Uint16Array } {
  const slerpSteps = Math.max(1, Math.ceil(swathKm / MAX_STEP_KM));
  const cols = slerpSteps + 1;
  const rows = fp.left.length;

  const positions = new Float32Array(rows * cols * 3);
  for (let k = 0; k < rows; k++) {
    const [lx, ly, lz] = geoToXyz(fp.left[k][0], fp.left[k][1], FILL_R);
    const [rx, ry, rz] = geoToXyz(fp.right[k][0], fp.right[k][1], FILL_R);
    for (let s = 0; s <= slerpSteps; s++) {
      const f = s / slerpSteps;
      const mx = lx + f * (rx - lx);
      const my = ly + f * (ry - ly);
      const mz = lz + f * (rz - lz);
      const len = Math.sqrt(mx * mx + my * my + mz * mz);
      const base = (k * cols + s) * 3;
      positions[base    ] = (mx / len) * FILL_R;
      positions[base + 1] = (my / len) * FILL_R;
      positions[base + 2] = (mz / len) * FILL_R;
    }
  }

  // Index buffer: (rows−1) × slerpSteps × 2 triangles × 3 indices
  const indices = new Uint16Array((rows - 1) * slerpSteps * 6);
  let ii = 0;
  for (let k = 0; k < rows - 1; k++) {
    for (let s = 0; s < slerpSteps; s++) {
      const tl = k * cols + s;
      const tr = k * cols + s + 1;
      const bl = (k + 1) * cols + s;
      const br = (k + 1) * cols + s + 1;
      indices[ii++] = tl; indices[ii++] = bl; indices[ii++] = br;
      indices[ii++] = tl; indices[ii++] = br; indices[ii++] = tr;
    }
  }

  return { positions, indices };
}

/**
 * Build the swept footprint for one datatake.
 * Row count n is adaptive: ceil(trackKm / MAX_ROW_KM), clamped to [MIN_ROWS, MAX_ROWS].
 * left[]/right[] each have n+1 points; ring is closed (2n+3 pts).
 */
export function buildFootprint(d: PreparedDatatake): FootprintGeometry {
  const trackKm = (d.dur / 60 / d.periodMin) * EARTH_CIRC_KM;
  const n = Math.min(MAX_ROWS, Math.max(MIN_ROWS, Math.ceil(trackKm / MAX_ROW_KM)));
  const left: GeoPoint[] = [];
  const right: GeoPoint[] = [];
  const t0 = d.t;
  const t1 = d.t + d.dur / 60;
  for (let k = 0; k <= n; k++) {
    const t = t0 + ((t1 - t0) * k) / n;
    const p = subPoint(d, t);
    const q = subPoint(d, t + 0.05);
    const b = bearing(p, q);
    left.push(dest(p, b - 90, d.swathKm / 2));
    right.push(dest(p, b + 90, d.swathKm / 2));
  }
  const ring: GeoPoint[] = [...left, ...right.slice().reverse(), left[0]];
  return { left, right, ring };
}

/**
 * Seconds-into-day for the simulation clock when a datatake is selected.
 *
 * Uses the mid-sensing crossing point (prep.tc) so the satellite dot appears
 * at the footprint centre for every mission. The result is clamped to
 * [0, 86399]: no wrapping. The sim day (simDayMs) is fixed to the datatake's
 * acquisition day, so a value of e.g. 86430 would place the satellite ~1 orbit
 * too early (the rAF's % 86400 would wrap it to 30 s, which is correct for
 * local midnight but would be read as 00:00:30 on the datatake's day — a
 * different instant than the actual mid-sensing). Clamping to 86399 keeps
 * the dot at the last second of the datatake's day, which is visually
 * indistinguishable from the true mid-sensing for any near-midnight case.
 */
export function simSecondsForDatatake(prep: PreparedDatatake): number {
  return Math.max(0, Math.min(86399, prep.tc * 60));
}

/**
 * Convert a pointer event position to Three.js NDC [-1, 1].
 * No view-offset parameter: setViewOffset modifies the camera's projection
 * matrix, so raycaster.setFromCamera already handles it via projectionMatrixInverse.
 * Passing anything other than standard +1 would double-correct and shift the hit area.
 */
export function pointerToNdc(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number } {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}
