import { makeDatatakeId } from "@/data/datatake-id";

export type Status = "Planned" | "Processing" | "Acquired" | "Partial" | "Unavailable";

export interface Datatake {
  id: string;
  satellite: string;
  mission: string;
  sensorMode: string;
  status: Status;
  completeness: number;
  start: Date;
}

export const MISSIONS: Record<string, string[]> = {
  "Sentinel-1": ["S1A", "S1C"],
  "Sentinel-2": ["S2A", "S2B", "S2C"],
  "Sentinel-3": ["S3A", "S3B"],
  "Sentinel-5P": ["S5P"],
};

const SENSOR_MODES: Record<string, string[]> = {
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
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((s) => [s, m])),
);

export const STATUS_COLOR: Record<Status, string> = {
  Planned: "var(--cmp-planned)",
  Processing: "var(--cmp-processing)",
  Acquired: "var(--cmp-acquired)",
  Partial: "var(--cmp-partial)",
  Unavailable: "var(--cmp-unavailable)",
};

export const DAY_MS = 86_400_000;

/** A coverage GAP: a datatake that flew and did not publish in full. Deliberately not
 *  "completeness < 100" — Processing is mid-publication and Planned has not flown, and counting
 *  either as a gap would put a permanent false positive at the top of the table. */
export function isGap(d: Datatake): boolean {
  return d.status === "Partial" || d.status === "Unavailable";
}


export const pad = (n: number) => String(n).padStart(2, "0");
export const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
export const dayKey = (d: Date) => fmtDate(d);

/** The window the page describes: three months back plus everything scheduled to 23:59:59 of the
 *  following day, anchored to UTC midnight so the mock set is stable for a whole day. */
export function acquisitionWindow() {
  const n = new Date();
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const start = new Date(today);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 23, 59, 59));
  return { start, end, today: new Date(today) };
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* Coverage is not uniform noise — it comes in runs. A ground-station fault or a processor
   regression degrades a mission for days at a time, and that is exactly the shape this concept
   exists to show. So each mission gets a few OUTAGE WINDOWS, and datatakes falling inside one are
   far more likely to be partial or lost. Scatter the same failures randomly across the quarter and
   the heatmap would be confetti, which would make the view look useless when the real data is not.
*/
interface Outage {
  mission: string;
  fromDay: number; // days back from today
  toDay: number;
  severity: "partial" | "loss";
}

const OUTAGES: Outage[] = [
  { mission: "Sentinel-3", fromDay: 74, toDay: 69, severity: "loss" },
  { mission: "Sentinel-1", fromDay: 58, toDay: 55, severity: "partial" },
  { mission: "Sentinel-2", fromDay: 41, toDay: 39, severity: "partial" },
  { mission: "Sentinel-5P", fromDay: 33, toDay: 28, severity: "partial" },
  { mission: "Sentinel-3", fromDay: 22, toDay: 17, severity: "partial" },
  { mission: "Sentinel-1", fromDay: 12, toDay: 9, severity: "loss" },
  { mission: "Sentinel-2", fromDay: 6, toDay: 4, severity: "partial" },
  { mission: "Sentinel-5P", fromDay: 2, toDay: 1, severity: "loss" },
];

function outageAt(mission: string, daysBack: number): Outage | undefined {
  return OUTAGES.find((o) => o.mission === mission && daysBack <= o.fromDay && daysBack >= o.toDay);
}

function generate(count = 900): Datatake[] {
  const rng = seededRandom(1607);
  const w = acquisitionWindow();
  const now = new Date(); // actual current moment, not today midnight
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const rows: Datatake[] = [];

  for (let i = 0; i < count; i++) {
    const sat = pick(ALL_SATELLITES);
    const mission = MISSION_OF[sat];
    const mode = pick(SENSOR_MODES[sat]);

    // Spread across the window, with a small scheduled tail ahead of today.
    const daysBack = Math.floor(rng() * 93) - 1; // -1 → tomorrow, 91 → three months ago
    const start = new Date(w.today.getTime() - daysBack * DAY_MS + rng() * DAY_MS);

    let status: Status;
    let completeness: number;

    if (start > now) {
      status = "Planned";
      completeness = 0;
    } else if (now.getTime() - start.getTime() < DAY_MS) {
      status = "Processing";
      completeness = Math.round(20 + rng() * 60);
    } else {
      const outage = outageAt(mission, daysBack);
      const roll = rng();
      if (outage?.severity === "loss" && roll < 0.62) {
        status = "Unavailable";
        rng(); completeness = 0; // consume the draw to keep all other mock data identical
      } else if (outage && roll < 0.85) {
        status = "Partial";
        completeness = Math.round(25 + rng() * 50);
      } else if (roll < 0.965) {
        /* Acquired means every expected product was published, so it is 100 exactly. Letting it
           drift to 94-99 would make almost every day contain a "gap" and the whole concept — the
           gap counter, the gap-first sort, days-since-last-gap — would be reporting noise. */
        status = "Acquired";
        completeness = 100;
      } else {
        status = "Partial";
        completeness = Math.round(55 + rng() * 40);
      }
    }

    const id = makeDatatakeId(sat, rng);

    rows.push({ id, satellite: sat, mission, sensorMode: mode, status, completeness, start });
  }

  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

export const DATA = generate();
export const WINDOW = acquisitionWindow();
/** The upper bound of the time window: tomorrow at midnight UTC (scheduled datatakes). */
export const LAST = new Date(WINDOW.today.getTime() + DAY_MS);

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

/** The days of a range, oldest first — the heatmap's columns. */
export function daysOf(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  for (let t = start; t <= end; t += DAY_MS) days.push(new Date(t));
  return days;
}

// ---------------------------------------------------------------------------
// Coverage strip — the bar colours of SentiBoard.html#data-availability
// ---------------------------------------------------------------------------

/** A bar's colour comes from its completeness band, not from its status: the strip answers "how
 *  much of it arrived", so 85% and 99% read differently even though both are Partial/Acquired.
 *  Planned and Processing have no final completeness yet, so they keep their state colour. */
const BANDS: { min: number; color: string }[] = [
  { min: 90, color: "#12E874" }, // 100–90  brilliant green
  { min: 80, color: "#46B96A" }, //  90–80  quieter green
  { min: 50, color: "#FFD01E" }, //  80–50  sun yellow
  { min: 30, color: "#F0736B" }, //  49–30  light red
  { min: 1, color: "#E8200F" }, //   30–1   fire red
];
const MISSING = "#8B98A6"; //          0     nothing published (lost/unavailable)

export function barColor(d: Datatake): string {
  if (d.status === "Planned") return "#7A8696";
  if (d.status === "Processing") return "#5B9BE8";
  return BANDS.find((b) => d.completeness >= b.min)?.color ?? MISSING;
}

/** Bars per strip: the same rhythm in every row, whatever its density. */
export const FRAMES = 96;

export interface Frame {
  /** The datatake the bar shows: the worst one in its group. */
  item: Datatake;
  /** How many datatakes the bar stands for (1 unless the row has more than FRAMES). */
  n: number;
  /** Centre of the bar along the strip, 0–100. */
  leftPct: number;
}

/** A row's datatakes, oldest first, folded into at most FRAMES evenly spaced bars. When there are
 *  more datatakes than bars, each bar holds a few and shows the one with the lowest completeness, so
 *  a loss is never hidden behind a success. Not yet final (Planned/Processing) never wins. */
export function framesOf(list: Datatake[]): Frame[] {
  const sorted = [...list].sort((a, b) => a.start.getTime() - b.start.getTime());
  const nF = Math.min(sorted.length, FRAMES);
  const rank = (d: Datatake) => (d.status === "Planned" || d.status === "Processing" ? 101 : d.completeness);
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

/** The labels under each strip: evenly spaced over the window, the first flush left and the last
 *  flush right. Windows of three days or less also show the hour. */
export function axisTicks(days: Date[]) {
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
      label: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}${short ? ` ${pad(d.getUTCHours())}:00` : ""}`,
    };
  });
}
