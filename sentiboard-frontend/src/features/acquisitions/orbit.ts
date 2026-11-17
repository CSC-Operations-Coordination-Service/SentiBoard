/* Where a satellite was, from its TLE (backend GET /orbit/), propagated with SGP4 (satellite.js).
   Server-side only in practice: the adapter runs in the data loader, so satellite.js never reaches
   the client bundle. */

import {
  SatRecError,
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  propagate,
  twoline2satrec,
  type SatRec,
} from "satellite.js";

export interface Tle {
  satellite_unit?: string | null;
  line1: string;
  line2: string;
}

/** One SGP4 record per satellite unit ("S1A"); TLEs without a unit or that SGP4 rejects are
 *  skipped (satellite.js parses malformed lines into NaN elements without flagging an error, hence
 *  the mean-motion check). When a unit has several TLEs, the first wins. */
export function satrecsByUnit(orbits: Tle[]): Map<string, SatRec> {
  const out = new Map<string, SatRec>();
  for (const o of orbits) {
    if (!o.satellite_unit || out.has(o.satellite_unit)) continue;
    const satrec = twoline2satrec(o.line1, o.line2);
    const valid = satrec.error === SatRecError.None && Number.isFinite(satrec.nokozai) && satrec.nokozai > 0;
    if (valid) out.set(o.satellite_unit, satrec);
  }
  return out;
}

/** Geodetic sub-satellite point (degrees, lon in [-180, 180]) at `date`; null if SGP4 fails. */
export function subSatellitePoint(satrec: SatRec, date: Date): { lat: number; lon: number } | null {
  const pv = propagate(satrec, date);
  if (!pv) return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const lat = degreesLat(geo.latitude);
  const lon = degreesLong(geo.longitude);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/** Orbital period in minutes, 1440 / revolutions per day as published in the TLE. satellite.js
 *  keeps that (Kozai) mean motion in `nokozai`, radians per minute; `no` is SGP4's internal
 *  Brouwer value, which gives a period about 0.06 min shorter. */
export function periodMinutes(satrec: SatRec): number {
  return (2 * Math.PI) / satrec.nokozai;
}
