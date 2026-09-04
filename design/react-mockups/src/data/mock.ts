import { fixedDatatakeId } from "./datatake-id";

// Static mock data for the UI mockups. In the real product these values come
// from Flask SSR (OpenSearch / JIRA / TLE) with no browser-exposed JSON API.
// Copy here mirrors the wording used in the current SentiBoard templates.

export type Status = "nominal" | "degraded" | "critical" | "info" | "neutral";

export interface NewsItem { title: string; published: string; body: string; sev: "ok" | "warn" | "crit" | "info"; }
export interface RtEvent { cls: "ok" | "warn" | "crit" | "info"; date: string; time: string; title: string; text: string; }
export interface ModuleCard {
  idx: string; href: string; title: string; img: string;
  pill: { label: string; status: Status }; metric: string; unit: string; desc: string;
  pos?: string; // optional CSS background-position focal point
}

export const NEWS: NewsItem[] = [
  { title: "Copernicus Sentinel-3 operation impacts", published: "2023-07-06", body: "Sentinel-3 operations were impacted from date 05-07-2026 on UTC 12:49. Operations return to nominal date 06-07-2026 on UTC 11:48.", sev: "warn" },
  { title: "Copernicus Sentinel-2B/C operation impacts", published: "2023-07-14", body: "Sentinel-2B and Sentinel-2C operations are impacted from date 26-06-2026 on 06:00 UTC. Operations return to nominal on date 26-06-2026 on 17:00 UTC.", sev: "ok" },
  { title: "Copernicus Sentinel-3A/3B operation impacts", published: "2023-07-13", body: "Sentinel 3A/3B operations were impacted from date 2026-07-11 on estimated UTC 21:47. Operations return to nominal date 2026-07-12 on UTC 10:08.", sev: "ok" },
  { title: "Copernicus Sentinel-2C operation impacts", published: "2023-07-12", body: "Sentinel 2C operations are partially impacted from date 2026-07-11 on estimated UTC 01:49. Analysis is ongoing. We apologise for the inconveniences the issue is causing.", sev: "warn" },
  { title: "Copernicus Sentinel-2B/2C operation impacts", published: "2023-07-11", body: "Sentinel 2B/2C operations were impacted from date 2026-07-07 on UTC 13:38. Operations return to nominal date 2026-07-08 on UTC 01:45.", sev: "ok" },
];

export const REALTIME: RtEvent[] = [
  { cls: "ok", date: "20 Jul 2026", time: "08:55", title: "Copernicus Sentinel-1A/C, Sentinel-2A/B/C and Sentinel-5P operation impacts", text: "Sentinel-1A, Sentinel-1C, Sentinel-2A, Sentinel-2B, Sentinel-2C and Sentinel-5P operations were impacted from date 18-06-2026 on UTC 15. Operations return to nominal date 19-06-2026 on UTC 03:25." },
  { cls: "info", date: "13 Jul 2026", time: "12:56", title: "Sentinel-1C orbital reconfiguration dates", text: "In preparation of the Sentinel-1A operations end of duty, the Sentinel-1C satellite will be manoeuvred to reach the 6-days nominal revisit frequency between Sentinel-1C and Sentinel-1D ground tracks (currently 1-day). During this period, to occur between 09 and 23 June, Sentinel-1C operations will be temporarily suspended and nominal operations will be ensured by the other two units, Sentinel-1A and Sentinel-1D. Please refer to the linked news for complete information." },
  { cls: "warn", date: "12 Jul 2026", time: "11:22", title: "Sentinel-5p planned maintenance activities starting on 17/06/2026", text: "Due to Sentinel-5P Ground Segment planned maintenance activities from 17/06/2026 to 18/07/2026, NRTI data production may experience delays or interruptions. Users requiring the most complete and detailed dataset are advised to use OFFL data, which will be made available in the following days. We apologize for any inconvenience this might cause to your activities." },
  { cls: "crit", date: "11 Jul 2026", time: "10:05", title: "Copernicus Sentinel-5P: INU Station WAN Outage", text: "Sentinel-5P operations were impacted by a WAN outage at the INU Station from 2026-05-23 at 09:45 UTC. Operations returned to nominal on 2026-05-23 at 19:11 UTC. The related operational impacts will be documented on the SentiBoard Event Page on the next nominal working day. We apologise for the inconvenience this issue may have caused." },
  { cls: "info", date: "08 Jul 2026", time: "08:41", title: "Copernicus Sentinel-2B/2C operation impacts", text: "Sentinel 2B/2C operations were impacted from date 2026-07-07 on UTC 13:38. Operations return to nominal date 2026-07-08 on UTC 01:45." },
];

// Module imagery is stored locally in /public/assets/img/modules (self-contained,
// no external hotlinks). Sources: Earth/servers/rocket-pad from Unsplash (free
// licence); ground station + Sentinel-2 spacecraft from Wikimedia Commons
// (ESA, CC BY-SA) — see README credits.
export const MODULES: ModuleCard[] = [
  { idx: "01", href: "/acquisitions", title: "Acquisitions Status", img: "/assets/img/modules/acquisitions.jpg", pill: { label: "Live", status: "nominal" }, metric: "1,284", unit: "datatakes / 24h", desc: "Past, current and planned Sentinel acquisitions on an interactive 3D globe. Inspect a past acquisition or explore planned observations." },
  { idx: "02", href: "/events", title: "Events", img: "/assets/img/modules/events.jpg", pill: { label: "3 open", status: "degraded" }, metric: "12", unit: "events / 3 months", desc: "Calibration activities, manoeuvres and anomalies that could impede data production, and the products they impact." },
  { idx: "03", href: "/availability", title: "Data Availability", img: "/assets/img/modules/availability.jpg", pill: { label: "98.4%", status: "nominal" }, metric: "98.4", unit: "% availability", desc: "Real-time list of available collections delivered by the missions. Verify whether data of interest is available and review key metrics." },
  { idx: "04", href: "/processors", title: "Processors", img: "/assets/img/modules/processors.jpg", pill: { label: "Baseline 003.71", status: "info" }, metric: "47", unit: "releases tracked", desc: "The complete list of Copernicus Sentinel processor releases on an interactive, zoomable timeline." },
];

/* Datatake completeness — the five states of the production legend ("Completeness Status:" in
   apps/templates/home/data-availability.html), in lifecycle order. Deliberately separate from
   `Status` above, which carries mission and processor health: "nominal" is a claim about a
   satellite, "acquired" is a claim about one datatake's products, and conflating the two is what
   made the old table say "Nominal" where the dashboard says "Acquired".
   Colours live in the --cmp-* tokens so both themes are handled in one place. */
export type Completeness = "planned" | "processing" | "acquired" | "partial" | "unavailable";

export const COMPLETENESS_ORDER: Completeness[] = ["planned", "processing", "acquired", "partial", "unavailable"];

export const COMPLETENESS_LABEL: Record<Completeness, string> = {
  planned: "Planned",
  processing: "Processing",
  acquired: "Acquired",
  partial: "Partial",
  unavailable: "Unavailable",
};

export const COMPLETENESS_COLOR: Record<Completeness, string> = {
  planned: "var(--cmp-planned)",
  processing: "var(--cmp-processing)",
  acquired: "var(--cmp-acquired)",
  partial: "var(--cmp-partial)",
  unavailable: "var(--cmp-unavailable)",
};

export interface Datatake { id: string; mission: string; sensing: string; start: Date; comp: Completeness; pct: number; }

/* The rows are placed RELATIVE to today rather than pinned to fixed dates. With fixed dates the
   period selector was decorative — every row fell outside "Last 24 Hours" the moment the dates
   aged, so no choice changed the table. Offsets keep at least one row inside every period and the
   sensing labels follow from the offsets. */
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad2 = (n: number) => String(n).padStart(2, "0");

/** "Sentinel-2A" from "S2A"; Sentinel-5P flies alone and keeps its name. */
function platformLabel(sat: string): string {
  return sat.startsWith("S5") ? "Sentinel-5P" : `Sentinel-${sat.slice(1)}`;
}

/* Ids come from data/datatake-id.ts — the dashboard's own per-mission format (S1C-73089,
   S2C-10132-1, S3A-142-380, S5P-45784). Seeded by the row's position so the list is stable and a
   literal written elsewhere can be matched against it. */

function sensingLabel(d: Date): string {
  return `${pad2(d.getUTCDate())} ${MONTH_ABBR[d.getUTCMonth()]} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC`;
}

// [satellite, offset from now, completeness, %] — positive offsets are scheduled, not yet flown.
// Percentages track the state: planned has flown nothing yet, processing is still publishing.
const DATATAKE_SPEC: [string, number, Completeness, number][] = [
  ["S1C", +14 * HOUR_MS, "planned", 0],
  ["S2C", +3 * HOUR_MS, "planned", 0],
  ["S2A", -1.5 * HOUR_MS, "processing", 41],
  ["S1A", -5 * HOUR_MS, "processing", 62],
  ["S3B", -11 * HOUR_MS, "acquired", 100],
  ["S5P", -19 * HOUR_MS, "acquired", 96],
  ["S2B", -2 * DAY_MS - 3 * HOUR_MS, "partial", 78],
  ["S3A", -5 * DAY_MS - 9 * HOUR_MS, "acquired", 100],
  ["S1A", -12 * DAY_MS - 2 * HOUR_MS, "unavailable", 0],
  ["S2A", -21 * DAY_MS - 7 * HOUR_MS, "acquired", 99],
  ["S3B", -44 * DAY_MS - 5 * HOUR_MS, "partial", 55],
  ["S5P", -68 * DAY_MS - 16 * HOUR_MS, "acquired", 97],
];

export const DATATAKES: Datatake[] = (() => {
  // Seconds are zeroed so an id stays legible; the rest rides on the current instant, which is
  // what keeps "Last 24 Hours" populated whatever time of day the page is opened.
  const anchor = Math.floor(Date.now() / 60_000) * 60_000;
  return DATATAKE_SPEC.map(([sat, offset, comp, pct], i) => {
    const start = new Date(anchor + offset);
    return { id: fixedDatatakeId(sat, i + 1), mission: platformLabel(sat), sensing: sensingLabel(start), start, comp, pct };
  }).sort((a, b) => b.start.getTime() - a.start.getTime());
})();

export const AVAILABILITY = [
  { label: "Sentinel-1", sub: "C-band SAR", pct: 99.1, status: "nominal" as Status },
  { label: "Sentinel-2", sub: "MSI", pct: 98.7, status: "nominal" as Status },
  { label: "Sentinel-3", sub: "OLCI / SLSTR", pct: 91.4, status: "degraded" as Status },
  { label: "Sentinel-5P", sub: "TROPOMI", pct: 99.6, status: "nominal" as Status },
];

export interface Processor { mission: string; from: number; to: number; label: string; status: Status; }
// from/to are 0..100 positions along a 12-month track (mockup only).
export const PROCESSORS: Processor[] = [
  { mission: "S1 IPF", from: 2, to: 40, label: "003.61", status: "neutral" },
  { mission: "S1 IPF", from: 40, to: 95, label: "003.71", status: "info" },
  { mission: "S2 IPF", from: 5, to: 55, label: "05.11", status: "neutral" },
  { mission: "S2 IPF", from: 55, to: 98, label: "05.12", status: "nominal" },
  { mission: "S3 IPF", from: 10, to: 70, label: "OL 07.01", status: "neutral" },
  { mission: "S3 IPF", from: 70, to: 96, label: "OL 07.02", status: "degraded" },
  { mission: "S5P", from: 0, to: 100, label: "02.06.00", status: "nominal" },
];

export type IssueType = "acquisition" | "calibration" | "manoeuvre" | "production" | "satellite";
export interface ImpactedDatatake { id: string; cls: "ok" | "warn" | "crit"; }
export interface CalEvent {
  day: number; type: IssueType;
  occurrence: string;        // full occurrence date, as the current app shows it
  satellites: string;        // impacted satellite(s)
  impacted: ImpactedDatatake[]; // list of impacted datatakes
}
export const EVENTS: CalEvent[] = [
  { day: 3, type: "calibration", occurrence: "Fri 03 Jul 2026 08:15:00 UTC", satellites: "S2B", impacted: [{ id: "S2B-42473", cls: "ok" }, { id: "S2B-42474", cls: "warn" }] },
  { day: 7, type: "manoeuvre", occurrence: "Tue 07 Jul 2026 11:30:00 UTC", satellites: "S1A", impacted: [{ id: "S1A-476451", cls: "ok" }] },
  { day: 9, type: "satellite", occurrence: "Thu 09 Jul 2026 22:15:00 UTC", satellites: "S3A", impacted: [{ id: "S3A-18604", cls: "crit" }, { id: "S3A-18605", cls: "crit" }] },
  { day: 12, type: "production", occurrence: "Sun 12 Jul 2026 03:00:00 UTC", satellites: "S1 / S2 / S3", impacted: [{ id: "S2A-3958", cls: "warn" }, { id: "S1C-22754", cls: "warn" }, { id: "S3B-11902", cls: "ok" }] },
  { day: 16, type: "acquisition", occurrence: "Thu 16 Jul 2026 10:42:00 UTC", satellites: "S2A", impacted: [{ id: "S2A-485773", cls: "warn" }, { id: "S2A-485774", cls: "ok" }] },
  { day: 21, type: "calibration", occurrence: "Tue 21 Jul 2026 06:00:00 UTC", satellites: "S3A / S3B", impacted: [{ id: "S3A-7720", cls: "ok" }, { id: "S3B-7721", cls: "ok" }] },
  { day: 24, type: "manoeuvre", occurrence: "Fri 24 Jul 2026 14:20:00 UTC", satellites: "S5P", impacted: [{ id: "S5P-06012", cls: "ok" }] },
];

// Event-type colours now follow production's Event Types legend rather than a
// mockup-only palette. They are CSS variables, not hexes, because two of
// production's five values are unreadable on the dark canvas and need a
// per-theme substitute — see the --evt-* block in styles/tokens.css. Every
// consumer applies these through inline style / currentColor, so var() is
// fine; anything painting to a <canvas> would need the resolved hex instead.
export const ISSUE_COLORS: Record<IssueType, string> = {
  acquisition: "var(--evt-acquisition)",
  calibration: "var(--evt-calibration)",
  manoeuvre: "var(--evt-manoeuvre)",
  production: "var(--evt-production)",
  satellite: "var(--evt-satellite)",
};

export const STATUS_COLORS: Record<Status, string> = {
  nominal: "#34d399", degraded: "#f5b544", critical: "#ef5b6e", info: "#4ea8ff", neutral: "#6c778a",
};

// ---- Acquisitions globe (interactive 3D canvas) ----
export interface Station { name: string; lat: number; lon: number; }
export interface AcqProduct { lvl: string; sub: string; st: "Published" | "Processing" | "Planned"; }

/* Per-product-type completeness, mirroring the real backend's `<TYPE>_local_percentage`
   fields. `pct: null` means the type is not expected for this datatake — distinct from
   0%, which means expected and missing.

   BACKEND AUDIT (apps/elastic/modules/datatakes.py, apps/utils/events_utils.py).
   Every mission aggregates to the same three display levels, but each one identifies
   them differently, and there is a fourth bucket:

     S1  _calc_s1_datatake_completeness — no "L" token at all; the level is a digit
         inside the product type: _0A_/_0C_/_0N_/_0S_ -> L0, _1A_/_1S_ -> L1,
         _2A_/_2S_ -> L2.
     S2  _calc_s2_datatake_completeness — L0_ -> L0; L1A_/L1B_/L1C_ all collapse into
         one L1; L2A_ -> L2. Keys starting with ("L0_","L1A_","L1B_","L1C_","L2A_")
         are level aggregates and are skipped.
     S3  level_ids["S3"] = {L0_: "L0_", L1_: "L1_", L2_: "L2_"} — read off the
         product document's own `product_level`, not parsed from the type name.
     S5  level_ids["S5"] = {L0_: "L0_", L1_: "L1B", L2_: "L2_"} — its L1 token is
         "L1B", not "L1".
     ALL `product_level` falls back to "UNKNOWN" when nothing matches (set in four
         places in datatakes.py), so UNKNOWN is a real bucket the UI must render.

   No mission defines a level above L2 in the completeness path. The one exception is
   get_product_level_python() in events_utils.py, used for sorting only, which maps a
   trailing "A" to level 3 and returns 98/99 for unrecognised types.

   Product types themselves are NOT enumerated anywhere in the backend — they are
   whatever the cds-completeness-* indices contain at runtime. The sets below are
   representative of each mission's instruments (SATELLITES[].instruments in
   apps/utils/satellite_registry.py): S1 SAR only, S2 MSI only, S5P TROPOMI only, and
   S3 four science instruments (OLCI, SLSTR, SRAL, MWR) — which is why S3 carries far
   more product types than the rest and the plates have to cap. */
export type ProductLevel = "L0" | "L1" | "L2" | "UNKNOWN";

export const LEVEL_LABEL: Record<ProductLevel, string> = {
  L0: "Level 0",
  L1: "Level 1",
  L2: "Level 2",
  UNKNOWN: "Unclassified",
};

export interface AcqProductType {
  type: string;
  pct: number | null;
  /** Instrument the type belongs to — the only mission where this varies is S3. */
  instrument?: string;
}
export interface AcqLevel { level: ProductLevel; products: AcqProductType[]; }

export interface AcqDatatake {
  id: string; sat: string; unit: string; station: string;
  lat: number; lon: number;            // acquisition footprint centre
  footprint: [number, number][];       // closed [lon, lat] ring — the acquired swath
  cls: "ok" | "warn" | "crit";         // marker colour — derived from comp
  comp: number;                        // completeness % — derived as the mean over expected types
  status: string;                      // human status
  mode: string;                        // instrument mode · polarisation, e.g. "IW · DV"
  absOrbit: string;                    // absolute orbit
  startIso: string;                    // sensing start — explicit, since the id no longer carries it
  sensingS: number;                    // sensing duration, seconds
  levels: AcqLevel[];
  prods: AcqProduct[];                 // legacy summary list, still used by the /acquisitions rail
  kmlLink?: { url: string; filename: string };  // ESA KML link for S1/S2; undefined for S3/S5
}

/* Sensing start, shared by the globe and the rail. This used to pick the timestamp out of the
   datatake id; the dashboard's real id format (S3A-142-380) carries no time, so it reads the
   explicit field instead. */
export function sensingMs(dt: { startIso: string }): number | null {
  const ms = Date.parse(dt.startIso);
  return Number.isNaN(ms) ? null : ms;
}

// ---- Completeness metrics -------------------------------------------------
// One place, so the header KPI, the datatake list, the globe markers and the
// completeness plates can never disagree.

/** Product types actually expected for this datatake (pct !== null). */
export const expectedTypes = (levels: AcqLevel[]): AcqProductType[] =>
  levels.flatMap((l) => l.products).filter((p) => p.pct !== null);

/**
 * Datatake completeness as the unweighted MEAN across expected product types.
 * This matches the reference design: for its S1C example the ten product types
 * average 90.76% and the header reads 90.8%. Note the real backend currently
 * reports `final_completeness_percentage` as the MAX, which would read 99.0% for
 * the same datatake — the best-performing product rather than the datatake.
 */
export function meanCompleteness(levels: AcqLevel[]): number {
  const ps = expectedTypes(levels);
  if (!ps.length) return 0;
  return ps.reduce((n, p) => n + (p.pct as number), 0) / ps.length;
}

/** Level aggregate — also an unweighted mean, as the reference design shows. */
export function levelMean(level: AcqLevel): number | null {
  const ps = level.products.filter((p) => p.pct !== null);
  if (!ps.length) return null;
  return ps.reduce((n, p) => n + (p.pct as number), 0) / ps.length;
}

/**
 * Missing sensing time, SUMMED ACROSS PRODUCT TYPES: each expected type should
 * cover the whole datatake, so a type at 62% is missing 38% of the sensing window
 * and the shortfalls add up. The total can therefore exceed the datatake's own
 * sensing duration — in the reference design a 3m 25s datatake reports 3m 09s
 * missing across ten product types. It is a backlog figure, not an interval.
 */
export function missingSeconds(dt: AcqDatatake): number {
  return expectedTypes(dt.levels).reduce((n, p) => n + dt.sensingS * (1 - (p.pct as number) / 100), 0);
}

// Builds a swath footprint around a centre point: `along` degrees down the ground
// track, `across` degrees wide, rotated by the pass heading. Edges are subdivided
// so the ring still follows the sphere's curvature once projected onto the globe.
// The swath extents below are illustrative mock geometry chosen to look plausible
// per instrument family — they are not taken from the mission specifications.
function swath(lat: number, lon: number, along: number, across: number, heading: number): [number, number][] {
  const h = (heading * Math.PI) / 180;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180)); // a longitude degree shrinks towards the poles
  const at = (a: number, c: number): [number, number] => [
    lon + (a * Math.sin(h) + c * Math.cos(h)) / cosLat,
    lat + (a * Math.cos(h) - c * Math.sin(h)),
  ];
  const corners = [
    [-along / 2, -across / 2], [along / 2, -across / 2],
    [along / 2, across / 2], [-along / 2, across / 2],
  ];
  const ring: [number, number][] = [];
  const SEG = 6;
  for (let i = 0; i < 4; i++) {
    const [a0, c0] = corners[i];
    const [a1, c1] = corners[(i + 1) % 4];
    for (let k = 0; k < SEG; k++) ring.push(at(a0 + ((a1 - a0) * k) / SEG, c0 + ((c1 - c0) * k) / SEG));
  }
  ring.push(ring[0]);
  return ring;
}

// Copernicus core ground stations.
export const STATIONS: Station[] = [
  { name: "Svalbard", lat: 78.23, lon: 15.39 },
  { name: "Matera", lat: 40.65, lon: 16.7 },
  { name: "Maspalomas", lat: 27.76, lon: -15.63 },
  { name: "Inuvik", lat: 68.35, lon: -133.72 },
  { name: "Neustrelitz", lat: 53.33, lon: 13.07 },
];

// Product-type completeness per datatake. These drive `comp` and `cls`, so the
// header KPI, the datatake list, the globe markers and the plates all read from one
// number. Percentages are illustrative mock values; the product-type names and the
// level each one falls into follow the real per-mission rules documented above.
type AcqSpec = Omit<AcqDatatake, "comp" | "cls">;

const ACQ_SPECS: AcqSpec[] = [
  {
    // S2 — MSI only. The backend collapses L1A/L1B/L1C into a single L1.
    id: "S2A-48201-1", startIso: "2026-07-16T10:42:01Z", sat: "Sentinel-2A", unit: "S2A", station: "Svalbard", lat: 48.2, lon: 11.6,
    footprint: swath(48.2, 11.6, 10, 2.6, -12), status: "Published",
    mode: "MSI \u00b7 NOBS", absOrbit: "048201", sensingS: 205,
    levels: [
      { level: "L0", products: [{ type: "MSI_L0__GR", pct: 100, instrument: "MSI" }] },
      {
        level: "L1", products: [
          { type: "MSI_L1A_DS", pct: 100, instrument: "MSI" },
          { type: "MSI_L1B_GR", pct: 100, instrument: "MSI" },
          { type: "MSI_L1C_TC", pct: 100, instrument: "MSI" },
        ]
      },
      { level: "L2", products: [{ type: "MSI_L2A_DS", pct: 100, instrument: "MSI" }] },
    ],
    prods: [{ lvl: "L0", sub: "MSI raw", st: "Published" }, { lvl: "L1C", sub: "TOA reflectance", st: "Published" }, { lvl: "L2A", sub: "BOA reflectance", st: "Published" }],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s2a_mp_acq__kml_20260903t150000_20260921t180000",
      filename: "s2a_user_20260710t000000_20260716t235959.kml",
    },
  },
  {
    // S1 — SAR only. Level lives in the digit inside the type name, no "L" token.
    id: "S1C-57622", startIso: "2026-07-16T09:33:10Z", sat: "Sentinel-1C", unit: "S1C", station: "Matera", lat: 12.4, lon: 42.1,
    footprint: swath(12.4, 42.1, 13, 2.3, -11), status: "Processing",
    mode: "IW \u00b7 DV", absOrbit: "057622", sensingS: 205,
    levels: [
      {
        level: "L0", products: [
          { type: "IW_RAW__0A", pct: 99.0, instrument: "SAR" },
          { type: "IW_RAW__0C", pct: 99.0, instrument: "SAR" },
          { type: "IW_RAW__0N", pct: 99.0, instrument: "SAR" },
          { type: "IW_RAW__0S", pct: 99.0, instrument: "SAR" },
        ]
      },
      {
        level: "L1", products: [
          { type: "IW_SLC__1A", pct: 62.8, instrument: "SAR" },
          { type: "IW_SLC__1S", pct: 78.9, instrument: "SAR" },
          { type: "IW_GRDH_1A", pct: 41.2, instrument: "SAR" },
          { type: "IW_GRDH_1S", pct: 55.4, instrument: "SAR" },
        ]
      },
      {
        level: "L2", products: [
          { type: "IW_OCN__2A", pct: null, instrument: "SAR" },
          { type: "IW_OCN__2S", pct: null, instrument: "SAR" },
        ]
      },
    ],
    prods: [{ lvl: "L0", sub: "SAR raw", st: "Published" }, { lvl: "L1", sub: "GRD", st: "Processing" }, { lvl: "L2", sub: "OCN", st: "Planned" }],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s1c_mp_user_20260902t180959_20260924t202000",
      filename: "s1c_mp_user_20260903t171528_20260925t194000",
    },
  },
  {
    // S3 — four science instruments, so by far the widest product-type set. This is
    // the datatake that exercises the per-plate cap.
    id: "S3B-080-345", startIso: "2026-07-16T08:11:45Z", sat: "Sentinel-3B", unit: "S3B", station: "Maspalomas", lat: -22.9, lon: -45.2,
    footprint: swath(-22.9, -45.2, 20, 11.4, -13), status: "Processing",
    mode: "OLCI \u00b7 EFR", absOrbit: "031145", sensingS: 1180,
    levels: [
      {
        level: "L0", products: [
          { type: "OL_0_EFR", pct: 99.0, instrument: "OLCI" },
          { type: "SL_0_SLT", pct: 99.0, instrument: "SLSTR" },
          { type: "SR_0_SRA", pct: 98.4, instrument: "SRAL" },
          { type: "MW_0_MWR", pct: 99.0, instrument: "MWR" },
        ]
      },
      {
        level: "L1", products: [
          { type: "OL_1_EFR", pct: 78.0, instrument: "OLCI" },
          { type: "OL_1_ERR", pct: 82.5, instrument: "OLCI" },
          { type: "SL_1_RBT", pct: 96.1, instrument: "SLSTR" },
          { type: "SR_1_SRA", pct: 99.0, instrument: "SRAL" },
          { type: "SR_1_SRA_A", pct: 99.0, instrument: "SRAL" },
          { type: "SR_1_SRA_BS", pct: 97.2, instrument: "SRAL" },
          { type: "MW_1_MWR", pct: 99.0, instrument: "MWR" },
        ]
      },
      {
        level: "L2", products: [
          { type: "OL_2_WFR", pct: 71.4, instrument: "OLCI" },
          { type: "OL_2_WRR", pct: 88.0, instrument: "OLCI" },
          { type: "OL_2_LFR", pct: 92.3, instrument: "OLCI" },
          { type: "OL_2_LRR", pct: 94.6, instrument: "OLCI" },
          { type: "SL_2_LST", pct: 96.8, instrument: "SLSTR" },
          { type: "SL_2_WST", pct: 99.0, instrument: "SLSTR" },
          { type: "SL_2_FRP", pct: 61.5, instrument: "SLSTR" },
          { type: "SL_2_AOD", pct: 99.0, instrument: "SLSTR" },
          { type: "SR_2_LAN", pct: 99.0, instrument: "SRAL" },
          { type: "SR_2_WAT", pct: 98.1, instrument: "SRAL" },
          { type: "SY_2_SYN", pct: 84.2, instrument: "SYN" },
          { type: "SY_2_VGP", pct: 99.0, instrument: "SYN" },
          { type: "SY_2_VG1", pct: null, instrument: "SYN" },
          { type: "SY_2_AOD", pct: 90.7, instrument: "SYN" },
        ]
      },
    ],
    prods: [{ lvl: "L0", sub: "OLCI raw", st: "Published" }, { lvl: "L1", sub: "OLCI EFR", st: "Processing" }],
  },
  {
    id: "S2B-42050-1", startIso: "2026-07-16T07:20:50Z", sat: "Sentinel-2B", unit: "S2B", station: "Inuvik", lat: 64.1, lon: -110.3,
    footprint: swath(64.1, -110.3, 10, 2.6, -14), status: "Published",
    mode: "MSI \u00b7 NOBS", absOrbit: "042050", sensingS: 188,
    levels: [
      { level: "L0", products: [{ type: "MSI_L0__GR", pct: 99.4, instrument: "MSI" }] },
      {
        level: "L1", products: [
          { type: "MSI_L1A_DS", pct: 100, instrument: "MSI" },
          { type: "MSI_L1B_GR", pct: 100, instrument: "MSI" },
          { type: "MSI_L1C_TC", pct: 100, instrument: "MSI" },
        ]
      },
      { level: "L2", products: [{ type: "MSI_L2A_DS", pct: 100, instrument: "MSI" }] },
    ],
    prods: [{ lvl: "L1C", sub: "TOA reflectance", st: "Published" }, { lvl: "L2A", sub: "BOA reflectance", st: "Published" }],
    kmlLink: {
      url: "https://sentinels.copernicus.eu/documents/d/sentinel/s2b_mp_acq__kml_20260827t120000_20260914t150000",
      filename: "s2b_user_20260827t120000_20260914t150000.kml",
    },
  },
  {
    // S5P — TROPOMI. Its L1 token is "L1B", not "L1", and it carries one radiance
    // product per spectral band, so it also runs past the cap.
    id: "S5P-60012", startIso: "2026-07-16T06:00:12Z", sat: "Sentinel-5P", unit: "S5P", station: "Neustrelitz", lat: 34.7, lon: 104.2,
    footprint: swath(34.7, 104.2, 24, 23, -12), status: "Published",
    mode: "TROPOMI \u00b7 NOMINAL", absOrbit: "060012", sensingS: 2940,
    levels: [
      {
        level: "L1", products: [
          { type: "L1B_RA_BD1", pct: 99.0, instrument: "TROPOMI" },
          { type: "L1B_RA_BD2", pct: 99.0, instrument: "TROPOMI" },
          { type: "L1B_RA_BD3", pct: 99.0, instrument: "TROPOMI" },
          { type: "L1B_RA_BD4", pct: 98.6, instrument: "TROPOMI" },
          { type: "L1B_RA_BD5", pct: 99.0, instrument: "TROPOMI" },
          { type: "L1B_RA_BD6", pct: 99.0, instrument: "TROPOMI" },
          { type: "L1B_RA_BD7", pct: 97.4, instrument: "TROPOMI" },
          { type: "L1B_RA_BD8", pct: 99.0, instrument: "TROPOMI" },
        ]
      },
      {
        level: "L2", products: [
          { type: "L2__NO2___", pct: 92.4, instrument: "TROPOMI" },
          { type: "L2__O3____", pct: 94.1, instrument: "TROPOMI" },
          { type: "L2__CO____", pct: 99.0, instrument: "TROPOMI" },
          { type: "L2__CH4___", pct: 88.9, instrument: "TROPOMI" },
          { type: "L2__HCHO__", pct: 96.2, instrument: "TROPOMI" },
          { type: "L2__SO2___", pct: 99.0, instrument: "TROPOMI" },
          { type: "L2__AER_AI", pct: 99.0, instrument: "TROPOMI" },
          { type: "L2__CLOUD_", pct: 93.5, instrument: "TROPOMI" },
        ]
      },
    ],
    prods: [{ lvl: "L1B", sub: "TROPOMI radiance", st: "Published" }, { lvl: "L2", sub: "NO\u2082 column", st: "Published" }],
  },
  {
    // S3 SLSTR-only pass that failed, plus an unrecognised type — the backend's
    // "UNKNOWN" product_level bucket, which the plates have to render.
    id: "S3A-055-358", startIso: "2026-07-15T22:15:33Z", sat: "Sentinel-3A", unit: "S3A", station: "Svalbard", lat: -35.6, lon: 138.9,
    footprint: swath(-35.6, 138.9, 20, 11.4, 13), status: "Failed",
    mode: "SLSTR \u00b7 SL", absOrbit: "021533", sensingS: 620,
    levels: [
      { level: "L0", products: [{ type: "SL_0_SLT", pct: 0, instrument: "SLSTR" }] },
      { level: "L1", products: [{ type: "SL_1_RBT", pct: 0, instrument: "SLSTR" }] },
      { level: "L2", products: [{ type: "SL_2_LST", pct: null, instrument: "SLSTR" }] },
      { level: "UNKNOWN", products: [{ type: "OUT_OF_MONITORING", pct: null }] },
    ],
    prods: [{ lvl: "L0", sub: "SLSTR raw", st: "Planned" }],
  },
];

// comp and cls are derived, never hand-set: a datatake cannot claim a completeness
// its product types do not support.
export const ACQ_DATATAKES: AcqDatatake[] = ACQ_SPECS.map((spec) => {
  const comp = Math.round(meanCompleteness(spec.levels) * 10) / 10;
  const cls: AcqDatatake["cls"] = comp >= 95 ? "ok" : comp > 0 ? "warn" : "crit";
  return { ...spec, comp, cls };
});
