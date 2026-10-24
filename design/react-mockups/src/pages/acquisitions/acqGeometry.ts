/**
 * Orbital-mechanics helpers for the acquisitions globe.
 * Ported verbatim from §5 of docs/acquisitions-prototype-ref.md.
 * All angles in degrees unless noted; [lon, lat] order throughout.
 */

import type { AcqDatatake } from "@/data/mock";

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** All Sentinel missions are near-polar; prototype uses one shared inclination. */
const INC = 98.6 * D2R;
/** Earth rotation, degrees per sidereal minute. */
const WE = 360 / 1436.07;

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

/** 25+25+51 points describing the swept footprint. */
export interface FootprintGeometry {
  left: GeoPoint[];  // 25 left-edge points
  right: GeoPoint[]; // 25 right-edge points
  ring: GeoPoint[];  // 51 closed ring (left + reversed right + left[0])
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

/**
 * Build the swept footprint for one datatake.
 * n=24 steps; left[]/right[] each have 25 points; ring is closed (51 pts).
 */
export function buildFootprint(d: PreparedDatatake): FootprintGeometry {
  const n = 24;
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
