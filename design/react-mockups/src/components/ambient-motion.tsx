import { useState } from "react";
import s from "./ambient-motion.module.css";

/**
 * Pause state for a page's ambient motion. Reduced-motion users start paused, and everyone can
 * pause, since the motion runs longer than five seconds.
 */
export function useAmbientMotion() {
  const [paused, setPaused] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );
  return { paused, toggle: () => setPaused((p) => !p) };
}

/**
 * Class string for the element that hosts the ambient layers. Pass the page's own class as
 * `extra` when that element already carries one, so its background stays on the same element.
 */
export function ambientRoot(paused: boolean, extra = ""): string {
  return [s.host, paused ? s.paused : "", extra].filter(Boolean).join(" ");
}

/** Class for a scrolling region that gets the scan band. */
export const ambientScan = s.scan;

/** Decorative starfield strip. Place it as the first child of the element passed to ambientRoot. */
export function AmbientSky() {
  return (
    <div className={s.sky} aria-hidden="true">
      <div className={s.track}>
        <div className={s.tile} />
        <div className={s.tile} />
      </div>
    </div>
  );
}

/** Pause/resume control, right-aligned in its own row. */
export function MotionToggle({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={s.toolbar}>
      <button type="button" className={s.toggle} onClick={onToggle}>
        {paused ? "Resume motion" : "Pause motion"}
      </button>
    </div>
  );
}
