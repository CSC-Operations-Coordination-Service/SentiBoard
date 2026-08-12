// DEVOCS-219 — "Mission Manifest" Events mock-up: domain types, the August 2026 mock data and the
// pure helpers both layout variants share. Mock-up only — nothing here talks to a backend; the
// shipping page is /v1/events, server-rendered from lib/data.ts.
//
// Everything is a literal: no Date.now(), no `new Date()` without explicit arguments, no RNG. The
// server render and the client hydration therefore produce identical markup, so React never
// reports a mismatch. That is also why no day is marked "today" — the mock is pinned to August
// 2026 and asking the runtime for the real date would reintroduce exactly that hazard.

import { Cog, Compass, Joystick, Satellite, SatelliteDish, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

/** The five event categories the production Events page publishes. */
export type EventCategory = "Acquisition" | "Calibration" | "Manoeuvre" | "Production" | "Satellite";

/** Publication completeness of a datatake — the same five states as the Events log proposal
 *  (/examples/events-log-v3) and the production legend, not a private three-colour scale. */
export type Status = "planned" | "processing" | "acquired" | "partial" | "unavailable";

export type Datatake = {
  id: string;
  satellite: string;
  /** Product level / sensor mode, as the datatake tables show it. */
  product: string;
  /** ISO-8601 UTC instants. Strings, not Dates, so the data stays serialisable and stable. */
  sensingStart: string;
  sensingStop: string;
  /** Publication completeness, 0–100. Meaningless while a datatake is still Planned. */
  completeness: number;
  status: Status;
};

export type ManifestEvent = {
  id: string;
  /** Day of month (August 2026). */
  day: number;
  /** HH:MM UTC. */
  time: string;
  category: EventCategory;
  satellite: string;
  title: string;
  summary: string;
  datatakes: Datatake[];
};

export const YEAR = 2026;
/** 1-based, matching the production page's ?month= parameter. August. */
export const MONTH = 8;
export const MONTH_LABEL = "August 2026";

export const MISSIONS: Record<string, string[]> = {
  "Sentinel-1": ["Sentinel-1A", "Sentinel-1C"],
  "Sentinel-2": ["Sentinel-2A", "Sentinel-2B", "Sentinel-2C"],
  "Sentinel-3": ["Sentinel-3A", "Sentinel-3B"],
  "Sentinel-5P": ["Sentinel-5P"],
};

export const MISSION_NAMES = Object.keys(MISSIONS);
export const ALL_SATELLITES = MISSION_NAMES.flatMap((m) => MISSIONS[m]);

const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((sat) => [sat, m])),
);

export function missionOf(satellite: string): string {
  return MISSION_OF[satellite] ?? satellite;
}

/** The same five glyphs the real Events page renders (components/EventIcon in the mock-ups app,
 *  the broadcast / compass / joystick / cog / satellite set on /v1/events), so a Manoeuvre reads
 *  identically wherever it appears. Drawn at CATEGORY_STROKE, matching EventIcon. */
export const CATEGORY_ICONS: Record<EventCategory, LucideIcon> = {
  Acquisition: SatelliteDish,
  Calibration: Compass,
  Manoeuvre: Joystick,
  Production: Cog,
  Satellite: Satellite,
};

/** EventIcon's stroke weight — thin enough to stay legible at 12px without going bold. */
export const CATEGORY_STROKE = 1.9;

export const CATEGORIES = Object.keys(CATEGORY_ICONS) as EventCategory[];

/** Labels and colours copied from the Events log proposal so the two proposals cannot disagree
 *  about what "Partial" looks like. Planned and Processing share the neutral grey: neither has
 *  lost anything, they are simply not finished. The values live in manifest.module.css. */
export const COMPLETENESS: Record<Status, { label: string; color: string }> = {
  planned: { label: "Planned", color: "var(--mf-grey)" },
  processing: { label: "Processing", color: "var(--mf-grey)" },
  acquired: { label: "Acquired", color: "var(--mf-green)" },
  partial: { label: "Partial", color: "var(--mf-orange)" },
  unavailable: { label: "Unavailable", color: "var(--mf-red)" },
};

/** Legend order: the lifecycle, then the two failure states. */
export const STATUS_ORDER: Status[] = ["planned", "processing", "acquired", "partial", "unavailable"];

/** How alarming each state is. Planned and Processing tie — neither has lost data, so neither
 *  should outrank the other when a day is summarised down to one status. */
const STATUS_RANK: Record<Status, number> = {
  unavailable: 3,
  partial: 2,
  processing: 1,
  planned: 1,
  acquired: 0,
};

/** True for the two states that actually cost data. Only these mark a day cell in the grid, so a
 *  month of planned and processing work stays quiet and the eye goes to the losses. */
export function marksLoss(status: Status): boolean {
  return status === "partial" || status === "unavailable";
}

// ---------------------------------------------------------------------------
// Mock data — August 2026
// ---------------------------------------------------------------------------

export const EVENTS: ManifestEvent[] = [
  {
    id: "ev-01", day: 3, time: "04:12", category: "Manoeuvre", satellite: "Sentinel-1A",
    title: "In-plane manoeuvre #212",
    summary: "Scheduled orbit maintenance burn. Imaging suspended for the burn window; no gap expected in the delivered products.",
    datatakes: [
      { id: "S1A-318402", satellite: "Sentinel-1A", product: "IW GRDH", sensingStart: "2026-08-03T04:02:00Z", sensingStop: "2026-08-03T04:11:12Z", completeness: 100, status: "acquired" },
      { id: "S1A-318403", satellite: "Sentinel-1A", product: "IW SLC", sensingStart: "2026-08-03T04:26:40Z", sensingStop: "2026-08-03T04:34:05Z", completeness: 100, status: "acquired" },
    ],
  },
  {
    id: "ev-02", day: 4, time: "09:30", category: "Calibration", satellite: "Sentinel-2B",
    title: "MSI dark-signal calibration",
    summary: "Monthly dark-current characterisation over the calibration site. Imaging suspended for 18 minutes by design.",
    datatakes: [
      { id: "S2B-712094", satellite: "Sentinel-2B", product: "MSI L1C", sensingStart: "2026-08-04T09:12:31Z", sensingStop: "2026-08-04T09:29:58Z", completeness: 100, status: "acquired" },
    ],
  },
  {
    id: "ev-03", day: 5, time: "18:40", category: "Acquisition", satellite: "Sentinel-3B",
    title: "Svalbard downlink interruption",
    summary: "Ground-station outage during the 18:40 pass; 41 minutes of OLCI and SLSTR data were not dumped and could not be recovered on the following orbit.",
    datatakes: [
      { id: "S3B-253251", satellite: "Sentinel-3B", product: "OL_1_EFR", sensingStart: "2026-08-05T18:22:00Z", sensingStop: "2026-08-05T19:03:00Z", completeness: 0, status: "unavailable" },
      { id: "S3B-253252", satellite: "Sentinel-3B", product: "SL_1_RBT", sensingStart: "2026-08-05T18:22:00Z", sensingStop: "2026-08-05T19:03:00Z", completeness: 62, status: "partial" },
      { id: "S3B-253253", satellite: "Sentinel-3B", product: "SR_1_SRA", sensingStart: "2026-08-05T18:31:40Z", sensingStop: "2026-08-05T18:58:20Z", completeness: 74, status: "partial" },
    ],
  },
  {
    id: "ev-04", day: 5, time: "19:05", category: "Production", satellite: "Sentinel-3B",
    title: "Ground-segment investigation opened",
    summary: "Root-cause analysis for the Svalbard outage. Reprocessing of the partially dumped products is queued behind the investigation.",
    datatakes: [
      { id: "S3B-253252", satellite: "Sentinel-3B", product: "SL_2_WST", sensingStart: "2026-08-05T18:22:00Z", sensingStop: "2026-08-05T19:03:00Z", completeness: 71, status: "processing" },
    ],
  },
  {
    id: "ev-05", day: 7, time: "02:15", category: "Satellite", satellite: "Sentinel-1C",
    title: "Platform safe mode",
    summary: "Autonomous transition to safe mode after a star-tracker anomaly. Payload off for four consecutive orbits; recovery completed 07:48 UTC.",
    datatakes: [
      { id: "S1C-401180", satellite: "Sentinel-1C", product: "IW GRDH", sensingStart: "2026-08-07T02:15:00Z", sensingStop: "2026-08-07T02:41:30Z", completeness: 0, status: "unavailable" },
      { id: "S1C-401181", satellite: "Sentinel-1C", product: "IW GRDH", sensingStart: "2026-08-07T03:52:10Z", sensingStop: "2026-08-07T04:19:44Z", completeness: 0, status: "unavailable" },
      { id: "S1C-401182", satellite: "Sentinel-1C", product: "EW GRDM", sensingStart: "2026-08-07T05:30:05Z", sensingStop: "2026-08-07T05:57:12Z", completeness: 0, status: "unavailable" },
    ],
  },
  {
    id: "ev-06", day: 10, time: "11:00", category: "Calibration", satellite: "Sentinel-5P",
    title: "TROPOMI solar irradiance calibration",
    summary: "Routine solar-port measurement sequence, nominal. No impact on the L2 product chain.",
    datatakes: [
      { id: "S5P-881204", satellite: "Sentinel-5P", product: "L1B_RA_BD3", sensingStart: "2026-08-10T10:41:00Z", sensingStop: "2026-08-10T10:59:20Z", completeness: 100, status: "acquired" },
    ],
  },
  {
    id: "ev-07", day: 12, time: "22:15", category: "Acquisition", satellite: "Sentinel-1A",
    title: "Acquisition-plan fragment loss",
    summary: "Two consecutive passes were not persisted by the planning service; the fragments were rebuilt from the long-term plan the following morning.",
    datatakes: [
      { id: "S1A-318974", satellite: "Sentinel-1A", product: "IW SLC", sensingStart: "2026-08-12T22:15:00Z", sensingStop: "2026-08-12T22:38:26Z", completeness: 48, status: "partial" },
      { id: "S1A-318975", satellite: "Sentinel-1A", product: "IW GRDH", sensingStart: "2026-08-12T23:52:40Z", sensingStop: "2026-08-13T00:14:02Z", completeness: 55, status: "partial" },
    ],
  },
  {
    id: "ev-08", day: 13, time: "07:50", category: "Production", satellite: "Sentinel-1A",
    title: "Fragment persistence restored",
    summary: "Cache write path patched and the affected passes backfilled. Both datatakes republished at full completeness.",
    datatakes: [
      { id: "S1A-318974", satellite: "Sentinel-1A", product: "IW SLC", sensingStart: "2026-08-12T22:15:00Z", sensingStop: "2026-08-12T22:38:26Z", completeness: 100, status: "acquired" },
      { id: "S1A-318975", satellite: "Sentinel-1A", product: "IW GRDH", sensingStart: "2026-08-12T23:52:40Z", sensingStop: "2026-08-13T00:14:02Z", completeness: 100, status: "acquired" },
    ],
  },
  {
    id: "ev-09", day: 14, time: "05:40", category: "Manoeuvre", satellite: "Sentinel-3A",
    title: "Out-of-plane manoeuvre #163",
    summary: "Inclination correction with a 35-minute instrument outage window. Altimetry products over the window are incomplete.",
    datatakes: [
      { id: "S3A-255014", satellite: "Sentinel-3A", product: "SR_2_LAN", sensingStart: "2026-08-14T05:33:00Z", sensingStop: "2026-08-14T06:08:00Z", completeness: 58, status: "partial" },
      { id: "S3A-255015", satellite: "Sentinel-3A", product: "OL_2_LFR", sensingStart: "2026-08-14T05:33:00Z", sensingStop: "2026-08-14T06:08:00Z", completeness: 61, status: "partial" },
    ],
  },
  {
    id: "ev-10", day: 17, time: "13:20", category: "Acquisition", satellite: "Sentinel-2A",
    title: "X-band transmitter switch-off",
    summary: "Transmitter tripped mid-pass over Matera; on-board memory overwrote the oldest segment before the next contact.",
    datatakes: [
      { id: "S2A-713401", satellite: "Sentinel-2A", product: "MSI L1C", sensingStart: "2026-08-17T13:04:12Z", sensingStop: "2026-08-17T13:19:50Z", completeness: 0, status: "unavailable" },
      { id: "S2A-713402", satellite: "Sentinel-2A", product: "MSI L2A", sensingStart: "2026-08-17T13:04:12Z", sensingStop: "2026-08-17T13:19:50Z", completeness: 0, status: "unavailable" },
    ],
  },
  {
    id: "ev-11", day: 19, time: "03:05", category: "Manoeuvre", satellite: "Sentinel-5P",
    title: "Orbit maintenance burn",
    summary: "Nominal sun-synchronous orbit correction. Instrument remained in measurement mode throughout.",
    datatakes: [
      { id: "S5P-882041", satellite: "Sentinel-5P", product: "L2__NO2___", sensingStart: "2026-08-19T02:47:30Z", sensingStop: "2026-08-19T03:34:10Z", completeness: 100, status: "acquired" },
    ],
  },
  {
    id: "ev-12", day: 20, time: "16:45", category: "Production", satellite: "Sentinel-2C",
    title: "L2A processing backlog",
    summary: "Processor queue saturated after a configuration rollout; L2A publication is running roughly three hours behind the timeliness target. Nothing is lost — the products are still being published.",
    datatakes: [
      { id: "S2C-714220", satellite: "Sentinel-2C", product: "MSI L2A", sensingStart: "2026-08-20T10:22:04Z", sensingStop: "2026-08-20T10:37:41Z", completeness: 80, status: "processing" },
      { id: "S2C-714221", satellite: "Sentinel-2C", product: "MSI L2A", sensingStart: "2026-08-20T12:01:18Z", sensingStop: "2026-08-20T12:16:55Z", completeness: 80, status: "processing" },
    ],
  },
  {
    id: "ev-13", day: 24, time: "08:18", category: "Satellite", satellite: "Sentinel-2A",
    title: "Collision avoidance manoeuvre",
    summary: "Precautionary avoidance burn scheduled against a tracked debris conjunction. The pass is planned; no product impact is expected once the burn is confirmed.",
    datatakes: [
      { id: "S2A-713988", satellite: "Sentinel-2A", product: "MSI L1C", sensingStart: "2026-08-24T08:02:44Z", sensingStop: "2026-08-24T08:17:29Z", completeness: 0, status: "planned" },
    ],
  },
  {
    id: "ev-14", day: 25, time: "21:30", category: "Acquisition", satellite: "Sentinel-3A",
    title: "Trickle-dump station handover delay",
    summary: "Handover between Svalbard and Inuvik slipped by twelve minutes, leaving a short gap at the head of the dumped segment.",
    datatakes: [
      { id: "S3A-255730", satellite: "Sentinel-3A", product: "OL_1_ERR", sensingStart: "2026-08-25T21:18:00Z", sensingStop: "2026-08-25T21:52:30Z", completeness: 91, status: "partial" },
    ],
  },
  {
    id: "ev-15", day: 27, time: "12:05", category: "Calibration", satellite: "Sentinel-1C",
    title: "SAR internal calibration sequence",
    summary: "Post-recovery instrument characterisation after the safe-mode event on 07 August. Results nominal.",
    datatakes: [
      { id: "S1C-402551", satellite: "Sentinel-1C", product: "IW SLC", sensingStart: "2026-08-27T11:48:20Z", sensingStop: "2026-08-27T12:04:58Z", completeness: 100, status: "acquired" },
    ],
  },
  {
    id: "ev-16", day: 31, time: "20:02", category: "Acquisition", satellite: "Sentinel-1A",
    title: "Downlink queue backlog",
    summary: "Minor queue backlog at Matera after a scheduling conflict; the tail of the pass was dumped on the following orbit.",
    datatakes: [
      { id: "S1A-319612", satellite: "Sentinel-1A", product: "IW GRDH", sensingStart: "2026-08-31T19:44:10Z", sensingStop: "2026-08-31T20:11:36Z", completeness: 93, status: "partial" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "18:22" — UTC, built from the ISO string's own parts so no timezone is ever applied. */
export function timeOf(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** "05 Aug 18:22–19:03" — the sensing window as the datatake tables print it. Includes the date
 *  on the stop side only when the window crosses midnight, which happens on ev-07. */
export function sensingWindow(dt: Datatake): string {
  const a = new Date(dt.sensingStart);
  const b = new Date(dt.sensingStop);
  const sameDay = a.getUTCDate() === b.getUTCDate();
  const day = (d: Date) => `${pad(d.getUTCDate())} ${MONTH_SHORT[d.getUTCMonth()]}`;
  return sameDay
    ? `${day(a)} ${timeOf(dt.sensingStart)}–${timeOf(dt.sensingStop)}`
    : `${day(a)} ${timeOf(dt.sensingStart)} – ${day(b)} ${timeOf(dt.sensingStop)}`;
}

/** A percentage only means something once acquisition has begun: Planned datatakes have none yet,
 *  so they print an em dash rather than a misleading 0%. */
export function completenessLabel(dt: Datatake): string {
  return dt.status === "planned" ? "—" : `${dt.completeness}%`;
}

/** The worst completeness across a set of datatakes — what a day cell's stripe reports. */
export function worstStatus(datatakes: Datatake[]): Status {
  return datatakes.reduce<Status>(
    (worst, d) => (STATUS_RANK[d.status] > STATUS_RANK[worst] ? d.status : worst),
    datatakes[0]?.status ?? "acquired",
  );
}

export function eventStatus(event: ManifestEvent): Status {
  return worstStatus(event.datatakes);
}

export function dayStatus(events: ManifestEvent[]): Status {
  return worstStatus(events.flatMap((e) => e.datatakes));
}

export type Filters = {
  mission: string; // "" = all
  satellite: string; // "" = all
  categories: EventCategory[]; // empty = none pass
  query: string;
};

export const EMPTY_FILTERS: Filters = { mission: "", satellite: "", categories: CATEGORIES, query: "" };

/** Mission, satellite, category and free-text search. The query matches the fields an operator
 *  would actually type: the event title and summary, the satellite, and any impacted datatake ID. */
export function filterEvents(events: ManifestEvent[], f: Filters): ManifestEvent[] {
  const q = f.query.trim().toLowerCase();
  return events.filter((e) => {
    if (f.mission && missionOf(e.satellite) !== f.mission) return false;
    if (f.satellite && e.satellite !== f.satellite) return false;
    if (!f.categories.includes(e.category)) return false;
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      e.summary.toLowerCase().includes(q) ||
      e.satellite.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.datatakes.some((d) => d.id.toLowerCase().includes(q) || d.product.toLowerCase().includes(q))
    );
  });
}

/** Day of month → that day's events, sorted by time. */
export function groupByDay(events: ManifestEvent[]): Map<number, ManifestEvent[]> {
  const map = new Map<number, ManifestEvent[]>();
  [...events]
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    .forEach((e) => map.set(e.day, [...(map.get(e.day) ?? []), e]));
  return map;
}

export type Cell = { day: number; dim: boolean };

/** A Monday-first month grid padded to whole weeks, matching components/EventsCalendar.tsx. The
 *  leading and trailing cells belong to the neighbouring months and are never selectable. */
export function calendarCells(year: number, month: number): Cell[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const prevMonthLast = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();

  const cells: Cell[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: prevMonthLast - firstDow + 1 + i, dim: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dim: false });
  for (let d = 1; cells.length % 7 !== 0; d++) cells.push({ day: d, dim: true });
  return cells;
}

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/** "05 Aug 2026" for a day of the mocked month. */
export function dayLabel(day: number): string {
  return `${pad(day)} ${MONTH_SHORT[MONTH - 1]} ${YEAR}`;
}
