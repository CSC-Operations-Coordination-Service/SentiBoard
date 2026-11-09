/* Temporary mock data — replaced by the real GET /datatake/ endpoint in Session 5.
   Ported from design/react-mockups/src/pages/data_availability/mock.ts with the Datatake
   type extended to include `stop` and `missionId`. */

import {
  DAY_MS,
  MISSION_ID_OF,
  type Datatake,
  type MissionId,
  type Status,
} from "./model";

// ---------------------------------------------------------------------------
// Helpers (private to this module)
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeDatatakeId(satellite: string, rng: () => number): string {
  const sat = satellite.toUpperCase();
  if (sat.startsWith("S3")) {
    const cycle = 100 + Math.floor(rng() * 300);
    const orbit = 1 + Math.floor(rng() * 385);
    return `${sat}-${pad2(cycle)}-${String(orbit).padStart(3, "0")}`;
  }
  if (sat.startsWith("S2")) {
    const datatake = 10000 + Math.floor(rng() * 89999);
    return rng() < 0.55
      ? `${sat}-${datatake}-${1 + Math.floor(rng() * 9)}`
      : `${sat}-${datatake}`;
  }
  return `${sat}-${10000 + Math.floor(rng() * 89999)}`;
}

const MISSIONS_MAP: Record<string, string[]> = {
  "Sentinel-1": ["S1A", "S1C"],
  "Sentinel-2": ["S2A", "S2B", "S2C"],
  "Sentinel-3": ["S3A", "S3B"],
  "Sentinel-5P": ["S5P"],
};

const MISSION_NAMES = Object.keys(MISSIONS_MAP);
const ALL_SATELLITES = MISSION_NAMES.flatMap((m) => MISSIONS_MAP[m]);
const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS_MAP[m].map((s) => [s, m])),
);

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

interface Outage {
  mission: string;
  fromDay: number;
  toDay: number;
  severity: "partial" | "loss";
}

const OUTAGES: Outage[] = [
  { mission: "Sentinel-3",  fromDay: 74, toDay: 69, severity: "loss"    },
  { mission: "Sentinel-1",  fromDay: 58, toDay: 55, severity: "partial" },
  { mission: "Sentinel-2",  fromDay: 41, toDay: 39, severity: "partial" },
  { mission: "Sentinel-5P", fromDay: 33, toDay: 28, severity: "partial" },
  { mission: "Sentinel-3",  fromDay: 22, toDay: 17, severity: "partial" },
  { mission: "Sentinel-1",  fromDay: 12, toDay:  9, severity: "loss"    },
  { mission: "Sentinel-2",  fromDay:  6, toDay:  4, severity: "partial" },
  { mission: "Sentinel-5P", fromDay:  2, toDay:  1, severity: "loss"    },
];

function outageAt(mission: string, daysBack: number): Outage | undefined {
  return OUTAGES.find(
    (o) => o.mission === mission && daysBack <= o.fromDay && daysBack >= o.toDay,
  );
}

export function getMockWindow(now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = new Date(today);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const last = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 23, 59, 59),
  );
  return { start, last, today: new Date(today) };
}

export function generateMockData(now: Date, count = 900): Datatake[] {
  const rng = seededRandom(1607);
  const w = getMockWindow(now);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const rows: Datatake[] = [];

  for (let i = 0; i < count; i++) {
    const sat = pick(ALL_SATELLITES);
    const mission = MISSION_OF[sat];
    const missionId = MISSION_ID_OF[mission] as MissionId;
    const mode = pick(SENSOR_MODES[sat]);

    const daysBack = Math.floor(rng() * 93) - 1;
    const start = new Date(w.today.getTime() - daysBack * DAY_MS + rng() * DAY_MS);
    // Sensing duration: 15–45 minutes, stored as stop time
    const stop = new Date(start.getTime() + (15 + Math.floor(rng() * 30)) * 60_000);

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
        rng(); // consume draw to keep other mock data stable
        completeness = 0;
      } else if (outage && roll < 0.85) {
        status = "Partial";
        completeness = Math.round(25 + rng() * 50);
      } else if (roll < 0.965) {
        status = "Acquired";
        completeness = 100;
      } else {
        status = "Partial";
        completeness = Math.round(55 + rng() * 40);
      }
    }

    const id = makeDatatakeId(sat, rng);
    rows.push({
      id,
      satellite: sat,
      mission,
      missionId,
      sensorMode: mode,
      status,
      completeness,
      start,
      stop,
    });
  }

  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

