"use client";

/* The interactive release timeline: animated window, zoom on a picked release, hover/focus
   tooltip. Browser-only (requestAnimationFrame, matchMedia, a portal on <body>), so the explorer
   loads it with next/dynamic and ssr: false; the server HTML carries ReleaseList instead.
   Ported from the prototype's processors.tsx; the window math moved in here from the page, so it
   ships in this lazily loaded chunk. */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "./processors.module.css";
import {
  MONTHS,
  isoDay,
  laneName,
  type ProcessorGroup,
  type ReleaseRecord,
} from "./model";
import type { BaselineFilter, Range } from "./url-state";

const DAY = 24 * 60 * 60 * 1000;
const MONTH_MS = 30.44 * DAY;

interface Mark {
  pct: number;
  label: string;
}

interface GridLine {
  pct: number;
  major: boolean;
}

/** A time window, [start, end] in ms. */
type Win = [number, number];

interface Axis {
  start: number;
  end: number;
  /** Percent position of TODAY along the track. */
  today: number;
  /** The chart fits the pane; below this width (narrow screens) it scrolls sideways instead. */
  minWidth: number;
  grid: GridLine[];
  months: Mark[];
  years: Mark[];
}

/**
 * Window bounds, as the reference timeline draws them: from the quarter before the earliest
 * baseline (never later than Jan 2014) up to three months past today.
 */
function timelineBounds(earliest: number, now: number): Win {
  const first = new Date(Math.min(earliest, Date.UTC(2014, 0, 1)));
  const today = new Date(now);
  const start = Date.UTC(
    first.getUTCFullYear(),
    Math.floor(first.getUTCMonth() / 3) * 3 - 3,
    1,
  );
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 1);
  return [start, end];
}

/** 1Y and 2Y start on the same month one or two years back; ALL uses the full bounds. */
function rangeWindow(range: Range, now: number, bounds: Win): Win {
  if (range === "ALL") return bounds;
  const today = new Date(now);
  return [
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth() - (range === "1Y" ? 12 : 24),
      1,
    ),
    bounds[1],
  ];
}

function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate());
}

/** A picked release zooms the window to five months either side of it, slid back inside the
 *  bounds when it would run past either end — zoomWin() in SentiBoard.html. */
function zoomWindow(ms: number, bounds: Win): Win {
  let t0 = addMonths(ms, -5);
  let t1 = addMonths(ms, 5);
  if (t0 < bounds[0]) {
    t1 += bounds[0] - t0;
    t0 = bounds[0];
  }
  if (t1 > bounds[1]) {
    t0 -= t1 - bounds[1];
    t1 = bounds[1];
  }
  return [t0, t1];
}

/**
 * Glides the visible window to `target` like a camera: the centre moves on an ease-in-out curve
 * and the WIDTH is interpolated logarithmically, so zooming from 12 years to 10 months feels as
 * even as zooming back. 820ms, as in the reference. Returns the window to draw this frame and
 * whether it is still moving (markers are not clickable mid-flight).
 */
function useAnimatedWindow(target: Win): [Win, boolean] {
  const [win, setWin] = useState<Win>(target);
  const [moving, setMoving] = useState(false);
  const current = useRef<Win>(target);
  const [b0, b1] = target;

  useEffect(() => {
    const [a0, a1] = current.current;
    if (a0 === b0 && a1 === b1) return;
    const to: Win = [b0, b1];
    let raf = 0;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      current.current = to;
      raf = requestAnimationFrame(() => setWin(to));
      return () => cancelAnimationFrame(raf);
    }
    const c0 = (a0 + a1) / 2;
    const c1 = (b0 + b1) / 2;
    const w0 = a1 - a0;
    const w1 = b1 - b0;
    const t = performance.now();
    const DUR = 820;
    const ease = (k: number) =>
      k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    const tick = (n: number) => {
      const k = Math.min(1, (n - t) / DUR);
      const e = ease(k);
      const w = w0 * Math.pow(w1 / w0, e);
      const c = c0 + (c1 - c0) * e;
      const next: Win = k >= 1 ? to : [c - w / 2, c + w / 2];
      current.current = next;
      setWin(next);
      setMoving(k < 1);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // interrupted (a new target): the next run starts from wherever this one got to
    return () => cancelAnimationFrame(raf);
  }, [b0, b1]);

  return [win, moving];
}

/**
 * Ticks for a window. Density follows the window length: monthly labels up to 15 months, every
 * second month up to 28, quarterly up to 60, and only the years beyond that.
 */
function buildAxis([start, end]: Win, now: number): Axis {
  const span = end - start;
  const months = span / MONTH_MS;
  const every = months <= 15 ? 1 : months <= 28 ? 2 : months <= 60 ? 3 : 12;

  const grid: GridLine[] = [];
  const monthMarks: Mark[] = [];
  const yearMarks: Mark[] = [];
  const at = (t: number) => ((t - start) / span) * 100;

  const cursor = new Date(start);
  let y = cursor.getUTCFullYear();
  let m = cursor.getUTCMonth();
  let firstYear = true;
  // The window rarely starts on 1 January, so its first year gets a label at the left edge —
  // but only with room for it: 8% of the track (~40px at the narrowest) before the next
  // January's label, which it would otherwise overprint ("2013" on top of "2014").
  const leadRoom = (Date.UTC(y + 1, 0, 1) - start) / span >= 0.08;
  while (Date.UTC(y, m, 1) <= end) {
    const pct = at(Date.UTC(y, m, 1));
    const isYear = m === 0;
    if (pct >= -1 && (m % every === 0 || isYear)) {
      grid.push({ pct, major: isYear });
      if (pct < 93 && every < 12) {
        monthMarks.push({ pct, label: MONTHS[m].slice(0, 3).toUpperCase() });
      }
    }
    if (pct >= -1 && pct < 95 && (isYear || (firstYear && leadRoom))) {
      yearMarks.push({ pct: Math.max(0, pct), label: String(y) });
    }
    if (pct >= -1) firstYear = false;
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }

  return {
    start,
    end,
    today: at(now),
    minWidth: 600,
    grid,
    months: monthMarks,
    years: yearMarks,
  };
}

interface Tip {
  group: ProcessorGroup;
  release: ReleaseRecord;
  isCurrent: boolean;
  isSelected: boolean;
  /** Viewport position of the marker's centre, and where the card sits relative to it. */
  x: number;
  y: number;
  below: boolean;
}

export interface ReleaseTimelineProps {
  /** The selected mission's processors. */
  groups: ProcessorGroup[];
  now: number;
  range: Range;
  baselineFilter: BaselineFilter;
  /** Normalised (trimmed, lower-case) search text. */
  query: string;
  /** Id of the release whose detail is open, if any. */
  selected: string | null;
  onPick: (id: string) => void;
}

/* Lane reveal, scroll-linked as in the prototype (37782d3 / b342a73: keyframes opacity 0 → 1 and
   translateY(15px) → 0, linear, `animation-timeline: view()` with `animation-range: entry 0%
   cover 25%`). view() cannot be used here — the lanes sit inside scroll containers that never
   scroll vertically (docs/memory/DECISIONS.md) — so the same mapping is computed from the page
   scroll in JavaScript. A lane's progress runs from 0 when its top reaches the bottom of the
   window ("entry 0%") to 1 a quarter of (window height + lane height) further ("cover 25%"); it
   follows the scroll both ways. */
const LANE_RISE_PX = 15;
const LANE_RANGE_COVER = 0.25;
/* Staggered entrance on a mission change with the timeline on screen. */
const LANE_IN_MS = 450;
const LANE_IN_SPREAD_MS = 240;
const LANE_IN_STEP_MS = 40;
const LANE_IN_EASING = "cubic-bezier(0.22, 1, 0.36, 1)"; // --ease in tokens.css

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Writes one lane's reveal onto its elements: `translate` and `filter: opacity()`, which compose
 *  with their own `transform` (marker hover/selection scale) and `opacity` (dim/off/faint) instead
 *  of overriding them, and affect neither layout nor neighbours. At 1 both are removed, so a
 *  settled lane carries no style at all. */
function paintLane(els: HTMLElement[], p: number) {
  for (const el of els) {
    if (p >= 1) {
      el.style.removeProperty("translate");
      el.style.removeProperty("filter");
    } else {
      el.style.translate = `0 ${(LANE_RISE_PX * (1 - p)).toFixed(2)}px`;
      el.style.filter = `opacity(${p.toFixed(3)})`;
    }
  }
}

/* Row geometry, as drawTimeline() lays it out in SentiBoard.html. */
const AXIS_TOP = 42; // rows start under the year + month labels
const STEM_TOP = 40; // stems and TODAY start just under the month labels
const FOOT = 26; // room under the last row for the TODAY label

export default function ReleaseTimeline({
  groups,
  now,
  range,
  baselineFilter,
  query,
  selected,
  onPick,
}: ReleaseTimelineProps) {
  // The window the timeline should show: the range (1Y/2Y/ALL), or — with a release picked — ten
  // months around that release. useAnimatedWindow glides from one to the other.
  const bounds = useMemo(() => {
    const earliest = groups.reduce(
      (min, g) => g.releases.reduce((m, r) => Math.min(m, r.ms), min),
      now,
    );
    return timelineBounds(earliest, now);
  }, [groups, now]);
  const selRow = selected
    ? groups.findIndex((g) => g.releases.some((r) => r.id === selected))
    : -1;
  const pickedMs =
    selRow >= 0
      ? (groups[selRow].releases.find((r) => r.id === selected)?.ms ?? null)
      : null;
  const target = useMemo<Win>(
    () =>
      pickedMs !== null
        ? zoomWindow(pickedMs, bounds)
        : rangeWindow(range, now, bounds),
    [pickedMs, bounds, range, now],
  );
  const [win, moving] = useAnimatedWindow(target);
  const axis = useMemo(() => buildAxis(win, now), [win, now]);

  const toPct = (ms: number) =>
    ((ms - axis.start) / (axis.end - axis.start)) * 100;
  const scrollRef = useRef<HTMLDivElement>(null); // sideways scroll (long windows)
  const [tip, setTip] = useState<Tip | null>(null);

  // Many rows (Sentinel-3) are drawn tighter, so the whole table stays in view.
  const n = groups.length;
  const rh = n > 12 ? 22 : n > 8 ? 28 : 44;
  const H = AXIS_TOP + rh * n + FOOT;
  const zoomed = selRow >= 0;

  // Scroll-linked lane reveal (see LANE_RANGE_COVER). Nothing here goes through React state: a
  // passive scroll/resize listener, batched per animation frame, reads one untransformed box (the
  // chart) and writes the lanes' styles directly, only for lanes whose progress changed.
  const mission = groups[0]?.mission;
  const chartRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLElement[][]>([]); // elements of each lane (data-lane-row)
  const paintedRef = useRef<number[]>([]); // progress last written per lane
  const geomRef = useRef({ n, rh });
  const paintRef = useRef(() => {});

  useLayoutEffect(() => {
    geomRef.current = { n, rh };
    paintRef.current = () => {
      const chart = chartRef.current;
      if (!chart || reducedMotion()) return;
      const { n: lanes, rh: h } = geomRef.current;
      const vh = window.innerHeight;
      const top = chart.getBoundingClientRect().top;
      // How much further the page can scroll: a lane the page cannot scroll far enough to finish
      // finishes at the bottom of the page instead, so none can stay part-faded.
      const more = Math.max(
        0,
        document.documentElement.scrollHeight - vh - window.scrollY,
      );
      for (let i = 0; i < lanes; i++) {
        const d = vh - (top + AXIS_TOP + i * h); // scrolled since "entry 0%"
        const len = Math.min(LANE_RANGE_COVER * (vh + h), d + more);
        const p = len <= 0 ? 1 : Math.round(Math.min(1, Math.max(0, d / len)) * 1000) / 1000;
        if (paintedRef.current[i] === p) continue;
        paintedRef.current[i] = p;
        paintLane(lanesRef.current[i] ?? [], p);
      }
    };
  });

  // After every render: re-collect each lane's elements (markers mount and unmount as the window
  // zooms) and repaint them before the browser paints.
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const lanes: HTMLElement[][] = Array.from({ length: n }, () => []);
    chart
      .querySelectorAll<HTMLElement>("[data-lane-row]")
      .forEach((el) => lanes[Number(el.dataset.laneRow)]?.push(el));
    lanesRef.current = lanes;
    paintedRef.current = [];
    paintRef.current();
  });

  useEffect(() => {
    let raf = 0;
    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          paintRef.current();
        });
      }
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    const ro = new ResizeObserver(schedule); // the page grows or shrinks (images, panes)
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Mission change with the timeline on screen: the new lanes rise and fade in, staggered row by
  // row. Web Animations with only a "from" keyframe, so each lane animates from hidden to its
  // scroll-linked state of the moment, and scroll-linking simply carries on when it ends. Not on
  // first render (the scroll-linked reveal covers it) and never on zoom or range changes.
  const shownMission = useRef(mission);
  useLayoutEffect(() => {
    const chart = chartRef.current;
    if (shownMission.current === mission || !chart) return;
    shownMission.current = mission;
    if (reducedMotion() || typeof chart.animate !== "function") return;
    const box = chart.getBoundingClientRect();
    const lanesTop = box.top + AXIS_TOP;
    if (box.bottom <= 0 || lanesTop >= window.innerHeight) return; // off screen
    const lanes = lanesRef.current;
    const step = lanes.length > 1 ? Math.min(LANE_IN_STEP_MS, LANE_IN_SPREAD_MS / (lanes.length - 1)) : 0;
    const running = lanes.flatMap((els, i) =>
      els.map((el) =>
        el.animate([{ translate: `0 ${LANE_RISE_PX}px`, filter: "opacity(0)" }], {
          duration: LANE_IN_MS,
          delay: Math.round(i * step),
          easing: LANE_IN_EASING,
          fill: "backwards",
        }),
      ),
    );
    return () => running.forEach((a) => a.cancel());
  }, [mission]);

  // Once the window has settled: overview → scrolled to the end (latest releases and TODAY in
  // view); zoomed → the picked release in the middle.
  useEffect(() => {
    if (moving) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    sc.scrollTo({
      left: (sc.scrollWidth - sc.clientWidth) * (zoomed ? 0.5 : 1),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [moving, zoomed, axis.minWidth]);

  const showTip = (el: HTMLElement, t: Omit<Tip, "x" | "y" | "below">) => {
    const box = scrollRef.current?.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const half = 118; // half the card's 236px width
    const x = Math.min(
      Math.max(r.left + r.width / 2, (box?.left ?? 0) + half),
      (box?.right ?? window.innerWidth) - half,
    );
    // No room above (the card is ~260px tall, under a 68px fixed nav): open underneath.
    const below = r.top < 330;
    setTip({ ...t, x, y: below ? r.bottom + 12 : r.top - 12, below });
  };

  return (
    <div
      className={s.tl}
    >
      {/* Every lane is shown at full height (no cap, no fade). The inner box is the sideways
          scroll for narrow screens, with the names pinned on the left. */}
      <div className={s.tlView}>
        <div
          className={s.tlScroll}
          ref={scrollRef}
          onScroll={() => setTip(null)}
        >
          <div ref={chartRef} className={s.tlChart} style={{ minWidth: axis.minWidth }}>
            {/* names: pinned to the left while the chart scrolls under them */}
            <div className={s.tlLabels} style={{ height: H }}>
              {groups.map((g, i) => (
                <span
                  key={g.ipf}
                  className={[
                    zoomed && i === selRow ? s.on : "",
                    zoomed && i !== selRow ? s.dim : "",
                  ].join(" ")}
                  style={{ top: AXIS_TOP + i * rh, height: rh }}
                  title={g.label}
                  data-lane-row={i}
                >
                  {laneName(g.label)}
                </span>
              ))}
            </div>

            <div className={s.tlTrack} style={{ height: H }}>
              {/* grid: year lines run the full height, month lines start under the year row */}
              {axis.grid.map((line) => (
                <i
                  key={`g${line.pct}`}
                  className={`${s.g} ${line.major ? s.gYear : ""}`}
                  style={{ left: `${line.pct}%` }}
                />
              ))}
              {axis.years.map((t) => (
                <span
                  key={`y${t.label}`}
                  className={s.yl}
                  style={{ left: `${t.pct}%` }}
                >
                  {t.label}
                </span>
              ))}
              {axis.months.map((t) => (
                <span
                  key={`m${t.pct}`}
                  className={s.ml}
                  style={{ left: `${t.pct}%` }}
                >
                  {t.label}
                </span>
              ))}

              {/* one hairline between rows */}
              {Array.from({ length: n + 1 }, (_, i) => (
                <i
                  key={`r${i}`}
                  className={s.rl}
                  style={{ top: AXIS_TOP + i * rh }}
                  data-lane-row={Math.min(i, n - 1)}
                />
              ))}

              {axis.today >= 0 && axis.today <= 100 && (
                <i
                  className={`${s.today} ${axis.today > 94 ? s.todayEnd : ""}`}
                  style={{ left: `${axis.today}%` }}
                  aria-hidden="true"
                >
                  <b>Today</b>
                </i>
              )}

              {groups.map((g, i) => {
                const cy = AXIS_TOP + i * rh + rh / 2;
                const rowDim = zoomed && i !== selRow;
                const groupHit =
                  !query || `${g.label} ${g.sub}`.toLowerCase().includes(query);

                return g.releases.map((r) => {
                  const x = toPct(r.ms);
                  if (x < -2 || x > 102) return null;
                  const isCurrent = r.isCurrent;
                  const isSelected = selected === r.id;
                  // Filters fade releases back instead of removing them, so the rows never jump.
                  const off = baselineFilter === "current" && !isCurrent;
                  const faint =
                    !groupHit && !r.baseline.toLowerCase().includes(query);
                  const state = [
                    rowDim ? s.dim : "",
                    off ? s.off : "",
                    faint ? s.faint : "",
                  ].join(" ");

                  return (
                    <span key={r.id} className={s.mkWrap}>
                      {/* the stem: from under the axis down to the release, so every release can be
                        read against the month labels */}
                      <i
                        className={`${s.stem} ${state}`}
                        style={{ left: `${x}%`, height: cy - STEM_TOP }}
                        data-lane-row={i}
                      />
                      <button
                        type="button"
                        className={[
                          s.mk,
                          isCurrent ? s.mkNow : "",
                          isSelected ? s.mkSel : "",
                          state,
                        ].join(" ")}
                        style={{ left: `${x}%`, top: cy }}
                        data-lane-row={i}
                        disabled={moving || off}
                        aria-label={`${laneName(g.label)} ${r.baseline}, operational since ${isoDay(r.ms)}${isCurrent ? ", current baseline" : ", superseded"}`}
                        aria-pressed={isSelected}
                        onMouseEnter={(e) =>
                          showTip(e.currentTarget, {
                            group: g,
                            release: r,
                            isCurrent,
                            isSelected,
                          })
                        }
                        onFocus={(e) =>
                          showTip(e.currentTarget, {
                            group: g,
                            release: r,
                            isCurrent,
                            isSelected,
                          })
                        }
                        onMouseLeave={() => setTip(null)}
                        onBlur={() => setTip(null)}
                        onClick={() => {
                          setTip(null);
                          onPick(r.id);
                        }}
                      />
                      {/* zoomed in, each release carries its version beside it */}
                      {zoomed && (
                        <span
                          className={`${s.vl} ${isCurrent ? s.vlNow : ""} ${state}`}
                          style={{ left: `${x}%`, top: cy }}
                          data-lane-row={i}
                        >
                          {r.baseline}
                        </span>
                      )}
                    </span>
                  );
                });
              })}
            </div>
          </div>
        </div>
      </div>

      {/* The card lives on <body>, fixed to the window, so no mask or scroll box can clip it. */}
      {tip &&
        createPortal(
          <div
            className={`${s.tip} ${tip.below ? s.tipBelow : ""}`}
            style={{ left: tip.x, top: tip.y }}
            role="tooltip"
          >
            <div className={s.ttTitle}>{tip.group.label}</div>
            <div className={s.ttStats}>
              <div>
                <span className={s.ttK}>Version</span>
                <span className={`${s.ttV} ${tip.isCurrent ? s.ttGo : ""}`}>
                  {tip.release.baseline}
                </span>
              </div>
              <div>
                <span className={s.ttK}>Status</span>
                <span
                  className={`${s.ttV} ${tip.isCurrent ? s.ttGo : s.ttOld}`}
                >
                  {tip.isCurrent ? "Current" : "Superseded"}
                </span>
              </div>
            </div>
            <hr />
            <dl className={s.ttRows}>
              <dt>Released</dt>
              <dd>
                {tip.release.releasedMs !== undefined
                  ? isoDay(tip.release.releasedMs)
                  : "—"}
              </dd>
              <dt>Operational since</dt>
              <dd>{isoDay(tip.release.ms)}</dd>
              <dt>Satellites</dt>
              <dd>{tip.release.sats.length ? tip.release.sats.join(", ") : "—"}</dd>
              <dt className={s.ttWide}>Changes</dt>
              <dd className={s.ttWide}>{tip.release.changes}</dd>
            </dl>
            <div className={s.ttHint}>
              {tip.isSelected
                ? "Click to go back to the overview"
                : "Click to zoom in and read the notes"}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
