"use client";

import { useState, useRef, useCallback, useEffect, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import { applyDayNightEarth, type DayNightEarth } from "./dayNightEarth";
import { applyStylizedEarth, type StylizedEarth } from "./stylizedEarth";
import type { AcquisitionsData } from "./types";
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

export default function AcquisitionsGlobe({
  look,
  nowMs,
  data: _data,
}: {
  look: GlobeLook;
  nowMs: number;
  /** Slice 3 consumes data to build footprints, satellites, stations. */
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

  // scene state: Slice 3 adds useEffect(() => { if (!scene) return; buildOverlays(scene, ...); }, [scene])
  const [_scene, setScene] = useState<THREE.Scene | null>(null);

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

  // lookRef lets handleReady (called once at mount) read the look prop.
  const lookRef = useRef(look);

  // simDayMs: UTC midnight of the day nowMs falls on; used as the base for the day/night shader.
  const simDayMs = nowMs - (nowMs % 86_400_000);
  const simDayMsRef = useRef(simDayMs);

  // simTimeRef: seconds into the day at mount (Slice 2 is frozen; Slice 3 will advance it).
  const simTimeRef = useRef((nowMs % 86_400_000) / 1000);

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

  // rAF loop: advance camera animation, applyView, globeZoomed class, dayNight, atmosphere.
  // Skips all work (not just the GL call) when the stage is off-screen.
  useEffect(() => {
    let animId: number;
    const tick = (now: number) => {
      if (stageVisibleRef.current) {
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
        const timeMs = simDayMsRef.current + simTimeRef.current * 1000;
        dayNightRef.current?.setTime(timeMs);
        const atmos = atmosphereRef.current;
        const c = cameraRef.current;
        if (atmos && c) fitAtmosphere(atmos, c);
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [applyView]);

  return (
    <div className={s.stageRow}>
      <div className={s.globeStage} ref={stageElRef}>
        <div className={s.canvasWrap}>
          <ThreeEarth
            transparent
            autoRotate={false}
            paused={!stageVisible}
            onReady={handleReady}
          />
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
      </div>
    </div>
  );
}
