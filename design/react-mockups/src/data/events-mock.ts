// DEVOCS-219 — Events mock data for the Mission swimlanes proposal (/examples/events-swimlanes).
//
// It began as `pages/events-manifest/mock.ts` and carries the same August 2026 dataset, with three
// deliberate changes:
//
//   1. Colours point at the APP-LEVEL tokens in styles/tokens.css (--cmp-* for completeness,
//      --evt-* for event type) instead of the private --mf-* set the manifest page defined. Those
//      tokens are transcribed from production's own two legends (dataAvailability.css and
//      events.css) and exist in both themes, so this page agrees with the shipping dashboard
//      rather than with a palette invented per page.
//   2. Event type gains a colour. Completeness keeps its own scale; the two never colour the
//      same mark.
//   3. Adds the datatake-count and "unrecovered" derivations the swimlanes surface without a click.
//
// It was briefly shared with a consolidated calendar-grid proposal, which was not taken forward;
// the calendar geometry and per-day helpers that only that page used are gone. The surviving
// surface is what EventsSwimlanes imports. `pages/events-manifest/mock.ts` is a separate file and
// stays byte-identical with its copy in the Next.js frontend (frontend/app/examples/events/).
//
// Everything is a literal: no Date.now(), no argument-less `new Date()`, no RNG — so a server
// render and a client hydration produce identical markup. That is also why no day is marked
// "today": the mock is pinned to August 2026 and asking the runtime for the real date would
// reintroduce exactly that hazard.

import { Cog, Compass, Joystick, Satellite, SatelliteDish, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

/** The five event categories the production Events page publishes. */
export type EventCategory = "Acquisition" | "Calibration" | "Manoeuvre" | "Production" | "Satellite";

/** Publication completeness of a datatake — production's five legend states. */
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

/** The short forms the dashboard prints on badges and datatake IDs — S1, S2, S3, S5P. */
export const MISSION_SHORT: Record<string, string> = {
  "Sentinel-1": "S1",
  "Sentinel-2": "S2",
  "Sentinel-3": "S3",
  "Sentinel-5P": "S5P",
};

const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((sat) => [sat, m])),
);

export function missionOf(satellite: string): string {
  return MISSION_OF[satellite] ?? satellite;
}

/** "S1A" — the satellite as the datatake tables abbreviate it. */
export function satelliteShort(satellite: string): string {
  const mission = missionOf(satellite);
  const unit = satellite.slice(mission.length).replace(/^-/, "");
  return MISSION_SHORT[mission] + unit;
}

/** The same five glyphs the real Events page renders (components/EventIcon), so a Manoeuvre reads
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

/** Event-type colours — the app-level --evt-* tokens, which are production's own Event Types
 *  legend (apps/static/assets/css/events.css) re-weighted for the dark canvas. Both themes are
 *  defined in styles/tokens.css, so nothing here needs a light-mode branch. */
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  Acquisition: "var(--evt-acquisition)",
  Calibration: "var(--evt-calibration)",
  Manoeuvre: "var(--evt-manoeuvre)",
  Production: "var(--evt-production)",
  Satellite: "var(--evt-satellite)",
};

/** Completeness labels and colours — the app-level --cmp-* tokens, which are production's five
 *  datatake legend states. Planned and Processing are the two greys, a step apart so a lone dot
 *  still distinguishes them; neither has lost anything, they are simply not finished. */
export const COMPLETENESS: Record<Status, { label: string; color: string }> = {
  planned: { label: "Planned", color: "var(--cmp-planned)" },
  processing: { label: "Processing", color: "var(--cmp-processing)" },
  acquired: { label: "Acquired", color: "var(--cmp-acquired)" },
  partial: { label: "Partial", color: "var(--cmp-partial)" },
  unavailable: { label: "Unavailable", color: "var(--cmp-unavailable)" },
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

// ---------------------------------------------------------------------------
// Counts surfaced WITHOUT a click
//
// The lane headers and the event rows both promise the datatake-affected count on their face, so
// the arithmetic lives here once rather than in each.
// ---------------------------------------------------------------------------

/** How many DISTINCT datatakes a set of events impacted.
 *
 *  Distinct, not summed: ev-07 loses two datatake fragments and ev-08 republishes the same two, so
 *  a plain sum reports four affected datatakes on a mission that only ever had two. A lane header
 *  reading "4 datatakes" when the operator can count two IDs inside it is a header they stop
 *  believing, so the same ID seen twice counts once. */
export function distinctDatatakeCount(events: ManifestEvent[]): number {
  return new Set(events.flatMap((e) => e.datatakes.map((d) => d.id))).size;
}

/** Whether an event's data has NOT yet come back — any datatake still Partial, Unavailable or
 *  Processing.
 *
 *  This is a COMPLETENESS reading, not a workflow state. The Events feed has no lifecycle field
 *  (see design/events-kanban-data-gap.md): production derives an `overall_status` of ok / partial /
 *  failed from the same datatake completeness figures, and that is the only "is this still a
 *  problem" signal the data actually carries. Every view that shows an "active" badge labels it
 *  against this definition, and none of them claims the event is open in a tracker. */
export function isUnrecovered(event: ManifestEvent): boolean {
  return event.datatakes.some(
    (d) => d.status === "partial" || d.status === "unavailable" || d.status === "processing",
  );
}

/** The wording every "N active" badge explains itself with, so the lane header, the event row and
 *  the page footnote cannot drift apart. */
export const ACTIVE_DEFINITION =
  "Active = datatake completeness still degraded, lost or in progress. The Events feed carries no open/closed field; this is derived from completeness.";

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

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

/** Mission name → that mission's events, chronological. Every mission gets a key, including the
 *  ones with nothing this month: a swimlane that disappears when its filter matches nothing reads
 *  as a missing row rather than a quiet one. */
export function groupByMission(events: ManifestEvent[]): Map<string, ManifestEvent[]> {
  const map = new Map<string, ManifestEvent[]>(MISSION_NAMES.map((m) => [m, []]));
  [...events]
    .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
    .forEach((e) => map.get(missionOf(e.satellite))!.push(e));
  return map;
}

/** "05 Aug" — the short form a swimlane row and a card use, where the year is already established. */
export function shortDayLabel(day: number): string {
  return `${pad(day)} ${MONTH_SHORT[MONTH - 1]}`;
}
