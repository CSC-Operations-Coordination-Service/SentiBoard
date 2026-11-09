/* Pure data model for the Data Availability page.
   No browser APIs; fully testable. All constants, types and computations live here. */

export type Status = "Planned" | "Processing" | "Acquired" | "Partial" | "Unavailable";

export interface Datatake {
  id: string;
  satellite: string;
  mission: string;    // full name, e.g. "Sentinel-1"
  missionId: MissionId;
  sensorMode: string;
  status: Status;
  completeness: number; // 0–100; 0 = nothing published (Unavailable) or not finalized
  start: Date;
  stop: Date;
}

export type MissionId = "S1" | "S2" | "S3" | "S5P";

export const MISSION_ORDER: MissionId[] = ["S1", "S2", "S3", "S5P"];

export const MISSION_DISPLAY: Record<MissionId, string> = {
  S1: "Sentinel-1",
  S2: "Sentinel-2",
  S3: "Sentinel-3",
  S5P: "Sentinel-5P",
};

export const MISSION_ID_OF: Record<string, MissionId> = {
  "Sentinel-1": "S1",
  "Sentinel-2": "S2",
  "Sentinel-3": "S3",
  "Sentinel-5P": "S5P",
};

export const SATELLITES_OF: Record<MissionId, string[]> = {
  S1: ["S1A", "S1C"],
  S2: ["S2A", "S2B", "S2C"],
  S3: ["S3A", "S3B"],
  S5P: ["S5P"],
};

/** All satellite codes across all missions, in order. */
export const ALL_SATELLITES: string[] = MISSION_ORDER.flatMap((m) => SATELLITES_OF[m]);

export const STATUS_ORDER: Status[] = [
  "Planned",
  "Processing",
  "Acquired",
  "Partial",
  "Unavailable",
];

export const STATUS_COLOR: Record<Status, string> = {
  Planned: "#7A8696",
  Processing: "#5B9BE8",
  Acquired: "#3FCF7F",
  Partial: "#F0A63A",
  Unavailable: "#E8514B",
};

export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

/** Format n as a 2-digit KPI value (left-padded) below 100; unpadded at 100+. */
export function kpiFmt(n: number): string {
  return n < 100 ? String(n).padStart(2, "0") : String(n);
}

// ---------------------------------------------------------------------------
// Bar colours (§4 of the prototype ref)
// ---------------------------------------------------------------------------

const BANDS: { min: number; color: string }[] = [
  { min: 90, color: "#12E874" },
  { min: 80, color: "#46B96A" },
  { min: 50, color: "#FFD01E" },
  { min: 30, color: "#F0736B" },
  { min: 1,  color: "#E8200F" },
];
const MISSING = "#8B98A6";

/** Colour for a completeness band; Unavailable (0) → MISSING grey. */
export function bandColor(pct: number): string {
  return BANDS.find((b) => pct >= b.min)?.color ?? MISSING;
}

/** Colour for the bar representing a datatake (strip cell).
 *  Planned and Processing use their state colour; everything else uses the completeness band. */
export function barColor(d: Datatake): string {
  if (d.status === "Planned") return "#7A8696";
  if (d.status === "Processing") return "#5B9BE8";
  return bandColor(d.completeness);
}

// ---------------------------------------------------------------------------
// Strip folding and axis ticks (ported from the mock-up's mock.ts)
// ---------------------------------------------------------------------------

/** The days in a window, oldest first — the strip's x-axis. */
export function daysOf(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  for (let t = start; t <= end; t += DAY_MS) days.push(new Date(t));
  return days;
}

const FRAMES = 96;

export interface Frame {
  item: Datatake;
  n: number;        // how many datatakes this bar represents
  leftPct: number;  // 0–100: bar centre position along the strip
}

/** Fold a mission's datatakes (oldest first) into at most 96 evenly-spaced bars.
 *  When several datatakes share a bar, the worst one (lowest finalized completeness) wins.
 *  Planned/Processing rank 101 so they never hide a loss. */
export function framesOf(list: Datatake[]): Frame[] {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
  const nF = Math.min(sorted.length, FRAMES);
  if (nF === 0) return [];
  const rank = (d: Datatake) =>
    d.status === "Planned" || d.status === "Processing" ? 101 : d.completeness;
  const frames: Frame[] = [];
  for (let k = 0; k < nF; k++) {
    const s0 = Math.floor((k * sorted.length) / nF);
    const s1 = Math.floor(((k + 1) * sorted.length) / nF);
    const grp = sorted.slice(s0, Math.max(s1, s0 + 1));
    const item = grp.reduce((worst, d) => (rank(d) < rank(worst) ? d : worst));
    frames.push({ item, n: grp.length, leftPct: ((k + 0.5) / nF) * 100 });
  }
  return frames;
}

export interface AxisTick {
  key: string;
  pct: number;      // 0–100: label position
  edge: "first" | "last" | "";
  label: string;
}

/** Evenly spaced axis labels for a window.
 *  Windows of ≤3 days use 4 intervals and show HH:00; others use 5 intervals and DD/MM. */
export function axisTicks(days: Date[]): AxisTick[] {
  if (!days.length) return [];
  const t0 = days[0].getTime();
  const t1 = days[days.length - 1].getTime() + DAY_MS;
  const short = days.length <= 3;
  const n = short ? 4 : 5;
  return Array.from({ length: n + 1 }, (_, k) => {
    const d = new Date(t0 + ((t1 - t0) * k) / n);
    return {
      key: `tk-${k}`,
      pct: (k / n) * 100,
      edge: k === 0 ? "first" : k === n ? "last" : "",
      label:
        `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}` +
        (short ? ` ${pad(d.getUTCHours())}:00` : ""),
    };
  });
}

// ---------------------------------------------------------------------------
// Datatake card — acquisition and publication sides (§7 of the prototype ref)
// ---------------------------------------------------------------------------

export interface CardSide {
  pct: number | null; // null = not finalized (Planned, Processing, Unavailable)
  color: string;
  label: string;      // badge text
}

export interface CardSides {
  acq: CardSide;
  pub: CardSide;
}

/** Compute the acquisition and publication sides for the datatake card (Decision 6 applied:
 *  Processing shows "—" / grey / ACQUIRED badge on the acquisition ring). */
export function cardSides(d: Datatake): CardSides {
  let acqPct: number | null;
  let acqColor: string;
  let acqLabel: string;
  let pubPct: number | null;
  let pubColor: string;
  let pubLabel: string;

  switch (d.status) {
    case "Planned":
      acqPct = null; acqColor = "#7A8696"; acqLabel = "PLANNED";
      pubPct = null; pubColor = "#7A8696"; pubLabel = "PLANNED";
      break;

    case "Processing":
      // Decision 6: acquisition shows "—", grey, badge ACQUIRED
      acqPct = null; acqColor = "#7A8696"; acqLabel = "ACQUIRED";
      pubPct = d.completeness > 0 ? Math.floor(d.completeness * 0.7) : null;
      pubColor = "#5B9BE8"; pubLabel = "PROCESSING";
      break;

    case "Acquired":
      acqPct = d.completeness; acqColor = bandColor(d.completeness); acqLabel = "ACQUIRED";
      pubPct = d.completeness; pubColor = bandColor(d.completeness); pubLabel = "PUBLISHED";
      break;

    case "Partial":
      acqPct = d.completeness; acqColor = bandColor(d.completeness); acqLabel = "PARTIAL";
      pubPct = d.completeness > 0 ? Math.floor(d.completeness * 0.85) : 0;
      pubColor = pubPct > 0 ? bandColor(pubPct) : MISSING;
      pubLabel = pubPct > 0 ? "PARTIAL" : "MISSING";
      break;

    case "Unavailable":
      acqPct = null; acqColor = MISSING; acqLabel = "UNAVAILABLE";
      pubPct = 0; pubColor = MISSING; pubLabel = "MISSING";
      break;
  }

  return {
    acq: { pct: acqPct, color: acqColor, label: acqLabel },
    pub: { pct: pubPct!, color: pubColor, label: pubLabel },
  };
}

// ---------------------------------------------------------------------------
// KPI computations (Decision #1 for coverage gaps)
// ---------------------------------------------------------------------------

export interface KpiStats {
  inRange: number;
  meanCompleteness: number | null; // null = no finalized datatakes (Decision 13)
  coverageGaps: number;            // satellite-days with no datatake (Decision #1)
  lost: number;
}

/** Compute the four KPIs from the filtered datatakes.
 *
 *  Coverage gaps (Decision #1): count of (satellite, day) pairs where the satellite's mission
 *  is active but no matching datatake starts on that calendar day.
 *
 *  Mean completeness (Decision 13): arithmetic mean of completeness for datatakes that are NOT
 *  Planned or Processing; null ("—") when none exist.
 */
export function kpiStats(
  matching: Datatake[],
  days: Date[],
  activeSatellites: string[],
): KpiStats {
  let lost = 0;
  let sumPct = 0;
  let countPct = 0;

  // Build a set of "satellite:dayKey" pairs that have at least one datatake
  const covered = new Set<string>();
  for (const d of matching) {
    const dayKey = `${d.start.getUTCFullYear()}-${d.start.getUTCMonth()}-${d.start.getUTCDate()}`;
    covered.add(`${d.satellite}:${dayKey}`);
    if (d.status === "Unavailable") lost++;
    if (d.status !== "Planned" && d.status !== "Processing") {
      sumPct += d.completeness;
      countPct++;
    }
  }

  // Count satellite-days with no datatake
  let coverageGaps = 0;
  for (const day of days) {
    const dayKey = `${day.getUTCFullYear()}-${day.getUTCMonth()}-${day.getUTCDate()}`;
    for (const sat of activeSatellites) {
      if (!covered.has(`${sat}:${dayKey}`)) coverageGaps++;
    }
  }

  return {
    inRange: matching.length,
    meanCompleteness: countPct > 0 ? sumPct / countPct : null,
    coverageGaps,
    lost,
  };
}
