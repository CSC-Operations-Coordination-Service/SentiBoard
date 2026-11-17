import { describe, expect, it } from "vitest";
import { adaptDatatakes, missionOf, toDatatake, type ApiDatatake } from "./adapter";

const status = (acq: [string, number], pub: [string, number]): ApiDatatake["completeness_status"] => ({
  acquisition: { status: acq[0] as "ACQUIRED", percentage: acq[1] },
  publication: { status: pub[0] as "PUBLISHED", percentage: pub[1] },
});

function record(over: Partial<ApiDatatake> = {}): ApiDatatake {
  return {
    id: "S1C-84679",
    datatake_id: "84679",
    mission: "S1",
    satellite_unit: "S1C",
    observation_time_start: "2026-11-16T10:00:00Z",
    observation_time_stop: "2026-11-16T10:02:00Z",
    instrument_mode: "IW",
    products: [],
    completeness: { L0: 100, L1: 80 },
    completeness_status: status(["ACQUIRED", 100], ["PUBLISHED", 90.123]),
    cams_tickets: [],
    ...over,
  };
}

describe("missionOf", () => {
  it("maps units to the page's missions", () => {
    expect(missionOf("S1D")).toBe("S1");
    expect(missionOf("S2C")).toBe("S2");
    expect(missionOf("S3B")).toBe("S3");
    expect(missionOf("S5P")).toBe("S5P");
    expect(missionOf("S6A")).toBeNull();
    expect(missionOf(null)).toBeNull();
  });
});

describe("toDatatake", () => {
  it("maps a record to the page model", () => {
    expect(toDatatake(record())).toEqual({
      id: "S1C-84679",
      satellite: "S1C",
      mission: "Sentinel-1",
      missionId: "S1",
      sensorMode: "IW",
      status: "Acquired",
      completeness: 90.12,
      start: new Date("2026-11-16T10:00:00Z"),
      stop: new Date("2026-11-16T10:02:00Z"),
      acq: { status: "ACQUIRED", pct: 100 },
      pub: { status: "PUBLISHED", pct: 90.12 },
    });
  });

  it("takes the status from the publication side, DELAYED as Processing", () => {
    const st = (pub: string) =>
      toDatatake(record({ completeness_status: status(["ACQUIRED", 100], [pub, 50]) }))!.status;
    expect(st("PUBLISHED")).toBe("Acquired");
    expect(st("PARTIAL")).toBe("Partial");
    expect(st("UNAVAILABLE")).toBe("Unavailable");
    expect(st("PLANNED")).toBe("Planned");
    expect(st("PROCESSING")).toBe("Processing");
    expect(st("DELAYED")).toBe("Processing");
  });

  it("without a status: Processing, completeness 0, no real sides", () => {
    const d = toDatatake(record({ completeness_status: null, instrument_mode: null }))!;
    expect(d).toMatchObject({ status: "Processing", completeness: 0, sensorMode: "" });
    expect(d.acq).toBeUndefined();
  });

  it("skips records it cannot place", () => {
    expect(toDatatake(record({ satellite_unit: null }))).toBeNull();
    expect(toDatatake(record({ satellite_unit: "S6A" }))).toBeNull();
    expect(toDatatake(record({ observation_time_stop: null }))).toBeNull();
    expect(toDatatake(record({ observation_time_start: "nope" }))).toBeNull();
  });
});

describe("adaptDatatakes", () => {
  it("sorts by start and reports the skipped ids", () => {
    const { datatakes, skipped } = adaptDatatakes([
      record({ id: "late", observation_time_start: "2026-11-16T12:00:00Z" }),
      record({ id: "bad", satellite_unit: null }),
      record({ id: "early", observation_time_start: "2026-11-16T08:00:00Z" }),
    ]);
    expect(datatakes.map((d) => d.id)).toEqual(["early", "late"]);
    expect(skipped).toEqual(["bad"]);
  });
});
