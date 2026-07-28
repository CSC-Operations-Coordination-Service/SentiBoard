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

export interface Datatake { id: string; mission: string; sensing: string; comp: Status; pct: number; }
export const DATATAKES: Datatake[] = [
  { id: "S2A_20260716T104201", mission: "Sentinel-2A", sensing: "16 Jul 10:42 UTC", comp: "nominal", pct: 100 },
  { id: "S1A_20260716T093310", mission: "Sentinel-1A", sensing: "16 Jul 09:33 UTC", comp: "info", pct: 62 },
  { id: "S3B_20260716T081145", mission: "Sentinel-3B", sensing: "16 Jul 08:11 UTC", comp: "degraded", pct: 78 },
  { id: "S2B_20260716T072050", mission: "Sentinel-2B", sensing: "16 Jul 07:20 UTC", comp: "nominal", pct: 100 },
  { id: "S5P_20260716T060012", mission: "Sentinel-5P", sensing: "16 Jul 06:00 UTC", comp: "nominal", pct: 96 },
  { id: "S3A_20260715T221533", mission: "Sentinel-3A", sensing: "15 Jul 22:15 UTC", comp: "critical", pct: 0 },
];

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

export const ISSUE_COLORS: Record<IssueType, string> = {
  acquisition: "#4ea8ff", calibration: "#a78bfa", manoeuvre: "#36d0e0", production: "#f5b544", satellite: "#ef5b6e",
};

export const STATUS_COLORS: Record<Status, string> = {
  nominal: "#34d399", degraded: "#f5b544", critical: "#ef5b6e", info: "#4ea8ff", neutral: "#6c778a",
};

// ---- Acquisitions globe (interactive 3D canvas) ----
export interface Station { name: string; lat: number; lon: number; }
export interface AcqProduct { lvl: string; sub: string; st: "Published" | "Processing" | "Planned"; }
export interface AcqDatatake {
  id: string; sat: string; station: string;
  lat: number; lon: number;            // acquisition footprint centre
  cls: "ok" | "warn" | "crit";         // marker colour
  comp: number;                        // completeness %
  status: string;                      // human status
  prods: AcqProduct[];
}

// Copernicus core ground stations.
export const STATIONS: Station[] = [
  { name: "Svalbard", lat: 78.23, lon: 15.39 },
  { name: "Matera", lat: 40.65, lon: 16.7 },
  { name: "Maspalomas", lat: 27.76, lon: -15.63 },
  { name: "Inuvik", lat: 68.35, lon: -133.72 },
  { name: "Neustrelitz", lat: 53.33, lon: 13.07 },
];

export const ACQ_DATATAKES: AcqDatatake[] = [
  {
    id: "S2A_20260716T104201", sat: "Sentinel-2A", station: "Svalbard", lat: 48.2, lon: 11.6, cls: "ok", comp: 100, status: "Published",
    prods: [{ lvl: "L0", sub: "MSI raw", st: "Published" }, { lvl: "L1C", sub: "TOA reflectance", st: "Published" }, { lvl: "L2A", sub: "BOA reflectance", st: "Published" }]
  },
  {
    id: "S1A_20260716T093310", sat: "Sentinel-1A", station: "Matera", lat: 12.4, lon: 42.1, cls: "warn", comp: 62, status: "Processing",
    prods: [{ lvl: "L0", sub: "SAR raw", st: "Published" }, { lvl: "L1", sub: "GRD", st: "Processing" }, { lvl: "L2", sub: "OCN", st: "Planned" }]
  },
  {
    id: "S3B_20260716T081145", sat: "Sentinel-3B", station: "Maspalomas", lat: -22.9, lon: -45.2, cls: "warn", comp: 78, status: "Processing",
    prods: [{ lvl: "L0", sub: "OLCI raw", st: "Published" }, { lvl: "L1", sub: "OLCI EFR", st: "Processing" }]
  },
  {
    id: "S2B_20260716T072050", sat: "Sentinel-2B", station: "Inuvik", lat: 64.1, lon: -110.3, cls: "ok", comp: 100, status: "Published",
    prods: [{ lvl: "L1C", sub: "TOA reflectance", st: "Published" }, { lvl: "L2A", sub: "BOA reflectance", st: "Published" }]
  },
  {
    id: "S5P_20260716T060012", sat: "Sentinel-5P", station: "Neustrelitz", lat: 34.7, lon: 104.2, cls: "ok", comp: 96, status: "Published",
    prods: [{ lvl: "L1B", sub: "TROPOMI radiance", st: "Published" }, { lvl: "L2", sub: "NO₂ column", st: "Published" }]
  },
  {
    id: "S3A_20260715T221533", sat: "Sentinel-3A", station: "Svalbard", lat: -35.6, lon: 138.9, cls: "crit", comp: 0, status: "Failed",
    prods: [{ lvl: "L0", sub: "SLSTR raw", st: "Planned" }]
  },
];
