// DEVOCS-219 — "Mission Manifest" Events mock-up: domain types, the January–October 2026 mock data
// and the pure helpers both layout variants share. Mock-up only — nothing here talks to a backend;
// the shipping page is /v1/events, server-rendered from lib/data.ts.
//
// The event data is all literal: no RNG, no Date.now(), no `new Date()` without explicit arguments.
// Random-looking data generated at module load would differ between loads and break any markup
// comparison, so the October rows were written out by hand like the rest. The only clock read is
// the calendar's starting month, which lives in events.tsx. No day is marked "today".

import { Cog, Compass, Joystick, Satellite, SatelliteDish, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Domain
// ---------------------------------------------------------------------------

/** The five event categories the production Events page publishes. */
export type EventCategory = "Acquisition" | "Calibration" | "Manoeuvre" | "Production" | "Satellite";

/** Publication completeness of a datatake — the same five states the production legend
 *  publishes, not a private three-colour scale. */
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
  /** Calendar year and 1-based month the event belongs to. Every helper that scopes events to a
   *  month filters on these, never on `day` alone — day 5 of March and day 5 of May are different. */
  year: number;
  month: number;
  /** Day of month. */
  day: number;
  /** HH:MM UTC. */
  time: string;
  category: EventCategory;
  satellite: string;
  title: string;
  datatakes: Datatake[];
};

/** The year every mock event belongs to. The page opens on the current month of this year. */
export const YEAR = 2026;

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

/** Event type colors — each category has a distinct hue. */
export const CATEGORY_COLOR: Record<EventCategory, string> = {
  Acquisition: "#aeb8c4",
  Calibration: "#b0dfe5",
  Manoeuvre: "#ffad00",
  Production: "#c77dff",
  Satellite: "#ee8216",
};

export const CATEGORIES = Object.keys(CATEGORY_ICONS) as EventCategory[];

/** Labels and colours taken from production's own datatake legend, so this page cannot disagree
 *  with the shipping dashboard about what "Partial" looks like. Planned and Processing share the
 *  neutral grey: neither has lost anything, they are simply not finished. The values live in
 *  events.module.css. */
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
// Mock data — January to September 2026
// ---------------------------------------------------------------------------

/** One datatake, written as a tuple so a month reads as a table:
 *  [id, product, sensing start (ISO UTC), sensing length in seconds, status, completeness].
 *  The stop instant is derived from the length, so a window can never disagree with its duration. */
type DatatakeSpec = [id: string, product: string, sensingStart: string, lengthSec: number, status: Status, completeness: number];

/** One event: [day, HH:MM UTC, category, satellite, datatakes]. Its satellite is every datatake's. */
type EventSpec = [day: number, time: string, category: EventCategory, satellite: string, datatakes: DatatakeSpec[]];

/** Month number (1-based) → that month's events. Months are listed in the order they happened. */
const SPECS: Record<number, EventSpec[]> = {
  // January
  1: [
    [2, "06:20", "Calibration", "Sentinel-2A", [["S2A-705112", "MSI L1C", "2026-01-02T06:08:14Z", 1003, "acquired", 100]]],
    [5, "10:45", "Acquisition", "Sentinel-1A", [["S1A-310655", "IW GRDH", "2026-01-05T10:33:00Z", 612, "acquired", 100], ["S1A-310656", "IW SLC", "2026-01-05T11:08:20Z", 480, "partial", 86]]],
    [6, "21:10", "Satellite", "Sentinel-3A", [["S3A-244402", "OL_1_EFR", "2026-01-06T20:55:00Z", 2430, "unavailable", 0]]],
    [8, "04:30", "Manoeuvre", "Sentinel-1C", [["S1C-395118", "IW GRDH", "2026-01-08T04:18:40Z", 700, "partial", 41], ["S1C-395119", "EW GRDM", "2026-01-08T05:51:03Z", 1540, "unavailable", 0]]],
    [9, "13:00", "Production", "Sentinel-2B", [["S2B-690871", "MSI L2A", "2026-01-08T10:02:17Z", 1015, "processing", 64]]],
    [12, "09:14", "Acquisition", "Sentinel-2A", [["S2A-705581", "MSI L2A", "2026-01-12T09:21:30Z", 1000, "partial", 92]]],
    [14, "02:40", "Calibration", "Sentinel-5P", [["S5P-871530", "L1B_RA_BD3", "2026-01-14T02:22:10Z", 1150, "acquired", 100]]],
    [16, "18:05", "Manoeuvre", "Sentinel-3B", [["S3B-240118", "SL_1_RBT", "2026-01-16T17:50:00Z", 2280, "partial", 47], ["S3B-240119", "SR_1_SRA", "2026-01-16T18:03:20Z", 1500, "partial", 33]]],
    [19, "15:30", "Production", "Sentinel-3A", [["S3A-244990", "SL_2_WST", "2026-01-19T15:12:00Z", 2400, "acquired", 100]]],
    [22, "07:12", "Acquisition", "Sentinel-1A", [["S1A-311402", "IW GRDH", "2026-01-22T07:00:12Z", 602, "planned", 0]]],
    [27, "23:18", "Satellite", "Sentinel-2C", [["S2C-720031", "MSI L1C", "2026-01-27T23:02:30Z", 1005, "acquired", 100]]],
    [29, "12:44", "Calibration", "Sentinel-3A", [["S3A-245310", "OL_2_LFR", "2026-01-29T12:20:00Z", 2640, "acquired", 100]]],
  ],
  // February
  2: [
    [3, "05:55", "Acquisition", "Sentinel-1C", [["S1C-396702", "IW SLC", "2026-02-03T05:41:12Z", 1466, "acquired", 100]]],
    [4, "11:20", "Calibration", "Sentinel-2B", [["S2B-691448", "MSI L1C", "2026-02-04T11:08:50Z", 1020, "acquired", 100]]],
    [6, "16:02", "Manoeuvre", "Sentinel-2A", [["S2A-706219", "MSI L1C", "2026-02-06T15:50:33Z", 985, "unavailable", 0], ["S2A-706220", "MSI L2A", "2026-02-06T16:06:01Z", 1010, "unavailable", 0]]],
    [7, "03:30", "Satellite", "Sentinel-1A", [["S1A-312087", "EW GRDM", "2026-02-07T03:14:30Z", 1620, "partial", 76]]],
    [9, "20:45", "Production", "Sentinel-5P", [["S5P-873044", "L2__NO2___", "2026-02-09T20:21:00Z", 2820, "processing", 58]]],
    [11, "08:10", "Acquisition", "Sentinel-3B", [["S3B-241776", "OL_1_EFR", "2026-02-11T07:52:00Z", 2460, "partial", 88], ["S3B-241777", "SL_1_RBT", "2026-02-11T07:52:00Z", 2460, "acquired", 100]]],
    [13, "14:36", "Calibration", "Sentinel-1A", [["S1A-312214", "IW GRDH", "2026-02-13T14:21:09Z", 598, "acquired", 100]]],
    [16, "01:22", "Satellite", "Sentinel-2C", [["S2C-720512", "MSI L2A", "2026-02-16T01:08:44Z", 1012, "unavailable", 0]]],
    [18, "10:04", "Acquisition", "Sentinel-3A", [["S3A-246077", "SR_2_LAN", "2026-02-18T09:48:00Z", 2100, "acquired", 100]]],
    [21, "17:40", "Manoeuvre", "Sentinel-1C", [["S1C-396911", "IW SLC", "2026-02-21T17:20:40Z", 1310, "partial", 52]]],
    [24, "06:12", "Production", "Sentinel-2A", [["S2A-706930", "MSI L2A", "2026-02-22T10:36:15Z", 1002, "acquired", 100]]],
    [26, "22:58", "Acquisition", "Sentinel-2B", [["S2B-692310", "MSI L1C", "2026-02-26T22:44:20Z", 1008, "planned", 0]]],
  ],
  // March
  3: [
    [2, "09:40", "Calibration", "Sentinel-3B", [["S3B-242604", "OL_1_ERR", "2026-03-02T09:18:00Z", 2220, "acquired", 100]]],
    [4, "19:15", "Acquisition", "Sentinel-1A", [["S1A-313540", "IW GRDH", "2026-03-04T19:02:50Z", 605, "acquired", 100], ["S1A-313541", "IW SLC", "2026-03-04T19:21:10Z", 510, "partial", 63]]],
    [5, "02:08", "Satellite", "Sentinel-5P", [["S5P-874612", "L1B_RA_BD3", "2026-03-05T01:50:00Z", 1160, "acquired", 100]]],
    [7, "12:31", "Manoeuvre", "Sentinel-2B", [["S2B-693018", "MSI L1C", "2026-03-07T12:18:25Z", 1000, "unavailable", 0]]],
    [10, "21:02", "Production", "Sentinel-3A", [["S3A-247410", "SL_2_WST", "2026-03-10T20:44:00Z", 2350, "processing", 72]]],
    [12, "04:47", "Acquisition", "Sentinel-1C", [["S1C-398210", "EW GRDM", "2026-03-12T04:31:20Z", 1605, "acquired", 100]]],
    [14, "13:20", "Satellite", "Sentinel-2A", [["S2A-707614", "MSI L1C", "2026-03-14T13:06:02Z", 1012, "partial", 81]]],
    [17, "08:55", "Calibration", "Sentinel-1C", [["S1C-398533", "IW SLC", "2026-03-17T08:40:18Z", 1385, "acquired", 100]]],
    [19, "16:30", "Acquisition", "Sentinel-3B", [["S3B-243190", "OL_2_LFR", "2026-03-19T16:12:00Z", 2580, "partial", 44]]],
    [23, "00:25", "Manoeuvre", "Sentinel-3A", [["S3A-247855", "SR_1_SRA", "2026-03-22T23:55:00Z", 1540, "partial", 38], ["S3A-247856", "SL_1_RBT", "2026-03-23T00:19:30Z", 2380, "unavailable", 0]]],
    [25, "11:12", "Production", "Sentinel-1A", [["S1A-314120", "IW GRDH", "2026-03-24T11:00:05Z", 598, "acquired", 100]]],
    [28, "18:48", "Satellite", "Sentinel-2C", [["S2C-721388", "MSI L2A", "2026-03-28T18:34:40Z", 1005, "acquired", 100]]],
    [30, "07:05", "Acquisition", "Sentinel-2B", [["S2B-693902", "MSI L1C", "2026-03-30T06:50:12Z", 1015, "planned", 0]]],
  ],
  // April
  4: [
    [1, "03:40", "Calibration", "Sentinel-5P", [["S5P-876110", "L1B_RA_BD3", "2026-04-01T03:22:14Z", 1120, "acquired", 100]]],
    [3, "14:10", "Acquisition", "Sentinel-1A", [["S1A-314702", "IW GRDH", "2026-04-03T13:58:31Z", 610, "acquired", 100]]],
    [6, "22:33", "Manoeuvre", "Sentinel-1C", [["S1C-399450", "IW GRDH", "2026-04-06T22:18:00Z", 655, "partial", 29], ["S1C-399451", "IW SLC", "2026-04-06T23:55:12Z", 1421, "unavailable", 0]]],
    [8, "06:18", "Production", "Sentinel-2C", [["S2C-722044", "MSI L2A", "2026-04-07T10:02:38Z", 1010, "processing", 45]]],
    [9, "17:50", "Satellite", "Sentinel-3B", [["S3B-244611", "SL_1_RBT", "2026-04-09T17:30:00Z", 2400, "acquired", 100]]],
    [11, "09:26", "Acquisition", "Sentinel-2A", [["S2A-708530", "MSI L1C", "2026-04-11T09:12:08Z", 1008, "partial", 70]]],
    [13, "21:04", "Calibration", "Sentinel-3A", [["S3A-248920", "OL_1_EFR", "2026-04-13T20:48:00Z", 2445, "acquired", 100]]],
    [15, "02:52", "Acquisition", "Sentinel-5P", [["S5P-876760", "L2__NO2___", "2026-04-15T02:30:00Z", 2700, "partial", 91]]],
    [18, "12:09", "Satellite", "Sentinel-2B", [["S2B-694560", "MSI L2A", "2026-04-18T11:57:09Z", 1011, "acquired", 100]]],
    [21, "05:37", "Acquisition", "Sentinel-1C", [["S1C-400110", "EW GRDM", "2026-04-21T05:20:45Z", 1598, "planned", 0]]],
    [24, "16:44", "Manoeuvre", "Sentinel-3B", [["S3B-245030", "OL_1_ERR", "2026-04-24T16:20:00Z", 2280, "unavailable", 0], ["S3B-245031", "SR_2_LAN", "2026-04-24T16:55:00Z", 2010, "unavailable", 0]]],
    [27, "10:20", "Production", "Sentinel-3A", [["S3A-249410", "SR_2_LAN", "2026-04-27T10:05:00Z", 2050, "acquired", 100]]],
    [29, "19:31", "Calibration", "Sentinel-1A", [["S1A-315890", "IW SLC", "2026-04-29T19:12:40Z", 1401, "acquired", 100]]],
  ],
  // May
  5: [
    [2, "08:02", "Acquisition", "Sentinel-2A", [["S2A-709412", "MSI L1C", "2026-05-02T07:48:22Z", 1004, "acquired", 100]]],
    [4, "15:15", "Satellite", "Sentinel-1A", [["S1A-316260", "IW GRDH", "2026-05-04T15:00:11Z", 612, "partial", 64]]],
    [6, "01:44", "Manoeuvre", "Sentinel-5P", [["S5P-878020", "L1B_RA_BD3", "2026-05-06T01:20:00Z", 1210, "unavailable", 0]]],
    [8, "11:30", "Production", "Sentinel-1C", [["S1C-400877", "IW SLC", "2026-05-07T11:04:40Z", 1392, "acquired", 100]]],
    [10, "20:20", "Acquisition", "Sentinel-3A", [["S3A-250380", "SL_2_WST", "2026-05-10T20:02:00Z", 2370, "acquired", 100]]],
    [12, "06:55", "Calibration", "Sentinel-2C", [["S2C-723301", "MSI L2A", "2026-05-12T06:41:34Z", 1009, "acquired", 100]]],
    [14, "17:42", "Acquisition", "Sentinel-3B", [["S3B-246120", "OL_1_EFR", "2026-05-14T17:25:00Z", 2470, "partial", 57], ["S3B-246121", "SR_1_SRA", "2026-05-14T17:40:00Z", 1580, "partial", 69]]],
    [16, "04:12", "Satellite", "Sentinel-2B", [["S2B-695922", "MSI L1C", "2026-05-16T03:58:40Z", 1017, "unavailable", 0]]],
    [19, "13:33", "Acquisition", "Sentinel-1A", [["S1A-316901", "EW GRDM", "2026-05-19T13:18:05Z", 1603, "acquired", 100]]],
    [21, "22:00", "Production", "Sentinel-2A", [["S2A-709870", "MSI L2A", "2026-05-20T09:44:12Z", 1001, "processing", 83]]],
    [23, "09:15", "Calibration", "Sentinel-3B", [["S3B-246804", "OL_2_LFR", "2026-05-23T08:55:00Z", 2600, "acquired", 100]]],
    [26, "14:48", "Manoeuvre", "Sentinel-1A", [["S1A-317310", "IW GRDH", "2026-05-26T14:30:21Z", 600, "partial", 35], ["S1A-317311", "IW SLC", "2026-05-26T14:44:55Z", 498, "planned", 0]]],
    [29, "03:05", "Acquisition", "Sentinel-5P", [["S5P-879655", "L2__NO2___", "2026-05-29T02:45:00Z", 2760, "acquired", 100]]],
  ],
  // June
  6: [
    [1, "12:40", "Acquisition", "Sentinel-2C", [["S2C-724640", "MSI L1C", "2026-06-01T12:27:19Z", 1010, "acquired", 100]]],
    [3, "07:21", "Calibration", "Sentinel-1C", [["S1C-401520", "IW GRDH", "2026-06-03T07:05:50Z", 610, "acquired", 100]]],
    [5, "18:58", "Satellite", "Sentinel-3A", [["S3A-251715", "OL_1_EFR", "2026-06-05T18:40:00Z", 2455, "unavailable", 0], ["S3A-251716", "SL_1_RBT", "2026-06-05T18:40:00Z", 2455, "partial", 52]]],
    [8, "10:12", "Production", "Sentinel-3B", [["S3B-247502", "SL_2_WST", "2026-06-08T09:52:00Z", 2330, "acquired", 100]]],
    [9, "02:30", "Acquisition", "Sentinel-1A", [["S1A-317960", "IW SLC", "2026-06-09T02:14:31Z", 1388, "partial", 90]]],
    [11, "16:05", "Manoeuvre", "Sentinel-2B", [["S2B-697011", "MSI L1C", "2026-06-11T15:49:07Z", 995, "unavailable", 0], ["S2B-697012", "MSI L2A", "2026-06-11T16:12:44Z", 1008, "unavailable", 0]]],
    [13, "23:17", "Calibration", "Sentinel-5P", [["S5P-881290", "L1B_RA_BD3", "2026-06-13T23:00:00Z", 1135, "acquired", 100]]],
    [16, "09:48", "Acquisition", "Sentinel-2A", [["S2A-710860", "MSI L1C", "2026-06-16T09:35:02Z", 1003, "acquired", 100]]],
    [18, "19:26", "Production", "Sentinel-1C", [["S1C-402104", "EW GRDM", "2026-06-18T19:03:20Z", 1571, "processing", 66]]],
    [20, "04:55", "Acquisition", "Sentinel-3B", [["S3B-248240", "OL_1_ERR", "2026-06-20T04:33:00Z", 2290, "acquired", 100]]],
    [23, "12:07", "Satellite", "Sentinel-2A", [["S2A-711402", "MSI L2A", "2026-06-23T11:52:48Z", 1006, "partial", 74]]],
    [25, "21:39", "Acquisition", "Sentinel-1C", [["S1C-402560", "IW GRDH", "2026-06-25T21:24:14Z", 600, "planned", 0]]],
    [28, "06:14", "Calibration", "Sentinel-3A", [["S3A-252408", "OL_2_LFR", "2026-06-28T05:50:00Z", 2620, "acquired", 100]]],
    [30, "15:52", "Production", "Sentinel-5P", [["S5P-882400", "L2__NO2___", "2026-06-30T15:30:00Z", 2640, "processing", 40]]],
  ],
  // July
  7: [
    [2, "04:05", "Acquisition", "Sentinel-1A", [["S1A-318220", "IW GRDH", "2026-07-02T03:50:18Z", 604, "acquired", 100]]],
    [4, "11:48", "Manoeuvre", "Sentinel-3A", [["S3A-252990", "SR_2_LAN", "2026-07-04T11:25:00Z", 2040, "partial", 61]]],
    [6, "20:14", "Calibration", "Sentinel-2B", [["S2B-698450", "MSI L1C", "2026-07-06T19:58:41Z", 1011, "acquired", 100]]],
    [9, "08:30", "Satellite", "Sentinel-5P", [["S5P-883100", "L1B_RA_BD3", "2026-07-09T08:10:00Z", 1148, "acquired", 100]]],
    [11, "17:26", "Production", "Sentinel-2C", [["S2C-725931", "MSI L2A", "2026-07-11T17:12:35Z", 1007, "acquired", 100]]],
    [13, "03:41", "Acquisition", "Sentinel-3B", [["S3B-249060", "SL_1_RBT", "2026-07-13T03:20:00Z", 2410, "unavailable", 0]]],
    [15, "13:02", "Acquisition", "Sentinel-2A", [["S2A-712070", "MSI L1C", "2026-07-15T12:48:10Z", 1013, "partial", 85]]],
    [17, "22:19", "Satellite", "Sentinel-1C", [["S1C-403240", "IW SLC", "2026-07-17T22:03:55Z", 1398, "partial", 47], ["S1C-403241", "EW GRDM", "2026-07-17T23:40:30Z", 1605, "unavailable", 0]]],
    [20, "07:33", "Manoeuvre", "Sentinel-2C", [["S2C-726610", "MSI L1C", "2026-07-20T07:19:44Z", 1002, "partial", 59]]],
    [22, "14:57", "Acquisition", "Sentinel-1A", [["S1A-318880", "IW SLC", "2026-07-22T14:42:09Z", 1412, "acquired", 100]]],
    [24, "01:12", "Calibration", "Sentinel-3B", [["S3B-249600", "OL_1_EFR", "2026-07-24T00:50:00Z", 2468, "acquired", 100]]],
    [27, "19:44", "Production", "Sentinel-3A", [["S3A-253900", "OL_2_LFR", "2026-07-27T19:20:00Z", 2610, "processing", 78]]],
    [30, "10:05", "Acquisition", "Sentinel-5P", [["S5P-884450", "L2__NO2___", "2026-07-30T09:45:00Z", 2730, "planned", 0]]],
  ],
  // August — the set the page opens on.
  8: [
    [3, "04:12", "Manoeuvre", "Sentinel-1A", [["S1A-318402", "IW GRDH", "2026-08-03T04:02:00Z", 552, "acquired", 100], ["S1A-318403", "IW SLC", "2026-08-03T04:26:40Z", 445, "acquired", 100]]],
    [4, "09:30", "Calibration", "Sentinel-2B", [["S2B-712094", "MSI L1C", "2026-08-04T09:12:31Z", 1047, "acquired", 100]]],
    [5, "18:40", "Acquisition", "Sentinel-3B", [["S3B-253251", "OL_1_EFR", "2026-08-05T18:22:00Z", 2460, "unavailable", 0], ["S3B-253252", "SL_1_RBT", "2026-08-05T18:22:00Z", 2460, "partial", 62], ["S3B-253253", "SR_1_SRA", "2026-08-05T18:31:40Z", 1600, "partial", 74]]],
    [5, "19:05", "Production", "Sentinel-3B", [["S3B-253252", "SL_2_WST", "2026-08-05T18:22:00Z", 2460, "processing", 71]]],
    [7, "02:15", "Satellite", "Sentinel-1C", [["S1C-401180", "IW GRDH", "2026-08-07T02:15:00Z", 1590, "unavailable", 0], ["S1C-401181", "IW GRDH", "2026-08-07T03:52:10Z", 1654, "unavailable", 0], ["S1C-401182", "EW GRDM", "2026-08-07T05:30:05Z", 1627, "unavailable", 0]]],
    [10, "11:00", "Calibration", "Sentinel-5P", [["S5P-881204", "L1B_RA_BD3", "2026-08-10T10:41:00Z", 1100, "acquired", 100]]],
    [12, "22:15", "Acquisition", "Sentinel-1A", [["S1A-318974", "IW SLC", "2026-08-12T22:15:00Z", 1406, "partial", 48], ["S1A-318975", "IW GRDH", "2026-08-12T23:52:40Z", 1282, "partial", 55]]],
    [13, "07:50", "Production", "Sentinel-1A", [["S1A-318974", "IW SLC", "2026-08-12T22:15:00Z", 1406, "acquired", 100], ["S1A-318975", "IW GRDH", "2026-08-12T23:52:40Z", 1282, "acquired", 100]]],
    [14, "05:40", "Manoeuvre", "Sentinel-3A", [["S3A-255014", "SR_2_LAN", "2026-08-14T05:33:00Z", 2100, "partial", 58], ["S3A-255015", "OL_2_LFR", "2026-08-14T05:33:00Z", 2100, "partial", 61]]],
    [17, "13:20", "Acquisition", "Sentinel-2A", [["S2A-713401", "MSI L1C", "2026-08-17T13:04:12Z", 938, "unavailable", 0], ["S2A-713402", "MSI L2A", "2026-08-17T13:04:12Z", 938, "unavailable", 0]]],
    [19, "03:05", "Manoeuvre", "Sentinel-5P", [["S5P-882041", "L2__NO2___", "2026-08-19T02:47:30Z", 2800, "acquired", 100]]],
    [20, "16:45", "Production", "Sentinel-2C", [["S2C-714220", "MSI L2A", "2026-08-20T10:22:04Z", 937, "processing", 80], ["S2C-714221", "MSI L2A", "2026-08-20T12:01:18Z", 937, "processing", 80]]],
    [24, "08:18", "Satellite", "Sentinel-2A", [["S2A-713988", "MSI L1C", "2026-08-24T08:02:44Z", 885, "planned", 0]]],
    [25, "21:30", "Acquisition", "Sentinel-3A", [["S3A-255730", "OL_1_ERR", "2026-08-25T21:18:00Z", 2070, "partial", 91]]],
    [27, "12:05", "Calibration", "Sentinel-1C", [["S1C-402551", "IW SLC", "2026-08-27T11:48:20Z", 998, "acquired", 100]]],
    [31, "20:02", "Acquisition", "Sentinel-1A", [["S1A-319612", "IW GRDH", "2026-08-31T19:44:10Z", 1646, "partial", 93]]],
  ],
  // September
  9: [
    [1, "05:50", "Acquisition", "Sentinel-2B", [["S2B-699501", "MSI L1C", "2026-09-01T05:37:24Z", 1009, "acquired", 100]]],
    [3, "16:16", "Satellite", "Sentinel-1A", [["S1A-319320", "IW GRDH", "2026-09-03T16:00:33Z", 608, "acquired", 100]]],
    [5, "09:02", "Manoeuvre", "Sentinel-3B", [["S3B-250310", "OL_1_ERR", "2026-09-05T08:40:00Z", 2305, "unavailable", 0], ["S3B-250311", "SR_1_SRA", "2026-09-05T08:55:00Z", 1560, "unavailable", 0]]],
    [7, "21:41", "Calibration", "Sentinel-1C", [["S1C-404010", "IW SLC", "2026-09-07T21:26:17Z", 1390, "acquired", 100]]],
    [9, "12:28", "Acquisition", "Sentinel-2C", [["S2C-727544", "MSI L2A", "2026-09-09T12:15:01Z", 1011, "acquired", 100]]],
    [11, "03:34", "Production", "Sentinel-5P", [["S5P-885120", "L1B_RA_BD3", "2026-09-11T03:15:00Z", 1140, "processing", 92]]],
    [13, "15:55", "Acquisition", "Sentinel-3A", [["S3A-254480", "SL_2_WST", "2026-09-13T15:37:00Z", 2360, "partial", 66]]],
    [15, "00:08", "Satellite", "Sentinel-2A", [["S2A-713050", "MSI L1C", "2026-09-15T00:00:04Z", 1005, "unavailable", 0]]],
    [17, "18:23", "Acquisition", "Sentinel-1C", [["S1C-404602", "EW GRDM", "2026-09-17T18:06:40Z", 1600, "acquired", 100]]],
    [19, "08:47", "Calibration", "Sentinel-3A", [["S3A-254910", "OL_1_EFR", "2026-09-19T08:25:00Z", 2452, "acquired", 100]]],
    [22, "13:10", "Manoeuvre", "Sentinel-2B", [["S2B-700420", "MSI L1C", "2026-09-22T12:56:31Z", 1000, "partial", 48], ["S2B-700421", "MSI L2A", "2026-09-22T13:12:09Z", 1012, "planned", 0]]],
    [25, "06:33", "Acquisition", "Sentinel-1A", [["S1A-320140", "IW SLC", "2026-09-25T06:17:02Z", 1395, "acquired", 100]]],
    [28, "20:01", "Production", "Sentinel-3B", [["S3B-251830", "SL_2_WST", "2026-09-28T19:40:00Z", 2390, "processing", 70]]],
    [30, "11:24", "Acquisition", "Sentinel-2C", [["S2C-728310", "MSI L1C", "2026-09-30T11:10:47Z", 1010, "partial", 89]]],
  ],
  // October — only the first ten days are populated so far.
  10: [
    [1, "02:48", "Satellite", "Sentinel-1A", [["S1A-320712", "IW GRDH", "2026-10-01T02:36:10Z", 600, "acquired", 100]]],
    [1, "13:22", "Production", "Sentinel-2B", [["S2B-701330", "MSI L2A", "2026-10-01T10:31:48Z", 1004, "acquired", 100]]],
    [2, "07:15", "Acquisition", "Sentinel-3A", [["S3A-255904", "OL_1_EFR", "2026-10-02T06:58:00Z", 2440, "partial", 79], ["S3A-255905", "SL_1_RBT", "2026-10-02T06:58:00Z", 2440, "acquired", 100]]],
    [3, "19:44", "Manoeuvre", "Sentinel-1C", [["S1C-404950", "IW SLC", "2026-10-03T19:30:22Z", 1385, "partial", 44], ["S1C-404951", "EW GRDM", "2026-10-03T21:05:40Z", 1590, "unavailable", 0]]],
    [4, "04:09", "Calibration", "Sentinel-5P", [["S5P-885800", "L1B_RA_BD3", "2026-10-04T03:50:00Z", 1130, "acquired", 100]]],
    [4, "12:37", "Acquisition", "Sentinel-2C", [["S2C-728902", "MSI L1C", "2026-10-04T12:24:15Z", 1006, "acquired", 100]]],
    [5, "21:11", "Satellite", "Sentinel-3B", [["S3B-251990", "OL_2_LFR", "2026-10-05T20:52:00Z", 2510, "unavailable", 0]]],
    [6, "08:26", "Production", "Sentinel-1A", [["S1A-320980", "IW SLC", "2026-10-05T22:08:17Z", 1400, "processing", 88]]],
    [6, "10:40", "Acquisition", "Sentinel-2A", [["S2A-713790", "MSI L2A", "2026-10-06T10:19:44Z", 1001, "partial", 58]]],
    [7, "16:03", "Calibration", "Sentinel-1C", [["S1C-405212", "IW GRDH", "2026-10-07T15:50:02Z", 612, "acquired", 100]]],
    [8, "00:57", "Manoeuvre", "Sentinel-2B", [["S2B-701944", "MSI L1C", "2026-10-08T00:41:30Z", 1010, "unavailable", 0], ["S2B-701945", "MSI L2A", "2026-10-08T00:57:08Z", 1012, "planned", 0]]],
    [9, "14:28", "Acquisition", "Sentinel-3A", [["S3A-256430", "SR_2_LAN", "2026-10-09T14:10:00Z", 2095, "acquired", 100]]],
    [10, "06:52", "Satellite", "Sentinel-1A", [["S1A-321236", "EW GRDM", "2026-10-10T06:36:50Z", 1602, "partial", 61]]],
    [10, "18:19", "Production", "Sentinel-2C", [["S2C-729511", "MSI L2A", "2026-10-10T18:05:00Z", 1009, "processing", 70]]],
  ],
};

/** Expands one datatake tuple into the Datatake shape the components read. */
function datatakeOf(satellite: string, [id, product, sensingStart, lengthSec, status, completeness]: DatatakeSpec): Datatake {
  const sensingStop = new Date(Date.parse(sensingStart) + lengthSec * 1000).toISOString().replace(".000Z", "Z");
  return { id, satellite, product, sensingStart, sensingStop, completeness, status };
}

function eventsOfMonth(month: number, specs: EventSpec[]): ManifestEvent[] {
  return specs.map(([day, time, category, satellite, datatakes], i) => ({
    id: `${YEAR}-${pad(month)}-${pad(i + 1)}`,
    year: YEAR,
    month,
    day,
    time,
    category,
    satellite,
    title: category,
    datatakes: datatakes.map((d) => datatakeOf(satellite, d)),
  }));
}

/** Every event in the mock, January to September 2026, in chronological order. */
export const EVENTS: ManifestEvent[] = Object.entries(SPECS).flatMap(([month, specs]) =>
  eventsOfMonth(Number(month), specs),
);

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
 *  on the stop side only when the window crosses midnight, as the 12 Aug Sentinel-1A pass does. */
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
 *  would actually type: the event title and summary, the satellite, and any impacted datatake ID.
 *  Filters only; it does not narrow by month — pass the result to eventsInMonth for that. */
export function filterEvents(events: ManifestEvent[], f: Filters): ManifestEvent[] {
  const q = f.query.trim().toLowerCase();
  return events.filter((e) => {
    if (f.mission && missionOf(e.satellite) !== f.mission) return false;
    if (f.satellite && e.satellite !== f.satellite) return false;
    if (!f.categories.includes(e.category)) return false;
    if (!q) return true;
    return (
      e.title.toLowerCase().includes(q) ||
      e.satellite.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.datatakes.some((d) => d.id.toLowerCase().includes(q) || d.product.toLowerCase().includes(q))
    );
  });
}

/** The events that fall in one calendar month. Matches on year and month together, so a month
 *  never picks up another month's events that happen to share a day number. */
export function eventsInMonth(events: ManifestEvent[], year: number, month: number): ManifestEvent[] {
  return events.filter((e) => e.year === year && e.month === month);
}

/** Day of month → that day's events, for one year and month only, sorted by time. */
export function groupByDay(events: ManifestEvent[], year: number, month: number): Map<number, ManifestEvent[]> {
  const map = new Map<number, ManifestEvent[]>();
  eventsInMonth(events, year, month)
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

/** "05 Aug 2026" for a day of the given month. */
export function dayLabel(year: number, month: number, day: number): string {
  return `${pad(day)} ${MONTH_SHORT[month - 1]} ${year}`;
}
