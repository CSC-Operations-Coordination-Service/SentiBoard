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

const DESCRIPTION = (
  <>
    <p>{ACQUISITIONS_DESCRIPTION}</p>
  </>
);

const SPEED_OPTIONS = [1, 10, 60, 100, 300, 1000];

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
  const tone = hex(STATUS_HEX[dt.cls] ?? 0x8a96a8);
  const types: number[] = expectedTypes(dt.levels).map((p) => p.pct as number);
  const dur = dt.sensingS;
  const nTypes = types.length;
  const missing = nTypes
    ? types.reduce((s, p) => s + (1 - p / 100) * dur, 0)
    : null;
  const start = dt.startIso ? noZone(dt.startIso) : null;
  // "MSI · NOBS" → mode NOBS; Sentinel-1 writes "IW · DV": mode IW, polarisation DV
  const modeParts = (dt.mode ?? "")
    .split("\u00b7")
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
  const g = ctx.createRadialGradient(
    mid,
    mid,
    unit * ATMOS_INNER,
    mid,
    mid,
    mid,
  );
  g.addColorStop(0, "rgba(110,170,255,0.34)");
  g.addColorStop(1, "rgba(110,170,255,0)");
  ctx.fillStyle = g;
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

  /** Camera flight (SentiBoard.html rotateTo): turn around the globe from one direction to another
   *  while easing the distance, over `dur` ms. */
  const camAnimRef = useRef<{
    from: THREE.Vector3;
    to: THREE.Vector3;
    d0: number;
    d1: number;
    t0: number;
    dur: number;
  } | null>(null);
  const flyTimerRef = useRef<number | undefined>(undefined);

  const [selectedDataTake, setSelectedDataTake] = useState<number>(0);
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

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
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
  const [simTime, setSimTime] = useState<number>(0);
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
  useEffect(() => () => dayNightRef.current?.dispose(), []);

  useEffect(() => {
    const map = new Map<string, PreparedDatatake>();
    ACQ_DATATAKES.forEach((dt) => {
      map.set(dt.id, prepDatatake(dt, todayMs));
    });
    prepMapRef.current = map;
  }, [todayMs]);

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
  /** Map from datatake ID → PreparedDatatake, computed once per todayMs. */
  const prepMapRef = useRef<Map<string, PreparedDatatake>>(new Map());
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
  selectedSatRef.current = isModalOpen
    ? (ACQ_DATATAKES[selectedDataTake]?.unit ?? null)
    : null;

  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;
  const selectedDataTakeRef = useRef(selectedDataTake);
  selectedDataTakeRef.current = selectedDataTake;

  // List of datatakes available for the dropdown options ( filtered by Satellite, Day, and Search — but NOT Datatake ID )
  const dropdownDatatakes = ACQ_DATATAKES.filter((dt) => {
    if (satelliteFilter !== "*" && dt.sat !== satelliteFilter) return false;
    if (dayFilter !== "*" && !noZone(dt.startIso).startsWith(dayFilter))
      return false;
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      const matchId = dt.id.toLowerCase().includes(q);
      const matchSat = dt.sat.toLowerCase().includes(q);
      if (!matchId && !matchSat) return false;
    }
    return true;
  });

  // Final filtered datatakes applied to globe 3D view and KPI calculation
  const filteredDatatakes = dropdownDatatakes.filter((dt) => {
    if (datatakeFilter !== "*" && dt.id !== datatakeFilter) return false;
    return true;
  });
  const filteredDatatakesRef = useRef(filteredDatatakes);
  filteredDatatakesRef.current = filteredDatatakes;

  const datatakesInView = filteredDatatakes.length;
  const acquired = Math.round(
    (filteredDatatakes.filter((dt) => dt.comp >= 95).length /
      Math.max(1, filteredDatatakes.length)) *
      100,
  );
  const published = Math.round(
    (filteredDatatakes.filter((dt) => dt.status === "Published").length /
      Math.max(1, filteredDatatakes.length)) *
      100,
  );
  const failedAcquisitions = filteredDatatakes.filter(
    (dt) => dt.cls === "crit",
  ).length;
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

  const getSwathCentroid = (coords: number[][]) => {
    const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    return { lon: avgLon, lat: avgLat };
  };

  /** Start a camera flight to a world direction and distance. */
  const flyTo = (dir: THREE.Vector3, dist: number, dur = 1300) => {
    const cam = cameraRef.current;
    if (!cam) return;
    camAnimRef.current = {
      from: cam.position.clone().normalize(),
      to: dir.clone().normalize(),
      d0: cam.position.length(),
      d1: dist,
      t0: performance.now(),
      dur,
    };
  };

  /** The reference's fitZoom: come close enough that the footprint fills about a third of the
   *  globe's window, between a gentle and a deep zoom. */
  const fitDistance = (coords: number[][]) => {
    const { lon, lat } = getSwathCentroid(coords);
    const c = latLonToVector3(lat, lon, 1).normalize();
    let far = 0;
    coords.forEach(([lo, la]) => {
      far = Math.max(far, c.angleTo(latLonToVector3(la, lo, 1).normalize()));
    });
    const canvas = rendererRef.current?.domElement;
    const W = canvas?.clientWidth || 800;
    const H = canvas?.clientHeight || 600;
    const cam = cameraRef.current as THREE.PerspectiveCamera | null;
    const tanHalf = Math.tan(((cam?.fov ?? 45) * D) / 2);
    // fraction of the half-height the footprint's radius should take
    const f = (0.6 * Math.min(W, H)) / H;
    const d = Math.cos(far) + Math.sin(Math.max(far, 0.02)) / (f * tanHalf);
    return Math.max(1.3, Math.min(3.0, d));
  };

  const focusOnDatatake = (coords: number[][]) => {
    const cam = cameraRef.current;
    if (!cam) return;
    const { lon, lat } = getSwathCentroid(coords);
    // EarthGroup may have turned since load, so aim at the footprint where it is now
    const earthGroup = sceneRef.current?.getObjectByName("EarthGroup");
    const dir = latLonToVector3(lat, lon, 1).normalize();
    if (earthGroup)
      dir.applyQuaternion(
        earthGroup.getWorldQuaternion(new THREE.Quaternion()),
      );
    const dist = fitDistance(coords);
    window.clearTimeout(flyTimerRef.current);
    // already close in: ease out a little first, then into the new footprint
    if (cam.position.length() < 2.2) {
      flyTo(cam.position, Math.min(3.0, cam.position.length() * 1.2), 520);
      flyTimerRef.current = window.setTimeout(() => flyTo(dir, dist), 520);
    } else flyTo(dir, dist);
  };

  /** Back out to the whole globe, keeping the current direction. */
  const flyHome = () => {
    window.clearTimeout(flyTimerRef.current);
    if (cameraRef.current) flyTo(cameraRef.current.position, 3.0, 1100);
  };

  const closeDatatake = () => {
    setIsModalOpen(false);
    flyHome();
  };

  const handleSelectDatatake = (dtId: string) => {
    const index = ACQ_DATATAKES.findIndex((dt) => dt.id === dtId);
    if (index !== -1) {
      setSelectedDataTake(index);
    }
    setDatatakeFilter(dtId);
    setIsModalOpen(true);

    const dt = ACQ_DATATAKES.find((d) => d.id === dtId);
    if (dt) {
      const prepEntry = prepMapRef.current.get(dtId);
      const ring: number[][] = prepEntry
        ? buildFootprint(prepEntry).ring.map(([lo, la]) => [lo, la])
        : [];
      focusOnDatatake(
        ring.length >= 4
          ? ring
          : [
              [dt.lon - 2, dt.lat - 2],
              [dt.lon + 2, dt.lat - 2],
              [dt.lon + 2, dt.lat + 2],
              [dt.lon - 2, dt.lat + 2],
            ],
      );
    }
  };

  const handleCycleSpeed = () => {
    const currentIndex = SPEED_OPTIONS.indexOf(speedMultiplier);
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
    setSpeedMultiplier(SPEED_OPTIONS[nextIndex]);
  };

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
    const selectedId = isModalOpen
      ? ACQ_DATATAKES[selectedDataTake]?.id
      : undefined;
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
  }, [filteredDatatakes, selectedDataTake, isModalOpen]);

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

      const ringPts = ring.map(([lo, la]) => latLonToVector3(la, lo, outlineR));
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

    camera.position.set(0, 0, 3.0);
    camera.lookAt(0, 0, 0);

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

    let isDragging = false;
    let dragDistance = 0;
    let previousMousePosition = { x: 0, y: 0 };
    const raycaster = new THREE.Raycaster();
    const mouseVector = new THREE.Vector2();

    const onMouseDown = (e: MouseEvent) => {
      camAnimRef.current = null;
      window.clearTimeout(flyTimerRef.current);
      isDragging = true;
      dragDistance = 0;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging && camera) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        dragDistance += Math.abs(deltaX) + Math.abs(deltaY);

        camera.position.applyAxisAngle(
          new THREE.Vector3(0, 1, 0),
          deltaX * 0.008,
        );
        camera.position.applyAxisAngle(
          new THREE.Vector3(1, 0, 0),
          deltaY * 0.008,
        );
        camera.lookAt(0, 0, 0);

        previousMousePosition = { x: e.clientX, y: e.clientY };
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      isDragging = false;

      if (dragDistance < 5 && camera && renderer) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseVector.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseVector.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouseVector, camera);

        const activeClickables = clickableMeshesRef.current.filter(
          (m) => m.visible,
        );
        const intersects = raycaster.intersectObjects(activeClickables, false);

        if (intersects.length > 0) {
          const hitMesh = intersects[0].object as THREE.Mesh;
          const dtId = hitMesh.userData.datatakeId;
          if (dtId) {
            handleSelectDatatake(dtId);
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camAnimRef.current = null;
      if (camera) {
        const direction = camera.position.clone().normalize();
        const currentDistance = camera.position.length();
        const newDistance = Math.max(
          1.25,
          Math.min(6, currentDistance + e.deltaY * 0.004),
        );
        camera.position.copy(direction.multiplyScalar(newDistance));
        camera.lookAt(0, 0, 0);
      }
    };

    renderer.domElement.addEventListener("mousedown", onMouseDown);
    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      atmosphere.removeFromParent();
      atmosphere.material.map?.dispose();
      atmosphere.material.dispose();
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);

      // Dispose footprint fill + outline geometry/material
      clickableMeshesRef.current.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); });
      footprintMeshesRef.current.forEach((m) => { (m as THREE.Line).geometry.dispose(); ((m as THREE.Line).material as THREE.Material).dispose(); });
      // Dispose satellite trail/future geometry/material
      satObjectsRef.current.forEach((sat) => {
        sat.trail.geometry.dispose(); (sat.trail.material as THREE.Material).dispose();
        sat.future.geometry.dispose(); (sat.future.material as THREE.Material).dispose();
      });
      // Dispose station cap/ring/links
      stationFxRef.current.forEach((fx) => {
        fx.cap.geometry.dispose(); (fx.cap.material as THREE.Material).dispose();
        fx.ring.geometry.dispose(); (fx.ring.material as THREE.Material).dispose();
        fx.links.forEach((lnk) => { lnk.geometry.dispose(); (lnk.material as THREE.Material).dispose(); });
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

      // camera flight: rotate around the globe (never through it) and ease the distance,
      // easeInOutCubic as in the reference
      const fly = camAnimRef.current;
      if (fly && cameraRef.current) {
        const k = Math.min(1, (now - fly.t0) / fly.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        const q = new THREE.Quaternion().setFromUnitVectors(fly.from, fly.to);
        const qe = new THREE.Quaternion().slerp(q, e);
        const dir = fly.from.clone().applyQuaternion(qe);
        cameraRef.current.position.copy(
          dir.multiplyScalar(fly.d0 + (fly.d1 - fly.d0) * e),
        );
        cameraRef.current.lookAt(0, 0, 0);
        if (k >= 1) camAnimRef.current = null;
      }

      // zoomed in, the globe's window fades into the sky through a soft oval
      if (cameraRef.current && rendererRef.current) {
        rendererRef.current.domElement.classList.toggle(
          g.globeZoomed,
          cameraRef.current.position.length() < 2.3,
        );
      }

      dayNightRef.current?.setTime(simDayMs + simTimeRef.current * 1000);

      // keep the atmosphere on the rim as the camera zooms
      if (atmosphereRef.current && cameraRef.current)
        fitAtmosphere(atmosphereRef.current, cameraRef.current);

      // Satellites on their ground points, with their trails (and the selected one's track ahead)
      const simTimeMin = simTimeRef.current / 60;
      const filtered = filteredDatatakesRef.current;
      const selectedDtId = isModalOpenRef.current
        ? (ACQ_DATATAKES[selectedDataTakeRef.current]?.id ?? null)
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

      if (cameraRef.current && rendererRef.current && sceneRef.current) {
        const camera = cameraRef.current as THREE.PerspectiveCamera;
        const renderer = rendererRef.current;
        const canvas = renderer.domElement;

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
            x: (vector.x * 0.5 + 0.5) * canvas.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * canvas.clientHeight,
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
            x: (vector.x * 0.5 + 0.5) * canvas.clientWidth,
            y: (-vector.y * 0.5 + 0.5) * canvas.clientHeight,
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
          <b className={g.kpiV}>{acquired}%</b>
          <span className={g.kpiK}>Acquired</span>
        </div>
        <div className={g.kpi}>
          <b className={g.kpiV}>{published}%</b>
          <span className={g.kpiK}>Published</span>
        </div>
        <div className={g.kpi}>
          <b className={`${g.kpiV} ${failedAcquisitions > 0 ? g.kpiCrit : ""}`}>
            {failedAcquisitions}
          </b>
          <span className={g.kpiK}>Failed acquisitions</span>
        </div>
      </div>

      {/* FILTER TOOLBAR: heading, three underlined dropdowns (label left, value right), search */}
      <div className={g.toolbar}>
        <h2 className={g.tbHeading}>{windowLabel(todayMs)}</h2>

        {/* SATELLITE */}
        <div className={`${g.fdrop} ${g.fdropSat}`}>
          <button
            type="button"
            className={g.fdropHead}
            aria-expanded={openDropdown === "sat"}
            onClick={() =>
              setOpenDropdown(openDropdown === "sat" ? null : "sat")
            }
          >
            <span className={g.fdropLabel}>Satellite</span>
            <span className={g.fdropVal}>
              {satelliteFilter === "*" ? "All" : satelliteFilter}
            </span>
            <Chevron />
          </button>
          {openDropdown === "sat" && (
            <div className={g.fdropMenu}>
              {["*", ...uniqueSatellites].map((sat) => (
                <button
                  key={sat}
                  type="button"
                  className={g.fitem}
                  aria-pressed={satelliteFilter === sat}
                  onClick={() => {
                    setSatelliteFilter(sat);
                    setOpenDropdown(null);
                  }}
                >
                  {sat === "*" ? "All satellites" : sat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DAY OF ACQUISITION */}
        <div className={`${g.fdrop} ${g.fdropDay}`}>
          <button
            type="button"
            className={g.fdropHead}
            aria-expanded={openDropdown === "day"}
            onClick={() =>
              setOpenDropdown(openDropdown === "day" ? null : "day")
            }
          >
            <span className={g.fdropLabel}>Day of acquisition</span>
            <span className={g.fdropVal}>
              {dayFilter === "*" ? "Any" : dayFilter.slice(5)}
            </span>
            <Chevron />
          </button>
          {openDropdown === "day" && (
            <div className={`${g.fdropMenu} ${g.calMenu}`}>
              <button
                type="button"
                className={g.fitem}
                aria-pressed={dayFilter === "*"}
                onClick={() => {
                  setDayFilter("*");
                  setOpenDropdown(null);
                }}
              >
                Any day
              </button>
              {(() => {
                const m = new Date(calMonth);
                const year = m.getUTCFullYear();
                const month = m.getUTCMonth();
                const step = (by: number) =>
                  setCalMonth(Date.UTC(year, month + by, 1));
                return (
                  <div className={g.calMonth}>
                    <button
                      type="button"
                      className={g.calNav}
                      aria-label="Previous month"
                      onClick={() => step(-1)}
                    >
                      ‹
                    </button>
                    <span>
                      {MONTHS[month]} {year}
                    </span>
                    <button
                      type="button"
                      className={g.calNav}
                      aria-label="Next month"
                      onClick={() => step(1)}
                    >
                      ›
                    </button>
                  </div>
                );
              })()}
              <div className={g.calDow}>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className={g.calGrid}>
                {/* weeks start on Monday: blank cells up to the 1st */}
                {[...Array((new Date(calMonth).getUTCDay() + 6) % 7)].map(
                  (_, i) => (
                    <span key={`b${i}`} />
                  ),
                )}
                {[
                  ...Array(
                    new Date(
                      Date.UTC(
                        new Date(calMonth).getUTCFullYear(),
                        new Date(calMonth).getUTCMonth() + 1,
                        0,
                      ),
                    ).getUTCDate(),
                  ),
                ].map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = ymd(calMonth + i * DAY_MS);
                  // the window's two days carry data
                  const has = dateStr === yesterdayStr || dateStr === todayStr;
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      className={`${g.calDay} ${has ? g.calHas : ""}`}
                      aria-pressed={dayFilter === dateStr}
                      onClick={() => {
                        setDayFilter(dateStr);
                        setOpenDropdown(null);
                      }}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* DATATAKE */}
        <div className={`${g.fdrop} ${g.fdropDtk}`}>
          <button
            type="button"
            className={g.fdropHead}
            aria-expanded={openDropdown === "dtk"}
            onClick={() =>
              setOpenDropdown(openDropdown === "dtk" ? null : "dtk")
            }
          >
            <span className={g.fdropLabel}>Datatake</span>
            <span className={g.fdropVal}>
              {datatakeFilter === "*" ? "All" : datatakeFilter}
            </span>
            <Chevron />
          </button>
          {openDropdown === "dtk" && (
            <div className={`${g.fdropMenu} ${g.dtkMenu}`}>
              <button
                type="button"
                className={g.fitem}
                aria-pressed={datatakeFilter === "*"}
                onClick={() => {
                  setDatatakeFilter("*");
                  setOpenDropdown(null);
                  closeDatatake();
                }}
              >
                All datatakes
              </button>
              {dropdownDatatakes.map((dt) => {
                const statusColor =
                  dt.cls === "ok"
                    ? "#34d399"
                    : dt.cls === "warn"
                      ? "#f5b544"
                      : "#ff5c5c";
                return (
                  <button
                    key={dt.id}
                    type="button"
                    className={`${g.fitem} ${g.dtkItem}`}
                    aria-pressed={datatakeFilter === dt.id}
                    onClick={() => {
                      setOpenDropdown(null);
                      handleSelectDatatake(dt.id);
                    }}
                  >
                    <i
                      className={g.dtkDot}
                      style={{ background: statusColor }}
                    />
                    <span>{dt.id}</span>
                    <small>
                      {Math.round(dt.comp)}% · {dt.status}
                    </small>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* SEARCH */}
        <label className={g.fsearch}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            aria-hidden
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredDatatakes.length > 0) {
                handleSelectDatatake(filteredDatatakes[0].id);
              }
            }}
            placeholder="Datatake ID"
            aria-label="Search datatakes"
          />
        </label>
      </div>

      {/* GLOBE + DATATAKE: one row. Selecting a datatake opens the side column and the globe's
          column narrows to make room (SentiBoard.html .acq-layout.has-sel). */}
      <div className={`${g.stageRow} ${isModalOpen ? g.hasSel : ""}`}>
        <div className={g.globeStage}>
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <ThreeEarth
              transparent
              autoRotate={!isModalOpen}
              onReady={handleSceneReady}
            />
          </div>

          {/* FLOATING BOTTOM OVERLAY CONTROL BAR */}
          <div
            style={{
              position: "absolute",
              bottom: "28px",
              left: "32px",
              right: "32px",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              gap: "20px",
              pointerEvents: "auto",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {/* Circular Play / Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "#00a8b5",
                border: "none",
                color: "#090d16",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: "0 0 12px rgba(0, 168, 181, 0.4)",
              }}
            >
              {isPlaying ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Timestamp Display */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                }}
              >
                {todayStr} {formatSimTime(simTime)}
              </span>
              <span
                style={{
                  color: "#6b7280",
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                }}
              >
                SIMULATION TIME
              </span>
            </div>

            {/* Timeline Slider Track */}
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <input
                type="range"
                min={0}
                max={86400}
                step={1}
                value={Math.floor(simTime)}
                onChange={(e) => setSimTime(Number(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#00c7d6",
                  cursor: "pointer",
                  height: "4px",
                }}
              />
            </div>

            {/* Single Speed Control Pill Button */}
            <button
              onClick={handleCycleSpeed}
              style={{
                background: "rgba(15, 23, 42, 0.85)",
                color: "#ffffff",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: "16px",
                padding: "6px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                backdropFilter: "blur(8px)",
                flexShrink: 0,
              }}
            >
              ×{speedMultiplier}
            </button>
          </div>

          {/* Zoom controls (SentiBoard.html .zoomctl): frosted 32px squares; each step is a short
            flight, not a jump */}
          <div className={g.zoomCtl}>
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => {
                const cam = cameraRef.current;
                if (cam)
                  flyTo(
                    cam.position,
                    Math.max(1.25, cam.position.length() * 0.8),
                    420,
                  );
              }}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => {
                const cam = cameraRef.current;
                if (cam)
                  flyTo(
                    cam.position,
                    Math.min(6, cam.position.length() * 1.25),
                    420,
                  );
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
                flyTo(new THREE.Vector3(0, 0, 1), 3.0, 1100);
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
                  selected={
                    isModalOpen &&
                    ACQ_DATATAKES[selectedDataTake]?.unit === unit
                  }
                />
              );
            })}
          </div>
        </div>

        {/* the datatake's record, in its own column: it grows to its full height, no inner scroll */}
        <div className={g.side}>
          {isModalOpen && ACQ_DATATAKES[selectedDataTake] && (
            <DatatakePanel
              key={ACQ_DATATAKES[selectedDataTake].id}
              dt={ACQ_DATATAKES[selectedDataTake]}
              onClose={closeDatatake}
            />
          )}
        </div>
      </div>
    </div>
  );
}
