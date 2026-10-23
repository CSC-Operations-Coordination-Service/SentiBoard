/* Types for the Events & Anomalies page UI model. */

export type EventCategory =
  | "Acquisition"
  | "Production"
  | "Manoeuvre"
  | "Calibration"
  | "Satellite";

export const CATEGORIES: EventCategory[] = [
  "Acquisition",
  "Production",
  "Manoeuvre",
  "Calibration",
  "Satellite",
];

export type MissionId = "s1" | "s2" | "s3" | "s5p";

export const MISSIONS: Record<MissionId, string[]> = {
  s1: ["S1A", "S1B", "S1C", "S1D"],
  s2: ["S2A", "S2B", "S2C"],
  s3: ["S3A", "S3B"],
  s5p: ["S5P"],
};

export const MISSION_DISPLAY: Record<MissionId, string> = {
  s1: "Sentinel-1",
  s2: "Sentinel-2",
  s3: "Sentinel-3",
  s5p: "Sentinel-5P",
};

export const MISSION_ORDER: MissionId[] = ["s1", "s2", "s3", "s5p"];

export const ALL_SATELLITES: string[] = MISSION_ORDER.flatMap((m) => MISSIONS[m]);
export const ALL_SATELLITES_SET: ReadonlySet<string> = new Set(ALL_SATELLITES);

export type DatatakeLevel = number | null;

export interface EventDatatake {
  datatakeId: string;
  L0: DatatakeLevel;
  L1: DatatakeLevel;
  L2: DatatakeLevel;
  /** True when all three levels are null. */
  noData: boolean;
}

/** One text segment from the anomaly's `text` field. No HTML — rendered as React elements. */
export type TextSegment =
  | { type: "text"; text: string }
  | { type: "br" }
  | { type: "code"; text: string };

/** Compact shape passed to the client for calendar markers and filtering. */
export interface EventCard {
  id: string;
  title: string;
  category: EventCategory;
  satellite: string;
  /** null for events where the satellite could not be determined ("Unknown"). */
  mission: MissionId | null;
  /** YYYY-MM-DD UTC. */
  startDate: string;
  /** YYYY-MM-DD UTC. */
  endDate: string;
  /** Day of month of the start date (1-31). */
  startDay: number;
  /** HH:MM UTC. */
  startTime: string;
  /** Every calendar month this event's [start, end] range overlaps. */
  months: { year: number; month: number }[];
  /** Total number of real (non-fake) datatakes. */
  datatakeCount: number;
  /** Datatakes where any non-null completeness level is below 100 % (partial or unavailable). */
  lostDatatakeCount: number;
}

/** Full event record — passed as the `selectedEvent` prop for the drawer. */
export interface EventDetail extends EventCard {
  key: string;
  textSegments: TextSegment[];
  datatakes: EventDatatake[];
  newsLink: string | null;
  newsTitle: string | null;
  impactedItem: string | null;
}
