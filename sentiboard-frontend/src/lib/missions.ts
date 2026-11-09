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

export const ALL_SATELLITES: string[] = MISSION_ORDER.flatMap((m) => SATELLITES_OF[m]);

export const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");

export function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function fmtDateTime(d: Date): string {
  return `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export function kpiFmt(n: number): string {
  return n < 100 ? String(n).padStart(2, "0") : String(n);
}
