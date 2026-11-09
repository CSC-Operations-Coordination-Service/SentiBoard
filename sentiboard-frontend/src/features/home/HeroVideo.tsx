"use client";

import { useEffect, useRef } from "react";
import s from "./home.module.css";
import { asset } from "@/lib/asset";

/** Full-bleed background video for the hero.
 *  No autoPlay attribute — useEffect drives play/pause so prefers-reduced-motion is respected. */
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    function apply() {
      const el = videoRef.current;
      if (!el) return;
      if (mq.matches) {
        el.pause();
      } else {
        el.play().catch(() => {});
      }
    }
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={videoRef}
      muted
      loop
      playsInline
      aria-hidden="true"
      className={s.heroVideo}
    >
      <source src={asset("/assets/mv/home.mp4")} type="video/mp4" />
    </video>
  );
}
