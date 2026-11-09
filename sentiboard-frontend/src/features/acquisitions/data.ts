"use cache";
// TODO (Slice 7): replace with the real acquisitions endpoint — name TBD with the backend team
import { adaptAcquisitions } from "./adapter";
import { getMockData } from "./mock-data";
import type { AcquisitionsData } from "./types";

export async function getAcquisitions(dayKey: string): Promise<AcquisitionsData> {
  return adaptAcquisitions(getMockData(dayKey), dayKey);
}
