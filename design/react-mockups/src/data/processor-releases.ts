/* Copernicus Sentinel processor releases — the shared fixture behind every Processors proposal.
   Lives in src/data (not inside one proposal's folder) because three concepts read it and a
   side-by-side comparison is worthless if they disagree about the data:

     · /examples/version-matrix  — grid of processors × baselines
     · /examples/release-log     — reverse-chronological feed of release notes
     · /processors               — the release timeline

   The releases are authored in the SHAPE THE UPSTREAM FEED USES, exactly as the timeline concept's
   fixture is (frontend/lib/data.ts → MOCK_RELEASES). The fields are the ones the feed actually
   carries, which is also the set the legacy operations viewer reads
   (apps/static/assets/js/processors-releases/processors-viewer.js):

       mission · target_ipfs · validity_start_date · processing_baseline · satellite_units · release_notes

   THERE IS NO STATUS FIELD. A release is a baseline version, a release date and some release notes;
   nothing upstream says "active", "in validation" or "deprecated", and neither does the legacy
   viewer. So nothing here invents one. This module parses and joins, and stops there — anything a
   proposal wants to conclude from the dates (which baseline is in force, how long it has held) is
   that proposal's own derivation, layered on top, not a field pretending to be data.

   One consequence worth stating: processors are one-to-one with IPF keys, because that is how the
   feed keys releases. Sensor modes that share a processor share its baselines exactly — S1's IW, EW,
   SM and WV products all come from S1_L1L2 — so they are one entry listing those products, not four
   identical ones. */

export type MissionId = "1" | "2" | "3" | "5P";

export const MISSION_NAMES: Record<MissionId, string> = {
  "1": "Sentinel-1",
  "2": "Sentinel-2",
  "3": "Sentinel-3",
  "5P": "Sentinel-5P",
};
export const MISSION_ORDER: MissionId[] = ["1", "2", "3", "5P"];

/** One release as the feed carries it, joined to the processor it targets. No derived fields. */
export interface ReleaseRecord {
  mission: MissionId;
  /** The feed's IPF key — what the release is keyed on. */
  ipf: string;
  /** Processor label, e.g. "S1 SAR L1/L2". */
  label: string;
  /** Gloss: the products this processor produces. */
  sub: string;
  /** "S1 L1L2" — the processor code, named as the timeline names it. */
  proc: string;
  /** The baseline version / tag. */
  baseline: string;
  /** Release date in ms — the ordering key. */
  ms: number;
  /** Release date, telemetry readout: "2026-06-16T00:00Z". */
  iso: string;
  /** Release date, month-year: "Jun 2026". */
  from: string;
  /** Release date, full day: "16 Jun 2026". */
  day: string;
  /** Satellite units the release applies to, e.g. ["S1A","S1C","S1D"]. */
  sats: string[];
  /** Release notes, flattened from the feed's HTML. Absent when the feed carries none. */
  notes?: string;
}

/** A processor and its releases, oldest first. */
export interface ProcessorGroup {
  mission: MissionId;
  ipf: string;
  label: string;
  sub: string;
  releases: ReleaseRecord[];
}

// ---------------------------------------------------------------------------
// The fixture — upstream's own response shape
// ---------------------------------------------------------------------------

interface RawRelease {
  mission: string;
  satellite_units: string[] | string;
  target_ipfs: string[];
  validity_start_date: string;
  release_notes: string;
}

const RELEASES: RawRelease[] = [
  // ---- Sentinel-1 ---------------------------------------------------------
  { mission: "S1", satellite_units: ["S1A"], target_ipfs: ["S1_L0:001.00"], validity_start_date: "18/01/2023", release_notes: "<p>First Level-0 baseline of the routine phase.</p>" },
  { mission: "S1", satellite_units: ["S1A", "S1C"], target_ipfs: ["S1_L0:001.02"], validity_start_date: "09/04/2024", release_notes: "<p>Annotation fixes for the extended orbit set.</p>" },
  { mission: "S1", satellite_units: ["S1A", "S1C", "S1D"], target_ipfs: ["S1_L0:001.03"], validity_start_date: "12/08/2025", release_notes: "<p>Improved downlink packet handling.</p>" },

  { mission: "S1", satellite_units: "S1A", target_ipfs: ["S1_L1L2:003.40"], validity_start_date: "06/09/2022", release_notes: "<p>Extended-timeliness SLC support; revised noise vectors for the wide-swath modes.</p>" },
  // The two standing lines below recur across this processor's baselines, as they do in the real
  // notes: every baseline restates its auxiliary-data and reprocessing position. They are the reason
  // the "Version compare" proposal has anything to hold constant — a line diff of two baselines whose
  // notes share nothing can only report "wholly rewritten", which is true but useless.
  { mission: "S1", satellite_units: "S1A", target_ipfs: ["S1_L1L2:003.52"], validity_start_date: "14/03/2023", release_notes: "<p>Radiometric calibration update for SLC and GRD. Azimuth geolocation corrected over high terrain.</p><p>Auxiliary data files are updated in step with this baseline.</p><p>No bulk reprocessing of the archive is planned.</p>" },
  { mission: "S1", satellite_units: "S1A, S1C", target_ipfs: ["S1_L1L2:003.61"], validity_start_date: "11/06/2024", release_notes: "<p>Revised OCN wind retrieval; DEM refresh.</p><p>Auxiliary data files are updated in step with this baseline.</p><p>No bulk reprocessing of the archive is planned.</p>" },
  // A longer, multi-paragraph note with a bullet list — the release log is the concept that has to
  // render these in full, so the fixture has to contain at least one of them.
  { mission: "S1", satellite_units: ["S1A", "S1C", "S1D"], target_ipfs: ["S1_L1L2:003.71"], validity_start_date: "16/06/2026", release_notes: "<p>Absolute geolocation improvement across SLC, GRD and OCN, and the first baseline to cover S1D alongside S1A and S1C.</p><ul><li>Thermal-noise removal reworked for the wide-swath modes; residual scalloping in EW sub-swath 1 reduced by roughly a factor of three.</li><li>Denoising vectors regenerated against the current instrument characterisation.</li><li>OCN wind retrieval now uses the updated GMF, changing wind speed by up to 0.3 m/s in the 4-12 m/s range.</li></ul><p>Products generated under 003.61 remain valid.</p><p>Auxiliary data files are updated in step with this baseline.</p>" },

  // A release the feed carries no notes for at all — real, and reported as such rather than hidden.
  { mission: "S1", satellite_units: ["S1A"], target_ipfs: ["S1_SETAP:001.04"], validity_start_date: "05/09/2023", release_notes: "" },
  { mission: "S1", satellite_units: ["S1A", "S1C"], target_ipfs: ["S1_SETAP:001.06"], validity_start_date: "18/02/2025", release_notes: "<p>Auxiliary set-up parameter refresh.</p>" },

  // ---- Sentinel-2 ---------------------------------------------------------
  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L0:06.03"], validity_start_date: "24/01/2023", release_notes: "" },
  // One release, two target IPFs — the fan-out the real feed does for paired S2 packages. The log
  // shows it as two entries on the same date, because it targets two processors.
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L0:06.05", "S2_L1:06.05"], validity_start_date: "04/02/2026", release_notes: "<p>TLM marker in JP2K; antemeridian nodata fix.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L1:05.09"], validity_start_date: "24/01/2023", release_notes: "<p>Geometric refinement using the global reference image.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L1:05.11"], validity_start_date: "11/03/2025", release_notes: "<p>Cloud mask and radiometric offset update.</p>" },

  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L2:05.09"], validity_start_date: "07/02/2023", release_notes: "<p>Sen2Cor 2.10 atmospheric correction.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L2:05.11"], validity_start_date: "11/03/2025", release_notes: "<p>Sen2Cor atmospheric correction update; aerosol optical thickness revised over bright surfaces.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L2:06.05"], validity_start_date: "04/02/2026", release_notes: "<p>Sen2Cor 3.0 — a new aerosol inversion and a per-scene water-vapour retrieval.</p><ul><li>Surface reflectance over vegetated and urban targets agrees with 05.11 to within 0.005.</li><li>Bright-target scenes (desert, salt flat, fresh snow) change by up to 0.02 in the blue bands.</li></ul>" },

  // ---- Sentinel-3 ---------------------------------------------------------
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL1:OL_06.10"], validity_start_date: "16/05/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL1:OL_07.01"], validity_start_date: "24/09/2024", release_notes: "<p>OLCI radiometric characterisation update.</p>" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL2:OL_06.10"], validity_start_date: "16/05/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL2:OL_07.01"], validity_start_date: "24/09/2024", release_notes: "<p>Water and land colour retrieval aligned to the L1 characterisation.</p>" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL2:OL_07.02"], validity_start_date: "02/06/2026", release_notes: "<p>Revised chlorophyll-a algorithm for Case-2 coastal and inland water. Open-ocean products agree with OL_07.01 to within 2%.</p>" },

  { mission: "S3", satellite_units: ["S3A"], target_ipfs: ["S3_SL1:SL_06.08"], validity_start_date: "11/07/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SL1:SL_07.00"], validity_start_date: "04/11/2025", release_notes: "<p>SLSTR geolocation and cloud flag improvements.</p>" },
  { mission: "S3", satellite_units: ["S3A"], target_ipfs: ["S3_SL2_LST:SL_06.08"], validity_start_date: "11/07/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SL2_LST:SL_07.00"], validity_start_date: "04/11/2025", release_notes: "<p>Land surface temperature split-window coefficients refreshed.</p>" },

  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SR1:SR_06.20"], validity_start_date: "09/03/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SR1:SR_07.00"], validity_start_date: "21/01/2026", release_notes: "<p>SAR-mode retracking update for the altimeter.</p>" },
  // S3_SR2 is deliberately absent from this list. It is on the roster below, so it is a processor
  // with no baselines — "tracked, nothing published" — which the timeline shows as an empty lane,
  // the matrix as an empty row, and the log by simply having no entries for it.

  // ---- Sentinel-5P --------------------------------------------------------
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L1B:02.01"], validity_start_date: "20/06/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L1B:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Irradiance degradation correction extended to the full mission archive.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_NO2:02.04"], validity_start_date: "14/11/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_NO2:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Tropospheric NO2 air-mass factor revision.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2O3_OFFL:02.04"], validity_start_date: "14/11/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2O3_OFFL:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Total ozone column reprocessed with the revised slant-column fit.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_CH4:02.04"], validity_start_date: "14/11/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_CH4:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Methane bias correction over low-albedo scenes.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_CH4:02.07"], validity_start_date: "14/07/2026", release_notes: "<p>Physics-based surface-albedo retrieval replacing the climatology.</p><ul><li>Bias against the TCCON ground network falls from 4.3 ppb to 1.1 ppb.</li><li>Scenes over snow and ice are no longer filtered out by the albedo pre-screen.</li></ul>" },
];

/* The display roster: which processors exist and in what order they read, in the processing-chain
   order the operations viewer uses (Level-0 first, then the sensor products) rather than the
   alphabet. One entry per IPF key — `sub` names the products, so an entry covering several sensor
   modes says so. An entry here with no releases in the feed still exists as a processor. */
const ROSTER: { mission: MissionId; ipf: string; label: string; sub: string }[] = [
  { mission: "1", ipf: "S1_L0", label: "S1 L0", sub: "Level-0 · RAW" },
  { mission: "1", ipf: "S1_L1L2", label: "S1 SAR L1/L2", sub: "SLC · GRD · OCN · all modes" },
  { mission: "1", ipf: "S1_SETAP", label: "S1 SETAP", sub: "Set-up auxiliary" },
  { mission: "2", ipf: "S2_L0", label: "S2 MSI L0", sub: "Level-0" },
  { mission: "2", ipf: "S2_L1", label: "S2 MSI L1C", sub: "Top-of-atmosphere reflectance" },
  { mission: "2", ipf: "S2_L2", label: "S2 MSI L2A", sub: "Surface reflectance" },
  { mission: "3", ipf: "S3_OL1", label: "S3 OLCI L1", sub: "OLCI radiance" },
  { mission: "3", ipf: "S3_OL2", label: "S3 OLCI L2", sub: "OLCI water · land colour" },
  { mission: "3", ipf: "S3_SL1", label: "S3 SLSTR L1", sub: "SLSTR radiance · BT" },
  { mission: "3", ipf: "S3_SL2_LST", label: "S3 SLSTR L2", sub: "Land surface temperature" },
  { mission: "3", ipf: "S3_SR1", label: "S3 SRAL L1", sub: "Altimeter waveforms" },
  { mission: "3", ipf: "S3_SR2", label: "S3 SRAL L2", sub: "Altimeter geophysical" },
  { mission: "5P", ipf: "S5P_L1B", label: "S5P TROPOMI L1B", sub: "Radiance · irradiance" },
  { mission: "5P", ipf: "S5P_L2_NO2", label: "S5P TROPOMI NO2", sub: "Nitrogen dioxide" },
  { mission: "5P", ipf: "S5P_L2O3_OFFL", label: "S5P TROPOMI O3", sub: "Total ozone column" },
  { mission: "5P", ipf: "S5P_L2_CH4", label: "S5P TROPOMI CH4", sub: "Methane" },
];

// ---------------------------------------------------------------------------
// Formatting and parsing
// ---------------------------------------------------------------------------

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Copernicus baseline dates are dd/MM/yyyy; convert so new Date() parses them UTC-correctly. */
function ddmmyyyyToISO(v: string): string {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v.trim();
}

/** Telemetry-style readout: 2026-07-24T00:00Z */
function isoUtc(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : `${d.toISOString().slice(0, 16)}Z`;
}

/** "Jun 2026" */
export function fmtMonthYear(v: string | number): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "16 Jun 2026" */
export function fmtDay(v: string | number): string {
  const d = new Date(v);
  return isNaN(d.getTime())
    ? String(v)
    : `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Release notes arrive as small HTML fragments — flatten to text rather than injecting markup. */
function stripHtml(v: string): string {
  return v
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** `satellite_units` arrives as an array, a bare string, or a comma-joined string. Flatten all three. */
function normSats(v: string[] | string): string[] {
  const parts = (Array.isArray(v) ? v : [v]).flatMap((x) => String(x ?? "").split(","));
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
}

/** Processor codes drop the mission prefix a group label already carries: "S1_L1L2" → "L1L2". */
export function ipfLabel(ipf: string): string {
  return ipf.replace(/^S(?:1|2|3|5P)_/, "");
}

/** Whole months between two instants, floored. */
export function monthsBetween(a: number, b: number): number {
  const x = new Date(a);
  const y = new Date(b);
  let m = (y.getUTCFullYear() - x.getUTCFullYear()) * 12 + (y.getUTCMonth() - x.getUTCMonth());
  if (y.getUTCDate() < x.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

/** "7 MO" / "3 YR" / "2 YR 4 MO" — compact enough for a cell or a counter. */
export function ageLabel(months: number): string {
  if (months < 1) return "<1 MO";
  if (months < 24) return `${months} MO`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} YR ${m} MO` : `${y} YR`;
}

// ---------------------------------------------------------------------------
// The parsed data every proposal starts from
// ---------------------------------------------------------------------------

/** Walk the roster and attach each processor's releases, oldest first. */
function build(): ProcessorGroup[] {
  const byIpf = new Map<string, { baseline: string; start: string; notes: string; sats: string[] }[]>();
  for (const r of RELEASES) {
    const sats = normSats(r.satellite_units);
    const notes = stripHtml(r.release_notes);
    for (const target of r.target_ipfs) {
      // target_ipfs entries look like "S1_L1L2:003.71" — key before ':', baseline after it.
      const [ipf, ver] = target.split(":");
      if (!ipf) continue;
      byIpf.set(ipf, [
        ...(byIpf.get(ipf) ?? []),
        { baseline: (ver ?? "").trim() || "—", start: ddmmyyyyToISO(r.validity_start_date), notes, sats },
      ]);
    }
  }

  const at = (v: string) => new Date(v).getTime();

  return ROSTER.map((slot) => ({
    ...slot,
    releases: (byIpf.get(slot.ipf) ?? [])
      .filter((r) => !isNaN(at(r.start)))
      .sort((a, b) => at(a.start) - at(b.start))
      .map<ReleaseRecord>((rel) => ({
        mission: slot.mission,
        ipf: slot.ipf,
        label: slot.label,
        sub: slot.sub,
        proc: `S${slot.mission} ${ipfLabel(slot.ipf)}`,
        baseline: rel.baseline,
        ms: at(rel.start),
        iso: isoUtc(rel.start),
        from: fmtMonthYear(rel.start),
        day: fmtDay(rel.start),
        sats: rel.sats,
        notes: rel.notes || undefined,
      })),
  }));
}

/** Every processor on the roster, in processing-chain order, each with its releases oldest first. */
export const PROCESSOR_GROUPS: ProcessorGroup[] = build();

/** Every release, flattened and ordered newest first — what a chronological reading starts from.
 *  Ties are broken by roster order, so releases sharing a date read down the processing chain
 *  rather than in whatever order the feed happened to list them. */
export const RELEASE_FEED: ReleaseRecord[] = PROCESSOR_GROUPS.flatMap((g) => g.releases)
  .map((r, i) => ({ r, i }))
  .sort((a, b) => b.r.ms - a.r.ms || a.i - b.i)
  .map(({ r }) => r);
