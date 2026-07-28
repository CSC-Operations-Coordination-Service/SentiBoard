"use client";
import { useEffect, useRef, useState } from "react";
import type { Station, AcqDatatake } from "@/lib/data";

const D = Math.PI / 180;
const ORBITS = [
  { inc: 98, omega: 30, col: "#00C7D6", u: 0, sp: 0.9 },
  { inc: 98.6, omega: 150, col: "#2E7DF6", u: 2, sp: 0.78 },
  { inc: 98.2, omega: 255, col: "#9aa7bd", u: 4, sp: 0.84 },
];
const DAY_START = Date.UTC(2026, 5, 29, 0, 0, 0);
const DAY_LEN = 86400000;
const SPEEDS = [10, 60, 300, 1000];

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

export default function AcquisitionGlobe({ stations, datatakes }: { stations: Station[]; datatakes: AcqDatatake[] }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(60);

  const selRef = useRef(0);
  const hoverRef = useRef(-1);
  const playingRef = useRef(true);
  const speedRef = useRef(60);
  const orbits = useRef(ORBITS.map((o) => ({ ...o })));
  const st = useRef({ W: 0, H: 0, R: 0, baseR: 0, cx: 0, cy: 0, yaw: 0, tilt: -0.42, t: 0, zoom: 1, autoSpin: true, dragging: false, lastX: 0, lastY: 0, moved: false, simMs: Date.UTC(2026, 5, 29, 11, 4, 22), pinch: 0 });

  useEffect(() => { selRef.current = sel; }, [sel]);

  const select = (i: number) => { setSel(i); selRef.current = i; };
  const setZoom = (z: number) => { const s = st.current; s.zoom = Math.max(0.6, Math.min(6, z)); s.R = s.baseR * s.zoom; };

  useEffect(() => {
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    const s = st.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      s.W = cv.clientWidth; s.H = cv.clientHeight;
      cv.width = s.W * dpr; cv.height = s.H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.baseR = Math.min(s.W, s.H) * 0.4; s.R = s.baseR * s.zoom; s.cx = s.W * 0.5; s.cy = s.H * 0.48;
    }
    function proj(lat: number, lon: number) {
      lat *= D; lon *= D;
      const x = Math.cos(lat) * Math.sin(lon - s.yaw), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon - s.yaw);
      const y2 = y * Math.cos(s.tilt) - z * Math.sin(s.tilt), z2 = y * Math.sin(s.tilt) + z * Math.cos(s.tilt);
      return { x: s.cx + x * s.R, y: s.cy - y2 * s.R, z: z2 };
    }
    function gc(o: typeof ORBITS[number], u: number) {
      const inc = o.inc * D, om = o.omega * D;
      const lat = Math.asin(Math.sin(inc) * Math.sin(u)) / D;
      const lon = (om + Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u))) / D;
      return { lat, lon };
    }
    function strokePath(pts: { x: number; y: number; z: number }[], style: string, width: number) {
      ctx.lineWidth = width; ctx.strokeStyle = style; ctx.beginPath(); let started = false;
      for (const p of pts) { if (p.z > 0) { started ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); started = true; } else started = false; }
      ctx.stroke();
    }
    function advanceClock() {
      s.simMs += (1000 * speedRef.current) / 60;
      if (s.simMs > DAY_START + DAY_LEN) s.simMs = DAY_START;
      const d = new Date(s.simMs); const p = (n: number) => (n < 10 ? "0" : "") + n;
      if (clockRef.current) clockRef.current.textContent = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
      if (fillRef.current) fillRef.current.style.width = (((s.simMs - DAY_START) / DAY_LEN) * 100).toFixed(1) + "%";
    }
    function frame() {
      s.t++;
      if (!reduce) { if (s.autoSpin && playingRef.current) s.yaw += 0.0022; if (playingRef.current) { orbits.current.forEach((o) => (o.u += 0.004 * o.sp)); advanceClock(); } }
      const { cx, cy, R } = s;
      ctx.clearRect(0, 0, s.W, s.H);
      const ag = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
      ag.addColorStop(0, "rgba(54,140,224,0.18)"); ag.addColorStop(1, "rgba(54,140,224,0)");
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, 6.2832); ctx.fill();
      const sg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      sg.addColorStop(0, "#14233d"); sg.addColorStop(0.6, "#0c1729"); sg.addColorStop(1, "#070d18");
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,199,214,0.35)"; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
      for (let la = -60; la <= 60; la += 30) { const ring = []; for (let lo = 0; lo <= 360; lo += 5) ring.push(proj(la, lo)); strokePath(ring, la === 0 ? "rgba(0,199,214,0.22)" : "rgba(120,150,190,0.12)", la === 0 ? 1.2 : 1); }
      for (let lo2 = 0; lo2 < 360; lo2 += 30) { const mer = []; for (let la2 = -90; la2 <= 90; la2 += 5) mer.push(proj(la2, lo2)); strokePath(mer, "rgba(120,150,190,0.10)", 1); }
      orbits.current.forEach((o) => {
        const trk = []; for (let u = 0; u < 6.2832; u += 0.05) { const g = gc(o, u); trk.push(proj(g.lat, g.lon)); }
        strokePath(trk, hexA(o.col, 0.32), 1.4);
        const g2 = gc(o, o.u), sp = proj(g2.lat, g2.lon);
        if (sp.z > 0) { const dx = sp.x - cx, dy = sp.y - cy, ax = cx + dx * 1.07, ay = cy + dy * 1.07;
          ctx.strokeStyle = hexA(o.col, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ax, ay); ctx.stroke();
          ctx.fillStyle = o.col; ctx.shadowColor = o.col; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(ax, ay, 3.2, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0; }
      });
      stations.forEach((stn) => { const p = proj(stn.lat, stn.lon); if (p.z > 0) { ctx.fillStyle = "#cdd9ec"; ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 4, p.y); ctx.lineTo(p.x, p.y + 4); ctx.lineTo(p.x - 4, p.y); ctx.closePath(); ctx.fill(); ctx.font = "10px ui-monospace,monospace"; ctx.fillStyle = "rgba(205,217,236,0.6)"; ctx.fillText(stn.name, p.x + 8, p.y + 3); } });
      datatakes.forEach((a, i) => { const p = proj(a.lat, a.lon); if (p.z > 0) {
        const col = a.cls === "ok" ? "#3DD68C" : a.cls === "warn" ? "#FFB020" : "#FF5C6C";
        const pulse = Math.sin(s.t * 0.06 + i) * 0.5 + 0.5, rr = 8 + pulse * 7;
        ctx.strokeStyle = hexA(col, 0.6 - pulse * 0.4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 6.2832); ctx.fill();
        if (selRef.current === i || hoverRef.current === i) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 5, 0, 6.2832); ctx.stroke(); ctx.font = "11px ui-monospace,monospace"; ctx.fillStyle = "#fff"; ctx.fillText(a.id, p.x + rr + 9, p.y - 2); ctx.fillStyle = "rgba(205,217,236,0.7)"; ctx.fillText(a.sat + " · " + a.comp + "%", p.x + rr + 9, p.y + 12); }
      } });
      if (!reduce) raf = requestAnimationFrame(frame);
    }

    function hit(e: MouseEvent) {
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      let best = -1, bd = 400;
      datatakes.forEach((a, i) => { const p = proj(a.lat, a.lon); if (p.z > 0) { const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = i; } } });
      return best;
    }
    const onClick = (e: MouseEvent) => { if (s.moved) { s.moved = false; return; } const b = hit(e); if (b >= 0) select(b); };
    const onMove = (e: MouseEvent) => {
      if (s.dragging) { const dx = e.clientX - s.lastX, dy = e.clientY - s.lastY; if (Math.abs(dx) + Math.abs(dy) > 3) s.moved = true; s.yaw -= dx * 0.005; s.tilt += dy * 0.005; s.tilt = Math.max(-1.45, Math.min(1.45, s.tilt)); s.lastX = e.clientX; s.lastY = e.clientY; return; }
      hoverRef.current = hit(e); cv.style.cursor = hoverRef.current >= 0 ? "pointer" : "grab";
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setZoom(s.zoom * Math.exp(-e.deltaY * 0.0015)); };
    const onDown = (e: MouseEvent) => { s.dragging = true; s.moved = false; s.lastX = e.clientX; s.lastY = e.clientY; s.autoSpin = false; cv.style.cursor = "grabbing"; };
    const onUp = () => { if (s.dragging) { s.dragging = false; cv.style.cursor = "grab"; } };
    const onTS = (e: TouchEvent) => { if (e.touches.length === 1) { s.dragging = true; s.moved = false; s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY; s.autoSpin = false; } else if (e.touches.length === 2) s.pinch = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); };
    const onTM = (e: TouchEvent) => { if (e.touches.length === 1 && s.dragging) { const dx = e.touches[0].clientX - s.lastX, dy = e.touches[0].clientY - s.lastY; s.yaw -= dx * 0.005; s.tilt += dy * 0.005; s.tilt = Math.max(-1.45, Math.min(1.45, s.tilt)); s.lastX = e.touches[0].clientX; s.lastY = e.touches[0].clientY; } else if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (s.pinch) setZoom(s.zoom * d / s.pinch); s.pinch = d; } };
    const onTE = () => { s.dragging = false; s.pinch = 0; };

    size();
    window.addEventListener("resize", size);
    cv.addEventListener("click", onClick);
    cv.addEventListener("mousemove", onMove);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    cv.addEventListener("touchstart", onTS, { passive: true });
    cv.addEventListener("touchmove", onTM, { passive: true });
    cv.addEventListener("touchend", onTE);
    advanceClock();
    if (reduce) frame(); else raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      cv.removeEventListener("click", onClick);
      cv.removeEventListener("mousemove", onMove);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      cv.removeEventListener("touchstart", onTS);
      cv.removeEventListener("touchmove", onTM);
      cv.removeEventListener("touchend", onTE);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, datatakes]);

  const dt = datatakes[sel];
  const pillFor = (st2: string) => (st2 === "Published" ? "nominal" : st2 === "Processing" ? "degraded" : "critical");
  const togglePlay = () => { const np = !playingRef.current; playingRef.current = np; setPlaying(np); };
  const cycleSpeed = () => { const n = SPEEDS[(SPEEDS.indexOf(speedRef.current) + 1) % SPEEDS.length]; speedRef.current = n; setSpeed(n); };
  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => { const r = e.currentTarget.getBoundingClientRect(); st.current.simMs = DAY_START + ((e.clientX - r.left) / r.width) * DAY_LEN; };
  const resetView = () => { setZoom(1); st.current.yaw = 0; st.current.tilt = -0.42; st.current.autoSpin = true; };

  return (
    <div className="acq-layout">
      <div className="globe-card reveal">
        <div className="globe-stage">
          <canvas ref={cvRef} className="globe-canvas" />
          <div className="globe-overlay">
            <span className="eyebrow">Live acquisition plan · 3D</span>
            <div className="acq-now">Now acquiring · <b>{dt.sat} → {dt.station}</b></div>
          </div>
          <div className="zoomctl">
            <button aria-label="Zoom in" onClick={() => setZoom(st.current.zoom * 1.3)}>+</button>
            <button aria-label="Zoom out" onClick={() => setZoom(st.current.zoom / 1.3)}>−</button>
            <button aria-label="Reset view" title="Reset view" onClick={resetView}>⌖</button>
          </div>
          <div className="globe-hint">scroll to zoom · drag to rotate</div>
          <div className="simbar">
            <button className="play" aria-label="Play/pause" onClick={togglePlay}>{playing ? "❚❚" : "►"}</button>
            <div className="simtime"><span ref={clockRef}>2026-06-29 11:04:22Z</span><small>SIMULATION TIME</small></div>
            <div className="scrub" onClick={onScrub}><i ref={fillRef} /></div>
            <div className="speed" onClick={cycleSpeed}>×{speed}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div className="acq-list reveal">
          <div className="lh"><span>List of Datatakes</span><span>completeness</span></div>
          {datatakes.map((a, i) => (
            <div key={a.id} className={"acq-item" + (sel === i ? " sel" : "")}
              onClick={() => select(i)}
              onMouseEnter={() => (hoverRef.current = i)} onMouseLeave={() => (hoverRef.current = -1)}>
              <span className={"sd " + a.cls} />
              <div><div className="id">{a.id}</div><div className="sub">{a.sat} · {a.station}</div></div>
              <span className="pct">{a.comp}%</span>
            </div>
          ))}
        </div>

        <aside className="panel dt-detail reveal">
          <span className="eyebrow">Datatake details</span>
          <h4 style={{ marginTop: 10 }}>{dt.id}</h4>
          <div style={{ marginTop: 12 }}>
            <div className="kv"><span>Satellite</span><span>{dt.sat}</span></div>
            <div className="kv"><span>Station</span><span>{dt.station}</span></div>
            <div className="kv"><span>Footprint</span><span>{Math.abs(dt.lat)}°{dt.lat >= 0 ? "N" : "S"}  {Math.abs(dt.lon)}°{dt.lon >= 0 ? "E" : "W"}</span></div>
            <div className="kv"><span>Completeness</span><span>{dt.comp} %</span></div>
            <div className="kv"><span>Status</span><span>{dt.status}</span></div>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted-2)", margin: "18px 0 2px" }}>Products</div>
          {dt.prods.map((p, i) => (
            <div className="prod-row" key={i}><span><span className="lvl">{p.lvl}</span> · {p.sub}</span><span className={"pill " + pillFor(p.st)}>{p.st}</span></div>
          ))}
        </aside>
      </div>
    </div>
  );
}
