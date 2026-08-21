/* ============================================================================
   MOCK ONLY — downlink passes per datatake.
   ============================================================================
   This file is deliberately isolated from data/mock.ts because it is the one part
   of the datatake rail that the backend CANNOT currently feed.

   What exists today (see apps/utils/acquisitions_utils.py, build_downlink_passes):
     payload["downlink_passes"][station][satellite] = [ raw_pass, ... ]
   and a raw pass carries only:
     ground_station, satellite_id, antenna_status, delivery_push_status,
     front_end_status, cams_origin

   What this block needs and the backend does not have:
     1. a join from a DATATAKE to the passes that downlinked it — the existing
        index is keyed (station, satellite), not datatake;
     2. a downlinked VOLUME per pass — `content_length` exists on published
        products (apps/elastic/modules/publication.py, archive_statistics.py) but
        is not attributed to a pass;
     3. a downlink DURATION per pass.

   TO WIRE UP FOR REAL: keep `DownlinkPass` and `passesFor()` as the contract and
   replace the body of `passesFor()` with the API call. Nothing outside this file
   knows where the data came from, and no component imports DOWNLINK_PASSES
   directly. Volumes and durations below are invented and are not measurements.
   ============================================================================ */

export interface DownlinkPass {
  /** Short station code, as the acquisition service reports it. */
  station: string;
  /** Human station name, matching data/mock.ts STATIONS. */
  stationName: string;
  /** Acquisition (pass) start, ISO 8601 UTC. */
  atIso: string;
  /** Downlinked volume, megabits. */
  volumeMb: number;
  /** Downlink duration, seconds. */
  durationS: number;
}

/** Keyed by datatake id — the join the backend does not yet provide. */
const DOWNLINK_PASSES: Record<string, DownlinkPass[]> = {
  "S2A-48201-1": [
    { station: "SGS", stationName: "Svalbard", atIso: "2026-07-16T11:02:14Z", volumeMb: 18_400, durationS: 41 },
  ],
  "S1A-57622": [
    { station: "MTI", stationName: "Matera", atIso: "2026-07-16T09:58:07Z", volumeMb: 23_200, durationS: 36 },
    { station: "SGS", stationName: "Svalbard", atIso: "2026-07-16T10:44:52Z", volumeMb: 9_850, durationS: 17 },
  ],
  "S3B-080-345": [
    { station: "MSP", stationName: "Maspalomas", atIso: "2026-07-16T08:37:20Z", volumeMb: 31_600, durationS: 58 },
  ],
  "S2B-42050-1": [
    { station: "INU", stationName: "Inuvik", atIso: "2026-07-16T07:41:33Z", volumeMb: 17_900, durationS: 39 },
  ],
  "S5P-60012": [
    { station: "NSG", stationName: "Neustrelitz", atIso: "2026-07-16T06:52:41Z", volumeMb: 4_120, durationS: 12 },
    { station: "SGS", stationName: "Svalbard", atIso: "2026-07-16T07:35:09Z", volumeMb: 3_780, durationS: 11 },
  ],
  // The failed datatake downlinked nothing — an empty list is a real state the
  // rail has to render, not a missing key.
  "S3A-055-358": [],
};

/**
 * Passes that downlinked a datatake, earliest first. Returns [] when there is no
 * entry, which the rail renders as "no passes recorded" — the same thing it will
 * show for a datatake the real API has no passes for.
 */
export function passesFor(datatakeId: string): DownlinkPass[] {
  return (DOWNLINK_PASSES[datatakeId] ?? []).slice().sort((a, b) => a.atIso.localeCompare(b.atIso));
}
