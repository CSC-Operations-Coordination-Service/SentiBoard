import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_DESCRIPTION } from "@/data/copy";
import {
  MISSION_ORDER,
  MISSION_NAMES,
  MONTHS,
  type MissionId,
  type ProcessorGroup,
  type ReleaseRecord,
} from "@/data/processor-releases";
import s from "./processors.module.css";
import {
  ambientRoot,
  useAmbientMotion,
} from "@/components/ambient-motion";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import { useProcessors } from "@/api/processors";
import { ApiError } from "@/api/client";
import { htmlToText, notesSection, sanitizeHtml } from "@/lib/sanitize-html";

/** Static chevron for dropdown heads — no rotation, matching DA behaviour (Decision 3). */
function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// Transparent WebP cut-outs (alpha confirmed). Decision 10, §5.3.
const SATELLITE_IMAGES: Record<MissionId, string> = {
  "1": "/assets/img/satellites/s1.webp",
  "2": "/assets/img/satellites/s2.webp",
  "3": "/assets/img/satellites/s3.webp",
  "5P": "/assets/img/satellites/s5p.webp",
};

const DESCRIPTION = (
  <>
    <p>{PROCESSORS_DESCRIPTION}</p>
    <p>Select a release on the timeline to read its baseline notes.</p>
    <div className="desc-legend">
      <div className="legend-item">
        <span className="dot dot-bl-current" aria-hidden="true" />
        Current baseline
      </div>
      <div className="legend-item">
        <span className="dot dot-bl-superseded" aria-hidden="true" />
        Superseded
      </div>
    </div>
  </>
);

/** Stable empty list while the processors load, so memos keyed on it don't re-run. */
const NO_GROUPS: ProcessorGroup[] = [];

/** Mission shown on first render. Changing it is only ever done from the Mission dropdown. */
const DEFAULT_MISSION: MissionId = "1";

/** The timeline's visible window. */
const RANGES = ["1Y", "2Y", "ALL"] as const;
type Range = (typeof RANGES)[number];

const DAY = 24 * 60 * 60 * 1000;
const MONTH_MS = 30.44 * DAY;

/** "all" shows every baseline on the timeline; "current" shows only the baseline in force. */
type BaselineFilter = "all" | "current";
const BASELINE_OPTIONS: { value: BaselineFilter; label: string }[] = [
  { value: "all", label: "All releases" },
  { value: "current", label: "Current baselines" },
];
const BASELINE_SHORT: Record<BaselineFilter, string> = {
  all: "All",
  current: "Current",
};

/** The release whose detail is open on the right. Releases are picked by id: the same baseline
 *  tag can recur on one processor. */
interface Selection {
  ipf: string;
  id: string;
}

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

// §11 / Decision 11 — orbit rotation on mission change.
// NAV_H matches the shell's fixed nav (§11: "H = 100vh − 64px").
const NAV_H = 64;

function easeInOutCubic(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
}

/**
 * Planet-centre and STEP for the orbit rotation (§11).
 *   H_stage = innerHeight − 64  (stage below the nav)
 *   centreY_stage = H_stage + 6133.05 × (H_stage / 1600)   ≈ 4.833 × H_stage
 *   centreY_vp    = NAV_H + centreY_stage   (viewport coords)
 *   STEP = W × 1.08 / (centreY_stage − H_stage / 2)        ≈ 0.43 rad at 1440 × 836
 */
function orbitGeometry() {
  const W = window.innerWidth;
  const H = window.innerHeight - NAV_H;
  const centreY_stage = H + 6133.05 * (H / 1600);
  const centreY_vp = NAV_H + centreY_stage;
  const STEP = (W * 1.08) / (centreY_stage - H / 2);
  return { W, centreY_vp, STEP };
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

  useEffect(() => {
    const [a0, a1] = current.current;
    const [b0, b1] = target;
    if (a0 === b0 && a1 === b1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setWin(target);
      return;
    }
    const c0 = (a0 + a1) / 2;
    const c1 = (b0 + b1) / 2;
    const w0 = a1 - a0;
    const w1 = b1 - b0;
    const t = performance.now();
    const DUR = 820;
    const ease = (k: number) =>
      k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    let raf = 0;
    setMoving(true);
    const tick = (n: number) => {
      const k = Math.min(1, (n - t) / DUR);
      const e = ease(k);
      const w = w0 * Math.pow(w1 / w0, e);
      const c = c0 + (c1 - c0) * e;
      const next: Win = k >= 1 ? target : [c - w / 2, c + w / 2];
      current.current = next;
      setWin(next);
      if (k < 1) raf = requestAnimationFrame(tick);
      else setMoving(false);
    };
    raf = requestAnimationFrame(tick);
    // interrupted (a new target): the next run starts from wherever this one got to
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target[0], target[1]]);

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
  while (Date.UTC(y, m, 1) <= end) {
    const pct = at(Date.UTC(y, m, 1));
    const isYear = m === 0;
    if (pct >= -1 && (m % every === 0 || isYear)) {
      grid.push({ pct, major: isYear });
      if (pct < 93 && every < 12) {
        monthMarks.push({ pct, label: MONTHS[m].slice(0, 3).toUpperCase() });
      }
    }
    // Decision 15: always label the first year (prototype behaviour); "2013" may overprint "2014"
    // at the far-left scroll edge in All view — accepted (only visible when scrolled all the way).
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

/** "S1 SAR L1/L2" → "SAR L1/L2", "S2 MSI L1" → "L1": drops mission prefix then MSI/TROPOMI. */
function laneName(label: string): string {
  return label.replace(/^S(?:1|2|3|5P)\s+/, "").replace(/^(TROPOMI|MSI)\s+/, "");
}

/** Version text: baseline tag, or 'Mon YYYY' when neither version nor processing_baseline was in
 *  the record — the same "—" sentinel the adapter produces (adapters/processor.ts:143). */
function verOf(r: ReleaseRecord): string {
  return r.baseline === "—" ? r.from : r.baseline;
}

/** "5 February 2026" */
function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-02-05" */
function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const CHANGES_TITLE = /^changes introduced\s*:?$/i;
const CHANGES_MAX = 120;

function clip(text: string, max = CHANGES_MAX): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** The tooltip's "Changes" line: the notes' "Changes introduced" section when they have one —
 *  its first two items and "+ N more" — otherwise the start of the notes. */
function changesOf(html?: string): string {
  const section = notesSection(html, CHANGES_TITLE);
  if (section) {
    const items = section
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("•"))
      .map((l) => l.replace(/^•\s*/, ""));
    if (items.length) {
      const more = items.length > 2 ? ` + ${items.length - 2} more` : "";
      return clip(items.slice(0, 2).join("; ")) + more;
    }
    return clip(section.replace(/\s*\n+\s*/g, " "));
  }
  const text = htmlToText(html);
  return text ? clip(text.replace(/\s*\n+\s*/g, " ").replace(/•\s*/g, "")) : "—";
}

interface Tip {
  group: ProcessorGroup;
  release: ReleaseRecord;
  isCurrent: boolean;
  isSelected: boolean;
  /** Marker rect snapshotted at hover time; useLayoutEffect places the card from it. */
  markerRect: DOMRect;
}

interface ReleaseTimelineProps {
  groups: ProcessorGroup[];
  axis: Axis;
  baselineFilter: BaselineFilter;
  query: string;
  selected: Selection | null;
  moving: boolean;
  onPick: (ipf: string, id: string) => void;
  scrollToEnd?: boolean;
  scrollContainerRef?: { current: HTMLDivElement | null };
}

/* Row geometry, as drawTimeline() lays it out in SentiBoard.html. */
const AXIS_TOP = 42; // rows start under the year + month labels
const STEM_TOP = 40; // stems and TODAY start just under the month labels
const FOOT = 26; // room under the last row for the TODAY label

function ReleaseTimeline({
  groups,
  axis,
  baselineFilter,
  query,
  selected,
  moving,
  onPick,
  scrollToEnd = false,
  scrollContainerRef,
}: ReleaseTimelineProps) {
  const toPct = (ms: number) =>
    ((ms - axis.start) / (axis.end - axis.start)) * 100;
  const scrollRef = useRef<HTMLDivElement>(null); // sideways scroll (long windows)
  // C: snap to end on mount so the overlay timeline is already at the right position before the
  // first rAF frame, and to expose the scrollable element to the parent for post-tween snapping.
  useLayoutEffect(() => {
    if (scrollContainerRef) scrollContainerRef.current = scrollRef.current;
    if (!scrollToEnd) return;
    const sc = scrollRef.current;
    if (sc) sc.scrollLeft = sc.scrollWidth - sc.clientWidth;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [tip, setTip] = useState<Tip | null>(null);
  const [tipOn, setTipOn] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const tipRafRef = useRef(0);

  // All-words AND search over label, sub, baselines, year and notes (Decision 6).
  // Memoised per groups so the Map is only rebuilt when the data changes.
  const haystacks = useMemo(
    () =>
      new Map(
        groups.flatMap((g) =>
          g.releases.map((r) => [
            r.id,
            [
              g.label,
              g.sub ?? "",
              r.baseline,
              r.processingBaseline ?? "",
              String(new Date(r.ms).getUTCFullYear()),
              htmlToText(r.notesHtml),
            ]
              .join(" ")
              .toLowerCase(),
          ]),
        ),
      ),
    [groups],
  );
  const words = query.trim() ? query.trim().split(/\s+/) : [];

  // Many rows (Sentinel-3) are drawn tighter, so the whole table stays in view.
  const n = groups.length;
  const rh = n > 12 ? 22 : n > 8 ? 28 : 44;
  const H = AXIS_TOP + rh * n + FOOT;

  const selRow = selected
    ? groups.findIndex((g) => g.ipf === selected.ipf)
    : -1;
  const zoomed = selRow >= 0;

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

  const showTip = (el: HTMLElement, t: Omit<Tip, "markerRect">) => {
    cancelAnimationFrame(tipRafRef.current);
    setTip({ ...t, markerRect: el.getBoundingClientRect() });
  };

  const hideTip = () => {
    cancelAnimationFrame(tipRafRef.current);
    setTipOn(false);
  };

  // Placement: measure real card size, then compute §8 position, then fade in.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!tip || !el) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const br = tip.markerRect;
    const tr = scrollRef.current?.getBoundingClientRect() ??
      ({ left: 0, right: window.innerWidth, top: 0, bottom: window.innerHeight } as DOMRect);
    const navEl = document.querySelector<HTMLElement>(".nav");
    const skyTop = (navEl?.getBoundingClientRect().bottom ?? 68) + 8;
    const skyBot = window.innerHeight - 12;
    const cx = br.left + br.width / 2;
    const gap = 12;
    let vx = Math.min(Math.max(cx - tw / 2, tr.left), tr.right - tw);
    let vy: number;
    if (br.top - th - gap >= skyTop) {
      vy = br.top - th - gap;                                         // above
    } else if (br.bottom + th + gap <= skyBot) {
      vy = br.bottom + gap;                                           // below
    } else {
      vx = cx + 16 + tw <= tr.right ? cx + 16 : cx - 16 - tw;       // beside
      vy = Math.min(Math.max(br.top + br.height / 2 - th / 2, skyTop), skyBot - th);
    }
    el.style.left = `${vx}px`;
    el.style.top = `${vy}px`;
    cancelAnimationFrame(tipRafRef.current);
    tipRafRef.current = requestAnimationFrame(() => setTipOn(true));
    return () => cancelAnimationFrame(tipRafRef.current);
  }, [tip]);

  // Hide on any page or ancestor scroll (capture phase, DA pattern).
  useEffect(() => {
    const hide = () => { cancelAnimationFrame(tipRafRef.current); setTipOn(false); };
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  return (
    <div className={s.tl}>
      {/* Every lane is shown at full height (no cap, no fade). The inner box is the sideways
          scroll for narrow screens, with the names pinned on the left. */}
      <div className={s.tlView}>
        <div
          className={s.tlScroll}
          ref={scrollRef}
          onScroll={hideTip}
        >
          <div className={s.tlChart} style={{ minWidth: axis.minWidth }}>
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
                  const isSelected =
                    selected?.ipf === g.ipf && selected.id === r.id;
                  // Filters fade releases back instead of removing them, so the rows never jump.
                  const off = baselineFilter === "current" && !isCurrent;
                  const faint =
                    words.length > 0 &&
                    !words.every((w) => haystacks.get(r.id)?.includes(w));
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
                          onPick(g.ipf, r.id);
                        }}
                      />
                      {/* zoomed in, each release carries its version beside it */}
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

      {/* Always portalled to <body> so no ancestor transform or overflow can clip it.
          Positioned imperatively in useLayoutEffect; fades in/out via .tipOn toggle. */}
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
                <dd>
                  {tip.release.sats.length ? tip.release.sats.join(", ") : "—"}
                </dd>
                <dt>Changes</dt>
                <dd>{changesOf(tip.release.notesHtml)}</dd>
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

/**
 * Release notes as the feed carries them: HTML authored in Word, Confluence or Jira. Sanitized
 * (allowlisted tags, no inline styles or classes) so it takes the theme's own typography.
 */
function ReleaseNotes({ html }: { html?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html]);
  if (!clean) {
    return <p className={s.none}>No release notes in the feed.</p>;
  }
  return <div className={s.rnHtml} dangerouslySetInnerHTML={{ __html: clean }} />;
}

interface ReleaseDetailProps {
  group: ProcessorGroup;
  index: number;
  onClose: () => void;
  onStep: (delta: -1 | 1) => void;
}

/** The selected baseline's details. Steps replay the vswap animation; first open does not. */
function ReleaseDetail({ group, index, onClose, onStep }: ReleaseDetailProps) {
  const release: ReleaseRecord = group.releases[index];
  const isCurrent = release.isCurrent;

  // Inner wrapper is keyed by release.id so stepping remounts it and replays vswap.
  // firstOpen ref suppresses the animation on the first pick (the pane's own entrance covers it).
  const firstOpen = useRef(true);
  const [swapId, setSwapId] = useState(release.id);

  useEffect(() => {
    if (firstOpen.current) {
      firstOpen.current = false;
      return;
    }
    setSwapId(release.id);
  }, [release.id]);

  return (
    <div className={s.dtIn}>
      <div key={swapId} className={firstOpen.current ? undefined : s.swap}>
        <div className={s.dtTop}>
          <button type="button" className={s.dtBack} onClick={onClose}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M7 3L2 8l5 5M2 8h12"></path>
            </svg>
            Overview
          </button>
          <div className={s.dtSteps}>
            <button
              type="button"
              className={s.step}
              disabled={index <= 0}
              onClick={() => onStep(-1)}
              aria-label="Previous release"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="M15 5l-7 7 7 7"></path>
              </svg>
            </button>
            <button
              type="button"
              className={s.step}
              disabled={index >= group.releases.length - 1}
              onClick={() => onStep(1)}
              aria-label="Next release"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                aria-hidden="true"
              >
                <path d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
        </div>

        <div className={s.dtHead}>
          <div>
            <span className={s.dtProc}>
              {group.sub ? `${group.label} · ${group.sub}` : group.label}
            </span>
            <b className={s.dtVer}>{release.baseline}</b>
          </div>
          <span className={isCurrent ? s.tagNow : s.tagOld}>
            {isCurrent ? "Current baseline" : "Superseded"}
          </span>
        </div>

        <dl className={s.meta}>
          <div>
            <dt>Processor Baseline ID:</dt>
            <dd>{release.processingBaseline ?? "—"}</dd>
          </div>
          <div>
            <dt>Operational since:</dt>
            <dd>{longDate(release.ms)}</dd>
          </div>
          <div>
            <dt>Impacted satellite(s):</dt>
            <dd>{release.sats.length ? release.sats.join(", ") : "—"}</dd>
          </div>
        </dl>

        <div className={s.rn}>
          <h4>Release notes</h4>
          <ReleaseNotes html={release.notesHtml} />
        </div>
      </div>
    </div>
  );
}

/**
 * Tracks the horizon line (navBottom + 0.8334 × (innerHeight − navBottom) − 14)
 * and writes --hz-cut = line − element.top on each ref element every rAF frame
 * triggered by scroll, resize, or a ResizeObserver on containerRef.
 * Returns a pump(ms) function for continuous per-frame updates during the FLIP.
 * Decision 21.
 */
function useHorizonMask(
  containerRef: React.RefObject<HTMLElement | null>,
  ...els: React.RefObject<HTMLElement | null>[]
): (durationMs: number) => () => void {
  const updateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".nav");
    let raf = 0;

    function update() {
      raf = 0;
      const navBottom = nav?.getBoundingClientRect().bottom ?? 64;
      const line =
        navBottom + 0.8334 * (window.innerHeight - navBottom) - 14;
      for (const ref of els) {
        const el = ref.current;
        if (!el) continue;
        el.style.setProperty(
          "--hz-cut",
          `${Math.round(line - el.getBoundingClientRect().top)}px`,
        );
      }
    }

    updateRef.current = update;

    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    const ro = new ResizeObserver(schedule);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      updateRef.current = null;
    };
  }, []); // refs are stable — no deps needed

  return useCallback((durationMs: number): (() => void) => {
    const deadline = performance.now() + durationMs;
    let id = 0;
    function tick() {
      updateRef.current?.();
      if (performance.now() < deadline) id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

export default function Processors() {
  // Captured once so the stats and the timeline window agree for the life of the page.
  const [now] = useState(() => Date.now());
  const [activeMission, setActiveMission] =
    useState<MissionId>(DEFAULT_MISSION);
  const [range, setRange] = useState<Range>("ALL");
  const [baselineFilter, setBaselineFilter] = useState<BaselineFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);
  const [openDrop, setOpenDrop] = useState<"mission" | "baseline" | null>(null);
  const missionDropRef = useRef<HTMLDivElement>(null);
  const baselineDropRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const motion = useAmbientMotion();

  /* Refs and state for the overview ↔ detail FLIP (Decision 12, §10). */
  const procpaneRef = useRef<HTMLElement>(null);
  const flipFrom = useRef<DOMRect | null>(null);
  const [focusClass, setFocusClass] = useState(false);
  const [detailOn, setDetailOn] = useState(false);

  /* Horizon mask (Decision 21). containerRef → ResizeObserver; detailRef alongside procpaneRef. */
  const containerRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const pumpHorizon = useHorizonMask(containerRef, procpaneRef, detailRef);
  const [lcolEnter, setLcolEnter] = useState(false);

  /* §11 / Decision 11 — orbit rotation state and refs. */
  // Animated float position 0–3 (S1=0 … S5P=3); written by the rAF loop, read at cancel.
  const posRef = useRef(MISSION_ORDER.indexOf(DEFAULT_MISSION) as number);
  // Incoming mission while the tween runs; null at rest.
  const [tweenTarget, setTweenTarget] = useState<MissionId | null>(null);
  const tweenTargetRef = useRef<MissionId | null>(null); // set immediately (closure companion)
  // Tween params stored here so the useLayoutEffect can read them after overlay mounts.
  const tweenParamsRef = useRef<{ fromPos: number; toIdx: number; dur: number; mainIdx: number } | null>(null);
  // SpaceBackdrop turn — set once per mission change (§11 deviation, see Decision 11).
  const [turn, setTurn] = useState(0);
  // Direct DOM refs for per-frame style mutations (no React setState in the rAF loop).
  const sheetMainRef = useRef<HTMLDivElement | null>(null);
  const sheetOverRef  = useRef<HTMLDivElement | null>(null);
  // Four satellite img refs (one per mission) — stacked in one .orbit div; no src ever changes.
  const satImgRefs = useRef<Record<MissionId, HTMLImageElement | null>>({
    "1": null, "2": null, "3": null, "5P": null,
  });
  // C: snap main timeline scroll to end after tween hands over, avoiding a smooth-scroll from 0.
  const mainScrollRef   = useRef<HTMLDivElement | null>(null);
  const justTweenedRef  = useRef(false);

  const processors = useProcessors();
  const allGroups = processors.data ?? NO_GROUPS;
  const ready = processors.status === "ready";

  const normalisedQuery = query.trim().toLowerCase();
  const isDetail = selected !== null;

  const missionGroups = useMemo(
    () => allGroups.filter((g) => g.mission === activeMission),
    [allGroups, activeMission],
  );

  // Overlay data for the incoming mission's full ReleaseTimeline (§11 point 1).
  const overlayGroups = useMemo(
    () => (tweenTarget ? allGroups.filter((g) => g.mission === tweenTarget) : NO_GROUPS),
    [allGroups, tweenTarget],
  );
  const overlayBounds = useMemo((): Win => {
    if (!tweenTarget) return [now, now];
    const earliest = overlayGroups.reduce(
      (min, g) => g.releases.reduce((m, r) => Math.min(m, r.ms), min),
      now,
    );
    return timelineBounds(earliest, now);
  }, [overlayGroups, now, tweenTarget]);
  const overlayAxis = useMemo(
    () => (tweenTarget ? buildAxis(rangeWindow(range, now, overlayBounds), now) : null),
    [tweenTarget, range, now, overlayBounds],
  );

  // KPIs and the mission caption switch to the incoming mission at tween start (§11 point 4).
  const displayMission = tweenTarget ?? activeMission;
  const statsGroups = tweenTarget ? overlayGroups : missionGroups;

  // The window the timeline should show: the range (1Y/2Y/ALL), or — with a release picked — ten
  // months around that release. useAnimatedWindow glides from one to the other.
  const bounds = useMemo(() => {
    const earliest = missionGroups.reduce(
      (min, g) => g.releases.reduce((m, r) => Math.min(m, r.ms), min),
      now,
    );
    return timelineBounds(earliest, now);
  }, [missionGroups, now]);
  const pickedMs = useMemo(() => {
    if (!selected) return null;
    const g = missionGroups.find((x) => x.ipf === selected.ipf);
    return (
      g?.releases.find((r) => r.id === selected.id)?.ms ?? null
    );
  }, [selected, missionGroups]);
  const target = useMemo<Win>(
    () =>
      pickedMs !== null
        ? zoomWindow(pickedMs, bounds)
        : rangeWindow(range, now, bounds),
    [pickedMs, bounds, range, now],
  );
  const [win, moving] = useAnimatedWindow(target);
  const axis = useMemo(() => buildAxis(win, now), [win, now]);

  // Keep the last selection while the pane slides shut, so its content does not vanish mid-motion.
  const lastSelected = useRef<Selection | null>(null);
  if (selected) lastSelected.current = selected;
  const view = selected ?? lastSelected.current;

  // Detail pane content, looked up from every processor so it never depends on the filters.
  const detailGroup = view
    ? allGroups.find((g) => g.ipf === view.ipf)
    : undefined;
  const detailIndex =
    detailGroup && view
      ? detailGroup.releases.findIndex((r) => r.id === view.id)
      : -1;

  // §11 / Decision 11 — orbit rotation tween.
  // `activeMission` at call time is the outgoing mission; it stays stable until tween end.
  const startMissionTween = useCallback(
    (toMission: MissionId) => {
      const toIdx = MISSION_ORDER.indexOf(toMission);
      const fromPos = posRef.current;
      const { STEP } = orbitGeometry();

      // Start SpaceBackdrop easing immediately (§11: phi = pos × STEP).
      // Deviation: turn prop has a fixed 900 ms ease-out cubic independent of the orbit tween
      // (SpaceBackdrop exposes no per-frame API without modifying the shared component).
      setTurn(toIdx * STEP);

      // prefers-reduced-motion: instant swap, no rAF (§11).
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        posRef.current = toIdx;
        setActiveMission(toMission);
        setTweenTarget(null); // clears any in-flight tween via the useLayoutEffect cleanup
        tweenTargetRef.current = null;
        return;
      }

      const steps = Math.abs(toIdx - fromPos);
      const dur = 1300 + 600 * Math.max(0, steps - 1); // §11: 1300 + 600·(n−1) ms
      const mainIdx = MISSION_ORDER.indexOf(activeMission); // outgoing, stable for this tween

      // Store params so the useLayoutEffect can start the rAF after the overlay commits.
      tweenParamsRef.current = { fromPos, toIdx, dur, mainIdx };
      tweenTargetRef.current = toMission;
      setTweenTarget(toMission); // triggers render of overlay; useLayoutEffect starts the rAF
    },
    // activeMission is intentionally captured at call time (it is the outgoing mission).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeMission],
  );

  // A: preload all satellite images on mount so the tween handover never shows a blank frame.
  useEffect(() => {
    for (const src of Object.values(SATELLITE_IMAGES)) {
      const img = new Image();
      img.src = src;
      img.decode().catch(() => {});
    }
  }, []);

  // Start the rAF loop only after the overlay DOM is committed (§11 fix: avoids the race between
  // setTweenTarget and requestAnimationFrame where the overlay refs could be null on frame 1).
  useLayoutEffect(() => {
    if (!tweenTarget || !tweenParamsRef.current) return;

    const { fromPos, toIdx, dur, mainIdx } = tweenParamsRef.current;
    const toMission = tweenTarget; // stable for this closure

    const mainMission = MISSION_ORDER[mainIdx];

    // §11 issue-2 fix: read ALL geometry here — before any style write — so the rAF only writes.
    // planet-centre x = W/2; y (viewport) = NAV_H + centreY_stage (§11).
    const W = window.innerWidth;
    const H = window.innerHeight - NAV_H;
    const centreY_stage = H + 6133.05 * (H / 1600);
    const centreY_vp    = NAV_H + centreY_stage;
    let STEP_f = (W * 1.08) / (centreY_stage - H / 2);
    const pcx = W / 2;
    const pcy = centreY_vp;

    const sheetMainR = sheetMainRef.current?.getBoundingClientRect();
    const sheetOverR  = sheetOverRef.current?.getBoundingClientRect();
    const orbitR = (satImgRefs.current[mainMission] ?? satImgRefs.current[toMission])?.getBoundingClientRect();

    const mainSheetO = { x: sheetMainR ? pcx - sheetMainR.left : 0, y: sheetMainR ? pcy - sheetMainR.top : 0 };
    const overSheetO  = { x: sheetOverR  ? pcx - sheetOverR.left  : 0, y: sheetOverR  ? pcy - sheetOverR.top  : 0 };
    const orbitO      = { x: orbitR      ? pcx - orbitR.left      : 0, y: orbitR      ? pcy - orbitR.top      : 0 };

    // Pre-hide incoming satellite before first paint (inline style; cleared by clearStyles).
    const toSatEl = satImgRefs.current[toMission];
    if (toSatEl) { toSatEl.style.visibility = "hidden"; toSatEl.style.opacity = "0"; }

    let raf = 0;
    let t0 = 0; // captured on first rAF frame so slow renders don't eat the tween budget

    const clearStyles = () => {
      for (const r of [sheetMainRef, sheetOverRef]) {
        const el = r.current;
        if (!el) continue;
        el.style.opacity = "";
        el.style.visibility = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
      for (const mid of [mainMission, toMission]) {
        const el = satImgRefs.current[mid];
        if (!el) continue;
        el.style.opacity = "";
        el.style.visibility = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
    };

    const applyEl = (
      el: HTMLElement | null,
      origin: { x: number; y: number },
      off: number,
    ) => {
      if (!el) return;
      const abs = Math.abs(off);
      if (abs >= 0.999) {
        el.style.opacity = "0";
        el.style.visibility = "hidden";
        el.style.transform = "";
        return;
      }
      el.style.visibility = "";
      el.style.opacity = String(Math.max(0, 1 - abs * 1.4));
      el.style.transformOrigin = `${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px`;
      el.style.transform = `rotate(${(off * STEP_f).toFixed(5)}rad)`;
    };

    // rAF only writes — all reads were taken above.
    const frame = (now_t: number) => {
      if (t0 === 0) t0 = now_t; // t0 on first rAF frame, not at click time
      const q = Math.min(1, (now_t - t0) / dur);
      const e = easeInOutCubic(q);
      const pos = fromPos + (toIdx - fromPos) * e;
      posRef.current = pos;

      applyEl(sheetMainRef.current,            mainSheetO, mainIdx - pos);
      applyEl(sheetOverRef.current,             overSheetO,  toIdx - pos);
      applyEl(satImgRefs.current[mainMission],  orbitO,     mainIdx - pos);
      applyEl(satImgRefs.current[toMission],    orbitO,      toIdx - pos);

      if (q < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        posRef.current = toIdx;
        justTweenedRef.current = true; // C: snap main scroll before next paint
        setActiveMission(toMission);
        setTweenTarget(null);
        tweenTargetRef.current = null;
      }
    };

    // On resize: update STEP_f from viewport dims only — no getBoundingClientRect reads.
    const onResize = () => {
      const W2 = window.innerWidth;
      const H2 = window.innerHeight - NAV_H;
      const c2  = H2 + 6133.05 * (H2 / 1600);
      STEP_f = (W2 * 1.08) / (c2 - H2 / 2);
    };
    window.addEventListener("resize", onResize);

    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      clearStyles();
    };
  }, [tweenTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  // C: snap main timeline scroll to end after tween, before the first post-tween paint, so the
  // settled useEffect([moving]) scroll-to-end fires as a no-op instead of a visible slide.
  useLayoutEffect(() => {
    if (!justTweenedRef.current) return;
    justTweenedRef.current = false;
    const sc = mainScrollRef.current;
    if (sc) sc.scrollLeft = sc.scrollWidth - sc.clientWidth;
  }, [activeMission]);

  // Single point of truth for all view changes (Decision 8).
  const changeView = (
    action: { mission: MissionId } | { range: Range } | { sel: Selection | null },
  ) => {
    if ("mission" in action) {
      setSelected(null);
      if (isDetail) {
        // Detail open: instant swap — avoid the FLIP and rotation colliding (§11 / Decision 11).
        // setTweenTarget(null) triggers the useLayoutEffect cleanup, which cancels any rAF.
        setTweenTarget(null);
        tweenTargetRef.current = null;
        posRef.current = MISSION_ORDER.indexOf(action.mission);
        const { STEP } = orbitGeometry();
        setTurn(posRef.current * STEP);
        setActiveMission(action.mission);
      } else {
        startMissionTween(action.mission);
      }
    } else if ("range" in action) {
      setRange(action.range);
      setSelected(null);
    } else {
      setSelected(action.sel);
    }
  };

  // Unified Escape: open dropdown → close and restore focus; else detail → overview (Decision 24).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openDrop !== null) {
        setOpenDrop(null);
        const ref = openDrop === "mission" ? missionDropRef : baselineDropRef;
        (ref.current?.querySelector("button") as HTMLButtonElement | null)?.focus();
        return;
      }
      if (isDetail) changeView({ sel: null });
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // changeView only calls stable setters; openDrop and isDetail are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDrop, isDetail]);

  // Unmount: the useLayoutEffect([tweenTarget]) cleanup cancels the rAF automatically.

  // Click-outside closes any open dropdown (DA pointerdown pattern).
  useEffect(() => {
    if (openDrop === null) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (
        !missionDropRef.current?.contains(t) &&
        !baselineDropRef.current?.contains(t)
      )
        setOpenDrop(null);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [openDrop]);

  // Overview ↔ detail motion orchestration (Decision 12, §10).
  // Captures the procpane rect before the grid switch, drives focusClass,
  // delays detailOn by 180 ms (open) and delays the grid-back by 280 ms (close).
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;

    if (isDetail) {
      if (procpaneRef.current)
        flipFrom.current = procpaneRef.current.getBoundingClientRect();
      setFocusClass(true);
      t1 = setTimeout(() => setDetailOn(true), reduce ? 0 : 180);
    } else {
      setDetailOn(false);
      t2 = setTimeout(() => {
        if (procpaneRef.current)
          flipFrom.current = procpaneRef.current.getBoundingClientRect();
        setFocusClass(false);
        setLcolEnter(true);
        t3 = setTimeout(() => setLcolEnter(false), 560);
      }, reduce ? 0 : 280);
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isDetail]);

  // FLIP: after focusClass changes the grid, translate the procpane from its
  // old position (captured above) to its new position, then animate to zero.
  // Both x and y are translated so the animation also works at ≤1080 where the
  // detail stacks below the timeline.
  useLayoutEffect(() => {
    if (!flipFrom.current) return;
    const el = procpaneRef.current;
    if (!el) return;
    const after = el.getBoundingClientRect();
    const dx = flipFrom.current.left - after.left;
    const dy = flipFrom.current.top - after.top;
    flipFrom.current = null;
    if (
      (dx === 0 && dy === 0) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const cancelPump = pumpHorizon(820);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "transform 720ms cubic-bezier(.2,.7,.2,1)";
        el.style.transform = "";
        const done = () => {
          el.style.transition = "";
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
      });
    });
    return cancelPump;
  }, [focusClass]);

  // KPIs use statsGroups (= overlay mission during tween, active mission otherwise — §11 point 4).
  const missionReleases = statsGroups.flatMap((g) => g.releases);
  const yearStart = now - 365 * DAY;
  const latestMs = missionReleases
    .filter((r) => r.ms <= now)
    .reduce((m, r) => Math.max(m, r.ms), 0);
  // Until the data is in, the counts read "—" rather than a misleading 0.
  const stats = [
    { value: ready ? statsGroups.length : "—", label: "Processors" },
    { value: ready ? missionReleases.length : "—", label: "Releases" },
    {
      value: ready
        ? missionReleases.filter((r) => r.ms > yearStart && r.ms <= now).length
        : "—",
      label: "Released in the last year",
    },
    {
      value: ready ? (latestMs ? new Date(latestMs).getUTCFullYear() : "—") : "—",
      label: "Latest release",
    },
  ];

  // All view changes for markers go through changeView — no setSelected anywhere outside it (Decision 8).
  const toggleRelease = (ipf: string, id: string) =>
    changeView({
      sel:
        selected && selected.ipf === ipf && selected.id === id
          ? null
          : { ipf, id },
    });

  const stepRelease = (delta: -1 | 1) => {
    if (!detailGroup) return;
    const next = detailGroup.releases[detailIndex + delta];
    if (next) changeView({ sel: { ipf: detailGroup.ipf, id: next.id } });
  };

  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title="Processors"
          subtitle="The complete list of Copernicus Sentinel processor releases on an interactive timeline."
          desc={DESCRIPTION}
          img="/assets/img/modules/processors.jpg"
        />
      </div>

      <section className={ambientRoot(motion.paused, s.container)} ref={containerRef}>
        <SpaceBackdrop page={2} paused={motion.paused} turn={turn} />

        {/* Headline counts for the selected mission */}
        <Reveal className={s.counters}>
          {stats.map((st) => (
            <div key={st.label} className={s.counter}>
              <span className={s.counterV}>{st.value}</span>
              <span className={s.counterK}>{st.label}</span>
            </div>
          ))}
        </Reveal>

        {/* Filter bar: mission dropdown, range buttons, baseline dropdown, search (§3). */}
        <div className={s.filters}>
          {/* Mission — caption only, no value beside the label (Decision 4, §3.1). */}
          <div className={s.fdrop} ref={missionDropRef}>
            <button
              id="mission-filter"
              type="button"
              className={s.fdropHead}
              aria-expanded={openDrop === "mission"}
              aria-controls="mission-filter-body"
              onClick={() =>
                setOpenDrop((d) => (d === "mission" ? null : "mission"))
              }
            >
              <span className={s.fdropLabel}>Mission</span>
              <ChevronDown />
            </button>
            <div
              id="mission-filter-body"
              className={s.fdropBody}
              style={{
                gridTemplateRows: openDrop === "mission" ? "1fr" : "0fr",
              }}
            >
              <div
                className={s.fdropInner}
                {...(openDrop !== "mission" && { inert: "" as unknown as boolean })}
              >
                <div className={s.fdropPad}>
                  {MISSION_ORDER.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${s.fitem} ${displayMission !== m ? s.fitemOff : ""}`}
                      onClick={() => {
                        changeView({ mission: m });
                        setOpenDrop(null);
                      }}
                    >
                      {MISSION_NAMES[m].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Range buttons — 49 px tall, cyan underline on active (§3.2, Decision 1). */}
          <div className={s.frange} role="group" aria-label="Timeline range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${s.frangeBtn} ${range === r ? s.frangeBtnOn : ""}`}
                aria-pressed={range === r}
                onClick={() => changeView({ range: r })}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Baseline — shows current value beside the label (Decision 5, §3.3). */}
          <div className={s.fdrop} ref={baselineDropRef}>
            <button
              id="baseline-filter"
              type="button"
              className={s.fdropHead}
              aria-expanded={openDrop === "baseline"}
              aria-controls="baseline-filter-body"
              onClick={() =>
                setOpenDrop((d) => (d === "baseline" ? null : "baseline"))
              }
            >
              <span className={s.fdropLabel}>Baseline</span>
              <span className={s.fdropVal}>{BASELINE_SHORT[baselineFilter]}</span>
              <ChevronDown />
            </button>
            <div
              id="baseline-filter-body"
              className={s.fdropBody}
              style={{
                gridTemplateRows: openDrop === "baseline" ? "1fr" : "0fr",
              }}
            >
              <div
                className={s.fdropInner}
                {...(openDrop !== "baseline" && { inert: "" as unknown as boolean })}
              >
                <div className={s.fdropPad}>
                  {BASELINE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`${s.fitem} ${baselineFilter !== o.value ? s.fitemOff : ""}`}
                      onClick={() => {
                        setBaselineFilter(o.value);
                        setOpenDrop(null);
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Search: static hairline, no focus change, Escape clears the field (§3.4, Decision 24). */}
          <label className={s.search}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden="true"
            >
              <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            <input
              ref={searchInputRef}
              type="search"
              className={s.searchInput}
              placeholder="Search"
              aria-label="Search the releases"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setQuery("");
                }
              }}
            />
          </label>
        </div>

        {/* Satellite column | timeline column | detail panel (Decision 12, §5.1, §10).
            The grid flips between "lcol proc" (overview) and "proc detail" (focus) via a
            JS FLIP on the procpane element. The lcol stays absolutely painted while
            focused so the satellite can fade smoothly before being aria-hidden. */}
        <div className={`${s.split} ${focusClass ? s.focus : ""}`}>
          <section
            className={`${s.lcol} ${lcolEnter ? s.lcolEnter : ""}`}
            aria-label={`Sentinel-${displayMission}`}
            aria-hidden={focusClass || undefined}
          >
            {/* All four satellite images stacked in one .orbit — src never changes (§11 fix).
                .satOff hides non-active/non-target images; the rAF writes inline styles on top.
                clearStyles() removes inline styles so the CSS class resumes control. */}
            <div className={s.orbit}>
              {MISSION_ORDER.map((mid) => (
                <img
                  key={mid}
                  ref={(el) => { satImgRefs.current[mid] = el; }}
                  src={SATELLITE_IMAGES[mid]}
                  className={`${s.sat}${mid !== activeMission && mid !== tweenTarget ? ` ${s.satOff}` : ""}`}
                  alt={mid === displayMission ? `Artist's impression of Sentinel-${mid}` : ""}
                  aria-hidden={mid !== displayMission ? true : undefined}
                />
              ))}
            </div>
          </section>

          {/* `.tweening` lifts overflow-x so the rotating sheets can extend outside (§11). */}
          <section className={`${s.procpane} ${tweenTarget ? s.tweening : ""}`} ref={procpaneRef}>
            {/* Outgoing mission sheet — rotated away by the rAF tween (§11). */}
            <div ref={sheetMainRef} className={s.sheet}>
              <div className={s.phead}>
                <h2>{MISSION_NAMES[activeMission]} processors</h2>
              </div>
              <div className={s.tlBar}>
                <span className={s.tlCap}>Release timeline</span>
              </div>
              {processors.status === "loading" ? (
                <p className={s.status} role="status">
                  <span className={s.statusPulse} aria-hidden="true" />
                  Loading processor releases…
                </p>
              ) : processors.status === "error" ? (
                <div className={s.statusError} role="alert">
                  <p className={s.statusTitle}>
                    {processors.error instanceof ApiError &&
                    processors.error.kind === "unreachable"
                      ? "Backend unreachable"
                      : "Could not load processor releases"}
                  </p>
                  <p className={s.statusText}>
                    {processors.error instanceof ApiError &&
                    processors.error.kind === "unreachable"
                      ? "The processor feed did not answer. Check that the backend is running, then try again."
                      : processors.error instanceof Error
                        ? processors.error.message
                        : "Unexpected error."}
                  </p>
                  <button
                    type="button"
                    className={s.retry}
                    onClick={processors.retry}
                  >
                    Try again
                  </button>
                </div>
              ) : missionGroups.length > 0 ? (
                <ReleaseTimeline
                  groups={missionGroups}
                  axis={axis}
                  baselineFilter={baselineFilter}
                  query={normalisedQuery}
                  selected={selected}
                  moving={moving || !!tweenTarget}
                  onPick={toggleRelease}
                  scrollContainerRef={mainScrollRef}
                />
              ) : (
                <p className={s.none}>No processors for this mission.</p>
              )}
            </div>
            {/* Incoming mission sheet — full heading + timeline, swings in during the tween (§11).
                inert + aria-hidden: no focus, no events, no tooltip. */}
            {tweenTarget && overlayAxis && (
              <div
                ref={sheetOverRef}
                className={`${s.sheet} ${s.sheetOver}`}
                aria-hidden="true"
                {...({ inert: "" } as Record<string, unknown>)}
              >
                <div className={s.phead}>
                  <h2>{MISSION_NAMES[tweenTarget]} processors</h2>
                </div>
                <div className={s.tlBar}>
                  <span className={s.tlCap}>Release timeline</span>
                </div>
                {overlayGroups.length > 0 && (
                  <ReleaseTimeline
                    groups={overlayGroups}
                    axis={overlayAxis}
                    baselineFilter={baselineFilter}
                    query={normalisedQuery}
                    selected={null}
                    moving={true}
                    onPick={() => {}}
                    scrollToEnd={true}
                  />
                )}
              </div>
            )}
          </section>

          <section
            ref={detailRef}
            className={`${s.detailpane} ${detailOn ? s.on : ""}`}
            aria-live="polite"
            aria-hidden={focusClass ? undefined : true}
            style={detailGroup
              ? ({ '--pr-mis': `var(--pr-mis-${detailGroup.mission})` } as CSSProperties)
              : undefined}
          >
            {detailGroup && detailIndex >= 0 && (
              <ReleaseDetail
                group={detailGroup}
                index={detailIndex}
                onClose={() => changeView({ sel: null })}
                onStep={stepRelease}
              />
            )}
          </section>
        </div>
      </section>
    </>
  );
}
