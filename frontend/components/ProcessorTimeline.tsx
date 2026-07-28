"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MissionId, ProcMission, ProcWindow, Release } from "@/lib/data";

// Muted per-satellite lane hues — quieter than the teal signal on purpose. Teal is reserved for
// "now" and the active selection; amber for held/deprecated baselines.
const LANE_HUE: Record<MissionId, string> = {
  "1": "var(--m1)", "2": "var(--m2)", "3": "var(--m3)", "5P": "var(--m5p)",
};
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY = 86_400_000;
const MIN_SPAN = 45 * DAY; // deepest zoom
// Missions with more processors than this start collapsed — S3 has 17 IPFs and S5P 14, so opening
// everything would put a ~1400px wall where the hero should be.
const AUTO_OPEN_MAX = 6;

type Vp = { t0: number; t1: number };

const p2 = (n: number) => (n < 10 ? "0" : "") + n;
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}Z`;

// The plot is inset from the left edge by the label gutter, so percentages apply to the track area
// (100% - gutter), not to the full width. Both the now marker and the ticks use this.
const atPct = (pct: number) => `calc(var(--ptl-gutter) + (100% - var(--ptl-gutter)) * ${pct} / 100)`;

// Tick granularity follows the zoom: years when wide, quarters at a few years, months when close.
function ticksFor(vp: Vp) {
  const span = vp.t1 - vp.t0;
  const y0 = new Date(vp.t0).getUTCFullYear();
  const y1 = new Date(vp.t1).getUTCFullYear();
  const out: { t: number; label: string; major: boolean }[] = [];
  const months = span > 400 * DAY ? [0, 3, 6, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (let y = y0; y <= y1; y++) {
    if (span > 4 * 365 * DAY) {
      out.push({ t: Date.UTC(y, 0, 1), label: String(y), major: true });
    } else {
      for (const m of months) out.push({ t: Date.UTC(y, m, 1), label: m === 0 ? String(y) : MON[m], major: m === 0 });
    }
  }
  return out.filter((k) => k.t >= vp.t0 && k.t <= vp.t1);
}

export default function ProcessorTimeline({ missions, win }: { missions: ProcMission[]; win: ProcWindow }) {
  const all = useMemo(() => missions.flatMap((m) => m.rows.flatMap((r) => r.releases)), [missions]);
  const [sel, setSel] = useState<Release | null>(all.find((r) => r.def) ?? all[all.length - 1] ?? null);
  const [vp, setVp] = useState<Vp>({ t0: win.start, t1: win.end });
  const [open, setOpen] = useState<Set<MissionId>>(
    () => new Set(missions.filter((m) => m.rows.length <= AUTO_OPEN_MAX).map((m) => m.id)),
  );
  // Rendered as null server-side and filled after mount: a clock can't match across the boundary,
  // so deferring both the stamp and the marker position avoids a hydration mismatch.
  const [now, setNow] = useState<{ t: number; stamp: string } | null>(null);

  const plotRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const userPicked = useRef(false);
  const dragged = useRef(false);

  const pct = (t: number) => ((t - vp.t0) / (vp.t1 - vp.t0)) * 100;
  const zoomed = vp.t1 - vp.t0 < win.end - win.start;

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNow({ t: d.getTime(), stamp: utcStamp(d) });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Scroll the detail panel into view on click, but not for the default selection on load.
  useEffect(() => {
    if (!userPicked.current) return;
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [sel]);

  // Wheel zoom anchored on the cursor. Registered manually because preventDefault needs a
  // non-passive listener, which React's onWheel does not give us.
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const track = trackRect(el);
      if (!track) return;
      e.preventDefault();
      setVp((v) => {
        const span = v.t1 - v.t0;
        const frac = Math.max(0, Math.min(1, (e.clientX - track.left) / track.width));
        const anchor = v.t0 + span * frac;
        const next = Math.max(MIN_SPAN, Math.min(win.end - win.start, span * (e.deltaY > 0 ? 1.18 : 1 / 1.18)));
        return clamp({ t0: anchor - next * frac, t1: anchor + next * (1 - frac) }, win);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [win]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = plotRef.current;
    const track = el && trackRect(el);
    if (!track) return;
    dragged.current = false;
    const startX = e.clientX;
    const start = vp;
    const perPx = (start.t1 - start.t0) / track.width;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (Math.abs(dx) > 4) dragged.current = true;
      setVp(clamp({ t0: start.t0 - dx * perPx, t1: start.t1 - dx * perPx }, win));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // A drag that started on a dot must not also select it.
  const pick = (rel: Release) => {
    if (dragged.current) return;
    userPicked.current = true;
    setSel(rel);
  };

  const toggle = (id: MissionId) =>
    setOpen((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const ticks = ticksFor(vp);
  const nowPct = now ? pct(now.t) : null;
  const nowVisible = nowPct !== null && nowPct >= 0 && nowPct <= 100;

  // One rail of dots. Used for both an IPF sub-row and a collapsed mission's merged summary.
  const Track = ({ releases, showTags }: { releases: Release[]; showTags: boolean }) => {
    // A processor on the roster with no releases yet still gets its lane — an empty rail says
    // "tracked, nothing published" where a missing row would just look like an oversight.
    if (!releases.length) {
      return (
        <div className="ptl-track">
          <div className="ptl-rail" />
          <span className="ptl-none">no releases published</span>
        </div>
      );
    }
    const newest = releases.reduce((a, b) => (b.ms > a.ms ? b : a), releases[0]);
    const liveFrom = pct(newest.ms);
    const liveTo = now ? pct(now.t) : liveFrom;
    return (
      <div className="ptl-track">
        <div className="ptl-rail" />
        {liveTo > liveFrom && (
          <div
            className="ptl-live"
            style={{ left: `${Math.max(0, liveFrom)}%`, width: `${Math.min(100, liveTo) - Math.max(0, liveFrom)}%` }}
          />
        )}
        <span className="ptl-arrow">▶</span>
        {releases.map((rel) => {
          const x = pct(rel.ms);
          if (x < -1 || x > 101) return null; // off-viewport
          const isSel = sel === rel;
          return (
            <button
              key={rel.proc + rel.baseline + rel.ms}
              type="button"
              className={`ptl-mark ${rel.kind}${isSel ? " sel" : ""}`}
              style={{ left: `${x}%` }}
              onClick={() => pick(rel)}
              aria-pressed={isSel}
              title={`${rel.proc} · ${rel.baseline} · ${rel.iso}${rel.sats.length ? ` · ${rel.sats.join(" ")}` : ""}`}
            >
              <i className="dot" />
              {(showTags && rel.kind === "cur") || isSel ? <span className="tag">{rel.baseline}</span> : null}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <section className="ptl-hero">
        <div className="ptl-inner">
          <div className="ptl-nowhead">
            {now && nowVisible && (
              <div className="ptl-nowout" style={{ left: atPct(nowPct!) }}>
                <span className="lbl">now ⟶</span>
                <span className="utc">{now.stamp}</span>
              </div>
            )}
            <button
              type="button"
              className="ptl-reset"
              onClick={() => setVp({ t0: win.start, t1: win.end })}
              disabled={!zoomed}
            >
              {zoomed ? "Reset zoom" : "Scroll to zoom · drag to pan"}
            </button>
          </div>

          <div className="ptl-scale">
            {ticks.map((k) => (
              <span key={k.t} className={k.major ? "major" : ""} style={{ left: `${pct(k.t)}%` }}>
                {k.label}
              </span>
            ))}
          </div>

          <div className="ptl-plot" ref={plotRef} onPointerDown={onPointerDown}>
            {now && nowVisible && <div className="ptl-nowline" style={{ left: atPct(nowPct!) }} />}

            {missions.map((m) => {
              const isOpen = open.has(m.id);
              const merged = m.rows.flatMap((r) => r.releases);
              return (
                <div className="ptl-lane" key={m.id} style={{ ["--lane" as string]: LANE_HUE[m.id] }}>
                  <div className="ptl-sub">
                    <button
                      type="button"
                      className={`ptl-lane-name${isOpen ? " open" : ""}`}
                      onClick={() => toggle(m.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="chev" aria-hidden="true">›</span>
                      <b>S{m.id}</b>
                      <small>{isOpen ? m.name : `${m.rows.length} processors`}</small>
                    </button>
                    {/* Collapsed: every release of the mission merged onto one rail, so nothing is
                        hidden — only aggregated. Expanded: this row is just the group header. */}
                    {isOpen ? <div className="ptl-track ptl-track-empty" /> : <Track releases={merged} showTags={false} />}
                  </div>

                  {isOpen &&
                    m.rows.map((row) => (
                      <div className="ptl-sub" key={row.label}>
                        <div className="ptl-sub-label">
                          <span className="ipf">{row.label}</span>
                          <span className="sub">{row.sub}</span>
                        </div>
                        <Track releases={row.releases} showTags />
                      </div>
                    ))}

                  <div className="ptl-lane-rule" />
                </div>
              );
            })}
          </div>

          <div className="ptl-hint">
            <span><i className="old" /> Superseded</span>
            <span><i className="cur" /> In production</span>
            <span><i className="now" /> Now</span>
            <span>{all.length} releases · {missions.reduce((n, m) => n + m.rows.length, 0)} processors</span>
          </div>
        </div>
      </section>

      {sel && (
        // key replays the slide-up on each selection change.
        <aside className="panel ptl-detail" key={sel.proc + sel.baseline + sel.ms} ref={detailRef}>
          <span className="eyebrow">Release detail</span>
          <div className="rd-head">
            <h4>{sel.proc}</h4>
            <span className="ver">{sel.baseline}</span>
            <span className={"pill " + sel.pill}>{sel.status}</span>
          </div>
          <div className="rd-grid">
            <div className="kv"><span>Baseline</span><span>{sel.baseline}</span></div>
            <div className="kv"><span>Previous</span><span>{sel.prev}</span></div>
            <div className="kv"><span>Operational since</span><span>{sel.iso}</span></div>
            <div className="kv"><span>Valid to</span><span>{sel.isoEnd}</span></div>
          </div>
          <div className="rd-notes">
            <span className="lbl">Release  notes</span>
            {sel.notes ? (
              sel.notes.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)
            ) : (
              <p className="none">No Release notes published for this baseline.</p>
            )}
          </div>
          <div className="rd-prods">
            <span className="lbl">Impacted satellite(s)</span>
            {sel.sats.length ? (
              sel.sats.map((sat) => <span className="tag sat" key={sat}>{sat}</span>)
            ) : (
              // A release with no satellite_units is real in this feed, not a formatting gap.
              <span className="tag none">Not published in the releases feed</span>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

// The track area starts after the label gutter; read the gutter off the computed style so the CSS
// stays the single source of truth for its width.
function trackRect(plot: HTMLElement) {
  const r = plot.getBoundingClientRect();
  const gutter = parseFloat(getComputedStyle(plot).getPropertyValue("--ptl-gutter")) || 0;
  const width = r.width - gutter;
  return width > 0 ? { left: r.left + gutter, width } : null;
}

function clamp(v: Vp, win: ProcWindow): Vp {
  const span = Math.min(v.t1 - v.t0, win.end - win.start);
  let t0 = v.t0;
  if (t0 < win.start) t0 = win.start;
  if (t0 + span > win.end) t0 = win.end - span;
  return { t0, t1: t0 + span };
}
