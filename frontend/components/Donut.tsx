"use client";
import { useEffect, useRef, useState } from "react";
import type { DonutSeg } from "@/lib/data";

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export default function Donut({
  title, sub, centerLabel, centerValue, segments,
}: {
  title: string; sub: string; centerLabel: string; centerValue: number; segments: DonutSeg[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<string | null>(null);
  const progRef = useRef(0);
  const [num, setNum] = useState(0);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, cx = 0, cy = 0, rad = 0, lw = 0;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv!.clientWidth; H = cv!.clientHeight;
      cv!.width = W * dpr; cv!.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W / 2; cy = H / 2; rad = Math.min(W, H) / 2 - 16; lw = Math.max(15, rad * 0.26);
      draw();
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.lineCap = "round";
      ctx.lineWidth = lw; ctx.strokeStyle = "rgba(138,145,152,0.10)";
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.2832); ctx.stroke();
      const total = segments.reduce((s, x) => s + x.val, 0);
      const gap = 0.06, sweep = 6.2832 - gap * segments.length;
      let start = -Math.PI / 2;
      for (const s of segments) {
        const ang = (s.val / total) * sweep, a1 = start + ang * progRef.current;
        const dim = hoverRef.current && hoverRef.current !== s.label;
        ctx.strokeStyle = dim ? hexA(s.color, 0.16) : s.color;
        ctx.lineWidth = dim ? lw * 0.66 : lw;
        ctx.shadowColor = dim ? "transparent" : s.color; ctx.shadowBlur = dim ? 0 : 14;
        ctx.beginPath(); ctx.arc(cx, cy, rad, start, a1); ctx.stroke();
        start += ang + gap;
      }
      ctx.shadowBlur = 0;
    }

    size();
    window.addEventListener("resize", size);

    // animate in when scrolled into view
    let started = false;
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting && !started) {
        started = true;
        if (reduce) { progRef.current = 1; setNum(centerValue); draw(); return; }
        const t0 = performance.now();
        const step = (t: number) => {
          const p = Math.min((t - t0) / 1200, 1), e2 = 1 - Math.pow(1 - p, 3);
          progRef.current = e2; setNum(+(centerValue * e2).toFixed(1)); draw();
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }), { threshold: 0.3 });
    io.observe(cv);

    (cv as any)._draw = draw;
    return () => { window.removeEventListener("resize", size); io.disconnect(); };
  }, [segments, centerValue]);

  const setHover = (label: string | null) => {
    hoverRef.current = label;
    (canvasRef.current as any)?._draw?.();
  };

  return (
    <div className="donut-card">
      <div className="donut-wrap">
        <canvas ref={canvasRef} className="donut" />
        <div className="d-center"><span className="num">{num.toFixed(1)}<small>%</small></span><span className="lbl">{centerLabel}</span></div>
      </div>
      <div>
        <div className="d-title">{title}</div>
        <p className="d-sub">{sub}</p>
        <div className="leg" onMouseLeave={() => setHover(null)}>
          {segments.map((s) => (
            <div className="leg-item" key={s.label} onMouseEnter={() => setHover(s.label)}>
              <span className="dot" style={{ background: s.color }} />
              <span className="lab">{s.label}</span>
              <span className="v">{s.val}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
