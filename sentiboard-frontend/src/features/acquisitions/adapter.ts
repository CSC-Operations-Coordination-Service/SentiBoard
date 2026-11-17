/* Backend → Acquisitions page model. Everything specific to this page lives here; the backend
   serves generic records (GET /datatake/, /acquisition-pass/, /orbit/).

   Two steps:
   - buildDatatakes (inside the cached loader, data.ts): positions each datatake on the globe from
     its satellite's TLE, picks its downlink station, maps statuses and levels.
   - adaptAcquisitions (per request, page.tsx): completeness tone, and hides datatakes that have
     not started yet at request time. */

import type { components } from "@/lib/api/schema";
import { meanCompleteness } from "./model";
import { periodMinutes, satrecsByUnit, subSatellitePoint } from "./orbit";
import type { AcqDatatake, AcqLevel, AcqProductType, AcquisitionsData, Station } from "./types";

export type ApiDatatake = components["schemas"]["Datatake"];
export type ApiAcquisitionPass = components["schemas"]["AcquisitionPass"];
export type ApiOrbit = components["schemas"]["SatelliteOrbit"];

export type RawAcqDatatake = Omit<AcqDatatake, "comp" | "cls"> & {
  levels: AcqLevel[];
  /** Publication completeness (legacy PUB %, mean of the level values); null when unknown. */
  pubPct: number | null;
};

// ── page-specific constants ───────────────────────────────────────────────────────────────────

/** Swath width (km) drawn for a footprint: per instrument mode for S1, per mission otherwise.
 *  Nominal instrument values; the legacy registry gives S3 1270 km and S5P 2600 km. */
const S1_SWATH_KM: Record<string, number> = { IW: 250, EW: 400, SM: 80, WV: 20 };
const MISSION_SWATH_KM: Record<string, number> = { S1: 250, S2: 290, S3: 1270, S5: 2600 };
const DEFAULT_SWATH_KM = 250;

export function swathKm(mission: string | null | undefined, mode: string | null | undefined): number {
  if (mission === "S1" && mode && S1_SWATH_KM[mode] !== undefined) return S1_SWATH_KM[mode];
  return MISSION_SWATH_KM[mission ?? ""] ?? DEFAULT_SWATH_KM;
}

/** CADIP ground-station codes → the station names of stations.ts. Maspalomas is "MPS_" in the
 *  index; trailing underscores are dropped before the lookup. */
const STATION_NAME: Record<string, string> = {
  SGS: "Svalbard",
  MTI: "Matera",
  MPS: "Maspalomas",
  INS: "Inuvik",
  NSG: "Neustrelitz",
};

export function stationName(code: string | null | undefined): string {
  if (!code) return "";
  const key = code.toUpperCase().replace(/_+$/, "");
  return STATION_NAME[key] ?? code;
}

/** Legacy PUB status → the page's labels. */
const STATUS_LABEL: Record<string, string> = {
  PUBLISHED: "Published",
  PARTIAL: "Partial",
  UNAVAILABLE: "Failed",
  PLANNED: "Processing",
  PROCESSING: "Processing",
  DELAYED: "Processing",
};

export function statusLabel(status: ApiDatatake["completeness_status"]): string {
  return STATUS_LABEL[status?.publication.status ?? ""] ?? "Processing";
}

/** "S1A" → "Sentinel-1A". */
export function satelliteName(unit: string): string {
  return `Sentinel-${unit.slice(1)}`;
}

// ── downlink station ──────────────────────────────────────────────────────────────────────────

/** A datatake is downlinked within this time after its sensing stops, or not matched at all. */
const DOWNLINK_WITHIN_MS = 12 * 3600 * 1000;

export interface PassSpan {
  station: string;
  start: number;
  stop: number;
}

export function passesByUnit(passes: ApiAcquisitionPass[]): Map<string, PassSpan[]> {
  const out = new Map<string, PassSpan[]>();
  for (const p of passes) {
    if (!p.satellite_id || !p.ground_station || !p.downlink_start || !p.downlink_stop) continue;
    const span = {
      station: stationName(p.ground_station),
      start: Date.parse(p.downlink_start),
      stop: Date.parse(p.downlink_stop),
    };
    if (!Number.isFinite(span.start) || !Number.isFinite(span.stop)) continue;
    const list = out.get(p.satellite_id) ?? [];
    list.push(span);
    out.set(p.satellite_id, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.start - b.start);
  return out;
}

/** Heuristic: the first pass of the same satellite that is still running when sensing starts
 *  (real-time downlink) or starts after it (store and dump), within DOWNLINK_WITHIN_MS of the
 *  sensing stop. The CDS indices hold no explicit datatake → pass link. */
export function downlinkStation(
  passes: PassSpan[] | undefined,
  sensingStart: number,
  sensingStop: number,
): string {
  const pass = passes?.find(
    (p) => p.stop >= sensingStart && p.start <= sensingStop + DOWNLINK_WITHIN_MS,
  );
  return pass?.station ?? "";
}

// ── levels ────────────────────────────────────────────────────────────────────────────────────

const LEVEL_ORDER: AcqLevel["level"][] = ["L0", "L1", "L2", "UNKNOWN"];

export function groupLevels(products: ApiDatatake["products"]): AcqLevel[] {
  const byLevel = new Map<AcqLevel["level"], AcqProductType[]>();
  for (const p of products ?? []) {
    const level = p.product_level ?? "UNKNOWN";
    const list = byLevel.get(level) ?? [];
    list.push({ type: p.product_type, pct: p.percentage ?? null });
    byLevel.set(level, list);
  }
  return LEVEL_ORDER.filter((l) => byLevel.has(l)).map((level) => ({
    level,
    products: byLevel.get(level)!,
  }));
}

// ── step 1: backend records → raw page datatakes ──────────────────────────────────────────────

export type SkipReason = "no-time" | "no-orbit" | "propagation";

export function buildDatatakes(
  records: ApiDatatake[],
  passes: ApiAcquisitionPass[],
  orbits: ApiOrbit[],
): { datatakes: RawAcqDatatake[]; skipped: { id: string; reason: SkipReason }[] } {
  const satrecs = satrecsByUnit(orbits);
  const passIndex = passesByUnit(passes);
  const datatakes: RawAcqDatatake[] = [];
  const skipped: { id: string; reason: SkipReason }[] = [];

  for (const r of records) {
    const unit = r.satellite_unit;
    const start = r.observation_time_start ? Date.parse(r.observation_time_start) : NaN;
    const stop = r.observation_time_stop ? Date.parse(r.observation_time_stop) : NaN;
    if (!unit || !Number.isFinite(start) || !Number.isFinite(stop) || stop < start) {
      skipped.push({ id: r.id, reason: "no-time" });
      continue;
    }
    const satrec = satrecs.get(unit);
    if (!satrec) {
      skipped.push({ id: r.id, reason: "no-orbit" });
      continue;
    }
    // The globe's footprint model is centred on the mid-sensing sub-satellite point.
    const centre = subSatellitePoint(satrec, new Date((start + stop) / 2));
    if (!centre) {
      skipped.push({ id: r.id, reason: "propagation" });
      continue;
    }

    datatakes.push({
      id: r.id,
      sat: satelliteName(unit),
      unit,
      station: downlinkStation(passIndex.get(unit), start, stop),
      lat: Math.round(centre.lat * 1000) / 1000,
      lon: Math.round(centre.lon * 1000) / 1000,
      swathKm: swathKm(r.mission, r.instrument_mode),
      periodMin: Math.round(periodMinutes(satrec) * 100) / 100,
      startIso: new Date(start).toISOString(),
      sensingS: (stop - start) / 1000,
      status: statusLabel(r.completeness_status),
      mode: [r.instrument_mode, r.polarization].filter(Boolean).join(" · "),
      absOrbit: r.absolute_orbit ?? "",
      levels: groupLevels(r.products),
      pubPct: r.completeness_status?.publication.percentage ?? null,
    });
  }
  return { datatakes, skipped };
}

// ── step 2: per request ───────────────────────────────────────────────────────────────────────

/** Footprint tone: red only for a failed datatake, green from 95 %, amber otherwise (including
 *  datatakes still being processed, which have little or nothing published yet). */
export function toneOf(status: string, comp: number): AcqDatatake["cls"] {
  if (status === "Failed") return "crit";
  return comp >= 95 ? "ok" : "warn";
}

export function adaptAcquisitions(
  raw: { datatakes: RawAcqDatatake[]; stations: Station[] },
  nowMs: number,
): AcquisitionsData {
  return {
    datatakes: raw.datatakes
      // Not started yet: planned, not acquired. The page shows acquisitions only.
      .filter((d) => Date.parse(d.startIso) <= nowMs)
      .map(({ pubPct, ...d }) => {
        const comp = Math.round((pubPct ?? meanCompleteness(d.levels)) * 10) / 10;
        return { ...d, comp, cls: toneOf(d.status, comp) };
      }),
    stations: raw.stations,
  };
}
