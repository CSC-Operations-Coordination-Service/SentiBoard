/* The Processors UI model, shared by the server (adapter, release list) and the client (explorer,
   timeline). Ported from the prototype's src/data/processor-releases.ts without its fixture data.

   The feed has NO STATUS FIELD: a release is a baseline version, its dates, the satellites and some
   release notes. "Current baseline" is derived from the validity dates by the adapter
   (currentBaselineIndex in ./adapter.ts) and nowhere else. */

export type MissionId = "1" | "2" | "3" | "5P";

export const MISSION_NAMES: Record<MissionId, string> = {
  "1": "Sentinel-1",
  "2": "Sentinel-2",
  "3": "Sentinel-3",
  "5P": "Sentinel-5P",
};
export const MISSION_ORDER: MissionId[] = ["1", "2", "3", "5P"];

/** One release as the timeline shows it: one feed record on one target IPF's lane. */
export interface ReleaseRecord {
  /** `<record id>:<IPF>` — unique per (feed record × target IPF): a tag can recur on one IPF. */
  id: string;
  /** The baseline version / tag. */
  baseline: string;
  /** validity_start_date (or release_date) in ms — the lane position and ordering key. */
  ms: number;
  /** Satellite units the release applies to, e.g. ["S1A","S1C","S1D"]. */
  sats: string[];
  /** Key of this release's notes in ProcessorNotes. Absent when the feed has none. One feed record
   *  sits on several lanes, so its notes are sent once, not once per lane. */
  notesId?: string;
  /** The tooltip's "Changes" line, precomputed on the server from the notes. */
  changes: string;
  /** The feed's processing_baseline, e.g. "3.37". Absent when null. */
  processingBaseline?: string;
  /** Publication date (the feed's release_date) in ms, when the feed carries one. */
  releasedMs?: number;
  /** Whether this is the processor's baseline in force (the adapter's current-baseline rule). */
  isCurrent: boolean;
}

/** Release notes by ReleaseRecord.notesId, SANITIZED on the server (src/lib/sanitize-html.ts). */
export type ProcessorNotes = Record<string, string>;

/** A processor (one IPF key) and its releases, oldest first. */
export interface ProcessorGroup {
  mission: MissionId;
  ipf: string;
  label: string;
  /** Gloss: the products this processor produces. */
  sub: string;
  releases: ReleaseRecord[];
}

/* The display roster: which processors exist and in what order they read, in the processing-chain
   order the operations viewer uses (Level-0 first, then the sensor products) rather than the
   alphabet. One entry per IPF key — `sub` names the products. */
export const ROSTER: { mission: MissionId; ipf: string; label: string; sub: string }[] = [
  { mission: "1", ipf: "S1_L0", label: "S1 L0", sub: "Level-0 · RAW" },
  { mission: "1", ipf: "S1_L1L2", label: "L1L2", sub: "SLC · GRD · OCN · all modes" },
  { mission: "1", ipf: "S1_SETAP", label: "SETAP", sub: "Set-up auxiliary" },
  { mission: "2", ipf: "S2_L0", label: "L0", sub: "Level-0" },
  { mission: "2", ipf: "S2_L1", label: "L1", sub: "Top-of-atmosphere reflectance" },
  { mission: "2", ipf: "S2_L2", label: "L2", sub: "Surface reflectance" },
  { mission: "2", ipf: "S2_EUP", label: "EUP", sub: "End User Product" },
  { mission: "3", ipf: "S3_PUG", label: "S3 PUG", sub: "Product User Guide" },
  { mission: "3", ipf: "S3_L0", label: "S3 L0", sub: "Level-0 Processor" },
  { mission: "3", ipf: "S3_OL1", label: "S3 OL1", sub: "OLCI radiance" },
  { mission: "3", ipf: "S3_OL1_RAC", label: "S3 OL1_RAC", sub: "OLCI Radiometric Calibration" },
  { mission: "3", ipf: "S3_OL1_SPC", label: "S3 OL1_SPC", sub: "OLCI Spectral Calibration" },
  { mission: "3", ipf: "S3_OL2", label: "S3 OL2", sub: "OLCI water · land colour" },
  { mission: "3", ipf: "S3_SL1", label: "S3 SL1", sub: "SLSTR radiance · BT" },
  { mission: "3", ipf: "S3_SL2", label: "S3 SL2", sub: "Land surface temperature" },
  { mission: "3", ipf: "S3_SL2_LST", label: "S3 SL2_LST", sub: "Land surface temperature" },
  { mission: "3", ipf: "S3_SL2_FRP", label: "S3 SL2_FRP", sub: "Fire Radiative Power" },
  { mission: "3", ipf: "S3_SR1", label: "S3 SR1", sub: "Level-1 radar altimetry" },
  { mission: "3", ipf: "S3_SR2", label: "S3 SR2", sub: "Level-2 radar altimetry geophysical" },
  { mission: "3", ipf: "S3_SM2", label: "S3 SM2_HY", sub: "Surface Measurement 2" },
  { mission: "3", ipf: "S3_SM2_LI", label: "S3 SM2_LI", sub: "Surface Measurement 2 Land Ice" },
  { mission: "3", ipf: "S3_SM2_SI", label: "S3 SM2_SI", sub: "Surface Measurement 2 Sea Ice" },
  { mission: "3", ipf: "S3_MW1", label: "S3 MW1", sub: "Microwave Radiometer" },
  { mission: "3", ipf: "S3_SY2", label: "S3 SY2", sub: "SYNERGY Level-2" },
  { mission: "3", ipf: "S3_SY2_AOD", label: "S3 SY2_AOD", sub: "SYNERGY Level-2 Aerosol Optical Depth" },
  { mission: "3", ipf: "S3_SY2_VGS", label: "S3 SY2_VGS", sub: "SYNERGY Level-2 Vegetation Synthesis " },
  { mission: "3", ipf: "S3_SY2_VGP", label: "S3 SY2_VGP", sub: "SYNERGY Level-2 SPOT VEGETATION Continuity Product" },
  { mission: "5P", ipf: "S5P_L1B", label: "S5P L1B", sub: "Radiance · irradiance" },
  { mission: "5P", ipf: "S5P_L2_NO2", label: "S5P NO2", sub: "Nitrogen dioxide" },
  { mission: "5P", ipf: "S5P_L2O3_OFFL", label: "S5P SNPP_CLOUD", sub: "Total ozone column" },
];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Processor codes drop the mission prefix a group label already carries: "S1_L1L2" → "L1L2". */
export function ipfLabel(ipf: string): string {
  return ipf.replace(/^S(?:1|2|3|5P)_/, "");
}

/** "S1 SAR L1/L2" → "SAR L1/L2": the lane names drop the mission prefix the page already shows. */
export function laneName(label: string): string {
  return label.replace(/^S(?:1|2|3|5P)\s+/, "");
}

/** "5 February 2026" */
export function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-02-05" */
export function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
