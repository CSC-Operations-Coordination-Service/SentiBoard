/* Datatake detail data for the "View Details" modal.
   ---------------------------------------------------------------------------
   Production opens this from the Actions column of the datatake table
   (apps/static/assets/js/datatakes/datatakes.js → toggleInfoTable) and fills it from
   /api/worker/cds-datatake/<id>: one row per product, 10 rows a page, with the Timeliness column
   shown only for Sentinel-3 and Sentinel-5P. This module reproduces that payload locally.

   Everything is derived from the datatake ID through a hash, so a given datatake always shows the
   same orbit, station and product percentages no matter how often the modal is reopened — no
   Math.random() at render time. Product types are the real Copernicus type names; the orbit
   numbers, downlink stations and coverage figures are invented, as this is a mock-up. */

export interface DatatakeSummary {
  id: string;
  /** Satellite unit — S1A, S2B, S5P … */
  platform: string;
  /** Mission family — "Sentinel-1", "Sentinel-5P" … */
  mission: string;
  sensorMode?: string;
  sensingStart: Date;
  statusLabel: string;
  statusColor: string;
  /** Publication completeness, 0–100. */
  completeness: number;
}

export interface ProductRow {
  timeliness: string;
  type: string;
  pct: number;
}

export interface DatatakeDetails {
  sensingStop: Date;
  durationMin: number;
  sensorMode: string;
  absoluteOrbit: number;
  relativeOrbit: number;
  cycle: number;
  station: string;
  coverage: number;
  footprint: string;
  levels: string[];
  products: ProductRow[];
  /** Production shows the Timeliness column for S3 and S5P only. */
  showTimeliness: boolean;
}

// --- deterministic RNG ------------------------------------------------------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rngFor(id: string) {
  let s = hash(id) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// --- mission facts ----------------------------------------------------------

/** Repeat-cycle length in orbits — the range a relative orbit (track) number falls in. */
const TRACKS: Record<string, number> = { "Sentinel-1": 175, "Sentinel-2": 143, "Sentinel-3": 385, "Sentinel-5P": 227 };

/** Typical datatake length per mission, in minutes. */
const DURATION: Record<string, [number, number]> = {
  "Sentinel-1": [4, 25],
  "Sentinel-2": [10, 47],
  "Sentinel-3": [20, 45],
  "Sentinel-5P": [90, 101],
};

const STATIONS = ["Svalbard", "Matera", "Maspalomas", "Inuvik", "Neustrelitz", "Kiruna"];
const FOOTPRINTS = ["Land", "Land + coastal", "Open ocean", "Polar", "Coastal"];

const DEFAULT_MODE: Record<string, string> = {
  "Sentinel-1": "IW",
  "Sentinel-2": "MSI",
  "Sentinel-3": "OLCI",
  "Sentinel-5P": "TROPOMI",
};

/** Product types per sensor mode, using the real Copernicus product-type names. */
const TYPES: Record<string, string[]> = {
  IW: ["L0__IW_RAW", "L1__IW_SLC", "L1__IW_GRDH", "L2__IW_OCN"],
  EW: ["L0__EW_RAW", "L1__EW_SLC", "L1__EW_GRDM", "L2__EW_OCN"],
  SM: ["L0__SM_RAW", "L1__SM_SLC", "L1__SM_GRDH", "L2__SM_OCN"],
  WV: ["L0__WV_RAW", "L1__WV_SLC", "L2__WV_OCN"],
  MSI: ["MSI_L0__GR", "MSI_L1B___", "MSI_L1C___", "MSI_L2A___"],
  OLCI: ["OL_0_EFR__", "OL_1_EFR__", "OL_1_ERR__", "OL_2_LFR__", "OL_2_LRR__", "OL_2_WFR__", "OL_2_WRR__"],
  SLSTR: ["SL_0_SLT__", "SL_1_RBT__", "SL_2_LST__", "SL_2_WST__", "SL_2_FRP__", "SL_2_AOD__"],
  SRAL: ["SR_0_SRA__", "SR_1_SRA__", "SR_1_SRA_A", "SR_1_SRA_BS", "SR_2_LAN__", "SR_2_WAT__"],
  TROPOMI: [
    "L1B_ENG_DB", "L1B_RA_BD1", "L1B_RA_BD2", "L1B_RA_BD3", "L1B_RA_BD4",
    "L1B_RA_BD5", "L1B_RA_BD6", "L1B_RA_BD7", "L1B_RA_BD8",
    "L2__AER_AI", "L2__AER_LH", "L2__CH4___", "L2__CLOUD_", "L2__CO____",
    "L2__HCHO__", "L2__NO2___", "L2__NP_BD3", "L2__NP_BD6", "L2__NP_BD7",
    "L2__O3____", "L2__O3_TCL", "L2__SO2___",
  ],
};

/** Timeliness classes per mission. Only S3 and S5P show the column, matching production. */
const TIMELINESS: Record<string, string[]> = {
  "Sentinel-1": ["NRT-3h"],
  "Sentinel-2": ["NOMINAL"],
  "Sentinel-3": ["NR", "ST", "NT"],
  "Sentinel-5P": ["NRTI", "OFFL"],
};

/** "S2A" → "Sentinel-2"; "S5P" → "Sentinel-5P". */
export function missionOfPlatform(platform: string): string {
  const p = platform.toUpperCase();
  if (p.startsWith("S5")) return "Sentinel-5P";
  const digit = p.match(/^S(\d)/);
  return digit ? `Sentinel-${digit[1]}` : "Sentinel-1";
}

// --- detail generation ------------------------------------------------------

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Per-product completeness that averages out near the datatake's own figure. */
function productPct(completeness: number, rng: () => number) {
  if (completeness >= 99) return 100;
  if (completeness <= 1) return rng() < 0.85 ? 0 : round2(rng() * 4);
  const spread = completeness >= 85 ? 8 : 26;
  const v = completeness + (rng() * 2 - 1) * spread;
  return round2(Math.min(100, Math.max(0, v)));
}

export function datatakeDetails(dt: DatatakeSummary): DatatakeDetails {
  const rng = rngFor(dt.id);
  const mission = dt.mission;
  const mode = dt.sensorMode ?? DEFAULT_MODE[mission] ?? "IW";

  const [minMin, maxMin] = DURATION[mission] ?? [10, 40];
  const durationMin = Math.round(minMin + rng() * (maxMin - minMin));
  const sensingStop = new Date(dt.sensingStart.getTime() + durationMin * 60_000);

  const trackCount = TRACKS[mission] ?? 175;
  const relativeOrbit = 1 + Math.floor(rng() * trackCount);
  const cycle = 40 + Math.floor(rng() * 180);
  const absoluteOrbit = cycle * trackCount + relativeOrbit;

  const station = STATIONS[Math.floor(rng() * STATIONS.length)];
  const footprint = FOOTPRINTS[Math.floor(rng() * FOOTPRINTS.length)];
  // Coverage is acquisition-side and sits at or above publication completeness: you cannot publish
  // more than you acquired, but you can acquire a pass whose products then fail to publish.
  const coverage = dt.completeness >= 99 ? 100 : Math.min(100, round2(dt.completeness + rng() * 12));

  const types = TYPES[mode] ?? TYPES.IW;
  const timeliness = TIMELINESS[mission] ?? ["NOMINAL"];
  const showTimeliness = mission === "Sentinel-3" || mission === "Sentinel-5P";

  // With no Timeliness column there is one row per product type; with it, one row per
  // (timeliness, type) pair — which is what makes the S5P list run to several pages.
  const products: ProductRow[] = showTimeliness
    ? timeliness.flatMap((t) => types.map((type) => ({ timeliness: t, type, pct: productPct(dt.completeness, rng) })))
    : types.map((type) => ({ timeliness: timeliness[0], type, pct: productPct(dt.completeness, rng) }));

  const levels = [...new Set(products.map((p) => (p.type.match(/L(\d)/) ? `L${p.type.match(/L(\d)/)![1]}` : "L1")))].sort();

  return {
    sensingStop, durationMin, sensorMode: mode, absoluteOrbit, relativeOrbit, cycle,
    station, coverage, footprint, levels, products, showTimeliness,
  };
}
