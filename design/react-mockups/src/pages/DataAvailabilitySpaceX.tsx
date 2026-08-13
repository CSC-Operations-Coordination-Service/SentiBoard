import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/theme";
import { DEFAULT_PERIOD, PERIODS, PERIOD_LABEL, inPeriod, periodStart, type PeriodId } from "@/data/period";

/* =============================================================================
   DEVOCS-219 — Data Availability, proposal 3: "telemetry console".
   PROPOSAL only — the page it proposes to replace is /availability, untouched.

   A launch-console reading of the same data: hairline rules instead of panels, 2px radii,
   condensed display type for headings and monospace for every identifier, timestamp and
   figure — the rule being that anything a controller would read off a screen is set in mono,
   and anything that labels it is set in the condensed face, uppercase and tracked out.

   PORTED from frontend/components/DataAvailabilitySpaceX.tsx, which is the same file. It
   imports nothing but React, so the port needed only two changes:

   · The theme toggle in the header now drives the APP's theme through useTheme() instead of a
     local useState. Every route here is wrapped in <Nav/> with the global switch, and two
     independent toggles would let the page and the nav above it disagree. The button the brief
     asked for stays exactly where it was — it just moves the whole app with it.

   · The font stacks fall back through var(--font-display, var(--font-sans, ...)), since this app
     defines --font-sans and --font-mono but no --font-display. A bare var() with no fallback
     would invalidate the whole declaration here and silently drop the typography.

   The palette is deliberately NOT the shared tokens: the brief asks for a pitch-dark canvas with
   electric accents, which is a different register from the rest of v2 — that IS the proposal.
   ============================================================================= */

// -----------------------------------------------------------------------------
// Domain
// -----------------------------------------------------------------------------

type Status = "Planned" | "Processing" | "Acquired" | "Partial" | "Unavailable";

interface Datatake {
  id: string;
  satellite: string;
  mission: string;
  sensorMode: string;
  status: Status;
  completeness: number;
  start: Date;
}

const MISSIONS: Record<string, string[]> = {
  "Sentinel-1": ["S1A", "S1C"],
  "Sentinel-2": ["S2A", "S2B", "S2C"],
  "Sentinel-3": ["S3A", "S3B"],
  "Sentinel-5P": ["S5P"],
};

const SENSOR_MODES: Record<string, string[]> = {
  S1A: ["IW", "EW", "SM", "WV"],
  S1C: ["IW", "EW", "SM", "WV"],
  S2A: ["MSI"],
  S2B: ["MSI"],
  S2C: ["MSI"],
  S3A: ["OLCI", "SLSTR", "SRAL"],
  S3B: ["OLCI", "SLSTR", "SRAL"],
  S5P: ["TROPOMI"],
};

const MISSION_NAMES = Object.keys(MISSIONS);
const ALL_SATELLITES = MISSION_NAMES.flatMap((m) => MISSIONS[m]);
const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((s) => [s, m])),
);

/* The five completeness states of the production legend, in lifecycle order
   (apps/templates/home/data-availability.html → "Completeness Status:"). Each maps to a
   --sx-st-* token so the colour follows the theme without any JS palette. */
const STATUS_ORDER: Status[] = ["Planned", "Processing", "Acquired", "Partial", "Unavailable"];

const STATUS_VAR: Record<Status, string> = {
  Planned: "var(--sx-st-planned)",
  Processing: "var(--sx-st-processing)",
  Acquired: "var(--sx-st-acquired)",
  Partial: "var(--sx-st-partial)",
  Unavailable: "var(--sx-st-unavailable)",
};

const MISSION_VAR: Record<string, string> = {
  "Sentinel-1": "var(--sx-m1)",
  "Sentinel-2": "var(--sx-m2)",
  "Sentinel-3": "var(--sx-m3)",
  "Sentinel-5P": "var(--sx-m5p)",
};

const MODE_VAR: Record<string, string> = {
  IW: "var(--sx-m1)", EW: "var(--sx-m1-2)", SM: "var(--sx-m1-3)", WV: "var(--sx-m1-4)",
  MSI: "var(--sx-m2)",
  OLCI: "var(--sx-m3)", SLSTR: "var(--sx-m3-2)", SRAL: "var(--sx-m3-3)",
  TROPOMI: "var(--sx-m5p)",
};

const GROUND_STATIONS = ["SVALBARD", "MATERA", "MASPALOMAS", "INUVIK", "NEUSTRELITZ", "KIRUNA"];
/** Repeat-cycle length per mission — the range a relative orbit (track) number falls in. */
const TRACKS: Record<string, number> = {
  "Sentinel-1": 175, "Sentinel-2": 143, "Sentinel-3": 385, "Sentinel-5P": 227,
};
const LEVELS: Record<string, string[]> = {
  "Sentinel-1": ["L0", "L1", "L2"],
  "Sentinel-2": ["L0", "L1B", "L1C", "L2A"],
  "Sentinel-3": ["L0", "L1B", "L2"],
  "Sentinel-5P": ["L1B", "L2"],
};

// -----------------------------------------------------------------------------
// Time helpers — UTC throughout; operations never speak local time
// -----------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fmtTime = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
const fmtStamp = (d: Date) => `${fmtDate(d)} ${fmtTime(d)}`;

/** Past three months plus everything scheduled to 23:59:59 of the following day, anchored to UTC
 *  midnight. The anchor is what keeps the server render and the client hydration identical — a
 *  raw new Date() would seed different rows on each side and React would report a mismatch. */
function acquisitionWindow() {
  const n = new Date();
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const start = new Date(today);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 23, 59, 59));
  return { start, end, today: new Date(today) };
}

// -----------------------------------------------------------------------------
// Mock data — seeded, so the table is identical on every render and both sides of
// hydration. Status is drawn first and the sensing time is then made to agree with
// it: a Planned datatake sits in the scheduled tail with nothing published, a
// Processing one flew within the last day, the settled states fill everything older.
// -----------------------------------------------------------------------------

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function statusFor(rng: () => number): Status {
  const r = rng();
  if (r < 0.08) return "Planned";
  if (r < 0.18) return "Processing";
  if (r < 0.78) return "Acquired";
  if (r < 0.93) return "Partial";
  return "Unavailable";
}

function completenessFor(status: Status, rng: () => number) {
  switch (status) {
    case "Planned": return 0;
    case "Processing": return Math.round(20 + rng() * 60);
    case "Acquired": return Math.round(90 + rng() * 10);
    case "Partial": return Math.round(30 + rng() * 55);
    case "Unavailable": return Math.round(rng() * 8);
  }
}

function startFor(status: Status, rng: () => number, w: ReturnType<typeof acquisitionWindow>) {
  const DAY = 86_400_000;
  if (status === "Planned") return new Date(w.today.getTime() + rng() * (w.end.getTime() - w.today.getTime()));
  if (status === "Processing") return new Date(w.today.getTime() - DAY + rng() * DAY);
  return new Date(w.start.getTime() + rng() * (w.today.getTime() - DAY - w.start.getTime()));
}

function generateMockData(count = 240): Datatake[] {
  const rng = seededRandom(42);
  const w = acquisitionWindow();
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const rows: Datatake[] = [];
  for (let i = 0; i < count; i++) {
    const sat = pick(ALL_SATELLITES);
    const mode = pick(SENSOR_MODES[sat]);
    const status = statusFor(rng);
    const completeness = completenessFor(status, rng);
    const start = startFor(status, rng, w);
    const hex = Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
    const id = `${sat}_${mode}_${fmtDate(start).replace(/-/g, "")}T${pad(start.getUTCHours())}${pad(
      start.getUTCMinutes(),
    )}${pad(start.getUTCSeconds())}_${hex}`;
    rows.push({ id, satellite: sat, mission: MISSION_OF[sat], sensorMode: mode, status, completeness, start });
  }
  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

const DATA = generateMockData();
const WINDOW = acquisitionWindow();
const ROW_CAP = 14;

// -----------------------------------------------------------------------------
// Per-datatake telemetry for the modal. Hashed off the ID so a row always reopens
// with the same orbit, station and footprint — no reshuffling between views.
// -----------------------------------------------------------------------------

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Telemetry {
  stop: Date;
  durationMin: number;
  absoluteOrbit: number;
  relativeOrbit: number;
  cycle: number;
  station: string;
  levels: string[];
  polygon: [number, number][];
  productCount: number;
  publishedCount: number;
  volumeGb: number;
}

const DURATION: Record<string, [number, number]> = {
  "Sentinel-1": [4, 25], "Sentinel-2": [10, 47], "Sentinel-3": [20, 45], "Sentinel-5P": [90, 101],
};

function telemetryFor(dt: Datatake): Telemetry {
  let s = hash(dt.id) % 233280;
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const [lo, hi] = DURATION[dt.mission] ?? [10, 40];
  const durationMin = Math.round(lo + rng() * (hi - lo));
  const trackCount = TRACKS[dt.mission] ?? 175;
  const relativeOrbit = 1 + Math.floor(rng() * trackCount);
  const cycle = 40 + Math.floor(rng() * 180);
  const productCount = 4 + Math.floor(rng() * 44);

  // A four-corner ground footprint: one corner drawn, the rest offset by the swath.
  const lat = Math.round((rng() * 140 - 70) * 100) / 100;
  const lon = Math.round((rng() * 360 - 180) * 100) / 100;
  const dLat = Math.round((2 + rng() * 6) * 100) / 100;
  const dLon = Math.round((2 + rng() * 8) * 100) / 100;
  const wrap = (v: number) => Math.round((((v + 180) % 360) - 180) * 100) / 100;
  const clamp = (v: number) => Math.round(Math.max(-90, Math.min(90, v)) * 100) / 100;

  return {
    stop: new Date(dt.start.getTime() + durationMin * 60_000),
    durationMin,
    absoluteOrbit: cycle * trackCount + relativeOrbit,
    relativeOrbit,
    cycle,
    station: GROUND_STATIONS[Math.floor(rng() * GROUND_STATIONS.length)],
    levels: LEVELS[dt.mission] ?? ["L0", "L1", "L2"],
    polygon: [
      [lat, lon],
      [lat, wrap(lon + dLon)],
      [clamp(lat - dLat), wrap(lon + dLon)],
      [clamp(lat - dLat), lon],
    ],
    productCount,
    publishedCount: Math.round((productCount * dt.completeness) / 100),
    volumeGb: Math.round((productCount * (0.4 + rng() * 3)) * 10) / 10,
  };
}

/** The record as the backend would hand it over — the modal's raw metadata pane. */
function rawMetadata(dt: Datatake, t: Telemetry) {
  return {
    datatake_id: dt.id,
    mission: dt.mission,
    platform_short_name: dt.satellite,
    instrument_mode: dt.sensorMode,
    sensing_start: `${fmtDate(dt.start)}T${fmtTime(dt.start)}Z`,
    sensing_stop: `${fmtDate(t.stop)}T${fmtTime(t.stop)}Z`,
    duration_seconds: t.durationMin * 60,
    orbit: { absolute: t.absoluteOrbit, relative: t.relativeOrbit, cycle: t.cycle, direction: t.relativeOrbit % 2 ? "ASCENDING" : "DESCENDING" },
    footprint: { type: "Polygon", coordinates_lat_lon: t.polygon },
    acquisition: { downlink_station: t.station, completeness_status: dt.status.toUpperCase() },
    publication: {
      processing_levels: t.levels,
      products_expected: t.productCount,
      products_published: t.publishedCount,
      completeness_percentage: dt.completeness,
      volume_gb: t.volumeGb,
    },
    updated: `${fmtDate(WINDOW.today)}T00:00:00Z`,
  };
}

// -----------------------------------------------------------------------------
// Aggregation
// -----------------------------------------------------------------------------

interface Slice { key: string; label: string; value: number; color: string; note?: string }

function missionSlices(rows: Datatake[]): Slice[] {
  const acc: Record<string, { n: number; sum: number }> = {};
  MISSION_NAMES.forEach((m) => (acc[m] = { n: 0, sum: 0 }));
  rows.forEach((r) => {
    acc[r.mission].n += 1;
    acc[r.mission].sum += r.completeness;
  });
  return MISSION_NAMES.map((m) => ({
    key: m,
    label: m.replace("Sentinel-", "S"),
    value: acc[m].n,
    color: MISSION_VAR[m],
    note: `${acc[m].n ? Math.round(acc[m].sum / acc[m].n) : 0}% AVG`,
  }));
}

function statusSlices(rows: Datatake[]): Slice[] {
  const acc = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  rows.forEach((r) => (acc[r.status] += 1));
  return STATUS_ORDER.map((s) => ({ key: s, label: s.toUpperCase(), value: acc[s], color: STATUS_VAR[s] }));
}

function modeSlices(rows: Datatake[]): Slice[] {
  const acc = new Map<string, number>();
  rows.forEach((r) => acc.set(r.sensorMode, (acc.get(r.sensorMode) ?? 0) + 1));
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mode, n]) => ({ key: mode, label: mode, value: n, color: MODE_VAR[mode] ?? "var(--sx-accent)" }));
}

// -----------------------------------------------------------------------------
// Icons — inline so the file stays dependency-free. 1.5px strokes, square caps:
// the same hairline weight as the rules around them.
// -----------------------------------------------------------------------------

type IconProps = { size?: number };
const svg = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "square" as const, strokeLinejoin: "miter" as const,
});

const IconSearch = ({ size = 13 }: IconProps) => (
  <svg {...svg(size)} aria-hidden><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5" /></svg>
);
const IconClose = ({ size = 14 }: IconProps) => (
  <svg {...svg(size)} aria-hidden><path d="M5 5l14 14M19 5L5 19" /></svg>
);
const IconChevron = ({ size = 13 }: IconProps) => (
  <svg {...svg(size)} aria-hidden><path d="M9 6l6 6-6 6" /></svg>
);
const IconReset = ({ size = 12 }: IconProps) => (
  <svg {...svg(size)} aria-hidden><path d="M4 12a8 8 0 108-8 8 8 0 00-5.7 2.4L4 8.7M4 4v5h5" /></svg>
);
const IconCopy = ({ size = 13 }: IconProps) => (
  <svg {...svg(size)} aria-hidden><rect x="9" y="9" width="11" height="11" /><path d="M5 15V5h10" /></svg>
);
const IconDownload = ({ size = 13 }: IconProps) => (
  <svg {...svg(size)} aria-hidden><path d="M12 4v10M8 11l4 4 4-4M4 20h16" /></svg>
);

// -----------------------------------------------------------------------------
// Donut — hand-drawn SVG rather than a chart library: a 10px hairline ring with
// square-cut segments, which no charting default will give you. Strokes are set
// through `style` (a CSS property) and not the `stroke` attribute, because a
// presentation attribute cannot resolve var() — this is what lets the segments
// follow the theme with no JS palette.
// -----------------------------------------------------------------------------

function Donut({ slices, total, caption }: { slices: Slice[]; total: number; caption: string }) {
  const SIZE = 128;
  const THICK = 10;
  const r = (SIZE - THICK) / 2;
  const circumference = 2 * Math.PI * r;
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  const GAP = 2;

  let offset = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / sum) * circumference;
      const drawn = Math.max(1, len - GAP);
      const node = (
        <circle
          key={s.key}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={THICK}
          strokeDasharray={`${drawn} ${circumference - drawn}`}
          strokeDashoffset={-offset}
          style={{ stroke: s.color }}
        />
      );
      offset += len;
      return node;
    });

  return (
    <div className="sx-donut">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={caption}>
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" strokeWidth={THICK} className="sx-donut-track" />
          {arcs}
        </g>
      </svg>
      <div className="sx-donut-mid">
        <span className="sx-donut-n">{total}</span>
        <span className="sx-donut-c">{caption}</span>
      </div>
    </div>
  );
}

function Legend({ slices, total }: { slices: Slice[]; total: number }) {
  const denom = total || 1;
  return (
    <ul className="sx-legend">
      {slices.map((s) => (
        <li key={s.key}>
          <span className="sx-dot" style={{ background: s.color }} aria-hidden />
          <span className="sx-legend-l">{s.label}</span>
          <span className="sx-legend-v">{s.value}</span>
          <span className="sx-legend-p">{Math.round((s.value / denom) * 100)}%</span>
          {s.note && <span className="sx-legend-n">{s.note}</span>}
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="sx-badge" style={{ ["--c" as string]: STATUS_VAR[status] }}>
      <span className="sx-badge-dot" aria-hidden />
      {status.toUpperCase()}
    </span>
  );
}

/* The bar takes the row's status colour rather than a threshold on the number: Planned sits at 0%
   because it has not flown, which is not the failure that Unavailable at 0% is. */
function CompletenessBar({ value, status }: { value: number; status: Status }) {
  return (
    <div className="sx-bar">
      <div className="sx-bar-track">
        <div className="sx-bar-fill" style={{ width: `${value}%`, background: STATUS_VAR[status] }} />
      </div>
      <span className="sx-bar-v">{String(value).padStart(3, "0")}%</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Details modal
// -----------------------------------------------------------------------------

function DetailsModal({ datatake, onClose }: { datatake: Datatake; onClose: () => void }) {
  const telemetry = useMemo(() => telemetryFor(datatake), [datatake]);
  const raw = useMemo(() => JSON.stringify(rawMetadata(datatake, telemetry), null, 2), [datatake, telemetry]);
  const [copied, setCopied] = useState<"id" | "json" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fromBackdrop = useRef(false);

  // Escape closes; Tab is kept inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const nodes = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = dialogRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Lock the page behind, padding for the scrollbar so the layout does not jump sideways.
  useEffect(() => {
    const { body } = document;
    const overflow = body.style.overflow;
    const padding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padding;
    };
  }, []);

  // Focus in on open, back to the row on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const flash = useCallback((what: "id" | "json", text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(what);
        window.setTimeout(() => setCopied(null), 1600);
      },
      () => setCopied(null),
    );
  }, []);

  const download = useCallback(() => {
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${datatake.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [raw, datatake.id]);

  const kv: [string, string][] = [
    ["PLATFORM", datatake.satellite],
    ["MISSION", datatake.mission],
    ["SENSOR MODE", datatake.sensorMode],
    ["SENSING START", fmtStamp(datatake.start)],
    ["SENSING STOP", fmtStamp(telemetry.stop)],
    ["DURATION", `${telemetry.durationMin} MIN`],
    ["ABS ORBIT", String(telemetry.absoluteOrbit)],
    ["REL ORBIT", String(telemetry.relativeOrbit)],
    ["CYCLE", String(telemetry.cycle)],
    ["PASS", telemetry.relativeOrbit % 2 ? "ASCENDING" : "DESCENDING"],
    ["STATION", telemetry.station],
    ["PROC LEVELS", telemetry.levels.join(" / ")],
  ];

  return (
    <div
      className="sx-backdrop"
      onMouseDown={(e) => {
        fromBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (fromBackdrop.current && e.target === e.currentTarget) onClose();
        fromBackdrop.current = false;
      }}
    >
      <div className="sx-modal" role="dialog" aria-modal="true" aria-labelledby="sx-modal-t" tabIndex={-1} ref={dialogRef}>
        <header className="sx-modal-h">
          <div>
            <span className="sx-tag">DATATAKE TELEMETRY</span>
            <h2 id="sx-modal-t">{datatake.id}</h2>
          </div>
          <button className="sx-x" onClick={onClose} aria-label="Close telemetry">
            <IconClose />
          </button>
        </header>

        <div className="sx-modal-b">
          <div className="sx-modal-top">
            <StatusBadge status={datatake.status} />
            <CompletenessBar value={datatake.completeness} status={datatake.status} />
            <span className="sx-modal-top-l">
              {telemetry.publishedCount}/{telemetry.productCount} PRODUCTS · {telemetry.volumeGb} GB
            </span>
          </div>

          <div className="sx-kvs">
            {kv.map(([k, v]) => (
              <div className="sx-kv" key={k}>
                <span className="sx-kv-k">{k}</span>
                <span className="sx-kv-v">{v}</span>
              </div>
            ))}
          </div>

          <div className="sx-sec">
            <span className="sx-sec-l">FOOTPRINT · LAT/LON</span>
          </div>
          <div className="sx-poly">
            {telemetry.polygon.map(([la, lo], i) => (
              <span key={i}>
                <em>P{i + 1}</em>
                {la >= 0 ? `+${la.toFixed(2)}` : la.toFixed(2)} {lo >= 0 ? `+${lo.toFixed(2)}` : lo.toFixed(2)}
              </span>
            ))}
          </div>

          <div className="sx-sec">
            <span className="sx-sec-l">RAW METADATA</span>
            <button className="sx-mini" onClick={() => flash("json", raw)}>
              <IconCopy />
              {copied === "json" ? "COPIED" : "COPY JSON"}
            </button>
          </div>
          <pre className="sx-raw">{raw}</pre>
        </div>

        <footer className="sx-modal-f">
          <button className="sx-btn" onClick={() => flash("id", datatake.id)}>
            <IconCopy />
            {copied === "id" ? "COPIED" : "COPY ID"}
          </button>
          <button className="sx-btn" onClick={download}>
            <IconDownload />
            DOWNLOAD JSON
          </button>
          <button className="sx-btn sx-btn-primary" onClick={onClose}>
            CLOSE
          </button>
        </footer>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function DataAvailabilitySpaceX() {
  // Theme is read, never set: the switch lives in the app nav above this page.
  const { theme } = useTheme();
  const dark = theme !== "light";
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const [mission, setMission] = useState("ALL");
  const [satellite, setSatellite] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Datatake | null>(null);

  const satelliteOptions = mission === "ALL" ? ALL_SATELLITES : MISSIONS[mission];
  const satelliteLocked = mission === "Sentinel-5P"; // one satellite, so the picker has no choice to offer

  const onMissionChange = useCallback((value: string) => {
    setMission(value);
    setSatellite(value === "Sentinel-5P" ? "S5P" : "ALL");
  }, []);

  const reset = useCallback(() => {
    setPeriod(DEFAULT_PERIOD);
    setMission("ALL");
    setSatellite("ALL");
    setFrom("");
    setTo("");
    setQuery("");
  }, []);

  /* Typing a date by hand is what "custom" means, so the selector follows the pickers — and
     choosing a period clears them, since a preset and a hand-typed bound would otherwise both
     claim to own the range. */
  const onCustomDate = useCallback((which: "from" | "to", value: string) => {
    (which === "from" ? setFrom : setTo)(value);
    setPeriod("custom");
  }, []);

  const rows = useMemo(() => {
    let out = DATA;
    if (period !== "custom") out = out.filter((r) => inPeriod(r.start, period));
    if (mission !== "ALL") out = out.filter((r) => r.mission === mission);
    if (satellite !== "ALL") out = out.filter((r) => r.satellite === satellite);
    if (from) {
      const f = new Date(`${from}T00:00:00Z`);
      out = out.filter((r) => r.start >= f);
    }
    if (to) {
      const t = new Date(`${to}T23:59:59Z`);
      out = out.filter((r) => r.start <= t);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      out = out.filter((r) => r.id.toLowerCase().includes(q));
    }
    return out;
  }, [period, mission, satellite, from, to, query]);

  const filtered = rows !== DATA || Boolean(query || from || to);

  // What the header reports as the range actually in force.
  const rangeFrom = period === "custom" ? (from ? new Date(`${from}T00:00:00Z`) : WINDOW.start) : periodStart(period)!;
  const rangeTo = period === "custom" && to ? new Date(`${to}T23:59:59Z`) : WINDOW.end;
  const rangeLabel = `${fmtDate(rangeFrom)} → ${fmtDate(rangeTo)}`;
  const visible = rows.slice(0, ROW_CAP);

  const missions = useMemo(() => missionSlices(rows), [rows]);
  const statuses = useMemo(() => statusSlices(rows), [rows]);
  const modes = useMemo(() => modeSlices(rows), [rows]);

  const lost = rows.filter((r) => r.status === "Partial" || r.status === "Unavailable").length;
  const published = rows.length ? Math.round(rows.reduce((s, r) => s + r.completeness, 0) / rows.length) : 0;

  return (
    <div className="sx" data-theme={dark ? "dark" : "light"}>
      <style>{CSS}</style>

      <div className="sx-wrap">
        {/* ---------------- header ---------------- */}
        <header className="sx-head">
          <div className="sx-head-l">
            <div className="sx-tagline">
              <span className="sx-live" aria-hidden />
              COPERNICUS · SENTINEL OPERATIONS
            </div>
            <h1 className="sx-h1">DATA AVAILABILITY</h1>
            <p className="sx-lede">
              Datatakes from {fmtDate(WINDOW.start)} to {fmtDate(WINDOW.end)} UTC, including those scheduled to
              23:59:59 of the following day. Refreshed hourly.
            </p>
          </div>

          <div className="sx-head-r">
            <div className="sx-window">
              <span className="sx-window-l">ACTIVE RANGE</span>
              <span className="sx-window-v">{rangeLabel}</span>
              <span className="sx-window-d">{PERIOD_LABEL[period].toUpperCase()}</span>
            </div>
          </div>
        </header>

        <div className="sx-counters">
          <div className="sx-counter">
            <span className="sx-counter-k">TOTAL DATATAKES</span>
            <span className="sx-counter-v">{String(DATA.length).padStart(4, "0")}</span>
          </div>
          <div className="sx-counter">
            <span className="sx-counter-k">IN CURRENT FILTER</span>
            <span className="sx-counter-v">{String(rows.length).padStart(4, "0")}</span>
          </div>
          <div className="sx-counter">
            <span className="sx-counter-k">MEAN COMPLETENESS</span>
            <span className="sx-counter-v">{published}%</span>
          </div>
          <div className="sx-counter">
            <span className="sx-counter-k">DEGRADED / LOST</span>
            <span className="sx-counter-v sx-warn">{String(lost).padStart(4, "0")}</span>
          </div>
        </div>

        {/* ---------------- overview ---------------- */}
        <div className="sx-sec sx-sec-top">
          <span className="sx-sec-l">OVERVIEW{filtered ? " · FILTERED" : ""}</span>
          <span className="sx-sec-r">3 METRICS</span>
        </div>

        <div className="sx-grid3">
          <section className="sx-card">
            <h2 className="sx-card-t">MISSION SHARE</h2>
            {rows.length === 0 ? (
              <p className="sx-none">NO SIGNAL — NO DATATAKES IN FILTER</p>
            ) : (
              <>
                <Donut slices={missions} total={rows.length} caption="DATATAKES" />
                <Legend slices={missions} total={rows.length} />
              </>
            )}
          </section>

          <section className="sx-card">
            <h2 className="sx-card-t">ACQUISITION STATUS</h2>
            {rows.length === 0 ? (
              <p className="sx-none">NO SIGNAL — NO DATATAKES IN FILTER</p>
            ) : (
              <>
                <Donut slices={statuses} total={published} caption="MEAN COMPL." />
                <Legend slices={statuses} total={rows.length} />
              </>
            )}
          </section>

          <section className="sx-card">
            <h2 className="sx-card-t">ACTIVE SENSOR MODES</h2>
            {rows.length === 0 ? (
              <p className="sx-none">NO SIGNAL — NO DATATAKES IN FILTER</p>
            ) : (
              <>
                <Donut slices={modes} total={modes.length} caption="MODES" />
                <Legend slices={modes} total={rows.length} />
              </>
            )}
          </section>
        </div>

        {/* ---------------- filters ---------------- */}
        <div className="sx-sec">
          <span className="sx-sec-l">FILTER TELEMETRY</span>
          <button className="sx-mini" onClick={reset} disabled={!filtered}>
            <IconReset />
            RESET
          </button>
        </div>

        <div className="sx-filters">
          <div className="sx-field">
            <label htmlFor="sx-period">PERIOD</label>
            <select
              id="sx-period"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as PeriodId);
                setFrom("");
                setTo("");
              }}
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>{p.label.toUpperCase()}</option>
              ))}
              <option value="custom">CUSTOM RANGE</option>
            </select>
          </div>

          <div className="sx-field">
            <label htmlFor="sx-mission">MISSION</label>
            <select id="sx-mission" value={mission} onChange={(e) => onMissionChange(e.target.value)}>
              <option value="ALL">ALL MISSIONS</option>
              {MISSION_NAMES.map((m) => (
                <option key={m} value={m}>{m.toUpperCase()}</option>
              ))}
            </select>
          </div>

          <div className="sx-field">
            <label htmlFor="sx-sat">SATELLITE</label>
            <select id="sx-sat" value={satellite} disabled={satelliteLocked} onChange={(e) => setSatellite(e.target.value)}>
              <option value="ALL">ALL UNITS</option>
              {satelliteOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="sx-field">
            <label htmlFor="sx-from">FROM</label>
            <input id="sx-from" type="date" value={from} onChange={(e) => onCustomDate("from", e.target.value)} />
          </div>

          <div className="sx-field">
            <label htmlFor="sx-to">TO</label>
            <input id="sx-to" type="date" value={to} onChange={(e) => onCustomDate("to", e.target.value)} />
          </div>

          <div className="sx-field sx-field-wide">
            <label htmlFor="sx-q">DATATAKE ID</label>
            <div className="sx-search">
              <span className="sx-search-i" aria-hidden><IconSearch /></span>
              <input
                id="sx-q"
                type="text"
                placeholder="SEARCH BY ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className="sx-search-x" onClick={() => setQuery("")} aria-label="Clear search">
                  <IconClose size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ---------------- table ---------------- */}
        <div className="sx-sec">
          <span className="sx-sec-l">DATATAKES</span>
          <span className="sx-sec-r">
            {String(visible.length).padStart(3, "0")} / {String(rows.length).padStart(4, "0")} SHOWN
            {rows.length > ROW_CAP ? " · NARROW THE FILTER FOR MORE" : ""}
          </span>
        </div>

        <div className="sx-tablewrap">
          <table className="sx-table">
            <thead>
              <tr>
                <th>DATATAKE ID</th>
                <th>PLATFORM</th>
                <th>MODE</th>
                <th>START UTC</th>
                <th>STATUS</th>
                <th>COMPLETENESS</th>
                <th className="sx-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Telemetry for datatake ${row.id}`}
                  onClick={() => setSelected(row)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(row);
                    }
                  }}
                >
                  <td className="sx-id">{row.id}</td>
                  <td><span className="sx-plat">{row.satellite}</span></td>
                  <td className="sx-mode">{row.sensorMode}</td>
                  <td className="sx-time">{fmtStamp(row.start)}</td>
                  <td><StatusBadge status={row.status} /></td>
                  <td><CompletenessBar value={row.completeness} status={row.status} /></td>
                  <td className="sx-right">
                    {/* The row is the primary target; this repeats it for anyone scanning
                        for a control rather than trying the row. */}
                    <button
                      className="sx-view"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(row);
                      }}
                    >
                      VIEW DETAILS
                      <IconChevron />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr className="sx-empty-row">
                  <td colSpan={7}>NO DATATAKES MATCH THE CURRENT FILTER</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="sx-foot">
          <span>MOCK DATA · NO BACKEND ATTACHED</span>
          <span>SENTIBOARD V2 · DEVOCS-219 · PROPOSAL 03</span>
        </footer>
      </div>

      {selected && <DetailsModal datatake={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles. Scoped under .sx and keyed off data-theme on this component's own root,
// so the mock-up carries both themes without touching app/globals.css and without
// depending on whatever theme the surrounding app is in.
// -----------------------------------------------------------------------------

const CSS = `
.sx {
  --sx-mono: "JetBrains Mono", "Geist Mono", var(--font-mono, ui-monospace), "SFMono-Regular", Menlo, Consolas, monospace;
  --sx-sans: var(--font-display, var(--font-sans, "Inter")), system-ui, -apple-system, sans-serif;

  --sx-bg: #08090a;
  --sx-panel: #0d0e12;
  --sx-panel-2: #101218;
  --sx-line: #1b1e25;
  --sx-line-2: #2b303a;
  --sx-text: #e9ecf1;
  --sx-dim: #8a919d;
  --sx-faint: #565d6a;
  --sx-accent: #00e5ff;
  --sx-accent-2: #00ff9c;
  --sx-accent-soft: rgba(0, 229, 255, 0.1);

  --sx-st-planned: #6b7280;
  --sx-st-processing: #00d4ff;
  --sx-st-acquired: #00e08a;
  --sx-st-partial: #ffb020;
  --sx-st-unavailable: #ff4d5e;

  --sx-m1: #4d8dff;
  --sx-m1-2: #7fb0ff;
  --sx-m1-3: #2f66c9;
  --sx-m1-4: #1e4488;
  --sx-m2: #00e08a;
  --sx-m3: #c07dff;
  --sx-m3-2: #d9aeff;
  --sx-m3-3: #8f4fd1;
  --sx-m5p: #ffb020;

  min-height: 100vh;
  background: var(--sx-bg);
  color: var(--sx-text);
  font-family: var(--sx-sans);
  -webkit-font-smoothing: antialiased;
}

/* LIGHT — stark white ground, charcoal ink. The accents are darkened, not swapped:
   electric cyan and green are unreadable as hairlines on white. */
.sx[data-theme="light"] {
  --sx-bg: #f8f9fa;
  --sx-panel: #ffffff;
  --sx-panel-2: #f1f3f5;
  --sx-line: #dde1e6;
  --sx-line-2: #b9c0c9;
  --sx-text: #14171c;
  --sx-dim: #4d5560;
  --sx-faint: #79818d;
  --sx-accent: #007c93;
  --sx-accent-2: #00875a;
  --sx-accent-soft: rgba(0, 124, 147, 0.08);

  --sx-st-planned: #6b7280;
  --sx-st-processing: #0284a8;
  --sx-st-acquired: #00875a;
  --sx-st-partial: #b45309;
  --sx-st-unavailable: #d92d3f;

  --sx-m1: #2563c9;
  --sx-m1-2: #5b8ee0;
  --sx-m1-3: #17408a;
  --sx-m1-4: #0d2a5c;
  --sx-m2: #00875a;
  --sx-m3: #7c3fbf;
  --sx-m3-2: #a274d6;
  --sx-m3-3: #55258a;
  --sx-m5p: #b45309;
}

.sx *, .sx *::before, .sx *::after { box-sizing: border-box; }
.sx-wrap { max-width: 1320px; margin: 0 auto; padding: 26px 26px 56px; }

/* ---------- header ---------- */
.sx-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.sx-tagline {
  display: flex; align-items: center; gap: 8px;
  font-family: var(--sx-mono); font-size: 10px; letter-spacing: 0.26em; color: var(--sx-accent);
}
.sx-live {
  width: 6px; height: 6px; background: var(--sx-accent-2);
  box-shadow: 0 0 0 0 var(--sx-accent-2); animation: sx-pulse 2.4s infinite;
}
@keyframes sx-pulse {
  0% { box-shadow: 0 0 0 0 var(--sx-accent-2); opacity: 1; }
  70% { box-shadow: 0 0 0 7px transparent; opacity: 0.75; }
  100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
}
.sx-h1 {
  margin: 10px 0 0; font-size: clamp(28px, 4.4vw, 44px); font-weight: 700;
  letter-spacing: 0.01em; line-height: 1; text-transform: uppercase;
}
.sx-lede { margin: 10px 0 0; max-width: 66ch; font-size: 13px; line-height: 1.6; color: var(--sx-dim); }
.sx-head-r { display: flex; align-items: stretch; gap: 10px; }
/* Where the clock used to be. A wall clock told the reader nothing the page needed; the range
   actually in force is what makes the counters below it mean something. */
.sx-window {
  display: flex; flex-direction: column; gap: 3px;
  padding: 9px 14px; border: 1px solid var(--sx-line); background: var(--sx-panel); border-radius: 2px;
  font-family: var(--sx-mono);
}
.sx-window-l { font-size: 9px; letter-spacing: 0.2em; color: var(--sx-faint); }
.sx-window-v { font-size: 14px; letter-spacing: 0.02em; color: var(--sx-accent); font-variant-numeric: tabular-nums; }
.sx-window-d { font-size: 9.5px; letter-spacing: 0.14em; color: var(--sx-faint); }

/* ---------- counters ---------- */
.sx-counters {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  margin: 22px 0 26px; background: var(--sx-line); border: 1px solid var(--sx-line);
}
.sx-counter { display: flex; flex-direction: column; gap: 6px; padding: 13px 16px; background: var(--sx-panel); }
.sx-counter-k { font-family: var(--sx-mono); font-size: 9.5px; letter-spacing: 0.18em; color: var(--sx-faint); }
.sx-counter-v {
  font-family: var(--sx-mono); font-size: 24px; line-height: 1;
  font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
}
.sx-warn { color: var(--sx-st-partial); }

/* ---------- section rules ---------- */
.sx-sec {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding-bottom: 8px; margin: 26px 0 12px; border-bottom: 1px solid var(--sx-line);
}
.sx-sec-top { margin-top: 0; }
.sx-sec-l { font-family: var(--sx-mono); font-size: 10px; letter-spacing: 0.22em; color: var(--sx-text); }
.sx-sec-r { font-family: var(--sx-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--sx-faint); }
.sx-mini {
  display: inline-flex; align-items: center; gap: 6px; padding: 0; border: 0; background: none;
  color: var(--sx-accent); cursor: pointer;
  font-family: var(--sx-mono); font-size: 10px; letter-spacing: 0.14em;
}
.sx-mini:disabled { color: var(--sx-faint); cursor: default; }
.sx-mini:not(:disabled):hover { text-decoration: underline; }

/* ---------- metric cards ---------- */
.sx-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.sx-card {
  position: relative; padding: 16px; border: 1px solid var(--sx-line);
  background: var(--sx-panel); border-radius: 2px;
}
.sx-card::before {
  content: ""; position: absolute; top: -1px; left: -1px; width: 26px; height: 1px; background: var(--sx-accent);
}
.sx-card-t {
  margin: 0 0 14px; font-family: var(--sx-mono); font-size: 10px; font-weight: 500;
  letter-spacing: 0.2em; color: var(--sx-dim);
}
.sx-none {
  margin: 0; padding: 46px 0; text-align: center;
  font-family: var(--sx-mono); font-size: 10.5px; letter-spacing: 0.14em; color: var(--sx-faint);
}
.sx-donut { position: relative; display: flex; justify-content: center; }
.sx-donut-track { stroke: var(--sx-line-2); opacity: 0.45; }
.sx-donut-mid {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 3px; pointer-events: none;
}
.sx-donut-n { font-family: var(--sx-mono); font-size: 22px; font-variant-numeric: tabular-nums; }
.sx-donut-c { font-family: var(--sx-mono); font-size: 8.5px; letter-spacing: 0.18em; color: var(--sx-faint); }
.sx-legend { list-style: none; margin: 14px 0 0; padding: 0; }
.sx-legend li {
  display: grid; grid-template-columns: 8px 1fr auto auto; align-items: center; gap: 8px;
  padding: 5px 0; border-top: 1px solid var(--sx-line);
  font-family: var(--sx-mono); font-size: 10.5px;
}
.sx-legend li:first-child { border-top: 0; }
.sx-dot { width: 8px; height: 8px; border-radius: 1px; }
.sx-legend-l { letter-spacing: 0.1em; color: var(--sx-dim); overflow: hidden; text-overflow: ellipsis; }
.sx-legend-v { font-variant-numeric: tabular-nums; color: var(--sx-text); }
.sx-legend-p { font-variant-numeric: tabular-nums; color: var(--sx-faint); min-width: 34px; text-align: right; }
.sx-legend-n { grid-column: 2 / -1; font-size: 9px; letter-spacing: 0.1em; color: var(--sx-faint); }

/* ---------- filters ---------- */
.sx-filters {
  display: grid; grid-template-columns: repeat(5, 1fr) 1.5fr; gap: 1px;
  background: var(--sx-line); border: 1px solid var(--sx-line);
}
.sx-field { display: flex; flex-direction: column; gap: 7px; padding: 12px 14px; background: var(--sx-panel); min-width: 0; }
.sx-field label { font-family: var(--sx-mono); font-size: 9.5px; letter-spacing: 0.18em; color: var(--sx-faint); }
.sx-field select, .sx-field input {
  width: 100%; padding: 7px 9px; border: 1px solid var(--sx-line-2); border-radius: 2px;
  background: var(--sx-panel-2); color: var(--sx-text); outline: none;
  font-family: var(--sx-mono); font-size: 11.5px; letter-spacing: 0.04em;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.sx-field select { appearance: none; cursor: pointer; padding-right: 26px;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 13px) center, calc(100% - 9px) center;
  background-size: 4px 4px, 4px 4px; background-repeat: no-repeat;
}
.sx-field select:focus, .sx-field input:focus { border-color: var(--sx-accent); box-shadow: 0 0 0 2px var(--sx-accent-soft); }
.sx-field select:disabled { opacity: 0.45; cursor: not-allowed; }
.sx-search { position: relative; display: flex; }
.sx-search input { padding-left: 27px; padding-right: 26px; }
.sx-search-i { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); color: var(--sx-faint); display: flex; pointer-events: none; }
.sx-search-x {
  position: absolute; right: 7px; top: 50%; transform: translateY(-50%);
  border: 0; background: none; padding: 0; color: var(--sx-faint); cursor: pointer; display: flex;
}
.sx-search-x:hover { color: var(--sx-text); }

/* ---------- table ---------- */
.sx-tablewrap { border: 1px solid var(--sx-line); background: var(--sx-panel); overflow-x: auto; }
.sx-table { width: 100%; border-collapse: collapse; min-width: 940px; }
.sx-table th {
  text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--sx-line-2);
  background: var(--sx-panel-2);
  font-family: var(--sx-mono); font-size: 9.5px; font-weight: 500; letter-spacing: 0.18em; color: var(--sx-faint);
  white-space: nowrap;
}
.sx-table td { padding: 11px 14px; border-bottom: 1px solid var(--sx-line); vertical-align: middle; }
.sx-table tbody tr { cursor: pointer; transition: background 0.12s; }
.sx-table tbody tr:hover { background: var(--sx-accent-soft); }
.sx-table tbody tr:focus-visible { outline: 1px solid var(--sx-accent); outline-offset: -1px; }
.sx-right { text-align: right; }
.sx-id { font-family: var(--sx-mono); font-size: 11px; letter-spacing: 0.02em; white-space: nowrap; }
.sx-plat {
  display: inline-block; padding: 2px 7px; border: 1px solid var(--sx-line-2); border-radius: 2px;
  font-family: var(--sx-mono); font-size: 10.5px; letter-spacing: 0.06em; color: var(--sx-text);
}
.sx-mode { font-family: var(--sx-mono); font-size: 11px; color: var(--sx-dim); }
.sx-time { font-family: var(--sx-mono); font-size: 10.5px; color: var(--sx-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sx-empty-row td {
  padding: 40px 14px; text-align: center;
  font-family: var(--sx-mono); font-size: 10.5px; letter-spacing: 0.16em; color: var(--sx-faint);
}
.sx-view {
  display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px;
  border: 1px solid var(--sx-line-2); border-radius: 2px; background: transparent; color: var(--sx-dim);
  cursor: pointer; white-space: nowrap;
  font-family: var(--sx-mono); font-size: 9.5px; letter-spacing: 0.14em;
  transition: color 0.15s, border-color 0.15s;
}
.sx-view:hover { color: var(--sx-accent); border-color: var(--sx-accent); }

/* ---------- status + completeness ---------- */
.sx-badge {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px;
  border: 1px solid color-mix(in srgb, var(--c) 40%, transparent);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  color: var(--c); border-radius: 2px; white-space: nowrap;
  font-family: var(--sx-mono); font-size: 9.5px; letter-spacing: 0.12em;
}
.sx-badge-dot { width: 5px; height: 5px; background: var(--c); }
.sx-bar { display: flex; align-items: center; gap: 9px; min-width: 150px; }
.sx-bar-track { position: relative; flex: 1; height: 4px; background: var(--sx-line); overflow: hidden; }
.sx-bar-fill { height: 100%; transition: width 0.4s cubic-bezier(0.2, 0.7, 0.2, 1); }
.sx-bar-v { font-family: var(--sx-mono); font-size: 10.5px; color: var(--sx-dim); font-variant-numeric: tabular-nums; }

/* ---------- modal ---------- */
.sx-backdrop {
  position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center;
  padding: 24px; background: rgba(4, 6, 9, 0.72); backdrop-filter: blur(2px);
  animation: sx-fade 0.16s ease;
}
.sx[data-theme="light"] .sx-backdrop { background: rgba(20, 26, 34, 0.42); }
@keyframes sx-fade { from { opacity: 0 } to { opacity: 1 } }
.sx-modal {
  width: 100%; max-width: 760px; max-height: calc(100vh - 48px); display: flex; flex-direction: column;
  border: 1px solid var(--sx-line-2); background: var(--sx-bg); border-radius: 2px; outline: none;
  box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.8);
  animation: sx-rise 0.2s cubic-bezier(0.2, 0.7, 0.2, 1);
}
@keyframes sx-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@media (prefers-reduced-motion: reduce) { .sx-backdrop, .sx-modal { animation: none } }
.sx-modal-h {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 16px 18px; border-bottom: 1px solid var(--sx-line); background: var(--sx-panel);
}
.sx-tag { display: block; font-family: var(--sx-mono); font-size: 9px; letter-spacing: 0.24em; color: var(--sx-accent); }
.sx-modal-h h2 {
  margin: 7px 0 0; font-family: var(--sx-mono); font-size: 14px; font-weight: 500;
  letter-spacing: 0.02em; word-break: break-all;
}
.sx-x {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: 1px solid var(--sx-line-2); background: transparent; color: var(--sx-dim);
  border-radius: 2px; cursor: pointer; transition: color 0.15s, border-color 0.15s;
}
.sx-x:hover { color: var(--sx-accent); border-color: var(--sx-accent); }
.sx-modal-b { padding: 16px 18px 20px; overflow-y: auto; }
.sx-modal-top { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px; }
.sx-modal-top-l { font-family: var(--sx-mono); font-size: 10px; letter-spacing: 0.12em; color: var(--sx-faint); }
.sx-kvs {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px;
  background: var(--sx-line); border: 1px solid var(--sx-line);
}
.sx-kv { display: flex; flex-direction: column; gap: 4px; padding: 9px 12px; background: var(--sx-panel); }
.sx-kv-k { font-family: var(--sx-mono); font-size: 9px; letter-spacing: 0.16em; color: var(--sx-faint); }
.sx-kv-v { font-family: var(--sx-mono); font-size: 11.5px; color: var(--sx-text); font-variant-numeric: tabular-nums; }
.sx-poly { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 14px; }
.sx-poly span {
  display: flex; align-items: baseline; gap: 9px;
  font-family: var(--sx-mono); font-size: 11px; color: var(--sx-text); font-variant-numeric: tabular-nums;
}
.sx-poly em { font-style: normal; font-size: 9px; letter-spacing: 0.14em; color: var(--sx-faint); }
.sx-raw {
  margin: 0; padding: 13px; max-height: 260px; overflow: auto;
  border: 1px solid var(--sx-line); background: var(--sx-panel-2); color: var(--sx-dim);
  font-family: var(--sx-mono); font-size: 10.5px; line-height: 1.65; white-space: pre; border-radius: 2px;
}
.sx-modal-f {
  display: flex; align-items: center; gap: 9px; padding: 13px 18px;
  border-top: 1px solid var(--sx-line); background: var(--sx-panel);
}
.sx-btn {
  display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px;
  border: 1px solid var(--sx-line-2); background: transparent; color: var(--sx-dim);
  border-radius: 2px; cursor: pointer;
  font-family: var(--sx-mono); font-size: 10px; letter-spacing: 0.14em;
  transition: color 0.15s, border-color 0.15s;
}
.sx-btn:hover { color: var(--sx-accent); border-color: var(--sx-accent); }
.sx-btn-primary {
  margin-left: auto; border-color: var(--sx-accent); background: var(--sx-accent);
  color: var(--sx-bg); font-weight: 600;
}
.sx-btn-primary:hover { color: var(--sx-bg); filter: brightness(1.1); }

/* ---------- footer ---------- */
.sx-foot {
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  margin-top: 26px; padding-top: 12px; border-top: 1px solid var(--sx-line);
  font-family: var(--sx-mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--sx-faint);
}

/* ---------- responsive ---------- */
@media (max-width: 1280px) {
  .sx-filters { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1100px) {
  .sx-grid3 { grid-template-columns: 1fr; }
  .sx-filters { grid-template-columns: repeat(2, 1fr); }
  .sx-counters { grid-template-columns: repeat(2, 1fr); }
  .sx-kvs { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 640px) {
  .sx-wrap { padding: 20px 16px 44px; }
  .sx-filters { grid-template-columns: 1fr; }
  .sx-head-r { width: 100%; }
  .sx-poly { grid-template-columns: 1fr; }
  .sx-modal { max-height: 100vh; }
  .sx-backdrop { padding: 0; }
}
`;
