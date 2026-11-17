/* Backend datatakes (GET /datatake/, generic) → the Data Availability page model.

   The backend computes completeness and the legacy ACQ/PUB status; this adapter only picks what
   the page shows:
   - mission from the satellite unit ("S1A" → S1, "S5P" → S5P);
   - status from the publication (PUB) side: PUBLISHED → Acquired, PARTIAL → Partial,
     UNAVAILABLE → Unavailable, PLANNED → Planned, PROCESSING and DELAYED → Processing
     (Decision #14);
   - completeness = PUB % (mean of the level values), as on the Acquisitions page;
   - the real ACQ and PUB sides, so the card shows them instead of deriving them. */

import type { components } from "@/lib/api/schema";
import { MISSION_DISPLAY, type MissionId } from "@/lib/missions";
import type { Datatake, Status } from "./model";

export type ApiDatatake = components["schemas"]["Datatake"];

const MISSION_OF_PREFIX: Record<string, MissionId> = {
  S1: "S1",
  S2: "S2",
  S3: "S3",
  S5: "S5P",
};

const STATUS_OF_PUB: Record<string, Status> = {
  PUBLISHED: "Acquired",
  PARTIAL: "Partial",
  UNAVAILABLE: "Unavailable",
  PLANNED: "Planned",
  PROCESSING: "Processing",
  DELAYED: "Processing",
};

export function missionOf(unit: string | null | undefined): MissionId | null {
  return (unit && MISSION_OF_PREFIX[unit.slice(0, 2)]) || null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** One page datatake, or null when the record cannot be placed on the strip (no satellite,
 *  unknown mission, no valid start/stop). */
export function toDatatake(r: ApiDatatake): Datatake | null {
  const missionId = missionOf(r.satellite_unit);
  const start = r.observation_time_start ? new Date(r.observation_time_start) : null;
  const stop = r.observation_time_stop ? new Date(r.observation_time_stop) : null;
  if (!missionId || !r.satellite_unit || !start || !stop) return null;
  if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime())) return null;

  const cs = r.completeness_status;
  const status: Status = cs ? (STATUS_OF_PUB[cs.publication.status] ?? "Processing") : "Processing";
  return {
    id: r.id,
    satellite: r.satellite_unit,
    mission: MISSION_DISPLAY[missionId],
    missionId,
    sensorMode: r.instrument_mode ?? "",
    status,
    completeness: cs ? round2(cs.publication.percentage) : 0,
    start,
    stop,
    ...(cs && {
      acq: { status: cs.acquisition.status, pct: round2(cs.acquisition.percentage) },
      pub: { status: cs.publication.status, pct: round2(cs.publication.percentage) },
    }),
  };
}

/** Every placeable datatake, oldest first, and the ids of the records left out. */
export function adaptDatatakes(records: ApiDatatake[]): { datatakes: Datatake[]; skipped: string[] } {
  const datatakes: Datatake[] = [];
  const skipped: string[] = [];
  for (const r of records) {
    const d = toDatatake(r);
    if (d) datatakes.push(d);
    else skipped.push(r.id);
  }
  datatakes.sort((a, b) => a.start.getTime() - b.start.getTime());
  return { datatakes, skipped };
}
