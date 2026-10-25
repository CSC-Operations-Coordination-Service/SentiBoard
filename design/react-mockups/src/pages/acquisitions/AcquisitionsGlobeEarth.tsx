import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/ui";
import * as THREE from "three";
import ThreeEarth from "@/components/ThreeEarth";
import {
  applyDayNightEarth,
  type DayNightEarth,
} from "@/components/dayNightEarth";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES, expectedTypes } from "@/data/mock";
import { applyStylizedEarth } from "@/components/stylizedEarth";
import {
  AmbientSky,
  MotionToggle,
  ambientRoot,
  useAmbientMotion,
} from "@/components/ambient-motion";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import g from "./acq-globe.module.css";
import {
  prepDatatake,
  subPoint,
  buildFootprint,
  type GeoPoint,
  type PreparedDatatake,
} from "./acqGeometry";

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

const D = Math.PI / 180;

/** HOME_VIEW: §6 — centre lon 4°E, lat 34°N, zoom 1. */
const HOME_VIEW = { lon: 4 as number, lat: 34 as number, zoom: 1 as number };

const DESCRIPTION = (
  <>
    <p>{ACQUISITIONS_DESCRIPTION}</p>
  </>
);

const SPEED_OPTIONS = [1, 10, 60, 600];

/* ---------- map markers (SentiBoard.html#acquisitions) ---------- */

/** How close (great-circle degrees) a satellite's ground point must be for a station to be "in
 *  contact" — the reference's 22°. */
const CONTACT_DEG = 22;

/** The reference's ground-station antenna, in its own canvas units around the station point: a dish
 *  and its rim, the feed arm, the mast and the base. */
const DISH_PATH =
  "M-6.5 -7.5Q-5 1.2 5.2 -1.6M-6.5 -7.5L5.2 -1.6M-0.6 -4.5L2.6 -8.2M-1.2 -1.2L-1.2 4.2M-5 5L2.6 5";

/** A station: the antenna drawn twice (a dark halo under the line, so it reads over any imagery),
 *  the feed's dot, and the name on a dark tag. Cyan, with a ring, while a satellite is in contact. */
function StationMarker({
  name,
  x,
  y,
  contact,
}: {
  name: string;
  x: number;
  y: number;
  contact: boolean;
}) {
  const c = contact ? "#00E5FF" : "#EAF0F6";
  return (
    <div
      className={`${g.stn} ${contact ? g.stnOn : ""}`}
      style={{ left: x, top: y }}
    >
      <svg className={g.stnIcon} viewBox="-14 -14 28 28" aria-hidden>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={DISH_PATH} stroke="rgba(4,8,14,0.85)" strokeWidth="4.2" />
          <path d={DISH_PATH} stroke={c} strokeWidth="1.6" />
        </g>
        <circle cx="2.6" cy="-8.2" r="1.3" fill={c} />
        {contact && (
          <circle
            r="12"
            fill="none"
            stroke="rgba(0,229,255,0.35)"
            strokeWidth="1"
          />
        )}
      </svg>
      <span className={g.stnTag}>{name}</span>
    </div>
  );
}

/** A satellite: a small dot in its colour with a dark edge, and its name in small mono type up and to
 *  the right. The selected datatake's satellite is drawn larger, in white. */
function SatelliteMarker({
  name,
  x,
  y,
  color,
  selected,
}: {
  name: string;
  x: number;
  y: number;
  color: string;
  selected: boolean;
}) {
  return (
    <div
      className={`${g.sat} ${selected ? g.satSel : ""}`}
      style={{ left: x, top: y, ["--c" as string]: color }}
    >
      <i className={g.satDot} />
      <span className={g.satLbl}>{name}</span>
    </div>
  );
}

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Mission group: strips the variant letter suffix (A/B/C) so "Sentinel-2A" → "Sentinel-2". */
const satGroup = (sat: string) => sat.replace(/-[A-C]$/, "");

/* ---------- datatake status colours (the Datatake list's dots) ---------- */
const STATUS_HEX: Record<string, number> = {
  ok: 0x34d399,
  warn: 0xf5b544,
  crit: 0xff5c5c,
};
const statusHexOf = (id: string, fallback: number) => {
  const cls = ACQ_DATATAKES.find((d) => d.id === id)?.cls;
  return (cls && STATUS_HEX[cls]) ?? fallback;
};

/* ---------- the datatake record (SentiBoard.html#acquisitions) ----------
 * The fields the reference shows for a datatake. ACQ_DATATAKES carries only id / sat / comp / status
 * / cls / startIso, so the rest comes from the reference's sample set, keyed by ID. A datatake that
 * is not in this table still opens: its unknown fields read "NA". */
interface DtkDetail {
  rel: number;
  /** downlink pass — `after`: seconds from sensing start to the downlink — or null when there was none */
  pass: { after: number; mb: number; s: number } | null;
}

const DTK_DETAILS: Record<string, DtkDetail> = {
  "S2A-48201-1": { rel: 22, pass: { after: 1213, mb: 18400, s: 41 } },
  "S1C-57622":   { rel: 33, pass: { after: 927,  mb: 11250, s: 29 } },
  "S3B-080-345": { rel: 80, pass: { after: 860,  mb: 9600,  s: 36 } },
  "S2B-42050-1": { rel: 109, pass: { after: 1102, mb: 22600, s: 50 } },
  "S5P-60012":   { rel: 11, pass: { after: 1288, mb: 14100, s: 33 } },
  "S3A-055-358": { rel: 55, pass: null },
  "S1A-60418":   { rel: 141, pass: { after: 1034, mb: 12800, s: 31 } },
  "S2C-10187-1": { rel: 65, pass: { after: 1176, mb: 20900, s: 46 } },
  "S3A-112-207": { rel: 112, pass: { after: 1490, mb: 15300, s: 44 } },
  "S5P-60011":   { rel: 10, pass: { after: 3320, mb: 14600, s: 34 } },
  "S1C-57611":   { rel: 22, pass: { after: 1310, mb: 10400, s: 27 } },
};

const STATION_CODE: Record<string, string> = {
  Svalbard: "SGS",
  Matera: "MTI",
  Maspalomas: "MPS",
  Inuvik: "INU",
  Neustrelitz: "NSG",
};

/** "6m 40s", "41s" */
const fmtDur = (sec: number) => {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
};

/** ISO without the zone, as the reference prints it: 2026-07-16T06:06:52 */
const isoPlus = (start: string, addSec: number) =>
  new Date(Date.parse(`${start}Z`) + addSec * 1000).toISOString().slice(0, 19);

/** The datatake panel: eyebrow, ID and satellite, the status with its glowing dot and a close
 *  button; the completeness headline beside sensing / missing time; then the record, one hairline
 *  row per field. */
function DatatakePanel({
  dt,
  onClose,
}: {
  dt: (typeof ACQ_DATATAKES)[number];
  onClose: () => void;
}) {
  // The datatake's own fields come first (mock.ts carries sensing time, orbit, mode, product
  // levels and station); the reference table fills what the mock does not have — the relative
  // orbit and the downlink pass.
  const ref = DTK_DETAILS[dt.id];
  const unit = dt.unit ?? dt.sat;
  const pct = dt.comp;
  const status = dt.status || "Processing";
  const PILL_COLOR: Record<string, string> = {
    Published: "#00e676",
    Processing: "#9d4edd",
    Failed: "#ff3366",
  };
  const tone = PILL_COLOR[status] ?? "#737373";
  const types: number[] = expectedTypes(dt.levels).map((p) => p.pct as number);
  const dur = dt.sensingS;
  const nTypes = types.length;
  const missing = nTypes
    ? types.reduce((s, p) => s + (1 - p / 100) * dur, 0)
    : null;
  const start = dt.startIso ? noZone(dt.startIso) : null;
  // "MSI · NOBS" → mode NOBS; Sentinel-1 writes "IW · DV": mode IW, polarisation DV
  const modeParts = (dt.mode ?? "")
    .split("·")
    .map((s: string) => s.trim())
    .filter(Boolean);
  const isS1 = unit.startsWith("S1");
  const mode = (isS1 ? modeParts[0] : (modeParts[1] ?? modeParts[0])) ?? "NA";
  const pol = isS1 ? (modeParts[1] ?? "NA") : "NA";
  const orbit = dt.absOrbit ? String(Number(dt.absOrbit)) : "NA";
  const stationName = dt.station;
  const failed = status === "Failed";
  const acq = failed ? 0 : 100;

  const rows: [string, string][] = [
    ["Satellite ID", unit],
    ["Datatake ID", dt.id],
    ["Mode", mode],
    ["Swath", "NA"],
    ["Polarisation", pol],
    ["Observation time start", start ?? "NA"],
    [
      "Observation time stop",
      start ? isoPlus(start, dur) : "NA",
    ],
    ["Observation duration", `${Math.round(dur)} s`],
    ["Orbit absolute", orbit],
    ["Orbit relative", ref ? String(ref.rel) : "NA"],
    [
      "Acquisition status",
      `${failed ? "Failed" : "Acquired"} (${acq.toFixed(2)}%)`,
    ],
    [
      "Publication status",
      `${failed ? "Not published" : status} (${pct.toFixed(2)}%)`,
    ],
  ];
  if (stationName) {
    const code = STATION_CODE[stationName];
    const station = `${stationName}${code ? ` (${code})` : ""}`;
    if (ref?.pass && start)
      rows.push(
        ["Downlink station", station],
        ["Downlink time", isoPlus(start, ref.pass.after)],
        ["Downlink volume", `${ref.pass.mb.toLocaleString("en-US")} Mb`],
        ["Downlink duration", `${ref.pass.s} s`],
      );
    else
      rows.push(
        ["Downlink station", station],
        ["Downlink", ref?.pass === null || failed ? "No pass" : "NA"],
      );
  }

  return (
    <aside className={g.dtkPanel} aria-label={`Datatake ${dt.id}`}>
      <div className={g.dtkHead}>
        <span className={g.dtkSel}>
          <span className={g.dtkEyebrow}>Datatake</span>
          <span className={g.dtkId}>{dt.id}</span>
          <span className={g.dtkMission}>{unit}</span>
        </span>
        <span className={g.dtkHeadR}>
          <span className={g.dtkPill} style={{ color: tone }}>
            {status}
          </span>
          <button
            type="button"
            className={g.dtkClose}
            onClick={onClose}
            aria-label="Close the datatake"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
            >
              <path
                d="M3.5 3.5l9 9M12.5 3.5l-9 9"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </span>
      </div>

      <div className={g.dtkKpi}>
        <div className={g.dtkBig}>
          {pct.toFixed(1)}
          <sup>%</sup>
        </div>
        <dl className={g.dtkAside}>
          <div>
            <dt>Sensing</dt>
            <dd>{fmtDur(dur)}</dd>
          </div>
          <div>
            <dt
              title={`Missing sensing summed across ${nTypes} expected product types`}
            >
              Missing
            </dt>
            <dd className={missing && missing >= 0.5 ? g.dtkGap : ""}>
              {missing === null
                ? "NA"
                : missing < 0.5
                  ? "none"
                  : fmtDur(missing)}
            </dd>
          </div>
        </dl>
      </div>
      {nTypes > 0 && (
        <p className={g.dtkNote}>
          Mean across {nTypes} expected product types · missing time summed
          across types
        </p>
      )}

      <dl className={g.dtkRecord}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

/* ---------- ground tracks (SentiBoard.html#acquisitions) ----------
 * The reference draws no orbit rings in space: each satellite sits on its ground point, trailing a
 * thin white line over the last part of its pass (the selected one also shows where it is heading,
 * dashed). TRAIL_STEPS × TRAIL_STEP radians of orbit ≈ the reference's 24 minutes of a ~100 min
 * orbit. Stations within CONTACT_DEG of a satellite get a faint cyan coverage circle and a dashed
 * link to it. */
const GROUND_R = 1.006; // just above the footprints (1.004–1.005)

/** Ring of points at an angular radius around a unit direction, on a sphere of radius r. */
function capRing(center: THREE.Vector3, angRad: number, r: number, steps = 72) {
  const n = center.clone().normalize();
  const e1 = new THREE.Vector3(0, 1, 0).cross(n);
  if (e1.lengthSq() < 1e-6) e1.set(1, 0, 0);
  e1.normalize();
  const e2 = n.clone().cross(e1);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < steps; i++) {
    const b = (i / steps) * Math.PI * 2;
    pts.push(
      n
        .clone()
        .multiplyScalar(Math.cos(angRad))
        .add(e1.clone().multiplyScalar(Math.cos(b) * Math.sin(angRad)))
        .add(e2.clone().multiplyScalar(Math.sin(b) * Math.sin(angRad)))
        .multiplyScalar(r),
    );
  }
  return pts;
}

/** Writes a short great-circle arc from a to b (both on the sphere) into a line's geometry. */
function setArc(
  line: THREE.Line,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
) {
  const pos = line.geometry.attributes.position as THREE.BufferAttribute;
  const n = pos.count - 1;
  const v = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    v.copy(a)
      .lerp(b, i / n)
      .normalize()
      .multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  line.computeLineDistances();
}

/* ---------- see-through globe (SentiBoard.html#acquisitions) ----------
 * The reference draws the planet on a transparent canvas, so the page's starfield shows all around
 * it, and paints a thin blue atmosphere just outside the rim: a radial gradient from 0.98 to 1.15
 * planet radii, rgba(110,170,255) fading from 34% to nothing. */
const ATMOS_INNER = 0.98;
const ATMOS_OUTER = 1.15;

/** The atmosphere as a camera-facing sprite at the globe's centre. Its texture is the reference's
 *  gradient ring with the disc cut out, so it only ever shows around the planet. */
function makeAtmosphere(): THREE.Sprite {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const mid = size / 2;
  const unit = mid / ATMOS_OUTER; // canvas px per planet radius (at the rim)
  const gr = ctx.createRadialGradient(
    mid,
    mid,
    unit * ATMOS_INNER,
    mid,
    mid,
    mid,
  );
  gr.addColorStop(0, "rgba(110,170,255,0.34)");
  gr.addColorStop(1, "rgba(110,170,255,0)");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(mid, mid, mid, 0, Math.PI * 2);
  ctx.arc(mid, mid, unit * 0.995, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }),
  );
  sprite.name = "Atmosphere";
  sprite.renderOrder = -1; // under the swaths, orbits and satellites
  return sprite;
}

/** Seen from distance d, a unit sphere's rim lies at d/√(d²−1) in the plane through its centre;
 *  the sprite is scaled to that so the ring hugs the rim at every zoom. */
function fitAtmosphere(sprite: THREE.Sprite, camera: THREE.Camera) {
  const d = Math.max(1.05, camera.position.length());
  const rim = d / Math.sqrt(d * d - 1);
  sprite.scale.setScalar(2 * ATMOS_OUTER * rim);
}

/* ---------- the live window: yesterday – today (UTC) ----------
 * The heading, the calendar, the clock and the night side follow today's date: "15 – 16 October
 * 2026" today, "16 – 17 October 2026" tomorrow. mock.ts places every datatake 1–23 h before now,
 * so they always fall inside this window. */
const DAY_MS = 86_400_000;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Today, 00:00 UTC. */
const utcToday = () => {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
};

/** "2026-10-16" for a UTC midnight */
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** An ISO timestamp without the zone or milliseconds, as the reference prints it: 2026-10-16T10:42:01 */
const noZone = (iso: string) => new Date(iso).toISOString().slice(0, 19);

/** "15 – 16 October 2026"; across months "31 October – 1 November 2026"; across years
 *  "31 December 2026 – 1 January 2027". */
function windowLabel(todayMs: number): string {
  const a = new Date(todayMs - DAY_MS);
  const b = new Date(todayMs);
  const [da, ma, ya] = [
    a.getUTCDate(),
    MONTHS[a.getUTCMonth()],
    a.getUTCFullYear(),
  ];
  const [db, mb, yb] = [
    b.getUTCDate(),
    MONTHS[b.getUTCMonth()],
    b.getUTCFullYear(),
  ];
  if (ya !== yb) return `${da} ${ma} ${ya} – ${db} ${mb} ${yb}`;
  if (ma !== mb) return `${da} ${ma} – ${db} ${mb} ${yb}`;
  return `${da} – ${db} ${mb} ${yb}`;
}

const formatSimTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}Z`;
};

/** "imagery": satellite imagery by day, city lights by night (SentiBoard.html). "stylized": the
 *  vector planet of SentiBoard_stylized_globe.html — slate land, cyan coastline, navy sea. */
export type GlobeLook = "imagery" | "stylized";

export default function AcquisitionsGlobeEarthPage({
  look = "imagery",
}: {
  look?: GlobeLook;
} = {}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const motion = useAmbientMotion();

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  /* ---------- §6 view state: single source of truth for globe orientation ---------- */

  /** Current view — lon/lat = centre of view in degrees, zoom = scale factor (0.7–8). */
  const viewRef = useRef({ lon: HOME_VIEW.lon, lat: HOME_VIEW.lat, zoom: HOME_VIEW.zoom });

  /** Running rotateTo animation. */
  const animRef = useRef<{
    fromLon: number; fromLat: number; fromZoom: number;
    dl: number;      // shortest longitude delta
    toLat: number; toZoom: number;
    t0: number; dur: number;
  } | null>(null);

  /** Canvas size; updated by ResizeObserver in handleSceneReady. */
  const canvasSizeRef = useRef({ W: 800, H: 600 });

  /** The canvas element; set in handleSceneReady so aria-label can be refreshed. */
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);

  /** Ref for the wheel-hint div; populated in JSX. */
  const wheelHintRef = useRef<HTMLDivElement | null>(null);

  /** Deferred inter-flight timer (the "out first, then in" two-step). */
  const flyTimerRef = useRef<number | undefined>(undefined);

  /* ---------- datatake selection ---------- */

  /** Index into ACQ_DATATAKES of the selected datatake, or -1. */
  const [selIdx, setSelIdx] = useState(-1);
  const [displayedDtk, setDisplayedDtk] = useState<(typeof ACQ_DATATAKES)[number] | null>(null);
  const closeFadeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [satelliteFilter, setSatelliteFilter] = useState("*");
  const [dayFilter, setDayFilter] = useState("*");

  // The live window, fixed for the life of the page: the simulated clock runs over today (UTC).
  const [todayMs] = useState(utcToday);
  const simDayMs = todayMs;
  const yesterdayStr = ymd(todayMs - DAY_MS);
  const todayStr = ymd(todayMs);
  /** The month the day picker shows (UTC midnight of its 1st); it opens on the current month. */
  const [calMonth, setCalMonth] = useState(() => {
    const t = new Date(todayMs);
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1);
  });
  const [datatakeFilter, setDatatakeFilter] = useState<string>("*");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const footprintMeshesRef = useRef<THREE.Object3D[]>([]);
  const clickableMeshesRef = useRef<THREE.Mesh[]>([]);

  const [stationPositions, setStationPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean; contact: boolean }>
  >({});
  const [satPositions, setSatPositions] = useState<
    Record<string, { x: number; y: number; visible: boolean; color: string }>
  >({});

  // Simulation Time States
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [simTime, setSimTime] = useState<number>(() => {
    const n = new Date();
    return n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds();
  });
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(60);

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const speedMultiplierRef = useRef(speedMultiplier);
  speedMultiplierRef.current = speedMultiplier;

  // The SentiBoard.html planet (day imagery, night lights); its terminator follows the sim clock.
  const dayNightRef = useRef<DayNightEarth | null>(null);
  const atmosphereRef = useRef<THREE.Sprite | null>(null);
  const simTimeRef = useRef(0);
  simTimeRef.current = simTime;
  const stageVisibleRef = useRef(true);
  const stageElRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => dayNightRef.current?.dispose(), []);

  useEffect(() => {
    const map = new Map<string, PreparedDatatake>();
    ACQ_DATATAKES.forEach((dt) => {
      map.set(dt.id, prepDatatake(dt, todayMs));
    });
    prepMapRef.current = map;
  }, [todayMs]);

  useEffect(() => {
    const el = stageElRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { stageVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const satObjectsRef = useRef<
    {
      unit: string;
      prep: PreparedDatatake;
      activeCls: "ok" | "warn" | "crit";
      satGroup: THREE.Group;
      trail: THREE.Line;
      future: THREE.Line;
    }[]
  >([]);
  /** Map from datatake ID → PreparedDatatake, computed once (lazy useState initialiser
   *  runs only on the first render). handleSceneReady (called from ThreeEarth's mount
   *  effect, before any useEffect runs) sees a populated map, and the build cost is not
   *  paid on subsequent renders. The useEffect below replaces it if todayMs ever changes. */
  const [_prepMapState] = useState<Map<string, PreparedDatatake>>(
    () => new Map(ACQ_DATATAKES.map((dt) => [dt.id, prepDatatake(dt, todayMs)]))
  );
  const prepMapRef = useRef(_prepMapState);
  /** Per station: its direction and the coverage circle + dashed links shown while in contact. */
  const stationFxRef = useRef<
    {
      name: string;
      dir: THREE.Vector3;
      cap: THREE.Mesh;
      ring: THREE.LineLoop;
      links: THREE.Line[]; // one per satellite unit
    }[]
  >([]);
  const contactRef = useRef<Record<string, boolean>>({});
  /** The selected datatake's footprint, pulsed by the animation loop. */
  const selectedFootRef = useRef<{
    fill: THREE.MeshBasicMaterial | null;
    line: THREE.LineBasicMaterial;
  } | null>(null);
  const selectedSatRef = useRef<string | null>(null);
  selectedSatRef.current = selIdx >= 0
    ? (ACQ_DATATAKES[selIdx]?.unit ?? null)
    : null;

  /* ---------- stale-closure mirrors (kept current every render) ---------- */
  const selIdxRef = useRef(-1);
  selIdxRef.current = selIdx;
  const openDropdownRef = useRef<string | null>(null);
  openDropdownRef.current = openDropdown;

  // sat+day — base set for keyboard navigation and calendar
  const satDayDatatakes = ACQ_DATATAKES.filter((dt) => {
    if (satelliteFilter !== "*" && dt.sat !== satelliteFilter) return false;
    if (dayFilter !== "*" && !noZone(dt.startIso).startsWith(dayFilter)) return false;
    return true;
  });

  // sat+day+search — populates the Datatake dropdown list (search does not touch globe or KPIs)
  const dropdownDatatakes = satDayDatatakes.filter((dt) => {
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      if (!dt.id.toLowerCase().includes(q) && !dt.sat.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // sat+day+datatake — globe visibility and KPIs (search excluded per decision 5)
  const filteredDatatakes = satDayDatatakes.filter((dt) =>
    datatakeFilter === "*" || dt.id === datatakeFilter,
  );
  const filteredDatatakesRef = useRef(filteredDatatakes);
  filteredDatatakesRef.current = filteredDatatakes;

  /** Sat+day set — used for keyboard `[` `]` navigation across all visible datatakes. */
  const navDatatakesRef = useRef(satDayDatatakes);
  navDatatakesRef.current = satDayDatatakes;

  const datatakesInView = filteredDatatakes.length;
  // §2 formulas — acquired = share not Failed; published = mean pct; failed = pct 0
  const acquired = datatakesInView
    ? Math.round(100 * filteredDatatakes.filter((dt) => dt.status !== "Failed").length / datatakesInView) + "%"
    : "—";
  const published = datatakesInView
    ? Math.round(filteredDatatakes.reduce((s, dt) => s + dt.comp, 0) / datatakesInView) + "%"
    : "—";
  const failedAcquisitions = filteredDatatakes.filter((dt) => dt.comp === 0).length;
  const uniqueSatellites = Array.from(
    new Set(ACQ_DATATAKES.map((dt) => dt.sat)),
  ).sort();

  const latLonToVector3 = (
    latDeg: number,
    lonDeg: number,
    radius: number = 1.004,
  ): THREE.Vector3 => {
    const lat = latDeg * D;
    const lon = (lonDeg + 90) * D;

    return new THREE.Vector3(
      Math.cos(lat) * Math.sin(lon) * radius,
      Math.sin(lat) * radius,
      Math.cos(lat) * Math.cos(lon) * radius,
    );
  };

  /* ---------- §6 camera helpers ---------- */

  /** Apply the current view state to the camera every frame.
   *  Transforms the view direction and up vector through EarthGroup's world quaternion
   *  so HOME_VIEW really is 4°E 34°N with north up regardless of ThreeEarth's initial rotation. */
  const applyView = (cam: THREE.PerspectiveCamera, W: number, H: number) => {
    const view = viewRef.current;
    const radiusPx = 0.39 * Math.min(W, H) * view.zoom;
    const tanHalf = Math.tan((cam.fov * D) / 2);
    const dist = Math.sqrt(1 + Math.pow(H / (2 * radiusPx * tanHalf), 2));

    // Clamp lat to ±89.9 so lookAt never degenerates at the poles
    const clampedLat = Math.max(-89.9, Math.min(89.9, view.lat));
    const latR = clampedLat * D;
    const lonR = (view.lon + 90) * D; // same +90° convention as latLonToVector3

    const localDir = new THREE.Vector3(
      Math.cos(latR) * Math.sin(lonR),
      Math.sin(latR),
      Math.cos(latR) * Math.cos(lonR),
    );
    const localUp = new THREE.Vector3(0, 1, 0);

    // Apply EarthGroup rotation so the home view is geographically correct
    const earthGroup = sceneRef.current?.getObjectByName("EarthGroup");
    if (earthGroup) {
      const q = earthGroup.getWorldQuaternion(new THREE.Quaternion());
      localDir.applyQuaternion(q);
      localUp.applyQuaternion(q);
    }

    cam.position.copy(localDir.multiplyScalar(dist));
    cam.up.copy(localUp);
    cam.lookAt(0, 0, 0);
    if (cam.near !== 0.01) cam.near = 0.01;
    // setViewOffset calls updateProjectionMatrix internally; passing near changes take effect here
    cam.setViewOffset(W, H, 0, 0.04 * H, W, H);
  };

  /** §8 rotateTo: animate lon/lat/zoom from current view, shortest longitude path, 1300 ms. */
  const rotateTo = (toLon: number, toLat: number, toZoom: number) => {
    const v = viewRef.current;
    const dl = ((toLon - v.lon + 540) % 360) - 180;
    animRef.current = {
      fromLon: v.lon, fromLat: v.lat, fromZoom: v.zoom,
      dl, toLat, toZoom,
      t0: performance.now(), dur: 1300,
    };
  };

  /** §8 fitZoom: perspective-correct — projects the footprint's far edge to 30% of min(W,H).
   *  dist = cos(far) + f·sin(far)/want  (pinhole formula for angular radius on a unit sphere)
   *  then inverted through applyView's zoom↔dist mapping so +/− buttons keep working. */
  const fitZoom = (prep: PreparedDatatake): number => {
    const { ring } = buildFootprint(prep);
    const c = latLonToVector3(prep.lat, prep.lon, 1).normalize();
    let far = 0;
    ring.forEach(([lo, la]: GeoPoint) => {
      far = Math.max(far, c.angleTo(latLonToVector3(la, lo, 1).normalize()));
    });
    const cam = cameraRef.current as THREE.PerspectiveCamera | null;
    const { W, H } = canvasSizeRef.current;
    const tanHalf = Math.tan(((cam?.fov ?? 50) * D) / 2);
    const f = (H / 2) / tanHalf;                           // focal length in pixels
    const want = 0.3 * Math.min(W, H);                     // desired footprint radius, px
    const dist = Math.cos(far) + (f * Math.sin(far)) / want;
    // invert applyView: dist = sqrt(1 + (H/(2·radiusPx·tanHalf))²)
    const zoom = H / (2 * tanHalf * Math.sqrt(Math.max(1e-6, dist * dist - 1)) * 0.39 * Math.min(W, H));
    return Math.max(1.4, Math.min(5, zoom));
  };

  /* ---------- §8 select / deselect (also updates aria-label) ---------- */

  const updateAriaLabel = () => {
    if (!canvasElRef.current) return;
    const v = viewRef.current;
    const selDt = selIdxRef.current >= 0 ? ACQ_DATATAKES[selIdxRef.current] : null;
    const sel = selDt ? ` · ${selDt.id} selected` : "";
    canvasElRef.current.setAttribute(
      "aria-label",
      `Globe — lon ${Math.round(v.lon)}°, lat ${Math.round(v.lat)}°, zoom ${v.zoom.toFixed(1)}×${sel}`,
    );
  };

  /** Select datatake by ACQ_DATATAKES index; fly=true triggers the rotateTo animation. */
  const doSelect = (idx: number, fly: boolean) => {
    window.clearTimeout(flyTimerRef.current);
    const wasIdx = selIdxRef.current;
    setSelIdx(idx);
    updateAriaLabel();

    if (!fly || idx < 0) return;
    const dt = ACQ_DATATAKES[idx];
    if (!dt) return;
    const prep = prepMapRef.current.get(dt.id);
    const z = prep ? fitZoom(prep) : 2;
    if (wasIdx >= 0 && wasIdx !== idx && viewRef.current.zoom > 1.6) {
      // out a little first, then in after 520 ms (§8)
      rotateTo(viewRef.current.lon, viewRef.current.lat, 1.2);
      flyTimerRef.current = window.setTimeout(() => {
        if (selIdxRef.current === idx) rotateTo(dt.lon, dt.lat, z);
      }, 520);
    } else {
      rotateTo(dt.lon, dt.lat, z);
    }
  };

  /** Deselect; fly=true flies back to HOME_VIEW zoom 1 (§8). */
  const doDeselect = (fly: boolean) => {
    window.clearTimeout(flyTimerRef.current);
    setSelIdx(-1);
    updateAriaLabel();
    if (fly) rotateTo(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
  };

  // Stable refs so the handlers created once in handleSceneReady always call the latest versions
  const doSelectRef = useRef(doSelect);
  doSelectRef.current = doSelect;
  const doDeselectRef = useRef(doDeselect);
  doDeselectRef.current = doDeselect;
  const rotateToRef = useRef(rotateTo);
  rotateToRef.current = rotateTo;

  /** Selecting from the dropdown still sets the datatake filter (existing filter behaviour). */
  const handleSelectDatatake = (dtId: string) => {
    const index = ACQ_DATATAKES.findIndex((dt) => dt.id === dtId);
    if (index >= 0) {
      setDatatakeFilter(dtId);
      doSelect(index, true);
    }
  };

  /** Closing from the panel resets the filter and deselects (with flight home). */
  const closeDatatake = () => {
    setDatatakeFilter("*");
    doDeselect(true);
  };

  const handleSelectDatatakeRef = useRef(handleSelectDatatake);
  handleSelectDatatakeRef.current = handleSelectDatatake;
  const closeDatatakeRef = useRef(closeDatatake);
  closeDatatakeRef.current = closeDatatake;

  // Keep the panel mounted while the column fades closed (820 ms = flex-basis transition).
  useEffect(() => {
    if (selIdx >= 0 && ACQ_DATATAKES[selIdx]) {
      clearTimeout(closeFadeRef.current);
      setDisplayedDtk(ACQ_DATATAKES[selIdx]);
    } else {
      closeFadeRef.current = setTimeout(() => setDisplayedDtk(null), 820);
    }
    return () => clearTimeout(closeFadeRef.current);
  }, [selIdx]);

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speedMultiplier);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSpeedMultiplier(SPEED_OPTIONS[nextIndex]);
  };

  // Deselect (with flight home) if the current satellite or day filter now hides the chosen datatake.
  useEffect(() => {
    if (datatakeFilter === "*") return;
    const stillVisible = ACQ_DATATAKES.some((dt) => {
      if (dt.id !== datatakeFilter) return false;
      if (satelliteFilter !== "*" && dt.sat !== satelliteFilter) return false;
      if (dayFilter !== "*" && !noZone(dt.startIso).startsWith(dayFilter)) return false;
      return true;
    });
    if (!stillVisible) closeDatatakeRef.current();
  }, [satelliteFilter, dayFilter, datatakeFilter]);

  // The page opens on every datatake, none selected (SentiBoard.html): the user picks one from the
  // Datatake list or by clicking its footprint.

  useEffect(() => {
    const allowedIds = new Set(filteredDatatakes.map((dt) => dt.id));

    clickableMeshesRef.current.forEach((mesh) => {
      const dtId = mesh.userData.datatakeId;
      mesh.visible = allowedIds.has(dtId);
    });

    // Footprints take their datatake's status colour, as the reference does: green published,
    // amber processing, red failed. The selected one is matched by ID (the swath list and the
    // datatake list are not in the same order), pulses in the animation loop and gets a white edge.
    const selectedId = selIdx >= 0 ? ACQ_DATATAKES[selIdx]?.id : undefined;
    const anySelected = !!selectedId && allowedIds.has(selectedId);
    selectedFootRef.current = null;

    footprintMeshesRef.current.forEach((mesh) => {
      const line = mesh as THREE.Line;
      const dtId = line.userData?.datatakeId as string;
      line.visible = allowedIds.has(dtId);

      const lineMat = line.material as THREE.LineBasicMaterial;
      const fillMesh = line.userData?.fillMesh as THREE.Mesh;
      const fillMat = fillMesh?.material as THREE.MeshBasicMaterial;
      const color = statusHexOf(dtId, line.userData?.baseColor || 0x00e5ff);

      if (fillMat) fillMat.color.set(color);
      if (dtId === selectedId) {
        lineMat.color.set(0xffffff);
        lineMat.opacity = 1.0;
        if (fillMat) fillMat.opacity = 0.43;
        selectedFootRef.current = { fill: fillMat ?? null, line: lineMat };
      } else {
        lineMat.color.set(color);
        lineMat.opacity = 0.9;
        if (fillMat) fillMat.opacity = anySelected ? 0.14 : 0.24;
      }
    });
  }, [filteredDatatakes, selIdx]);

  const addDataOverlays = (scene: THREE.Scene, overlayGroup: THREE.Group) => {
    if (!scene) return;

    const earthGroup = scene.getObjectByName("EarthGroup") || scene;
    overlayGroup.name = "DataOverlays";
    earthGroup.add(overlayGroup);

    footprintMeshesRef.current = [];
    clickableMeshesRef.current = [];
    satObjectsRef.current = [];

    // Build footprints from orbital mechanics
    ACQ_DATATAKES.forEach((dt, idx) => {
      const prep = prepMapRef.current.get(dt.id);
      if (!prep) return;
      const { left, right, ring } = buildFootprint(prep);
      const colHex = STATUS_HEX[dt.cls] ?? 0x00e5ff;
      const fillR = 1.004;
      const outlineR = 1.005;
      const wideSwath = dt.swathKm > 500;
      const slerpSteps = wideSwath ? 6 : 0;

      const positions: number[] = [];
      for (let k = 0; k < 24; k++) {
        const L0 = left[k];
        const L1 = left[k + 1];
        const R0 = right[k];
        const R1 = right[k + 1];

        if (slerpSteps > 0) {
          const getV = (lo: GeoPoint, ro: GeoPoint, f: number): THREE.Vector3 => {
            const vl = latLonToVector3(lo[1], lo[0], fillR);
            const vr = latLonToVector3(ro[1], ro[0], fillR);
            return vl.clone().lerp(vr, f).normalize().multiplyScalar(fillR);
          };
          for (let s = 0; s < slerpSteps; s++) {
            const f0 = s / slerpSteps;
            const f1 = (s + 1) / slerpSteps;
            const p00 = getV(L0, R0, f0);
            const p10 = getV(L1, R1, f0);
            const p11 = getV(L1, R1, f1);
            const p01 = getV(L0, R0, f1);
            positions.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p11.x, p11.y, p11.z);
            positions.push(p00.x, p00.y, p00.z, p11.x, p11.y, p11.z, p01.x, p01.y, p01.z);
          }
        } else {
          const p00 = latLonToVector3(L0[1], L0[0], fillR);
          const p10 = latLonToVector3(L1[1], L1[0], fillR);
          const p11 = latLonToVector3(R1[1], R1[0], fillR);
          const p01 = latLonToVector3(R0[1], R0[0], fillR);
          positions.push(p00.x, p00.y, p00.z, p10.x, p10.y, p10.z, p11.x, p11.y, p11.z);
          positions.push(p00.x, p00.y, p00.z, p11.x, p11.y, p11.z, p01.x, p01.y, p01.z);
        }
      }

      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      const fillMat = new THREE.MeshBasicMaterial({
        color: colHex,
        opacity: 0.24,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.renderOrder = 14 + idx;
      fillMesh.userData = { datatakeId: dt.id };
      overlayGroup.add(fillMesh);
      clickableMeshesRef.current.push(fillMesh);

      const ringPts = ring.map(([lo, la]: GeoPoint) => latLonToVector3(la, lo, outlineR));
      const lineGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
      const lineMat = new THREE.LineBasicMaterial({
        color: colHex,
        opacity: 1.0,
        transparent: true,
        depthWrite: false,
        depthTest: true,
      });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      lineMesh.renderOrder = 18 + idx;
      lineMesh.userData = { datatakeId: dt.id, fillMesh, baseColor: colHex };
      overlayGroup.add(lineMesh);
      footprintMeshesRef.current.push(lineMesh);
    });

    // One Three.js group per unique satellite unit
    const satUnits = Array.from(new Set(ACQ_DATATAKES.map((dt) => dt.unit)));
    satUnits.forEach((unit) => {
      const satGroup = new THREE.Group();
      overlayGroup.add(satGroup);

      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Array(31 * 3).fill(0), 3),
      );
      const trail = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
          depthTest: true,
        }),
      );
      trail.renderOrder = 30;
      overlayGroup.add(trail);

      const futureGeo = new THREE.BufferGeometry();
      futureGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(new Array(31 * 3).fill(0), 3),
      );
      const future = new THREE.Line(
        futureGeo,
        new THREE.LineDashedMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.45,
          dashSize: 0.008,
          gapSize: 0.016,
          depthWrite: false,
          depthTest: true,
        }),
      );
      future.renderOrder = 30;
      future.visible = false;
      overlayGroup.add(future);

      const firstDt = ACQ_DATATAKES.find((dt) => dt.unit === unit);
      const initialPrep = firstDt ? prepMapRef.current.get(firstDt.id) : undefined;
      if (!initialPrep) return;

      satObjectsRef.current.push({
        unit,
        prep: initialPrep,
        activeCls: firstDt?.cls ?? "ok",
        satGroup,
        trail,
        future,
      });
    });

    // Stations: a 22° coverage cap + ring and one dashed link per satellite unit
    stationFxRef.current = STATIONS.map((st) => {
      const dir = latLonToVector3(st.lat, st.lon, 1).normalize();
      const ringPts = capRing(dir, CONTACT_DEG * D, 1.003);

      const capPos: number[] = [];
      const c = dir.clone().multiplyScalar(1.003);
      ringPts.forEach((p, i) => {
        const q = ringPts[(i + 1) % ringPts.length];
        capPos.push(c.x, c.y, c.z, p.x, p.y, p.z, q.x, q.y, q.z);
      });
      const capGeo = new THREE.BufferGeometry();
      capGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(capPos, 3),
      );
      const cap = new THREE.Mesh(
        capGeo,
        new THREE.MeshBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.06,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      cap.renderOrder = 10;
      cap.visible = false;

      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        }),
      );
      ring.renderOrder = 11;
      ring.visible = false;

      const links = satUnits.map(() => {
        const linkGeo = new THREE.BufferGeometry();
        linkGeo.setAttribute(
          "position",
          new THREE.Float32BufferAttribute(new Array(25 * 3).fill(0), 3),
        );
        const link = new THREE.Line(
          linkGeo,
          new THREE.LineDashedMaterial({
            color: 0x00e5ff,
            transparent: true,
            opacity: 0.75,
            dashSize: 0.006,
            gapSize: 0.006,
            depthWrite: false,
          }),
        );
        link.renderOrder = 31;
        link.visible = false;
        overlayGroup.add(link);
        return link;
      });

      overlayGroup.add(cap, ring);
      return { name: st.name, dir, cap, ring, links };
    });
  };

  const handleSceneReady = (
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
  ) => {
    sceneRef.current = scene;
    cameraRef.current = camera as THREE.PerspectiveCamera;
    rendererRef.current = renderer;

    const cam = camera as THREE.PerspectiveCamera;
    cam.near = 0.01;
    cam.updateProjectionMatrix();

    // See-through background: no scene colour, a fully transparent clear, and no CSS fill on the
    // canvas or its wrapper — the page's starfield (SpaceBackdrop) shows around the planet.
    scene.background = null;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.background = "transparent";
    if (renderer.domElement.parentElement)
      renderer.domElement.parentElement.style.background = "transparent";
    // setClearColor's alpha only counts if the WebGL context itself has an alpha channel, which is
    // fixed when ThreeEarth creates its renderer. Without it the clear stays opaque black.
    if (renderer.getContext().getContextAttributes()?.alpha === false) {
      console.warn(
        "[AcquisitionsGlobe] ThreeEarth's WebGLRenderer has no alpha channel, so the globe's " +
          "background cannot be transparent. Create it with `new THREE.WebGLRenderer({ alpha: true, ... })`.",
      );
    }

    // the thin atmosphere around the rim
    atmosphereRef.current?.removeFromParent();
    const atmosphere = makeAtmosphere();
    fitAtmosphere(atmosphere, camera);
    scene.add(atmosphere);
    atmosphereRef.current = atmosphere;

    // Swap the Earth's material before the overlays are added, so only the sphere itself is matched.
    dayNightRef.current?.dispose();
    dayNightRef.current = (
      look === "stylized" ? applyStylizedEarth : applyDayNightEarth
    )(scene, simDayMs + simTimeRef.current * 1000);

    const overlayGroup = new THREE.Group();
    addDataOverlays(scene, overlayGroup);

    /* ---------- canvas setup ---------- */
    const canvas = renderer.domElement;
    canvasElRef.current = canvas;
    canvas.tabIndex = 0;
    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";

    // Track canvas size for applyView; apply HOME_VIEW immediately
    const updateSize = () => {
      canvasSizeRef.current = {
        W: canvas.clientWidth || 800,
        H: canvas.clientHeight || 600,
      };
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(canvas);

    const { W, H } = canvasSizeRef.current;
    applyView(cam, W, H);
    updateAriaLabel();

    /* ---------- interaction ---------- */
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2();
    const globeSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1.0);

    type DragState = {
      startX: number; startY: number;
      startLon: number; startLat: number;
      moved: boolean; pid: number;
    };
    let dragState: DragState | null = null;
    let hintTimer: number | undefined;

    const showHint = () => {
      const el = wheelHintRef.current;
      if (!el) return;
      window.clearTimeout(hintTimer);
      el.classList.add(g.acqWheelHintOn);
      hintTimer = window.setTimeout(() => {
        el.classList.remove(g.acqWheelHintOn);
      }, 1300);
    };

    const onPointerDown = (e: PointerEvent) => {
      animRef.current = null;
      window.clearTimeout(flyTimerRef.current);
      dragState = {
        startX: e.clientX, startY: e.clientY,
        startLon: viewRef.current.lon, startLat: viewRef.current.lat,
        moved: false, pid: e.pointerId,
      };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
      e.preventDefault();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragState || e.pointerId !== dragState.pid) return;
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 3)
        dragState.moved = true;
      if (!dragState.moved) return;
      const k = 0.25 / viewRef.current.zoom;
      viewRef.current = {
        lon: dragState.startLon - dx * k,
        lat: Math.max(-90, Math.min(90, dragState.startLat + dy * k)),
        zoom: viewRef.current.zoom,
      };
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!dragState || e.pointerId !== dragState.pid) return;
      const moved = dragState.moved;
      dragState = null;
      canvas.style.cursor = "grab";

      if (!moved) {
        const rect = canvas.getBoundingClientRect();
        mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouseVec, cam);

        // Globe hit — near side only
        const hitTarget = new THREE.Vector3();
        const globeHit = raycaster.ray.intersectSphere(globeSphere, hitTarget);
        const globeDist = globeHit
          ? hitTarget.distanceTo(raycaster.ray.origin)
          : Infinity;

        // Footprint hit (ignore anything behind the globe surface)
        const activeClickables = clickableMeshesRef.current.filter(
          (m) => m.visible,
        );
        const intersects = raycaster.intersectObjects(activeClickables, false);
        const fpHit = intersects.find((i) => i.distance <= globeDist + 1e-3);

        if (fpHit) {
          const dtId = (fpHit.object as THREE.Mesh).userData.datatakeId as string;
          if (dtId === ACQ_DATATAKES[selIdxRef.current]?.id) {
            closeDatatakeRef.current(); // click selected footprint → deselect + clear filter
          } else {
            handleSelectDatatakeRef.current(dtId);
          }
        } else if (globeHit && selIdxRef.current >= 0) {
          closeDatatakeRef.current(); // click empty globe → deselect + clear filter
        }
      }
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (dragState && e.pointerId === dragState.pid) {
        dragState = null;
        canvas.style.cursor = "grab";
      }
    };

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) {
        // plain scroll — page scrolls; show zoom hint
        showHint();
        return; // no preventDefault so the page scrolls
      }
      e.preventDefault();
      animRef.current = null;
      window.clearTimeout(flyTimerRef.current);
      const v = viewRef.current;
      viewRef.current = {
        ...v,
        zoom: Math.max(0.7, Math.min(8, v.zoom * Math.exp(-e.deltaY * 0.004))),
      };
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const v = viewRef.current;
      const step = e.shiftKey ? 12 : 4;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          viewRef.current = { ...v, lon: v.lon - step };
          break;
        case "ArrowRight":
          e.preventDefault();
          viewRef.current = { ...v, lon: v.lon + step };
          break;
        case "ArrowUp":
          e.preventDefault();
          viewRef.current = { ...v, lat: Math.min(90, v.lat + step) };
          break;
        case "ArrowDown":
          e.preventDefault();
          viewRef.current = { ...v, lat: Math.max(-90, v.lat - step) };
          break;
        case "+":
        case "=":
          e.preventDefault();
          viewRef.current = { ...v, zoom: Math.min(8, v.zoom * 1.2) };
          break;
        case "-":
          e.preventDefault();
          viewRef.current = { ...v, zoom: Math.max(0.7, v.zoom / 1.2) };
          break;
        case "0": {
          e.preventDefault();
          window.clearTimeout(flyTimerRef.current);
          if (selIdxRef.current >= 0) {
            closeDatatakeRef.current();
          } else {
            rotateToRef.current(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
          }
          break;
        }
        case "[": {
          e.preventDefault();
          const nav = navDatatakesRef.current;
          if (!nav.length) break;
          const selId =
            selIdxRef.current >= 0
              ? ACQ_DATATAKES[selIdxRef.current]?.id
              : null;
          const navPos = selId ? nav.findIndex((d) => d.id === selId) : -1;
          const prev = navPos <= 0 ? nav.length - 1 : navPos - 1;
          handleSelectDatatakeRef.current(nav[prev].id);
          break;
        }
        case "]": {
          e.preventDefault();
          const nav = navDatatakesRef.current;
          if (!nav.length) break;
          const selId =
            selIdxRef.current >= 0
              ? ACQ_DATATAKES[selIdxRef.current]?.id
              : null;
          const navPos = selId ? nav.findIndex((d) => d.id === selId) : -1;
          const next =
            navPos < 0 || navPos >= nav.length - 1 ? 0 : navPos + 1;
          handleSelectDatatakeRef.current(nav[next].id);
          break;
        }
        case "Enter":
          e.preventDefault();
          setIsPlaying((p) => !p);
          break;
        default:
          break;
      }
    };

    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openDropdownRef.current !== null) {
        setOpenDropdown(null);
      } else if (selIdxRef.current >= 0) {
        closeDatatakeRef.current();
      }
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("keydown", onKeyDown);
    document.addEventListener("keydown", onDocKeyDown);

    return () => {
      ro.disconnect();
      window.clearTimeout(hintTimer);
      atmosphere.removeFromParent();
      atmosphere.material.map?.dispose();
      atmosphere.material.dispose();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keydown", onDocKeyDown);

      // Dispose footprint fill + outline geometry/material
      clickableMeshesRef.current.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      footprintMeshesRef.current.forEach((m) => {
        (m as THREE.Line).geometry.dispose();
        ((m as THREE.Line).material as THREE.Material).dispose();
      });
      // Dispose satellite trail/future geometry/material
      satObjectsRef.current.forEach((sat) => {
        sat.trail.geometry.dispose();
        (sat.trail.material as THREE.Material).dispose();
        sat.future.geometry.dispose();
        (sat.future.material as THREE.Material).dispose();
      });
      // Dispose station cap/ring/links
      stationFxRef.current.forEach((fx) => {
        fx.cap.geometry.dispose();
        (fx.cap.material as THREE.Material).dispose();
        fx.ring.geometry.dispose();
        (fx.ring.material as THREE.Material).dispose();
        fx.links.forEach((lnk) => {
          lnk.geometry.dispose();
          (lnk.material as THREE.Material).dispose();
        });
      });
    };
  };

  useEffect(() => {
    let animId: number;
    let lastTimestamp = performance.now();

    const animateSatellites = (now: number) => {
      const deltaSec = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      if (isPlayingRef.current) {
        setSimTime((prevTime) => {
          const nextTime =
            (prevTime + deltaSec * speedMultiplierRef.current) % 86400;
          return nextTime;
        });
      }

      /* ---------- §6/§8 camera: apply rotateTo animation then applyView ---------- */
      const anim = animRef.current;
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / anim.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        viewRef.current = {
          lon: anim.fromLon + anim.dl * e,
          lat: anim.fromLat + (anim.toLat - anim.fromLat) * e,
          zoom: anim.fromZoom + (anim.toZoom - anim.fromZoom) * e,
        };
        if (k >= 1) animRef.current = null;
      }

      if (cameraRef.current && rendererRef.current) {
        const { W, H } = canvasSizeRef.current;
        applyView(cameraRef.current as THREE.PerspectiveCamera, W, H);

        // §6: zoomed mask toggles on zoom > 1.3 (not camera distance)
        rendererRef.current.domElement.classList.toggle(
          g.globeZoomed,
          viewRef.current.zoom > 1.3,
        );
      }

      dayNightRef.current?.setTime(simDayMs + simTimeRef.current * 1000);

      // keep the atmosphere on the rim as the camera zooms
      if (atmosphereRef.current && cameraRef.current)
        fitAtmosphere(atmosphereRef.current, cameraRef.current);

      // Satellites on their ground points, with their trails (and the selected one's track ahead)
      const simTimeMin = simTimeRef.current / 60;
      const filtered = filteredDatatakesRef.current;
      const selectedDtId =
        selIdxRef.current >= 0
          ? (ACQ_DATATAKES[selIdxRef.current]?.id ?? null)
          : null;

      satObjectsRef.current.forEach((sat) => {
        // Pick active datatake: selected one wins, otherwise first in filtered set
        const unitFiltered = filtered.filter((dt) => dt.unit === sat.unit);
        const hasFiltered = unitFiltered.length > 0;
        sat.satGroup.visible = hasFiltered;
        sat.trail.visible = hasFiltered;
        if (!hasFiltered) { sat.future.visible = false; return; }

        const selectedDt = selectedDtId
          ? ACQ_DATATAKES.find((dt) => dt.id === selectedDtId && dt.unit === sat.unit)
          : undefined;
        const activeDt = selectedDt ?? unitFiltered[0];
        const prep = prepMapRef.current.get(activeDt.id);
        if (!prep) return;
        sat.prep = prep;
        sat.activeCls = activeDt.cls;

        const [lon, lat] = subPoint(prep, simTimeMin);
        sat.satGroup.position.copy(latLonToVector3(lat, lon, GROUND_R));

        const selected = selectedSatRef.current === sat.unit;
        const tp = sat.trail.geometry.attributes.position as THREE.BufferAttribute;
        const fp = sat.future.geometry.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < 31; k++) {
          const [blo, bla] = subPoint(prep, simTimeMin - (30 - k) * 0.8);
          const bv = latLonToVector3(bla, blo, GROUND_R);
          tp.setXYZ(k, bv.x, bv.y, bv.z);
          if (selected) {
            const [flo, fla] = subPoint(prep, simTimeMin + k * 0.8);
            const fv = latLonToVector3(fla, flo, GROUND_R);
            fp.setXYZ(k, fv.x, fv.y, fv.z);
          }
        }
        tp.needsUpdate = true;
        const trailMat = sat.trail.material as THREE.LineBasicMaterial;
        trailMat.opacity = selected ? 0.7 : 0.28;
        sat.future.visible = selected;
        if (selected) {
          fp.needsUpdate = true;
          sat.future.computeLineDistances();
        }
      });

      // Stations: coverage circle and one dashed link per satellite in range
      const contactCos = Math.cos(CONTACT_DEG * D);
      const contacts: Record<string, boolean> = {};
      stationFxRef.current.forEach((fx) => {
        let anyContact = false;
        satObjectsRef.current.forEach((sat, si) => {
          const lnk = fx.links[si];
          if (!lnk) return;
          if (!sat.satGroup.visible) { lnk.visible = false; return; }
          const d = sat.satGroup.position.clone().normalize();
          const inRange = d.dot(fx.dir) > contactCos;
          lnk.visible = inRange;
          if (inRange) {
            setArc(lnk, d, fx.dir, 1.007);
            lnk.computeLineDistances();
            anyContact = true;
          }
        });
        contacts[fx.name] = anyContact;
        fx.cap.visible = anyContact;
        fx.ring.visible = anyContact;
      });
      contactRef.current = contacts;

      // the selected footprint breathes, as in the reference (fill 0.34–0.52)
      if (selectedFootRef.current?.fill) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 420);
        selectedFootRef.current.fill.opacity = 0.34 + 0.18 * pulse;
      }

      if (stageVisibleRef.current && cameraRef.current && rendererRef.current && sceneRef.current) {
        const camera = cameraRef.current as THREE.PerspectiveCamera;
        const renderer = rendererRef.current;
        const cvs = renderer.domElement;

        const stationPosMap: Record<
          string,
          { x: number; y: number; visible: boolean; contact: boolean }
        > = {};
        const satPosMap: Record<
          string,
          { x: number; y: number; visible: boolean; color: string }
        > = {};

        const earthGroup = sceneRef.current.getObjectByName("EarthGroup");
        const camPos = camera.position.clone();
        const camDir = camPos.clone().normalize();
        const camDist = camPos.length();

        STATIONS.forEach((station) => {
          const localPos = latLonToVector3(station.lat, station.lon, 1.0);

          const worldPos = earthGroup
            ? localPos.clone().applyMatrix4(earthGroup.matrixWorld)
            : localPos;

          const isVisible =
            worldPos.clone().normalize().dot(camDir) > 1 / camDist;

          const vector = worldPos.clone().project(camera);

          stationPosMap[station.name] = {
            x: (vector.x * 0.5 + 0.5) * cvs.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * cvs.clientHeight,
            visible: isVisible,
            contact: !!contactRef.current[station.name],
          };
        });

        satObjectsRef.current.forEach((sat) => {
          if (!sat.satGroup.visible) return;
          const worldPos = sat.satGroup.getWorldPosition(new THREE.Vector3());
          const isVisible =
            worldPos.clone().normalize().dot(camDir) > 1 / camDist;
          const vector = worldPos.clone().project(camera);
          satPosMap[sat.unit] = {
            x: (vector.x * 0.5 + 0.5) * cvs.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * cvs.clientHeight,
            visible: isVisible,
            color: hex(STATUS_HEX[sat.activeCls] ?? 0x8a96a8),
          };
        });

        setStationPositions(stationPosMap);
        setSatPositions(satPosMap);
      }

      animId = requestAnimationFrame(animateSatellites);
    };

    animId = requestAnimationFrame(animateSatellites);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      className={ambientRoot(motion.paused)}
      style={{
        background: "#020409",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        paddingBottom: "calc(var(--sb-earth-h, 190px) + 32px)",
      }}
    >
      <SpaceBackdrop page={1} paused={motion.paused} />
      <PageHeader
        title="Acquisitions Status"
        subtitle="Past, current and planned Sentinel acquisitions on an interactive 3D globe."
        desc={DESCRIPTION}
        img="/assets/img/modules/acquisitions.jpg"
      />

      {/* KPIs: value over label, risen into the header's faded bottom (SentiBoard.html) */}
      <div className={g.kpis}>
        <div className={g.kpi}>
          <b className={g.kpiV}>{datatakesInView}</b>
          <span className={g.kpiK}>Datatakes in view</span>
        </div>
        <div className={g.kpi}>
          <b className={g.kpiV}>{acquired}</b>
          <span className={g.kpiK}>Acquired</span>
        </div>
        <div className={g.kpi}>
          <b className={g.kpiV}>{published}</b>
          <span className={g.kpiK}>Published</span>
        </div>
        <div className={g.kpi}>
          <b className={`${g.kpiV} ${failedAcquisitions > 0 ? g.kpiCrit : ""}`}>
            {failedAcquisitions}
          </b>
          <span className={g.kpiK}>Failed acquisitions</span>
        </div>
      </div>

      {/* FILTER TOOLBAR: heading + three in-flow dropdowns + search */}
      <div className={g.toolbar}>
        <h2 className={g.tbHeading}>
          {dayFilter === "*"
            ? windowLabel(todayMs)
            : `${+dayFilter.slice(8)} ${MONTHS[+dayFilter.slice(5, 7) - 1]} ${dayFilter.slice(0, 4)}`}
        </h2>

        {/* SATELLITE */}
        <div className={`${g.fdrop} ${g.fdropSat}`}>
          <button
            type="button"
            className={g.fdropHead}
            aria-expanded={openDropdown === "sat"}
            onClick={() => setOpenDropdown(openDropdown === "sat" ? null : "sat")}
          >
            <span className={g.fdropLabel}>Satellite</span>
            <span className={g.fdropVal}>
              {satelliteFilter === "*" ? "All" : satelliteFilter.replace("Sentinel-", "S")}
            </span>
            <Chevron />
          </button>
          <div
            className={g.fdropBody}
            style={{ gridTemplateRows: openDropdown === "sat" ? "1fr" : "0fr" }}
            aria-hidden={openDropdown !== "sat" ? true : undefined}
            ref={(el) => { if (el) el.inert = openDropdown !== "sat"; }}
          >
            <div className={g.fdropInner}>
              <div className={g.fdropPad}>
                {["*", ...uniqueSatellites].map((sat) => (
                  <button
                    key={sat}
                    type="button"
                    className={`${g.fitem} ${satelliteFilter !== "*" && sat !== satelliteFilter ? g.off : ""}`}
                    onClick={() => { setSatelliteFilter(sat); setOpenDropdown(null); }}
                  >
                    <u>{sat === "*" ? "All satellites" : sat}</u>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* DAY OF ACQUISITION */}
        <div className={`${g.fdrop} ${g.fdropDay}`}>
          <button
            type="button"
            className={g.fdropHead}
            aria-expanded={openDropdown === "day"}
            onClick={() => setOpenDropdown(openDropdown === "day" ? null : "day")}
          >
            <span className={g.fdropLabel}>Day of acquisition</span>
            <span className={g.fdropVal}>
              {dayFilter === "*"
                ? "Any"
                : dayFilter.slice(8) + " " + MONTHS[+dayFilter.slice(5, 7) - 1].slice(0, 3)}
            </span>
            <Chevron />
          </button>
          <div
            className={g.fdropBody}
            style={{ gridTemplateRows: openDropdown === "day" ? "1fr" : "0fr" }}
            aria-hidden={openDropdown !== "day" ? true : undefined}
            ref={(el) => { if (el) el.inert = openDropdown !== "day"; }}
          >
            <div className={g.fdropInner}>
              <div className={g.fdropPad}>
              <button
                type="button"
                className={`${g.fitem} ${g.acqAnyday} ${dayFilter !== "*" ? g.off : ""}`}
                onClick={() => { setDayFilter("*"); setOpenDropdown(null); }}
              >
                <u>Any day</u>
              </button>
              {(() => {
                const datesWithData = new Set(
                  ACQ_DATATAKES
                    .filter((dt) => satelliteFilter === "*" || dt.sat === satelliteFilter)
                    .map((dt) => noZone(dt.startIso).slice(0, 10)),
                );
                const m = new Date(calMonth);
                const year = m.getUTCFullYear();
                const month = m.getUTCMonth();
                const step = (by: number) => setCalMonth(Date.UTC(year, month + by, 1));
                const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
                const leadBlanks = (new Date(calMonth).getUTCDay() + 6) % 7;
                return (
                  <div className={g.calMonth}>
                    <div className={g.calMonthHead}>
                      <button type="button" className={g.calNav} aria-label="Previous month" onClick={() => step(-1)}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      </button>
                      <b className={g.calMonthLabel}>{MONTHS[month]} {year}</b>
                      <button type="button" className={g.calNav} aria-label="Next month" onClick={() => step(1)}>
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      </button>
                    </div>
                    <div className={g.calGrid}>
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <span key={i} className={g.calDow}>{d}</span>
                      ))}
                      {Array.from({ length: leadBlanks }, (_, i) => <span key={`b${i}`} />)}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const dayNum = i + 1;
                        const dateStr = ymd(calMonth + i * DAY_MS);
                        const has = datesWithData.has(dateStr);
                        const isOn = dayFilter === dateStr;
                        return has ? (
                          <button
                            key={dayNum}
                            type="button"
                            className={`${g.calDay} ${g.calHas}${isOn ? ` ${g.calOn}` : ""}`}
                            onClick={() => { setDayFilter(dateStr); setOpenDropdown(null); }}
                          >
                            {dayNum}<i />
                          </button>
                        ) : (
                          <span key={dayNum} className={g.calDay}>{dayNum}</span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              </div>
            </div>
          </div>
        </div>

        {/* DATATAKE */}
        <div className={`${g.fdrop} ${g.fdropDtk}`}>
          <button
            type="button"
            className={g.fdropHead}
            aria-expanded={openDropdown === "dtk"}
            onClick={() => setOpenDropdown(openDropdown === "dtk" ? null : "dtk")}
          >
            <span className={g.fdropLabel}>Datatake</span>
            <span className={g.fdropVal}>
              {datatakeFilter === "*" ? "All" : datatakeFilter}
            </span>
            <Chevron />
          </button>
          <div
            className={g.fdropBody}
            style={{ gridTemplateRows: openDropdown === "dtk" ? "1fr" : "0fr" }}
            aria-hidden={openDropdown !== "dtk" ? true : undefined}
            ref={(el) => { if (el) el.inert = openDropdown !== "dtk"; }}
          >
            <div className={g.fdropInner}>
              <div className={g.fdropPad}>
              <button
                type="button"
                className={`${g.fitem} ${datatakeFilter !== "*" ? g.off : ""}`}
                onClick={() => { setDatatakeFilter("*"); setOpenDropdown(null); doDeselect(true); }}
              >
                <u>All datatakes</u>
              </button>
              {[...dropdownDatatakes]
                .sort((a, b) => {
                  const ga = satGroup(a.sat), gb = satGroup(b.sat);
                  if (ga < gb) return -1; if (ga > gb) return 1;
                  if (a.id < b.id) return -1; if (a.id > b.id) return 1;
                  return 0;
                })
                .map((dt) => {
                  const dotColor = dt.cls === "ok" ? "#34d399" : dt.cls === "warn" ? "#f5b544" : "#ff5c5c";
                  return (
                    <button
                      key={dt.id}
                      type="button"
                      className={`${g.fitem} ${datatakeFilter !== "*" && dt.id !== datatakeFilter ? g.off : ""}`}
                      onClick={() => { setOpenDropdown(null); handleSelectDatatake(dt.id); }}
                    >
                      <i className={g.dtkDot} style={{ background: dotColor }} />
                      <u>{dt.id}</u>
                      <s>{dt.comp.toFixed(1)}% · {dt.status}</s>
                    </button>
                  );
                })}
              {dropdownDatatakes.length === 0 && (
                <p className={g.acqEmpty}>No datatake matches</p>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH */}
        <label className={g.fsearch}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) setOpenDropdown("dtk");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dropdownDatatakes.length > 0) {
                handleSelectDatatake(dropdownDatatakes[0].id);
                setOpenDropdown(null);
              }
            }}
            placeholder="Datatake ID"
            aria-label="Search datatakes"
          />
        </label>
      </div>

      {/* GLOBE + DATATAKE: one row. Selecting a datatake opens the side column and the globe's
          column narrows to make room (SentiBoard.html .acq-layout.has-sel). */}
      <div className={`${g.stageRow} ${selIdx >= 0 ? g.hasSel : ""}`}>
        <div className={g.globeStage} ref={stageElRef}>
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <ThreeEarth
              transparent
              autoRotate={false}
              onReady={handleSceneReady}
            />
          </div>

          {/* Wheel zoom hint (§8) */}
          <div
            ref={wheelHintRef}
            className={g.acqWheelHint}
          >
            {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} + scroll to zoom the globe
          </div>

          {/* §9 Simulation bar */}
          <div className={g.simbar}>
            <div className={g.simctl} role="toolbar" aria-label="Simulation clock">
              <button
                className={g.play}
                onClick={() => setIsPlaying(!isPlaying)}
                aria-pressed={isPlaying}
                aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
              >
                <span aria-hidden="true">{isPlaying ? "❚❚" : "▶"}</span>
              </button>
              <div className={g.simtime}>
                <span>{todayStr} {formatSimTime(simTime)}</span>
                <small>SIMULATION TIME</small>
              </div>
              <input
                className={g.scrub}
                type="range"
                min={0}
                max={1440}
                step={1}
                aria-label="Simulation time of day"
                value={Math.round(simTime / 60)}
                onChange={(e) => setSimTime(Number(e.target.value) * 60)}
                style={{ "--fill": (simTime / 86400 * 100).toFixed(1) + "%" } as React.CSSProperties}
              />
              <button
                className={g.speed}
                onClick={handleCycleSpeed}
                aria-label={`Simulation speed ${speedMultiplier} times real time. Activate to change.`}
              >
                <span aria-hidden="true">×{speedMultiplier}</span>
              </button>
            </div>
          </div>

          {/* Zoom controls (SentiBoard.html .zoomctl): frosted 32px squares; each step is a short
            flight, not a jump */}
          <div className={g.zoomCtl}>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => {
                const v = viewRef.current;
                rotateToRef.current(v.lon, v.lat, Math.min(8, v.zoom * 1.35));
              }}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => {
                const v = viewRef.current;
                rotateToRef.current(v.lon, v.lat, Math.max(0.7, v.zoom / 1.35));
              }}
            >
              −
            </button>
            <button
              type="button"
              aria-label="Reset view"
              title="Reset view"
              onClick={() => {
                window.clearTimeout(flyTimerRef.current);
                if (selIdx >= 0) {
                  closeDatatake();
                } else {
                  rotateToRef.current(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
                }
              }}
            >
              ⌖
            </button>
          </div>

          {/* 2D Overlay Badges */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            {STATIONS.map((station) => {
              const pos = stationPositions[station.name];
              if (!pos || !pos.visible || (pos.x === 0 && pos.y === 0))
                return null;
              return (
                <StationMarker
                  key={station.name}
                  name={station.name}
                  x={pos.x}
                  y={pos.y}
                  contact={pos.contact}
                />
              );
            })}

            {Object.entries(satPositions).map(([unit, pos]) => {
              if (!pos.visible) return null;
              return (
                <SatelliteMarker
                  key={`sat-${unit}`}
                  name={unit}
                  x={pos.x}
                  y={pos.y}
                  color={pos.color}
                  selected={selIdx >= 0 && ACQ_DATATAKES[selIdx]?.unit === unit}
                />
              );
            })}
          </div>
        </div>

        {/* the datatake's record, in its own column: it grows to its full height, no inner scroll */}
        <div className={g.side}>
          {displayedDtk && (
            <DatatakePanel
              key={displayedDtk.id}
              dt={displayedDtk}
              onClose={closeDatatake}
            />
          )}
        </div>
      </div>
    </div>
  );
}
