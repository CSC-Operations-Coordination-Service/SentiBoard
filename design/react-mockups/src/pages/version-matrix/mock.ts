/* Processors proposal 2 — "Version matrix". Mock release data.

   The releases below are authored in the SHAPE THE UPSTREAM FEED USES, exactly as the timeline
   concept's fixture is (frontend/lib/data.ts → MOCK_RELEASES). The fields are the ones the feed
   actually carries, which is also the set the legacy operations viewer reads
   (apps/static/assets/js/processors-releases/processors-viewer.js):

       mission · target_ipfs · validity_start_date · processing_baseline · satellite_units · release_notes

   THERE IS NO STATUS FIELD. A release is a baseline version, a release date and some release notes;
   nothing upstream says "active", "in validation" or "deprecated", and neither does the legacy
   viewer. So nothing here invents one. The only lifecycle distinction this file makes is the one the
   dates already imply, and it is the same one the timeline derives: for each row, the most recent
   release is the baseline in force, and every earlier release has been superseded by a later one.
   `kind: "cur" | "old"` carries that, named as the timeline names it.

   Everything else the matrix shows is likewise read or computed from the three real fields:

     · the release DATE, shown per cell and used to order the sequence;
     · how long a baseline has been (or was) in force — its own date to its successor's date, or to
       now for the newest. Note this is derived from the SUCCESSOR's release date, not from a
       validity-end field: the feed's end dates are not what the legacy viewer reads, and the day a
       replacement shipped is the day this baseline stopped being current;
     · the release NOTES, shown as the changelog, with their absence reported rather than hidden;
     · the baseline VERSION and the satellite units it applies to.

   One consequence worth stating: rows are one-to-one with IPF keys, because that is how the feed
   keys releases. Sensor modes that share a processor share its baselines exactly — S1's IW, EW, SM
   and WV products all come from S1_L1L2 — so they are one row listing those products, not four
   identical ones. */

export type MissionId = "1" | "2" | "3" | "5P";

/** Derived from release-date ordering, not from any field. Named as the timeline names it. */
export type RelKind = "cur" | "old";

/** One baseline, after parsing. The fields the feed carries, plus what the dates imply. */
export interface Release {
  /** "S1 L1L2" — the processor, named as the timeline names it. */
  proc: string;
  /** The baseline version / tag. */
  baseline: string;
  /** The baseline this one replaced, or "—" for a row's first record. */
  prev: string;
  /** The baseline that replaced this one, or null while it is the newest on record. */
  next: string | null;
  /** Release date: month-year readout, e.g. "Jun 2024". */
  from: string;
  /** Release date: telemetry readout, e.g. "2024-06-11T00:00Z". */
  iso: string;
  /** Release date in ms — the ordering key, and the start of this baseline's time in force. */
  ms: number;
  /** When the successor shipped, i.e. when this baseline stopped being current. Null for the newest. */
  untilMs: number | null;
  /** Whole months this baseline has been, or was, the one in force. */
  months: number;
  /** The newest release on record for its row, by release date. */
  kind: RelKind;
  /** Satellite units the release applies to, e.g. ["S1A","S1C","S1D"]. */
  sats: string[];
  /** Release notes, flattened from the feed's HTML. Absent when the feed carries none. */
  notes?: string;
}

/** One row of the matrix: a processor and its baselines, oldest first. */
export interface MatrixRow {
  mission: MissionId;
  /** The feed's IPF key — what the row's releases are keyed on. */
  ipf: string;
  /** Row label, e.g. "S1 SAR L1/L2". */
  label: string;
  /** Gloss under the label: the products this processor produces. */
  sub: string;
  releases: Release[];
}

/** A mission and the processor rows beneath it — the matrix's row groups. */
export interface MatrixMission {
  id: MissionId;
  name: string;
  rows: MatrixRow[];
}

export const MISSION_NAMES: Record<MissionId, string> = {
  "1": "Sentinel-1",
  "2": "Sentinel-2",
  "3": "Sentinel-3",
  "5P": "Sentinel-5P",
};
export const MISSION_ORDER: MissionId[] = ["1", "2", "3", "5P"];

/* Two treatments, because the dates support exactly two. Both come from the shared token set
   (tokens.css → --bl-*), which is theme-tuned: these also colour 9.5px label text on a cell tinted
   with the same hue, and the dark-theme values do not survive that on white. */
export const KIND_COLOR: Record<RelKind, string> = {
  cur: "var(--bl-current)",
  old: "var(--bl-past)",
};

export const KIND_LABEL: Record<RelKind, string> = {
  cur: "In force",
  old: "Superseded",
};

/** Legend order: what is running first. */
export const KIND_ORDER: RelKind[] = ["cur", "old"];

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
  { mission: "S1", satellite_units: "S1A", target_ipfs: ["S1_L1L2:003.52"], validity_start_date: "14/03/2023", release_notes: "<p>Radiometric calibration update for SLC and GRD. Azimuth geolocation corrected over high terrain.</p>" },
  { mission: "S1", satellite_units: "S1A, S1C", target_ipfs: ["S1_L1L2:003.61"], validity_start_date: "11/06/2024", release_notes: "<p>Revised OCN wind retrieval; DEM refresh.</p>" },
  { mission: "S1", satellite_units: ["S1A", "S1C", "S1D"], target_ipfs: ["S1_L1L2:003.71"], validity_start_date: "16/06/2026", release_notes: "<p>Absolute geolocation improvement across SLC, GRD and OCN. Thermal-noise removal reworked for the wide-swath modes.</p>" },

  // A release the feed carries no notes for at all — real, and reported as such rather than hidden.
  { mission: "S1", satellite_units: ["S1A"], target_ipfs: ["S1_SETAP:001.04"], validity_start_date: "05/09/2023", release_notes: "" },
  { mission: "S1", satellite_units: ["S1A", "S1C"], target_ipfs: ["S1_SETAP:001.06"], validity_start_date: "18/02/2025", release_notes: "<p>Auxiliary set-up parameter refresh.</p>" },

  // ---- Sentinel-2 ---------------------------------------------------------
  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L0:06.03"], validity_start_date: "24/01/2023", release_notes: "" },
  // One release, two target IPFs — the fan-out the real feed does for paired S2 packages.
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L0:06.05", "S2_L1:06.05"], validity_start_date: "04/02/2026", release_notes: "<p>TLM marker in JP2K; antemeridian nodata fix.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L1:05.09"], validity_start_date: "24/01/2023", release_notes: "<p>Geometric refinement using the global reference image.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L1:05.11"], validity_start_date: "11/03/2025", release_notes: "<p>Cloud mask and radiometric offset update.</p>" },

  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L2:05.09"], validity_start_date: "07/02/2023", release_notes: "<p>Sen2Cor 2.10 atmospheric correction.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L2:05.11"], validity_start_date: "11/03/2025", release_notes: "<p>Sen2Cor atmospheric correction update; aerosol optical thickness revised over bright surfaces.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L2:06.05"], validity_start_date: "04/02/2026", release_notes: "<p>Sen2Cor 3.0 — new aerosol inversion and a per-scene water-vapour retrieval.</p>" },

  // ---- Sentinel-3 ---------------------------------------------------------
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL1:OL_06.10"], validity_start_date: "16/05/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL1:OL_07.01"], validity_start_date: "24/09/2024", release_notes: "<p>OLCI radiometric characterisation update.</p>" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL2:OL_06.10"], validity_start_date: "16/05/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL2:OL_07.01"], validity_start_date: "24/09/2024", release_notes: "<p>Water and land colour retrieval aligned to the L1 characterisation.</p>" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL2:OL_07.02"], validity_start_date: "02/06/2026", release_notes: "<p>Revised chlorophyll-a algorithm for Case-2 coastal and inland water.</p>" },

  { mission: "S3", satellite_units: ["S3A"], target_ipfs: ["S3_SL1:SL_06.08"], validity_start_date: "11/07/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SL1:SL_07.00"], validity_start_date: "04/11/2025", release_notes: "<p>SLSTR geolocation and cloud flag improvements.</p>" },
  { mission: "S3", satellite_units: ["S3A"], target_ipfs: ["S3_SL2_LST:SL_06.08"], validity_start_date: "11/07/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SL2_LST:SL_07.00"], validity_start_date: "04/11/2025", release_notes: "<p>Land surface temperature split-window coefficients refreshed.</p>" },

  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SR1:SR_06.20"], validity_start_date: "09/03/2023", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SR1:SR_07.00"], validity_start_date: "21/01/2026", release_notes: "<p>SAR-mode retracking update for the altimeter.</p>" },
  // S3_SR2 is deliberately absent from this list. It is on the roster below, so it gets a row with
  // no baselines — "tracked, nothing published" — which is what the timeline shows as an empty lane.

  // ---- Sentinel-5P --------------------------------------------------------
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L1B:02.01"], validity_start_date: "20/06/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L1B:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Irradiance degradation correction extended to the full mission archive.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_NO2:02.04"], validity_start_date: "14/11/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_NO2:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Tropospheric NO2 air-mass factor revision.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2O3_OFFL:02.04"], validity_start_date: "14/11/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2O3_OFFL:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Total ozone column reprocessed with the revised slant-column fit.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_CH4:02.04"], validity_start_date: "14/11/2023", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_CH4:02.06"], validity_start_date: "25/02/2025", release_notes: "<p>Methane bias correction over low-albedo scenes.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_CH4:02.07"], validity_start_date: "14/07/2026", release_notes: "<p>Physics-based surface-albedo retrieval replacing the climatology.</p>" },
];

/* The display roster: which rows exist and in what order they read, in the processing-chain order
   the operations viewer uses (Level-0 first, then the sensor products) rather than the alphabet.
   One entry per IPF key, since that is how the feed keys releases — `sub` names the products so a
   row that covers several sensor modes says so. A row on this list with no releases in the feed
   still gets a row. */
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
// Parsing — one pass over the fixture, in the shape the feed delivers
// ---------------------------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function fmtMonthYear(v: string | number): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
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

/** Row labels drop the mission prefix the row group already carries: "S1_L1L2" → "L1L2". */
function ipfLabel(ipf: string): string {
  return ipf.replace(/^S(?:1|2|3|5P)_/, "");
}

/** Whole months between two instants, floored — the unit baseline lifetimes read in. */
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

interface ParsedRelease {
  baseline: string;
  start: string;
  notes: string;
  sats: string[];
}

/** Group the fixture by IPF key, fanning out releases that name several targets. */
function parseReleases(list: RawRelease[]): Map<string, ParsedRelease[]> {
  const byIpf = new Map<string, ParsedRelease[]>();
  for (const r of list) {
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
  return byIpf;
}

/** Walk the roster and fill each row with its IPF's releases, oldest first. */
function buildRows(byIpf: Map<string, ParsedRelease[]>, now: number): MatrixRow[] {
  const ms = (v: string) => new Date(v).getTime();

  return ROSTER.map((slot) => {
    const sorted = (byIpf.get(slot.ipf) ?? [])
      .filter((r) => !isNaN(ms(r.start)))
      .sort((a, b) => ms(a.start) - ms(b.start));

    /* The baseline in force is the most recently RELEASED one. Not blindly the last element: a feed
       that announces a baseline ahead of its release date would otherwise show something that is not
       running yet as the one that is. Nothing in this fixture is future-dated, so this is defensive
       rather than load-bearing — but it is the difference between reading the date and assuming it. */
    let curIdx = -1;
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (ms(sorted[i].start) <= now) { curIdx = i; break; }
    }

    const proc = `S${slot.mission} ${ipfLabel(slot.ipf)}`;

    const releases: Release[] = sorted.map((rel, i) => {
      const startMs = ms(rel.start);
      const successor = sorted[i + 1];
      // A baseline's time in force ends when its replacement shipped, and runs to now for the newest.
      const untilMs = successor ? ms(successor.start) : null;
      return {
        proc,
        baseline: rel.baseline,
        prev: sorted[i - 1]?.baseline ?? "—",
        next: successor?.baseline ?? null,
        from: fmtMonthYear(rel.start),
        iso: isoUtc(rel.start),
        ms: startMs,
        untilMs,
        months: monthsBetween(startMs, untilMs ?? now),
        kind: i === curIdx ? "cur" : "old",
        sats: rel.sats,
        notes: rel.notes || undefined,
      };
    });

    return { mission: slot.mission, ipf: slot.ipf, label: slot.label, sub: slot.sub, releases };
  });
}

const NOW = Date.now();

export const ROWS: MatrixRow[] = buildRows(parseReleases(RELEASES), NOW);

/** Group rows into mission blocks, dropping empty missions and keeping S1 → S5P order. */
export function groupByMission(rows: MatrixRow[]): MatrixMission[] {
  return MISSION_ORDER.map((id) => ({
    id,
    name: MISSION_NAMES[id],
    rows: rows.filter((r) => r.mission === id),
  })).filter((g) => g.rows.length > 0);
}

/** The baseline a row is running: its most recently released one. Null when it has none on record. */
export function currentOf(row: MatrixRow): Release | null {
  return row.releases.find((r) => r.kind === "cur") ?? null;
}

/** The longest release history among the given rows — the matrix's column count. */
export function depthOf(rows: MatrixRow[]): number {
  return rows.reduce((n, r) => Math.max(n, r.releases.length), 0);
}

/** How long a row's current baseline has been in force, in months. Null when nothing is on record. */
export function monthsInForce(row: MatrixRow): number | null {
  return currentOf(row)?.months ?? null;
}

/** A year without a new baseline. Not a fault — just the number worth surfacing when the whole
 *  point of the collapsed view is "what is each sensor running, and how old is it". */
export const STALE_MONTHS = 12;

/** Aggregates for the counters. Every figure here is read off dates, versions or notes. */
export function tally(rows: MatrixRow[]) {
  const all = rows.flatMap((r) => r.releases);
  const live = rows.map(currentOf).filter((r): r is Release => r !== null);
  const newest = all.reduce<Release | null>((a, b) => (a === null || b.ms > a.ms ? b : a), null);
  return {
    rows: rows.length,
    baselines: all.length,
    live: live.length,
    /** Most recent release across the whole selection. */
    newest,
    /** Rows whose current baseline predates the staleness threshold. */
    stale: live.filter((r) => r.months >= STALE_MONTHS).length,
    /** The row running the oldest baseline — the headline of the collapsed view. */
    oldest: live.reduce<Release | null>((a, b) => (a === null || b.months > a.months ? b : a), null),
  };
}
