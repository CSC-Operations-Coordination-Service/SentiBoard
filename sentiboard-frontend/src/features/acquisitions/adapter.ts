import { meanCompleteness } from "./model";
import type { AcqDatatake, AcqLevel, AcquisitionsData, Station } from "./types";

export type RawAcqDatatake = Omit<AcqDatatake, "comp" | "cls"> & { levels: AcqLevel[] };

export function adaptAcquisitions(
  raw: { datatakes: RawAcqDatatake[]; stations: Station[] },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _dayKey: string, // reserved for server-side filtering in Slice 7
): AcquisitionsData {
  return {
    datatakes: raw.datatakes.map((spec) => {
      const comp = Math.round(meanCompleteness(spec.levels) * 10) / 10;
      const cls: "ok" | "warn" | "crit" = comp >= 95 ? "ok" : comp > 0 ? "warn" : "crit";
      return { ...spec, comp, cls };
    }),
    stations: raw.stations,
  };
}
