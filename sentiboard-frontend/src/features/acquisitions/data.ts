"use cache";
// TODO (Slice 7): replace with the real acquisitions endpoint — name TBD with the backend team
import { getMockData } from "./mock-data";
import type { RawAcqSpec } from "./mock-data";
import type { Station } from "./types";

export type { RawAcqSpec };

export async function getAcquisitions(
  dayKey: string,
): Promise<{ rawSpecs: RawAcqSpec[]; stations: Station[] }> {
  return getMockData(dayKey);
}
