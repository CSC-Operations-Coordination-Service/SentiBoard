"use client";

import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import * as THREE from "three";
import { applyDayNightEarth, type DayNightEarth } from "./dayNightEarth";
import { applyStylizedEarth, type StylizedEarth } from "./stylizedEarth";
import type { AcquisitionsData } from "./types";
import { prepDatatake, subPoint, buildFootprint, buildFootprintFill, OUTLINE_R, pointerToNdc } from "./acqGeometry";
import type { PreparedDatatake } from "./acqGeometry";
import { kpiStats } from "./model";
import type { AcqDatatake } from "./types";
import DatatakePanel from "./DatatakePanel";
import { parseAcqView, acqViewHref, type AcqView } from "./url-state";
import { DAY_MS } from "@/lib/missions";
import { logger } from "@/lib/log";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import s from "./acq-globe.module.css";

const log = logger("acquisitions-globe");

// Loaded client-side only: ThreeEarth calls new THREE.WebGLRenderer() which requires a browser.
const ThreeEarth = dynamic(() => import("./ThreeEarth"), { ssr: false });

export type GlobeLook = "imagery" | "stylized";

const D = Math.PI / 180;
const HOME_VIEW = { lon: 4, lat: 34, zoom: 1 };
const ATMOS_INNER = 0.98;
const ATMOS_OUTER = 1.15;

// Module-level function definitions — no WebGL or document calls at module load time.
// Calling them inside handleReady (after the WebGL context exists) is safe.

function makeAtmosphere(): THREE.Sprite {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const mid = size / 2;
  const unit = mid / ATMOS_OUTER;
  const gr = ctx.createRadialGradient(mid, mid, unit * ATMOS_INNER, mid, mid, mid);
  gr.addColorStop(0, "rgba(110,170,255,0.34)");
  gr.addColorStop(1, "rgba(110,170,255,0)");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(mid, mid, mid, 0, Math.PI * 2);
  ctx.arc(mid, mid, unit * 0.995, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  const tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false }),
  );
  sprite.name = "Atmosphere";
  sprite.renderOrder = -1;
  return sprite;
}

function fitAtmosphere(sprite: THREE.Sprite, camera: THREE.Camera): void {
  const d = Math.max(1.05, camera.position.length());
  const rim = d / Math.sqrt(d * d - 1);
  sprite.scale.setScalar(2 * ATMOS_OUTER * rim);
}

// ── Slice 3 module-level helpers ──────────────────────────────────────────────

const GROUND_R = 1.006;
const CONTACT_DEG = 22;
const CONTACT_COS = Math.cos(CONTACT_DEG * D);

// Status hex colours — no CSS token exists for these Three.js material colours
const STATUS_HEX: Record<string, number> = {
  ok: 0x34d399,
  warn: 0xf5b544,
  crit: 0xff5c5c,
};

// Dish SVG path for station icons (documented literal from mock-up)
const DISH_PATH = "M-6.5 -7.5Q-5 1.2 5.2 -1.6M-6.5 -7.5L5.2 -1.6M-0.6 -4.5L2.6 -8.2M-1.2 -1.2L-1.2 4.2M-5 5L2.6 5";

function latLonToV3(lat: number, lon: number, r = GROUND_R): THREE.Vector3 {
  const φ = lat * D;
  const λ = (lon + 90) * D;
  return new THREE.Vector3(
    Math.cos(φ) * Math.sin(λ),
    Math.sin(φ),
    Math.cos(φ) * Math.cos(λ),
  ).multiplyScalar(r);
}

function capRing(center: THREE.Vector3, angRad: number, r: number, steps = 72): THREE.Vector3[] {
  const perp = new THREE.Vector3(1, 0, 0);
  if (Math.abs(center.dot(perp)) > 0.9) perp.set(0, 1, 0);
  const tangent = new THREE.Vector3().crossVectors(center, perp).normalize();
  const bitangent = new THREE.Vector3().crossVectors(center, tangent).normalize();
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (i / steps) * Math.PI * 2;
    pts.push(
      new THREE.Vector3()
        .addScaledVector(center, Math.cos(angRad))
        .addScaledVector(tangent, Math.sin(angRad) * Math.cos(θ))
        .addScaledVector(bitangent, Math.sin(angRad) * Math.sin(θ))
        .multiplyScalar(r),
    );
  }
  return pts;
}

const _arcScratch = new THREE.Vector3();
function setArc(line: THREE.Line, a: THREE.Vector3, b: THREE.Vector3, r: number, steps = 48): void {
  const positions = new Float32Array((steps + 1) * 3);
  for (let i = 0; i <= steps; i++) {
    _arcScratch.lerpVectors(a, b, i / steps).normalize().multiplyScalar(r);
    positions[i * 3] = _arcScratch.x;
    positions[i * 3 + 1] = _arcScratch.y;
    positions[i * 3 + 2] = _arcScratch.z;
  }
  line.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  line.geometry.attributes.position.needsUpdate = true;
  line.computeLineDistances();
}

function formatSimDate(dayMs: number): string {
  const d = new Date(dayMs);
  return d.toISOString().slice(0, 10);
}

interface SatObject {
  unit: string;
  cls: string;
  prep: PreparedDatatake;
  dot: THREE.Mesh;
  trailPts: THREE.Vector3[];
  trail: THREE.Line;
  aheadPts: THREE.Vector3[];
  aheadTrail: THREE.Line;
  worldPos: THREE.Vector3;
}

interface StationFx {
  name: string;
  dir: THREE.Vector3;      // unit direction, earthGroup-local
  localPos: THREE.Vector3; // at radius 1.0, earthGroup-local
  localPosGR: THREE.Vector3; // at GROUND_R, earthGroup-local (for setArc, pre-computed)
  cap: THREE.Mesh;
  ring: THREE.LineLoop;
  links: THREE.Line[];     // one per satellite unit
}

// ── Slice 4 module-level helpers ─────────────────────────────────────────────

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function windowLabel(todayMidnightMs: number): string {
  const a = new Date(todayMidnightMs - DAY_MS);
  const b = new Date(todayMidnightMs);
  const [da, ma, ya] = [a.getUTCDate(), MONTHS[a.getUTCMonth()], a.getUTCFullYear()];
  const [db, mb, yb] = [b.getUTCDate(), MONTHS[b.getUTCMonth()], b.getUTCFullYear()];
  if (ya !== yb) return `${da} ${ma} ${ya} – ${db} ${mb} ${yb}`;
  if (ma !== mb) return `${da} ${ma} – ${db} ${mb} ${yb}`;
  return `${da} – ${db} ${mb} ${yb}`;
}

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const satGroupOf = (sat: string) => sat.replace(/-[A-Z]$/, "");

// ── Slice 5 module-level helpers ──────────────────────────────────────────────

function geoDistRad(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = lat1 * D;
  const φ2 = lat2 * D;
  const dφ = (lat2 - lat1) * D;
  const dλ = (lon2 - lon1) * D;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

// Camera target zoom so the footprint ring fills ~30% of the smaller canvas dimension.
// Uses the same 0.39×min(W,H) globe-radius formula as applyView.
function fitZoom(prep: PreparedDatatake, W: number, H: number): number {
  const { ring } = buildFootprint(prep);
  const far = ring.reduce(
    (mx, [lo, la]) => Math.max(mx, geoDistRad(prep.lat, prep.lon, la, lo)),
    0,
  );
  const baseR = 0.39 * Math.min(W, H);
  const want = 0.3 * Math.min(W, H);
  const z = want / (baseR * Math.max(0.02, Math.sin(far)));
  return Math.max(1.4, Math.min(5, z));
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function AcquisitionsGlobe({
  look,
  nowMs,
  data,
}: {
  look: GlobeLook;
  nowMs: number;
  data: AcquisitionsData;
}) {
  // Modifier key: "Ctrl" on server and by default; "⌘" on Mac clients (no hydration mismatch).
  const modKey = useSyncExternalStore(
    () => () => {},
    () =>
      /mac|iphone|ipad/i.test(
        (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
          navigator.platform,
      )
        ? "⌘"
        : "Ctrl",
    () => "Ctrl",
  );

  // ── Slice 4: URL filter state ─────────────────────────────────────────────
  const searchParams = useSearchParams();
  const view: AcqView = useMemo(() => parseAcqView(searchParams), [searchParams]);

  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const openDropdownRef = useRef<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => {
    const t = new Date(nowMs);
    return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1);
  });
  const [searchQuery, setSearchQuery] = useState("");

  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const footprintMeshesRef = useRef<{ id: string; fill: THREE.Mesh; outline: THREE.Line; hex: number }[]>([]);
  const filteredUnitsRef = useRef<Set<string> | null>(null);

  const [scene, setScene] = useState<THREE.Scene | null>(null);

  // Off-screen pause: IntersectionObserver → stageVisibleRef (rAF reads) + stageVisible (ThreeEarth prop)
  const [stageVisible, setStageVisible] = useState(true);
  const stageVisibleRef = useRef(true);

  const viewRef = useRef({ lon: HOME_VIEW.lon, lat: HOME_VIEW.lat, zoom: HOME_VIEW.zoom });
  const animRef = useRef<{
    fromLon: number; fromLat: number; fromZoom: number;
    dl: number; toLat: number; toZoom: number;
    t0: number; dur: number;
  } | null>(null);
  const canvasSizeRef = useRef({ W: 800, H: 600 });
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wheelHintRef = useRef<HTMLDivElement | null>(null);
  const stageElRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const dayNightRef = useRef<DayNightEarth | StylizedEarth | null>(null);
  const atmosphereRef = useRef<THREE.Sprite | null>(null);

  // Simulation playback state (React state only — user-driven)
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(60);
  const SPEEDS = [1, 10, 60, 600];

  // Refs: clock
  const isPlayingRef = useRef(isPlaying);
  const speedRef = useRef(speed);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { openDropdownRef.current = openDropdown; }, [openDropdown]);

  // Outside-click closes the open dropdown
  useEffect(() => {
    if (!openDropdown) return;
    const onDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [openDropdown]);

  // Refs: DOM nodes written from the rAF loop (no React state per frame)
  const simTimeTextRef = useRef<HTMLSpanElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const lastSecRef = useRef(-1);

  // Refs: 3D overlay objects
  const overlayGroupRef = useRef<THREE.Group | null>(null);
  const satObjectsRef = useRef<SatObject[]>([]);
  const stationFxRef = useRef<StationFx[]>([]);
  // earthGroupRef: set in handleReady; used by rAF and parent useEffect for correct world transforms
  const earthGroupRef = useRef<THREE.Group | null>(null);
  // satDirsRef: pre-allocated unit-direction Vector3s (earthGroup-local) for contact checks, no per-frame alloc
  const satDirsRef = useRef<THREE.Vector3[]>([]);

  // Refs: DOM badge containers (written from rAF)
  const stationBadgeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const satBadgeRefs = useRef<(HTMLDivElement | null)[]>([]);

  // lookRef lets handleReady (called once at mount) read the look prop.
  const lookRef = useRef(look);

  // ── Slice 5: stable refs — updated in useLayoutEffect so event handlers always read current values ──
  const navigateRef = useRef<(next: AcqView) => void>(() => {});
  const urlViewRef = useRef<AcqView>(view);
  const filteredDatatakesRef = useRef<AcqDatatake[]>([]);

  // Selected datatake tracking (synced via useEffect below)
  const selectedDtkIdRef = useRef<string | null>(null);
  const selectedSatUnitRef = useRef<string | null>(null);
  const prevDtkIdRef = useRef<string | null>(null);

  // Panel display: stays mounted for 500 ms after deselect so CSS fade-out completes
  const [displayedDtk, setDisplayedDtk] = useState<AcqDatatake | null>(null);
  const fadeOutTimerRef = useRef<number | null>(null);

  // simDayMs: UTC midnight of the day nowMs falls on; used as the base for the day/night shader.
  const simDayMs = nowMs - (nowMs % 86_400_000);
  const simDayMsRef = useRef(simDayMs);

  // simTimeRef: seconds into the day at mount (Slice 2 is frozen; Slice 3 will advance it).
  const simTimeRef = useRef((nowMs % 86_400_000) / 1000);

  // Pre-compute orbital constants for each datatake (once per datatakes/nowMs change)
  const simDayMs2 = nowMs - (nowMs % 86_400_000);
  const prepared = useMemo(
    () => new Map(data.datatakes.map((dt) => [dt.id, prepDatatake(dt, simDayMs2)])),
    [data.datatakes, simDayMs2],
  );

  // Unique satellite units (one dot + trail per unit)
  const satUnits = useMemo(() => {
    const seen = new Set<string>();
    const result: { unit: string; cls: string; prep: PreparedDatatake }[] = [];
    for (const dt of data.datatakes) {
      if (!seen.has(dt.unit)) {
        seen.add(dt.unit);
        const p = prepared.get(dt.id);
        if (p) result.push({ unit: dt.unit, cls: dt.cls, prep: p });
      }
    }
    return result;
  }, [data.datatakes, prepared]);

  // ── Slice 4: three-tier filter cascade ───────────────────────────────────
  // Tier 1: satellite filter
  const satFilteredDatatakes = useMemo(
    () =>
      view.satellite
        ? data.datatakes.filter((dt) => dt.unit === view.satellite)
        : data.datatakes,
    [data.datatakes, view.satellite],
  );
  // Tier 2: satellite + day filter (base for calendar and dropdown list)
  const satDayDatatakes = useMemo(
    () =>
      view.day
        ? satFilteredDatatakes.filter((dt) => dt.startIso.slice(0, 10) === view.day)
        : satFilteredDatatakes,
    [satFilteredDatatakes, view.day],
  );
  // Tier 3: sat + day + datatake filter (globe visibility and KPIs)
  const filteredDatatakes = useMemo(
    () =>
      view.datatake
        ? satDayDatatakes.filter((dt) => dt.id === view.datatake)
        : satDayDatatakes,
    [satDayDatatakes, view.datatake],
  );

  // useLayoutEffect: runs synchronously after DOM mutations, before paint, so no event handler
  // can read a stale ref between render and the next frame.
  useLayoutEffect(() => {
    navigateRef.current = (next: AcqView) => {
      history.pushState(null, "", acqViewHref(next, window.location.pathname));
    };
    urlViewRef.current = view;
    filteredDatatakesRef.current = filteredDatatakes;
  }, [view, filteredDatatakes]);

  // Dropdown list: sat + day + search (search does not touch globe or KPIs)
  const dropdownDatatakes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return satDayDatatakes;
    return satDayDatatakes.filter(
      (dt) => dt.id.toLowerCase().includes(q) || dt.unit.toLowerCase().includes(q),
    );
  }, [satDayDatatakes, searchQuery]);

  const kpi = useMemo(() => kpiStats(filteredDatatakes), [filteredDatatakes]);
  const uniqueSatellites = useMemo(
    () => Array.from(new Set(data.datatakes.map((dt) => dt.unit))).sort(),
    [data.datatakes],
  );
  const datesWithData = useMemo(() => {
    const base = view.satellite
      ? data.datatakes.filter((dt) => dt.unit === view.satellite)
      : data.datatakes;
    return new Set(base.map((dt) => dt.startIso.slice(0, 10)));
  }, [data.datatakes, view.satellite]);

  // ── Slice 5 effects (all after useMemos so React Compiler sees no "used before declared") ──

  // Sync selectedDtkIdRef / selectedSatUnitRef for rAF reads
  useEffect(() => {
    const dtId = view.datatake;
    selectedDtkIdRef.current = dtId;
    if (dtId !== null) {
      const dt = data.datatakes.find((d) => d.id === dtId);
      selectedSatUnitRef.current = dt?.unit ?? null;
    } else {
      selectedSatUnitRef.current = null;
    }
  }, [view.datatake, data.datatakes]);

  // Keep panel mounted during 460 ms opacity fade-out after deselect
  // 460 ms matches `opacity 460ms ease` closing transition (prototype-ref.md line 495)
  useEffect(() => {
    if (view.datatake !== null) {
      if (fadeOutTimerRef.current !== null) {
        window.clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayedDtk(data.datatakes.find((d) => d.id === view.datatake) ?? null);
    } else {
      fadeOutTimerRef.current = window.setTimeout(() => {
        setDisplayedDtk(null);
        fadeOutTimerRef.current = null;
      }, 460);
    }
    return () => {
      if (fadeOutTimerRef.current !== null) window.clearTimeout(fadeOutTimerRef.current);
    };
  }, [view.datatake, data.datatakes]);

  // Keyboard: Escape → close dropdown then deselect; [ / ] cycle datatakes; Enter play/pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openDropdownRef.current) {
          setOpenDropdown(null);
        } else if (urlViewRef.current.datatake !== null) {
          navigateRef.current({ ...urlViewRef.current, datatake: null });
        }
        return;
      }
      if (e.key === "[" || e.key === "]") {
        const fds = filteredDatatakesRef.current;
        if (!fds.length) return;
        const sorted = [...fds].sort((a, b) => {
          const ga = satGroupOf(a.sat);
          const gb = satGroupOf(b.sat);
          if (ga < gb) return -1;
          if (ga > gb) return 1;
          if (a.id < b.id) return -1;
          if (a.id > b.id) return 1;
          return 0;
        });
        const curId = urlViewRef.current.datatake;
        const curIdx = sorted.findIndex((dt) => dt.id === curId);
        const delta = e.key === "]" ? 1 : -1;
        const nextIdx =
          curIdx < 0
            ? e.key === "]" ? 0 : sorted.length - 1
            : (curIdx + delta + sorted.length) % sorted.length;
        navigateRef.current({ ...urlViewRef.current, datatake: sorted[nextIdx].id });
        return;
      }
      if (e.key === "Enter") {
        setIsPlaying((p) => !p);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Fly-to: fires when view.datatake changes
  useEffect(() => {
    const dtId = view.datatake;
    const prev = prevDtkIdRef.current;
    prevDtkIdRef.current = dtId;
    if (dtId === null) {
      rotateToRef.current(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
      return;
    }
    const prep = prepared.get(dtId);
    if (!prep) return;
    const dt = data.datatakes.find((d) => d.id === dtId);
    if (!dt) return;
    const { W, H } = canvasSizeRef.current;
    const zoom = fitZoom(prep, W || 800, H || 600);
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reducedMotion && prev !== null && prev !== dtId && viewRef.current.zoom > 1.6) {
      rotateToRef.current(viewRef.current.lon, viewRef.current.lat, 1.2);
      window.setTimeout(() => {
        rotateToRef.current(dt.lon, dt.lat, zoom);
      }, 520);
    } else {
      rotateToRef.current(dt.lon, dt.lat, zoom);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.datatake]);

  function navigate(next: AcqView) {
    history.pushState(null, "", acqViewHref(next, window.location.pathname));
  }

  // applyView: positions the camera for the current view state.
  // Only reads refs (stable), so [] deps is correct and the function reference is stable.
  const applyView = useCallback((cam: THREE.PerspectiveCamera, W: number, H: number) => {
    const view = viewRef.current;
    const radiusPx = 0.39 * Math.min(W, H) * view.zoom;
    const tanHalf = Math.tan((cam.fov * D) / 2);
    const dist = Math.sqrt(1 + Math.pow(H / (2 * radiusPx * tanHalf), 2));
    const clampedLat = Math.max(-89.9, Math.min(89.9, view.lat));
    const latR = clampedLat * D;
    const lonR = (view.lon + 90) * D;
    const localDir = new THREE.Vector3(
      Math.cos(latR) * Math.sin(lonR),
      Math.sin(latR),
      Math.cos(latR) * Math.cos(lonR),
    );
    const localUp = new THREE.Vector3(0, 1, 0);
    const earthGroup = sceneRef.current?.getObjectByName("EarthGroup");
    if (earthGroup) {
      const q = earthGroup.getWorldQuaternion(new THREE.Quaternion());
      localDir.applyQuaternion(q);
      localUp.applyQuaternion(q);
    }
    cam.position.copy(localDir.multiplyScalar(dist));
    cam.up.copy(localUp);
    cam.lookAt(0, 0, 0);
    cam.near = 0.01;
    cam.setViewOffset(W, H, 0, 0.04 * H, W, H);
  }, []); // only reads refs (stable) — exhaustive-deps is satisfied

  // rotateTo: 1300 ms ease-in-out cubic, or instant under reduced-motion.
  const rotateTo = useCallback((toLon: number, toLat: number, toZoom: number) => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      viewRef.current = { lon: toLon, lat: toLat, zoom: toZoom };
      animRef.current = null;
    } else {
      const v = viewRef.current;
      const dl = ((toLon - v.lon + 540) % 360) - 180;
      animRef.current = {
        fromLon: v.lon, fromLat: v.lat, fromZoom: v.zoom,
        dl, toLat, toZoom,
        t0: performance.now(), dur: 1300,
      };
    }
  }, []); // only reads refs (stable) — exhaustive-deps is satisfied

  // rotateToRef: stable ref so JSX click handlers always call the current rotateTo.
  const rotateToRef = useRef(rotateTo);

  // handleReady: called once by ThreeEarth after its WebGL context is ready.
  const handleReady = useCallback(
    (threeScene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) => {
      const cam = camera as THREE.PerspectiveCamera;
      cameraRef.current = cam;
      sceneRef.current = threeScene;
      setScene(threeScene);

      cam.near = 0.01;
      cam.updateProjectionMatrix();

      threeScene.background = null;
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.style.background = "transparent";
      if (renderer.domElement.parentElement)
        renderer.domElement.parentElement.style.background = "transparent";
      if (renderer.getContext().getContextAttributes()?.alpha === false) {
        log.warn("ThreeEarth WebGLRenderer has no alpha channel; globe background cannot be transparent.");
      }

      // Atmosphere sprite — only called here, inside handleReady
      atmosphereRef.current?.removeFromParent();
      const atmosphere = makeAtmosphere();
      fitAtmosphere(atmosphere, cam);
      threeScene.add(atmosphere);
      atmosphereRef.current = atmosphere;

      // Earth material (imagery or stylized look)
      dayNightRef.current?.dispose();
      dayNightRef.current = (lookRef.current === "stylized" ? applyStylizedEarth : applyDayNightEarth)(
        threeScene,
        simDayMsRef.current + simTimeRef.current * 1000,
      );
      // EarthGroup is created by applyDayNightEarth / applyStylizedEarth; capture it for overlay parenting.
      earthGroupRef.current = (threeScene.getObjectByName("EarthGroup") as THREE.Group | null) ?? null;

      // Canvas interaction setup
      const canvas = renderer.domElement;
      canvasElRef.current = canvas;
      canvas.tabIndex = 0;
      canvas.setAttribute(
        "aria-label",
        `Acquisitions globe — lon ${HOME_VIEW.lon}°, lat ${HOME_VIEW.lat}°, zoom ${HOME_VIEW.zoom}×`,
      );
      canvas.style.cursor = "grab";
      canvas.style.touchAction = "none";

      const updateSize = () => {
        canvasSizeRef.current = { W: canvas.clientWidth || 800, H: canvas.clientHeight || 600 };
      };
      updateSize();
      const ro = new ResizeObserver(updateSize);
      ro.observe(canvas);

      const { W, H } = canvasSizeRef.current;
      applyView(cam, W, H);

      // Off-screen visibility observer (IntersectionObserver on the stage div)
      let ioDisconnect = () => {};
      if (stageElRef.current) {
        const io = new IntersectionObserver(
          ([entry]) => {
            stageVisibleRef.current = entry.isIntersecting;
            setStageVisible(entry.isIntersecting);
          },
          { threshold: 0 },
        );
        io.observe(stageElRef.current);
        ioDisconnect = () => io.disconnect();
      }

      // Interaction
      type DragState = { startX: number; startY: number; startLon: number; startLat: number; moved: boolean; pid: number };
      let dragState: DragState | null = null;
      let hintTimer: number | undefined;

      const showHint = () => {
        const el = wheelHintRef.current;
        if (!el) return;
        window.clearTimeout(hintTimer);
        el.classList.add(s.acqWheelHintOn);
        hintTimer = window.setTimeout(() => { el.classList.remove(s.acqWheelHintOn); }, 1300);
      };

      const onPointerDown = (e: PointerEvent) => {
        animRef.current = null;
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
        if (!dragState.moved && Math.abs(dx) + Math.abs(dy) > 3) dragState.moved = true;
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
        const wasMoved = dragState.moved;
        dragState = null;
        canvas.style.cursor = "grab";
        if (wasMoved) return; // drag — not a click

        const rect = canvas.getBoundingClientRect();
        const { x: ndcX, y: ndcY } = pointerToNdc(e.clientX, e.clientY, rect);

        const cam = cameraRef.current;
        if (!cam) return;
        const ray = new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

        const fms = footprintMeshesRef.current;
        const visibleFills = fms.filter((fm) => fm.fill.visible).map((fm) => fm.fill);
        const hits = ray.intersectObjects(visibleFills, false);

        const curView = urlViewRef.current;
        if (hits.length > 0) {
          const hitMesh = hits[0].object as THREE.Mesh;
          const hitItem = fms.find((fm) => fm.fill === hitMesh);
          if (hitItem) {
            if (hitItem.id === curView.datatake) {
              navigateRef.current({ ...curView, datatake: null });
            } else {
              navigateRef.current({ ...curView, datatake: hitItem.id });
            }
          }
        } else if (curView.datatake !== null) {
          navigateRef.current({ ...curView, datatake: null });
        }
      };

      const onPointerCancel = (e: PointerEvent) => {
        if (dragState && e.pointerId === dragState.pid) {
          dragState = null;
          canvas.style.cursor = "grab";
        }
      };

      const onWheel = (e: WheelEvent) => {
        if (!(e.ctrlKey || e.metaKey)) { showHint(); return; }
        e.preventDefault();
        animRef.current = null;
        const v = viewRef.current;
        viewRef.current = { ...v, zoom: Math.max(0.7, Math.min(8, v.zoom * Math.exp(-e.deltaY * 0.004))) };
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
          case "+": case "=":
            e.preventDefault();
            viewRef.current = { ...v, zoom: Math.min(8, v.zoom * 1.2) };
            break;
          case "-":
            e.preventDefault();
            viewRef.current = { ...v, zoom: Math.max(0.7, v.zoom / 1.2) };
            break;
          case "0":
            e.preventDefault();
            rotateToRef.current(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
            break;
        }
      };

      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerCancel);
      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("keydown", onKeyDown);

      // Cleanup: remove what the parent created (ThreeEarth disposes the renderer/context)
      return () => {
        window.clearTimeout(hintTimer);
        ro.disconnect();
        ioDisconnect();
        atmosphere.removeFromParent();
        (atmosphere.material as THREE.SpriteMaterial).map?.dispose();
        atmosphere.material.dispose();
        dayNightRef.current?.dispose();
        dayNightRef.current = null;
        canvas.removeEventListener("pointerdown", onPointerDown);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerup", onPointerUp);
        canvas.removeEventListener("pointercancel", onPointerCancel);
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("keydown", onKeyDown);
      };
    },
    [applyView], // applyView is a stable useCallback; listing it here satisfies exhaustive-deps
  );

  // rAF loop: clock always advances; render/sat/overlay work skipped when off-screen.
  // When the stage comes back into view, 3D positions and overlays jump to the current sim time.
  useEffect(() => {
    let animId: number;
    let prevNow = performance.now();
    // Scratch vectors allocated once per effect lifetime — never inside tick.
    const scratchWorld = new THREE.Vector3();
    const scratchNDC = new THREE.Vector3();

    const tick = (now: number) => {
      // Advance simulation clock regardless of visibility
      const deltaSec = Math.min(0.25, (now - prevNow) / 1000);
      if (isPlayingRef.current) {
        simTimeRef.current = (simTimeRef.current + deltaSec * speedRef.current) % 86400;
      }

      // Update time text and scrub regardless of visibility
      const curSec = Math.floor(simTimeRef.current);
      if (curSec !== lastSecRef.current) {
        lastSecRef.current = curSec;
        const h = String(Math.floor(simTimeRef.current / 3600)).padStart(2, "0");
        const m = String(Math.floor((simTimeRef.current % 3600) / 60)).padStart(2, "0");
        const ss = String(curSec % 60).padStart(2, "0");
        if (simTimeTextRef.current) {
          const dateStr = formatSimDate(simDayMsRef.current);
          simTimeTextRef.current.textContent = `${dateStr} ${h}:${m}:${ss}Z`;
        }
      }
      const scrubEl = scrubRef.current;
      if (scrubEl) {
        const pct = (simTimeRef.current / 86400) * 100;
        scrubEl.style.setProperty("--fill", `${pct.toFixed(2)}%`);
        if (document.activeElement !== scrubEl) {
          scrubEl.value = String(simTimeRef.current);
        }
      }

      if (stageVisibleRef.current) {
        // Camera animation
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
        const cam = cameraRef.current;
        if (cam) {
          const { W, H } = canvasSizeRef.current;
          applyView(cam, W, H);
          const canvas = canvasElRef.current;
          if (canvas) canvas.classList.toggle(s.globeZoomed, viewRef.current.zoom > 1.3);
        }

        // Update satellite positions, trails, overlay badges
        const simTimeMin = simTimeRef.current / 60;
        const satObjs = satObjectsRef.current;
        const satDirs = satDirsRef.current;
        const filteredUnits = filteredUnitsRef.current;
        const badgesVisible = !!cam;
        for (let si = 0; si < satObjs.length; si++) {
          const so = satObjs[si];
          if (filteredUnits && !filteredUnits.has(so.unit)) {
            so.dot.visible = false;
            so.trail.visible = false;
            const badgeEl = satBadgeRefs.current[si];
            if (badgeEl) badgeEl.style.display = "none";
            continue;
          }
          so.dot.visible = true;
          so.trail.visible = true;
          const [lon, lat] = subPoint(so.prep, simTimeMin);
          // dot.position is in earthGroup-local space (overlayGroup has no extra transform)
          so.dot.position.copy(latLonToV3(lat, lon, GROUND_R + 0.025));

          // Capture normalised earthGroup-local direction for contact checks (no world transform needed)
          if (si < satDirs.length) satDirs[si].copy(so.dot.position).normalize();

          // Trail (earthGroup-local positions — correct since trail is a child of overlayGroup → earthGroup)
          for (let k = 0; k < 31; k++) {
            const [tlo, tla] = subPoint(so.prep, simTimeMin - (30 - k) * 0.8);
            so.trailPts[k].copy(latLonToV3(tla, tlo, GROUND_R));
          }
          so.trail.geometry.setFromPoints(so.trailPts);
          so.trail.geometry.attributes.position.needsUpdate = true;

          // Satellite badge: get world position (earthGroup transform applied automatically)
          if (badgesVisible && cam) {
            so.dot.getWorldPosition(so.worldPos);
            scratchNDC.copy(so.worldPos).project(cam);
            const badgeEl = satBadgeRefs.current[si];
            if (badgeEl) {
              if (scratchNDC.z < 1) {
                const { W, H } = canvasSizeRef.current;
                badgeEl.style.left = `${((scratchNDC.x + 1) / 2) * W}px`;
                badgeEl.style.top = `${((1 - scratchNDC.y) / 2) * H}px`;
                badgeEl.style.display = "block";
              } else {
                badgeEl.style.display = "none";
              }
            }
          }

          // ── Slice 5: selected-satellite visuals ──────────────────────────────
          const isSel = so.unit === selectedSatUnitRef.current;
          // Dot: white when selected, status hex otherwise
          (so.dot.material as THREE.MeshBasicMaterial).color.set(
            isSel ? 0xffffff : (STATUS_HEX[so.cls] ?? STATUS_HEX.ok),
          );
          // Trail: 70% opacity for selected satellite
          (so.trail.material as THREE.LineBasicMaterial).opacity = isSel ? 0.70 : 0.28;
          // Ahead-track
          so.aheadTrail.visible = isSel;
          if (isSel) {
            for (let k = 0; k < 31; k++) {
              const [tlo, tla] = subPoint(so.prep, simTimeMin + k * 0.8);
              so.aheadPts[k].copy(latLonToV3(tla, tlo, GROUND_R));
            }
            so.aheadTrail.geometry.setFromPoints(so.aheadPts);
            so.aheadTrail.geometry.attributes.position.needsUpdate = true;
            (so.aheadTrail as THREE.Line).computeLineDistances();
          }
        }

        // ── Slice 5: footprint fill opacity pulse ────────────────────────────
        const selDtkId = selectedDtkIdRef.current;
        const anySelected = selDtkId !== null;
        const fpulse = 0.5 + 0.5 * Math.sin(now / 420);
        for (const fm of footprintMeshesRef.current) {
          if (!fm.fill.visible) continue;
          const fMat = fm.fill.material as THREE.MeshBasicMaterial;
          const oMat = fm.outline.material as THREE.LineBasicMaterial;
          if (fm.id === selDtkId) {
            fMat.opacity = 0.34 + 0.18 * fpulse;
            oMat.color.set(0xffffff);
          } else {
            fMat.opacity = anySelected ? 0.14 : 0.24;
            oMat.color.set(fm.hex);
          }
        }

        // Update station contact links + badge DOM
        const stnFx = stationFxRef.current;
        const eg = earthGroupRef.current;
        for (let sti = 0; sti < stnFx.length; sti++) {
          const fx = stnFx[sti];
          let anyContact = false;
          for (let si = 0; si < satObjs.length && si < fx.links.length; si++) {
            // Both fx.dir and satDirs[si] are earthGroup-local unit vectors — directly comparable
            const inContact = si < satDirs.length && fx.dir.dot(satDirs[si]) > CONTACT_COS;
            const link = fx.links[si];
            if (inContact) {
              // arc endpoints in earthGroup-local space: localPosGR (pre-computed) and dot.position
              setArc(link, fx.localPosGR, satObjs[si].dot.position, GROUND_R + 0.012);
              link.visible = true;
              anyContact = true;
            } else {
              link.visible = false;
            }
          }
          fx.cap.visible = anyContact;
          fx.ring.visible = anyContact;

          // Station badge: apply earthGroup.matrixWorld to localPos, then project (mock-up line 1623-1624)
          if (badgesVisible && cam) {
            const badgeEl = stationBadgeRefs.current[sti];
            if (badgeEl) {
              badgeEl.classList.toggle(s.stnOn, anyContact);
              scratchWorld.copy(fx.localPos);
              if (eg) scratchWorld.applyMatrix4(eg.matrixWorld);
              scratchNDC.copy(scratchWorld).project(cam);
              if (scratchNDC.z < 1) {
                const { W, H } = canvasSizeRef.current;
                badgeEl.style.left = `${((scratchNDC.x + 1) / 2) * W}px`;
                badgeEl.style.top = `${((1 - scratchNDC.y) / 2) * H}px`;
                badgeEl.style.display = "block";
              } else {
                badgeEl.style.display = "none";
              }
            }
          }
        }

        const timeMs = simDayMsRef.current + simTimeRef.current * 1000;
        dayNightRef.current?.setTime(timeMs);
        const atmos = atmosphereRef.current;
        const c = cameraRef.current;
        if (atmos && c) fitAtmosphere(atmos, c);
      }
      prevNow = now;
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [applyView]);

  // Parent effect: build/rebuild all 3D overlay geometry when scene or data changes.
  useEffect(() => {
    if (!scene) return;

    // Remove previous overlay group
    if (overlayGroupRef.current) {
      overlayGroupRef.current.removeFromParent();
      overlayGroupRef.current.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineLoop) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
    }

    // Attach to EarthGroup so all 3D geometry inherits the earth's world transform.
    // The mock-up does the same (AcquisitionsGlobeEarth.tsx line 947).
    const earthGroup = earthGroupRef.current;
    const group = new THREE.Group();
    group.name = "OverlayGroup";
    (earthGroup ?? scene).add(group);
    overlayGroupRef.current = group;

    // ── Footprints ────────────────────────────────────────────────────────────
    footprintMeshesRef.current = [];
    data.datatakes.forEach((dt, idx) => {
      const prep = prepared.get(dt.id);
      if (!prep) return;
      const fp = buildFootprint(prep);
      const hex = STATUS_HEX[dt.cls] ?? STATUS_HEX.ok;

      // Fill: quad-strip with optional across-track slerp (> 500 km), all vertices on sphere
      const { positions, indices } = buildFootprintFill(fp, dt.swathKm);
      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      fillGeo.setIndex(new THREE.BufferAttribute(indices, 1));
      const fillMat = new THREE.MeshBasicMaterial({
        color: hex,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
        depthTest: true,
        side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeo, fillMat);
      fillMesh.renderOrder = 14 + idx;
      group.add(fillMesh);

      // Outline at OUTLINE_R — ring already closes (first === last), use THREE.Line
      const outlinePts = fp.ring.map(([lo, la]) => latLonToV3(la, lo, OUTLINE_R));
      const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePts);
      const outlineMat = new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 1.0, depthWrite: false, depthTest: true });
      const outlineMesh = new THREE.Line(outlineGeo, outlineMat);
      outlineMesh.renderOrder = 18 + idx;
      group.add(outlineMesh);

      footprintMeshesRef.current.push({ id: dt.id, fill: fillMesh, outline: outlineMesh, hex });
    });

    // ── Satellite dots + trails ───────────────────────────────────────────────
    const newSatObjects: SatObject[] = [];
    for (const { unit, cls, prep } of satUnits) {
      const hex = STATUS_HEX[cls] ?? STATUS_HEX.ok;

      // Dot sphere
      const dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      const dotMat = new THREE.MeshBasicMaterial({ color: hex });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.renderOrder = 1;
      group.add(dot);

      // Trail (31 points, animated in rAF) — white at 0.28; 0.70 when selected
      const trailPts: THREE.Vector3[] = Array.from({ length: 31 }, () => new THREE.Vector3());
      const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
      const trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
      const trail = new THREE.Line(trailGeo, trailMat);
      group.add(trail);

      // Ahead-track: 31 dashed points ahead of satellite; shown only when selected
      const aheadPts: THREE.Vector3[] = Array.from({ length: 31 }, () => new THREE.Vector3());
      const aheadGeo = new THREE.BufferGeometry().setFromPoints(aheadPts);
      const aheadMat = new THREE.LineDashedMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        dashSize: 0.025,
        gapSize: 0.05,
      });
      const aheadTrail = new THREE.Line(aheadGeo, aheadMat);
      aheadTrail.visible = false;
      group.add(aheadTrail);

      newSatObjects.push({ unit, cls, prep, dot, trailPts, trail, aheadPts, aheadTrail, worldPos: new THREE.Vector3() });
    }
    satObjectsRef.current = newSatObjects;

    // ── Station markers (caps + rings + links) ───────────────────────────────
    const newStationFx: StationFx[] = [];
    for (const st of data.stations) {
      const dir = latLonToV3(st.lat, st.lon, 1.0).normalize();
      const localPos = latLonToV3(st.lat, st.lon, 1.0);

      // Coverage cap (fan triangles)
      const ring = capRing(dir, CONTACT_DEG * D, GROUND_R);
      const capPositions: number[] = [];
      const capCentre = dir.clone().multiplyScalar(GROUND_R);
      for (let i = 0; i < ring.length - 1; i++) {
        capPositions.push(...capCentre.toArray(), ...ring[i].toArray(), ...ring[i + 1].toArray());
      }
      const capGeo = new THREE.BufferGeometry();
      capGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(capPositions), 3));
      // F8: cap/ring/link colours match mock-up (AcquisitionsGlobeEarth.tsx lines 1104–1150)
      const capMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      group.add(cap);

      // Station ring (LineLoop at boundary)
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ring);
      const ringMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.28, depthWrite: false });
      const ringLine = new THREE.LineLoop(ringGeo, ringMat);
      group.add(ringLine);

      // Dashed contact links (one per satellite unit, hidden initially)
      const links: THREE.Line[] = [];
      for (let _si = 0; _si < satUnits.length; _si++) {
        const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const linkMat = new THREE.LineDashedMaterial({
          color: 0x00e5ff,
          transparent: true,
          opacity: 0.75,
          dashSize: 0.006,
          gapSize: 0.006,
          depthWrite: false,
        });
        const link = new THREE.Line(linkGeo, linkMat);
        link.visible = false;
        group.add(link);
        links.push(link);
      }

      const localPosGR = localPos.clone().multiplyScalar(GROUND_R);
      // Cap and ring start hidden; shown only while a satellite is in contact (mock-up lines 1115/1127/1590-1591)
      cap.visible = false;
      ringLine.visible = false;
      newStationFx.push({ name: st.name, dir, localPos, localPosGR, cap, ring: ringLine, links });
    }
    stationFxRef.current = newStationFx;

    // Pre-allocate per-satellite direction vectors for contact checks (no per-frame alloc in rAF)
    satDirsRef.current = newSatObjects.map(() => new THREE.Vector3());

    return () => {
      group.removeFromParent();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.LineLoop) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      satObjectsRef.current = [];
      stationFxRef.current = [];
      satDirsRef.current = [];
      footprintMeshesRef.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, prepared, data.stations, satUnits]);

  // Visibility effect: declared after geometry effect so React runs it second in the same commit.
  // Toggles .visible on existing meshes without rebuilding geometry.
  useEffect(() => {
    if (!scene) return;
    const allowedIds = new Set(filteredDatatakes.map((dt) => dt.id));
    /* eslint-disable react-hooks/immutability */
    for (const { id, fill, outline } of footprintMeshesRef.current) {
      const v = allowedIds.has(id);
      fill.visible = v;
      outline.visible = v;
    }
    /* eslint-enable react-hooks/immutability */
    if (view.satellite !== null || view.datatake !== null) {
      filteredUnitsRef.current = new Set(filteredDatatakes.map((dt) => dt.unit));
    } else {
      filteredUnitsRef.current = null;
    }
  }, [scene, prepared, filteredDatatakes, view.satellite, view.datatake]);

  return (
    <>
      {/* KPI row */}
      <div className={s.kpis}>
        <div className={s.kpi}>
          <b className={s.kpiV}>{kpi.total}</b>
          <span className={s.kpiK}>Datatakes in view</span>
        </div>
        <div className={s.kpi}>
          <b className={s.kpiV}>{kpi.acquiredPct !== null ? `${kpi.acquiredPct}%` : "—"}</b>
          <span className={s.kpiK}>Acquired</span>
        </div>
        <div className={s.kpi}>
          <b className={s.kpiV}>{kpi.publishedPct !== null ? `${kpi.publishedPct}%` : "—"}</b>
          <span className={s.kpiK}>Published</span>
        </div>
        <div className={s.kpi}>
          <b className={`${s.kpiV}${kpi.failedCount > 0 ? ` ${s.kpiCrit}` : ""}`}>
            {kpi.failedCount}
          </b>
          <span className={s.kpiK}>Failed acquisitions</span>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className={s.toolbar} ref={toolbarRef}>
        <h2 className={s.tbHeading}>
          {view.day
            ? `${+view.day.slice(8)} ${MONTHS[+view.day.slice(5, 7) - 1]} ${view.day.slice(0, 4)}`
            : windowLabel(nowMs)}
        </h2>

        {/* Satellite dropdown */}
        <div className={`${s.fdrop} ${s.fdropSat}${openDropdown === "sat" ? ` ${s.fdropOpen}` : ""}`}>
          <button
            type="button"
            className={s.fdropHead}
            aria-expanded={openDropdown === "sat"}
            onClick={() => setOpenDropdown(openDropdown === "sat" ? null : "sat")}
          >
            <span className={s.fdropLabel}>Satellite</span>
            <span className={s.fdropVal}>{view.satellite ?? "All"}</span>
            <Chevron />
          </button>
          <div className={s.fdropBody} aria-hidden={openDropdown !== "sat" || undefined}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
                {[null, ...uniqueSatellites].map((sat) => (
                  <button
                    key={sat ?? "*"}
                    type="button"
                    className={`${s.fitem}${view.satellite !== null && sat !== view.satellite ? ` ${s.off}` : ""}`}
                    onClick={() => {
                      navigate({ satellite: sat, day: view.day, datatake: null });
                      setOpenDropdown(null);
                    }}
                  >
                    <u>{sat === null ? "All satellites" : sat}</u>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Day of acquisition dropdown */}
        <div className={`${s.fdrop} ${s.fdropDay}${openDropdown === "day" ? ` ${s.fdropOpen}` : ""}`}>
          <button
            type="button"
            className={s.fdropHead}
            aria-expanded={openDropdown === "day"}
            onClick={() => setOpenDropdown(openDropdown === "day" ? null : "day")}
          >
            <span className={s.fdropLabel}>Day of acquisition</span>
            <span className={s.fdropVal}>
              {view.day
                ? `${view.day.slice(8)} ${MONTHS[+view.day.slice(5, 7) - 1].slice(0, 3)}`
                : "Any"}
            </span>
            <Chevron />
          </button>
          <div className={s.fdropBody} aria-hidden={openDropdown !== "day" || undefined}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
                <button
                  type="button"
                  className={`${s.fitem} ${s.acqAnyday}${view.day !== null ? ` ${s.off}` : ""}`}
                  onClick={() => {
                    navigate({ ...view, day: null, datatake: null });
                    setOpenDropdown(null);
                  }}
                >
                  <u>Any day</u>
                </button>
                {(() => {
                  const m = new Date(calMonth);
                  const year = m.getUTCFullYear();
                  const month = m.getUTCMonth();
                  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
                  const leadBlanks = (new Date(calMonth).getUTCDay() + 6) % 7;
                  return (
                    <div className={s.calMonth}>
                      <div className={s.calMonthHead}>
                        <button
                          type="button"
                          className={s.calNav}
                          aria-label="Previous month"
                          onClick={() => setCalMonth(Date.UTC(year, month - 1, 1))}
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </button>
                        <b className={s.calMonthLabel}>{MONTHS[month]} {year}</b>
                        <button
                          type="button"
                          className={s.calNav}
                          aria-label="Next month"
                          onClick={() => setCalMonth(Date.UTC(year, month + 1, 1))}
                        >
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        </button>
                      </div>
                      <div className={s.calGrid}>
                        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                          <span key={i} className={s.calDow}>{d}</span>
                        ))}
                        {Array.from({ length: leadBlanks }, (_, i) => (
                          <span key={`b${i}`} />
                        ))}
                        {Array.from({ length: daysInMonth }, (_, i) => {
                          const dayNum = i + 1;
                          const dateStr = ymd(calMonth + i * DAY_MS);
                          const has = datesWithData.has(dateStr);
                          const isOn = view.day === dateStr;
                          return has ? (
                            <button
                              key={dayNum}
                              type="button"
                              className={`${s.calDay} ${s.calHas}${isOn ? ` ${s.calOn}` : ""}`}
                              onClick={() => {
                                navigate({ ...view, day: dateStr, datatake: null });
                                setOpenDropdown(null);
                              }}
                            >
                              {dayNum}<i />
                            </button>
                          ) : (
                            <span key={dayNum} className={s.calDay}>{dayNum}</span>
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

        {/* Datatake dropdown */}
        <div className={`${s.fdrop} ${s.fdropDtk}${openDropdown === "dtk" ? ` ${s.fdropOpen}` : ""}`}>
          <button
            type="button"
            className={s.fdropHead}
            aria-expanded={openDropdown === "dtk"}
            onClick={() => setOpenDropdown(openDropdown === "dtk" ? null : "dtk")}
          >
            <span className={s.fdropLabel}>Datatake</span>
            <span className={s.fdropVal}>{view.datatake ?? "All"}</span>
            <Chevron />
          </button>
          <div className={s.fdropBody} aria-hidden={openDropdown !== "dtk" || undefined}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
                <button
                  type="button"
                  className={`${s.fitem}${view.datatake !== null ? ` ${s.off}` : ""}`}
                  onClick={() => {
                    navigate({ ...view, datatake: null });
                    setOpenDropdown(null);
                  }}
                >
                  <u>All datatakes</u>
                </button>
                {[...dropdownDatatakes]
                  .sort((a, b) => {
                    const ga = satGroupOf(a.sat);
                    const gb = satGroupOf(b.sat);
                    if (ga < gb) return -1;
                    if (ga > gb) return 1;
                    if (a.id < b.id) return -1;
                    if (a.id > b.id) return 1;
                    return 0;
                  })
                  .map((dt) => {
                    const dotColor =
                      dt.cls === "ok" ? "#34d399" : dt.cls === "warn" ? "#f5b544" : "#ff5c5c";
                    return (
                      <button
                        key={dt.id}
                        type="button"
                        className={`${s.fitem}${view.datatake !== null && dt.id !== view.datatake ? ` ${s.off}` : ""}`}
                        onClick={() => {
                          navigate({ ...view, datatake: dt.id });
                          setOpenDropdown(null);
                        }}
                      >
                        <i className={s.dtkDot} style={{ background: dotColor }} />
                        <u>{dt.id}</u>
                        <s>{dt.comp.toFixed(1)}% · {dt.status}</s>
                      </button>
                    );
                  })}
                {dropdownDatatakes.length === 0 && (
                  <p className={s.acqEmpty}>No datatake matches</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <label className={s.fsearch}>
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
                navigate({ ...view, datatake: dropdownDatatakes[0].id });
                setOpenDropdown(null);
              }
            }}
            placeholder="Datatake ID"
            aria-label="Search datatakes"
          />
        </label>
      </div>

      {/* Globe */}
      <div className={`${s.stageRow}${view.datatake !== null ? ` ${s.hasSel}` : ""}`}>
        <div className={s.globeStage} ref={stageElRef}>
        <SpaceBackdrop page={-1} paused={!stageVisible} />
        <div className={s.canvasWrap}>
          <ThreeEarth
            transparent
            autoRotate={false}
            paused={!stageVisible}
            onReady={handleReady}
          />
        </div>

        {/* Overlay badge container — position:absolute, inset 0, pointer-events:none */}
        <div className={s.overlayBadges}>
          {/* Station badges */}
          {data.stations.map((st, i) => (
            <div
              key={st.name}
              className={s.stn}
              style={{ display: "none" }}
              ref={(el) => { stationBadgeRefs.current[i] = el; }}
            >
              <svg className={s.stnIcon} viewBox="-10 -12 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d={DISH_PATH} />
              </svg>
              <div className={s.stnRing} />
              <div className={s.stnTag}>{st.name}</div>
            </div>
          ))}
          {/* Satellite badges */}
          {satUnits.map(({ unit, cls }, i) => {
            const hex = STATUS_HEX[cls] ?? STATUS_HEX.ok;
            const colour = `#${hex.toString(16).padStart(6, "0")}`;
            return (
              <div
                key={unit}
                className={s.sat}
                style={{ display: "none" }}
                ref={(el) => { satBadgeRefs.current[i] = el; }}
              >
                <div className={s.satDot} style={{ ["--c" as string]: colour }} />
                <div className={s.satLbl}>{unit}</div>
              </div>
            );
          })}
        </div>

        <div ref={wheelHintRef} className={s.acqWheelHint}>
          {modKey} + scroll to zoom
        </div>

        <div className={s.zoomCtl}>
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
            onClick={() => {
              if (urlViewRef.current.datatake !== null) {
                navigateRef.current({ ...urlViewRef.current, datatake: null });
              } else {
                rotateToRef.current(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
              }
            }}
          >
            ⌖
          </button>
        </div>

        {/* Simulation bar */}
        <div className={s.simbar}>
          <div className={s.simctl}>
            <button
              type="button"
              className={s.play}
              aria-label={isPlaying ? "Pause simulation" : "Play simulation"}
              onClick={() => setIsPlaying((p) => !p)}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <div className={s.simtime}>
              <span ref={simTimeTextRef}>
                {(() => {
                  const ms = simDayMs + (nowMs % 86_400_000);
                  const d = new Date(ms);
                  const h = String(d.getUTCHours()).padStart(2, "0");
                  const m = String(d.getUTCMinutes()).padStart(2, "0");
                  const ss = String(d.getUTCSeconds()).padStart(2, "0");
                  return `${formatSimDate(simDayMs)} ${h}:${m}:${ss}Z`;
                })()}
              </span>
              <small>SIMULATION TIME</small>
            </div>
            <input
              type="range"
              className={s.scrub}
              min={0}
              max={86400}
              step={1}
              defaultValue={(nowMs % 86_400_000) / 1000}
              ref={scrubRef}
              aria-label="Scrub simulation time"
              onInput={(e) => {
                const v = Number((e.target as HTMLInputElement).value);
                simTimeRef.current = v;
                lastSecRef.current = -1; // force text update on next tick
              }}
            />
            <button
              type="button"
              className={s.speed}
              aria-label={`Simulation speed ×${speed}; click to change`}
              onClick={() => {
                const idx = SPEEDS.indexOf(speed);
                setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
              }}
            >
              ×{speed}
            </button>
          </div>
        </div>
        </div>

        {/* Side column: datatake detail panel — always in DOM, CSS controls width / opacity */}
        <div className={s.sideCol}>
          <div className={s.dtkRail}>
            {displayedDtk && (
              <DatatakePanel
                dt={displayedDtk}
                onClose={() => navigateRef.current({ ...urlViewRef.current, datatake: null })}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
