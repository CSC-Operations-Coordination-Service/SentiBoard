// DEVOCS-219 — Data Availability mock-up: domain constants, seeded mock data and the theme
// palettes. Mockup only — nothing here talks to a backend; the real page is /v1/availability,
// which is server-rendered from lib/data.ts.
//
// Everything in this file is deterministic. The seeded RNG plus a window anchored to UTC
// *midnight* (never `new Date()` directly) means the server render and the client hydration
// produce byte-identical rows, so React never reports a hydration mismatch.

export type Status = "Nominal" | "Degraded" | "Not Acquired";

export type Datatake = {
  id: string;
  satellite: string;
  mission: string;
  sensorMode: string;
  status: Status;
  completeness: number;
  start: Date;
};

// ---------------------------------------------------------------------------
// Domain constants
// ---------------------------------------------------------------------------

export const MISSIONS: Record<string, string[]> = {
  "Sentinel-1": ["S1A", "S1C"],
  "Sentinel-2": ["S2A", "S2B", "S2C"],
  "Sentinel-3": ["S3A", "S3B"],
  "Sentinel-5P": ["S5P"],
};

export const SENSOR_MODES: Record<string, string[]> = {
  S1A: ["IW", "EW", "SM", "WV"],
  S1C: ["IW", "EW", "SM", "WV"],
  S2A: ["MSI"],
  S2B: ["MSI"],
  S2C: ["MSI"],
  S3A: ["OLCI", "SLSTR", "SRAL"],
  S3B: ["OLCI", "SLSTR", "SRAL"],
  S5P: ["TROPOMI"],
};

export const MISSION_NAMES = Object.keys(MISSIONS);
export const ALL_SATELLITES = MISSION_NAMES.flatMap((m) => MISSIONS[m]);

const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((sat) => [sat, m])),
);

export const STATUS_ORDER: Status[] = ["Nominal", "Degraded", "Not Acquired"];

// ---------------------------------------------------------------------------
// Date helpers (UTC throughout — operations never speak local time)
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function formatDate(d: Date) {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function formatDateTime(d: Date) {
  return `${formatDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** The window the real page describes: the past three months plus everything planned up to
 *  23:59:59 of the following day. Anchored to UTC midnight so it is stable for a whole day. */
export function acquisitionWindow() {
  const n = new Date();
  const start = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  start.setUTCMonth(start.getUTCMonth() - 3);
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 23, 59, 59));
  return { start, end };
}

// ---------------------------------------------------------------------------
// Mock data generation
// ---------------------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function weightedStatus(rng: () => number): Status {
  const r = rng();
  if (r < 0.78) return "Nominal";
  if (r < 0.93) return "Degraded";
  return "Not Acquired";
}

function completenessFor(status: Status, rng: () => number) {
  if (status === "Nominal") return Math.round(85 + rng() * 15);
  if (status === "Degraded") return Math.round(35 + rng() * 50);
  return Math.round(rng() * 20);
}

export function generateMockData(count = 240): Datatake[] {
  const rng = seededRandom(42);
  const { start: rangeStart, end: rangeEnd } = acquisitionWindow();
  const spanMs = rangeEnd.getTime() - rangeStart.getTime();

  const rows: Datatake[] = [];
  for (let i = 0; i < count; i++) {
    const sat = pick(rng, ALL_SATELLITES);
    const mode = pick(rng, SENSOR_MODES[sat]);
    const status = weightedStatus(rng);
    const completeness = completenessFor(status, rng);
    const start = new Date(rangeStart.getTime() + rng() * spanMs);
    const hex = Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
    const id = `${sat}_${mode}_${formatDate(start).replace(/-/g, "")}T${pad(start.getUTCHours())}${pad(
      start.getUTCMinutes(),
    )}${pad(start.getUTCSeconds())}_${hex}`;

    rows.push({ id, satellite: sat, mission: MISSION_OF[sat], sensorMode: mode, status, completeness, start });
  }
  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

// ---------------------------------------------------------------------------
// Chart aggregation
// ---------------------------------------------------------------------------

export type MissionSlice = { mission: string; count: number; avg: number };
export type StatusSlice = { status: Status; count: number; pct: number };
export type ModeSlice = { mode: string; count: number; pct: number };

export function missionShare(rows: Datatake[]): MissionSlice[] {
  const acc: Record<string, { sum: number; count: number }> = {};
  MISSION_NAMES.forEach((m) => (acc[m] = { sum: 0, count: 0 }));
  rows.forEach((r) => {
    acc[r.mission].sum += r.completeness;
    acc[r.mission].count += 1;
  });
  return MISSION_NAMES.map((m) => ({
    mission: m.replace("Sentinel-", "S"),
    count: acc[m].count,
    avg: acc[m].count ? Math.round(acc[m].sum / acc[m].count) : 0,
  }));
}

export function statusBreakdown(rows: Datatake[]): StatusSlice[] {
  const acc: Record<Status, number> = { Nominal: 0, Degraded: 0, "Not Acquired": 0 };
  rows.forEach((r) => (acc[r.status] += 1));
  const total = rows.length || 1;
  return STATUS_ORDER.map((status) => ({
    status,
    count: acc[status],
    pct: Math.round((acc[status] / total) * 100),
  }));
}

export function modeDistribution(rows: Datatake[]): ModeSlice[] {
  const acc = new Map<string, number>();
  rows.forEach((r) => acc.set(r.sensorMode, (acc.get(r.sensorMode) || 0) + 1));
  const total = rows.length || 1;
  return [...acc.entries()]
    .map(([mode, count]) => ({ mode, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
//
// One object is the single source of truth for colour: the page publishes it as --da-* custom
// properties for the CSS module, and hands the same object to Recharts (SVG presentation
// attributes such as `fill` do not resolve var(), so the charts need literal values).
//
// The dark palette *is* the globals.css mission-control palette — each value is annotated with
// the token it mirrors. The light palette exists only because this mock-up carries a theme
// toggle; the app itself is dark-only, so there is no light token set to borrow.

export type Palette = {
  bg: string;
  panel: string;
  panelAlt: string;
  line: string;
  lineSoft: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accentSoft: string;
  inputBg: string;
  headerBg: string;
  rowHover: string;
  nominal: string;
  degraded: string;
  critical: string;
  /** One hue per mission, in MISSION_NAMES order. */
  mission: string[];
  /** Sensor-mode hues, shaded within their mission's lane hue. */
  mode: Record<string, string>;
};

export const DARK: Palette = {
  bg: "#0B0D10", // --ground
  panel: "#14181D", // --panel
  panelAlt: "#191E24", // --panel-2
  line: "rgba(255,255,255,.14)", // --line
  lineSoft: "rgba(255,255,255,.08)", // --line-soft
  text: "#F2F4F5", // --text
  muted: "#8A9198", // --muted
  faint: "#666D74", // --muted-2
  accent: "#00C7D6", // --accent-cyan
  accentSoft: "rgba(0,199,214,.12)",
  inputBg: "#0B0D10", // --ground
  headerBg: "#0F1215", // --ground-2
  rowHover: "rgba(46,125,246,.05)", // --accent at 5%, as elsewhere in globals.css
  nominal: "#3DD68C", // --nominal
  degraded: "#FFB020", // --degraded
  critical: "#FF5C6C", // --critical
  mission: ["#6E7FE0", "#5FA98A", "#B08AC0", "#C9A15F"], // --m1 --m2 --m3 --m5p
  mode: {
    IW: "#6E7FE0", EW: "#8E9BE9", SM: "#4E5FC4", WV: "#38468F",
    MSI: "#5FA98A",
    OLCI: "#B08AC0", SLSTR: "#C7A9D4", SRAL: "#8E6BA0",
    TROPOMI: "#C9A15F",
  },
};

export const LIGHT: Palette = {
  bg: "#F4F6F9",
  panel: "#FFFFFF",
  panelAlt: "#F9FAFC",
  line: "#DDE3EC",
  lineSoft: "#E8EDF4",
  text: "#131A26",
  muted: "#5B6B82",
  faint: "#94A1B5",
  accent: "#0A7C87",
  accentSoft: "rgba(10,124,135,.10)",
  inputBg: "#FFFFFF",
  headerBg: "#EEF1F6",
  rowHover: "#F1F4F9",
  nominal: "#12885A",
  degraded: "#A96A00",
  critical: "#C42C3C",
  mission: ["#4B5CC0", "#3F8A6C", "#8A63A2", "#A47B36"],
  mode: {
    IW: "#4B5CC0", EW: "#6E7FE0", SM: "#33409A", WV: "#232D6E",
    MSI: "#3F8A6C",
    OLCI: "#8A63A2", SLSTR: "#A98BBD", SRAL: "#6A467E",
    TROPOMI: "#A47B36",
  },
};

export function statusColor(status: Status, p: Palette) {
  if (status === "Nominal") return p.nominal;
  if (status === "Degraded") return p.degraded;
  return p.critical;
}
