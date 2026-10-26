"use client";

/* The interactive release timeline: animated window, zoom on a picked release, hover/focus
   tooltip. Browser-only (requestAnimationFrame, matchMedia, a portal on <body>), so the explorer
   loads it with next/dynamic and ssr: false; the server HTML carries ReleaseList instead.
   Ported from the prototype's processors.tsx; the window math moved in here from the page, so it
   ships in this lazily loaded chunk. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import s from "./processors.module.css";
import {
  MONTHS,
  isoDay,
  laneName,
  verOf,
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
    return () => cancelAnimationFrame(raf);
  }, [b0, b1]);

  return [win, moving];
}

/**
 * Ticks for a window. Density follows the window length: monthly labels up to 15 months, every
 * second month up to 28, quarterly up to 60, and only the years beyond that.
 * Decision 13: minWidth = max(600, round(100 + 6 × months)); follows the animated window.
 * Decision 15: first year always labelled (no leadRoom guard); "2013" may overprint "2014"
 * at the far-left scroll edge in All view — accepted.
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
  while (Date.UTC(y, m, 1) <= end) {
    const pct = at(Date.UTC(y, m, 1));
    const isYear = m === 0;
    if (pct >= -1 && (m % every === 0 || isYear)) {
      grid.push({ pct, major: isYear });
      if (pct < 93 && every < 12) {
        monthMarks.push({ pct, label: MONTHS[m].slice(0, 3).toUpperCase() });
      }
    }
    if (pct >= -1 && pct < 95 && (isYear || firstYear)) {
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
    minWidth: Math.max(600, Math.round(100 + 6 * months)),
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
  /** Marker rect snapshotted at hover time; useLayoutEffect places the card from it. */
  markerRect: DOMRect;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipRafRef = useRef(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const [tipOn, setTipOn] = useState(false);

  const n = groups.length;
  const rh = n > 12 ? 22 : n > 8 ? 28 : 44;
  const H = AXIS_TOP + rh * n + FOOT;
  const zoomed = selRow >= 0;

  // All-words AND search using precomputed searchText (Decision 6).
  const words = query ? query.split(/\s+/).filter(Boolean) : [];

  // Once the window has settled: overview → scroll to end; zoomed → scroll to middle.
  useEffect(() => {
    if (moving) return;
    const sc = scrollRef.current;
    if (!sc) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    sc.scrollTo({
      left: (sc.scrollWidth - sc.clientWidth) * (zoomed ? 0.5 : 1),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [moving, zoomed, axis.minWidth]);

  const showTip = useCallback((el: HTMLElement, t: Omit<Tip, "markerRect">) => {
    cancelAnimationFrame(tipRafRef.current);
    setTip({ ...t, markerRect: el.getBoundingClientRect() });
  }, []);

  const hideTip = useCallback(() => {
    cancelAnimationFrame(tipRafRef.current);
    setTipOn(false);
  }, []);

  // §8 placement: measure real card size, compute above/below/beside, fade in.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!tip || !el) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const br = tip.markerRect;
    const tr =
      scrollRef.current?.getBoundingClientRect() ??
      ({ left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight } as DOMRect);
    const navEl = document.querySelector<HTMLElement>(".nav");
    const skyTop = (navEl?.getBoundingClientRect().bottom ?? 68) + 8;
    const skyBot = window.innerHeight - 12;
    const cx = br.left + br.width / 2;
    const gap = 12;
    let vx = Math.min(Math.max(cx - tw / 2, tr.left), tr.right - tw);
    let vy: number;
    if (br.top - th - gap >= skyTop) {
      vy = br.top - th - gap;
    } else if (br.bottom + th + gap <= skyBot) {
      vy = br.bottom + gap;
    } else {
      vx = cx + 16 + tw <= tr.right ? cx + 16 : cx - 16 - tw;
      vy = Math.min(Math.max(br.top + br.height / 2 - th / 2, skyTop), skyBot - th);
    }
    el.style.left = `${vx}px`;
    el.style.top = `${vy}px`;
    cancelAnimationFrame(tipRafRef.current);
    tipRafRef.current = requestAnimationFrame(() => setTipOn(true));
    return () => cancelAnimationFrame(tipRafRef.current);
  }, [tip]);

  // Hide on page scroll (capture phase, DA pattern).
  useEffect(() => {
    const hide = () => {
      cancelAnimationFrame(tipRafRef.current);
      setTipOn(false);
    };
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  return (
    <div className={s.tl}>
      <div className={s.tlView}>
        <div
          className={s.tlScroll}
          ref={scrollRef}
          onScroll={hideTip}
        >
          <div className={s.tlChart} style={{ minWidth: axis.minWidth }}>
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
                >
                  {laneName(g.label)}
                </span>
              ))}
            </div>

            <div className={s.tlTrack} style={{ height: H }}>
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

              {Array.from({ length: n + 1 }, (_, i) => (
                <i
                  key={`r${i}`}
                  className={s.rl}
                  style={{ top: AXIS_TOP + i * rh }}
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

                return g.releases.map((r) => {
                  const x = toPct(r.ms);
                  if (x < -2 || x > 102) return null;
                  const isCurrent = r.isCurrent;
                  const isSelected = selected === r.id;
                  const off = baselineFilter === "current" && !isCurrent;
                  const faint =
                    words.length > 0 &&
                    !words.every((w) => r.searchText.includes(w));
                  const state = [
                    rowDim ? s.dim : "",
                    off ? s.off : "",
                    faint ? s.faint : "",
                  ].join(" ");

                  return (
                    <span key={r.id} className={s.mkWrap}>
                      <i
                        className={`${s.stem} ${state}`}
                        style={{ left: `${x}%`, height: cy - STEM_TOP }}
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
                        disabled={moving || off}
                        aria-label={`${laneName(g.label)} ${verOf(r)}, operational since ${isoDay(r.ms)}${isCurrent ? ", current baseline" : ", superseded"}`}
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
                        onMouseLeave={hideTip}
                        onBlur={hideTip}
                        onClick={() => {
                          hideTip();
                          onPick(r.id);
                        }}
                      />
                      {zoomed && (
                        <span
                          className={`${s.vl} ${isCurrent ? s.vlNow : ""} ${state}`}
                          style={{ left: `${x}%`, top: cy }}
                        >
                          {verOf(r)}
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

      {/* Always portalled to <body>; fades in/out via tipOn. Positioned imperatively in useLayoutEffect. */}
      {createPortal(
        <div
          ref={tipRef}
          className={`${s.tip}${tipOn ? ` ${s.tipOn}` : ""}`}
          role="tooltip"
          aria-hidden={!tipOn}
        >
          {tip && (
            <>
              <div className={s.ttTitle}>{tip.group.label}</div>
              <div className={s.ttStats}>
                <div>
                  <span className={s.ttK}>Version</span>
                  <span className={`${s.ttV} ${tip.isCurrent ? s.ttGo : ""}`}>
                    {verOf(tip.release)}
                  </span>
                </div>
                <div>
                  <span className={s.ttK}>Status</span>
                  <span className={`${s.ttV} ${tip.isCurrent ? s.ttGo : s.ttOld}`}>
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
                <dt>Changes</dt>
                <dd>{tip.release.changes}</dd>
              </dl>
              <div className={s.ttHint}>
                {tip.isSelected
                  ? "Click to go back to the overview"
                  : "Click to zoom in and read the notes"}
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
