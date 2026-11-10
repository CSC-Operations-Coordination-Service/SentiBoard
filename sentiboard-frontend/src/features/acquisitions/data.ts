"use cache";
// TODO (Slice 7): replace with the real acquisitions endpoint — name TBD with the backend team.
// Ground stations are real fixed positions kept in stations.ts, not from the backend.
import type { RawAcqDatatake } from "./adapter";
import type { Station } from "./types";
import { COPERNICUS_STATIONS } from "./stations";

export async function getAcquisitions(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dayKey: string,
): Promise<{ datatakes: RawAcqDatatake[]; stations: Station[] }> {
  return { datatakes: [], stations: COPERNICUS_STATIONS };
}
