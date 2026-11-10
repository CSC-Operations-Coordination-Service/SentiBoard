"use client";

import { useState, useRef, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { applyDayNightEarth, type DayNightEarth } from "./dayNightEarth";
import { applyStylizedEarth, type StylizedEarth } from "./stylizedEarth";
import type { AcquisitionsData } from "./types";
import { prepDatatake, subPoint, buildFootprint, buildFootprintFill, OUTLINE_R } from "./acqGeometry";
import type { PreparedDatatake } from "./acqGeometry";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import s from "./acq-globe.module.css";

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
        console.warn(
          "[AcquisitionsGlobe] ThreeEarth WebGLRenderer has no alpha channel; globe background cannot be transparent.",
        );
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
        dragState = null;
        canvas.style.cursor = "grab";
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
        if (simTimeTextRef.current) simTimeTextRef.current.textContent = `${h}:${m}:${ss}Z`;
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
        const badgesVisible = !!cam;
        for (let si = 0; si < satObjs.length; si++) {
          const so = satObjs[si];
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

    // Read CSS colour tokens once
    const cssRoot = getComputedStyle(document.documentElement);
    const fillColour = (token: string, fallback: string) => {
      const v = cssRoot.getPropertyValue(token).trim();
      return v || fallback;
    };

    // ── Footprints ────────────────────────────────────────────────────────────
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
      const outlineMat = new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.55, depthWrite: false, depthTest: true });
      const outlineMesh = new THREE.Line(outlineGeo, outlineMat);
      outlineMesh.renderOrder = 18 + idx;
      group.add(outlineMesh);
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

      // Trail (31 points, animated in rAF)
      const trailPts: THREE.Vector3[] = Array.from({ length: 31 }, () => new THREE.Vector3());
      const trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
      const trailMat = new THREE.LineBasicMaterial({ color: hex, transparent: true, opacity: 0.28, depthWrite: false });
      const trail = new THREE.Line(trailGeo, trailMat);
      group.add(trail);

      newSatObjects.push({ unit, cls, prep, dot, trailPts, trail, worldPos: new THREE.Vector3() });
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
      const capColour = fillColour("--color-accent", "#007c93");
      const capMat = new THREE.MeshBasicMaterial({
        color: capColour,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const cap = new THREE.Mesh(capGeo, capMat);
      group.add(cap);

      // Station ring (LineLoop at boundary)
      const ringGeo = new THREE.BufferGeometry().setFromPoints(ring);
      // #2fc6dc — documented literal (no token maps to this exact accent ring colour)
      const ringMat = new THREE.LineBasicMaterial({ color: 0x2fc6dc, transparent: true, opacity: 0.35 });
      const ringLine = new THREE.LineLoop(ringGeo, ringMat);
      group.add(ringLine);

      // Dashed contact links (one per satellite unit, hidden initially)
      const links: THREE.Line[] = [];
      for (let _si = 0; _si < satUnits.length; _si++) {
        const linkGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const linkMat = new THREE.LineDashedMaterial({
          color: 0x2fc6dc,
          transparent: true,
          opacity: 0.6,
          dashSize: 0.04,
          gapSize: 0.03,
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
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, prepared, data.stations, satUnits]);

  return (
    <div className={s.stageRow}>
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
              rotateToRef.current(HOME_VIEW.lon, HOME_VIEW.lat, HOME_VIEW.zoom);
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
                  const t = (nowMs % 86_400_000) / 1000;
                  const h = String(Math.floor(t / 3600)).padStart(2, "0");
                  const m = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
                  const ss = String(Math.floor(t % 60)).padStart(2, "0");
                  return `${h}:${m}:${ss}Z`;
                })()}
              </span>
              <small>{formatSimDate(simDayMs)}</small>
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
    </div>
  );
}
