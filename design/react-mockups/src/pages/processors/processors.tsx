import {
  useEffect,
  useMemo,
  useRef,
  useState,
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

// Map mission IDs to satellite image paths
const SATELLITE_IMAGES: Record<MissionId, string> = {
  "1": "/assets/img/satellites/s1_.png",
  "2": "/assets/img/satellites/s2_.png",
  "3": "/assets/img/satellites/s3_.png",
  "5P": "/assets/img/satellites/s5_.png",
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

/** "S1 SAR L1/L2" → "SAR L1/L2": the lane names drop the mission prefix the page already shows. */
function laneName(label: string): string {
  return label.replace(/^S(?:1|2|3|5P)\s+/, "");
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
  /** Viewport position of the marker's centre, and where the card sits relative to it. */
  x: number;
  y: number;
  below: boolean;
}

interface ReleaseTimelineProps {
  groups: ProcessorGroup[];
  axis: Axis;
  baselineFilter: BaselineFilter;
  query: string;
  selected: Selection | null;
  moving: boolean;
  onPick: (ipf: string, id: string) => void;
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
}: ReleaseTimelineProps) {
  const toPct = (ms: number) =>
    ((ms - axis.start) / (axis.end - axis.start)) * 100;
  const scrollRef = useRef<HTMLDivElement>(null); // sideways scroll (long windows)
  const [tip, setTip] = useState<Tip | null>(null);

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
    <div className={s.tl}>
      {/* Every lane is shown at full height (no cap, no fade). The inner box is the sideways
          scroll for narrow screens, with the names pinned on the left. */}
      <div className={s.tlView}>
        <div
          className={s.tlScroll}
          ref={scrollRef}
          onScroll={() => setTip(null)}
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
                const groupHit =
                  !query || `${g.label} ${g.sub}`.toLowerCase().includes(query);

                return g.releases.map((r) => {
                  const x = toPct(r.ms);
                  if (x < -2 || x > 102) return null;
                  const isCurrent = r.isCurrent;
                  const isSelected =
                    selected?.ipf === g.ipf && selected.id === r.id;
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
                          onPick(g.ipf, r.id);
                        }}
                      />
                      {/* zoomed in, each release carries its version beside it */}
                      {zoomed && (
                        <span
                          className={`${s.vl} ${isCurrent ? s.vlNow : ""} ${state}`}
                          style={{ left: `${x}%`, top: cy }}
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
              <dd className={s.ttWide}>{changesOf(tip.release.notesHtml)}</dd>
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

interface FilterDropdownProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  /** Short text shown beside the label when closed, e.g. "Current". */
  displayValue?: string;
  onChange: (value: T) => void;
}

/** Label + chevron trigger that opens a vertical menu. Closes on outside click or Escape. */
function FilterDropdown<T extends string>({
  id,
  label,
  value,
  options,
  displayValue,
  onChange,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`${s.dd} ${open ? s.ddOpen : ""}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={s.ddTrigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={s.ddLabel}>{label}</span>
        {displayValue && <span className={s.ddValue}>{displayValue}</span>}
        <svg
          className={`${s.ddChev} ${open ? s.ddChevUp : ""}`}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </button>

      {open && (
        <ul id={`${id}-menu`} className={s.ddMenu}>
          {options.map((o) => {
            const isOn = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  className={`${s.ddItem} ${isOn ? s.ddItemOn : ""}`}
                  aria-current={isOn ? "true" : undefined}
                  onClick={() => choose(o.value)}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
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

/** The selected baseline's details. Keyed by release so each step replays the entrance. */
function ReleaseDetail({ group, index, onClose, onStep }: ReleaseDetailProps) {
  const release: ReleaseRecord = group.releases[index];
  const isCurrent = release.isCurrent;

  return (
    <div key={release.id} className={s.dtIn}>
      <div className={s.dtTop}>
        <button type="button" className={s.dtBack} onClick={onClose}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
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
        {release.processingBaseline && (
          <div>
            <dt>Processing baseline:</dt>
            <dd>{release.processingBaseline}</dd>
          </div>
        )}
        <div>
          <dt>Released:</dt>
          <dd>
            {release.releasedMs !== undefined
              ? longDate(release.releasedMs)
              : "—"}
          </dd>
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
  );
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
  const motion = useAmbientMotion();

  const processors = useProcessors();
  const allGroups = processors.data ?? NO_GROUPS;
  const ready = processors.status === "ready";

  const satelliteImageUrl = SATELLITE_IMAGES[activeMission];
  const normalisedQuery = query.trim().toLowerCase();
  const isDetail = selected !== null;

  const missionGroups = useMemo(
    () => allGroups.filter((g) => g.mission === activeMission),
    [allGroups, activeMission],
  );

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

  // Escape closes the detail view, as the Overview button does.
  useEffect(() => {
    if (!isDetail) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDetail]);

  const missionReleases = missionGroups.flatMap((g) => g.releases);
  const yearStart = now - 365 * DAY;
  const latestMs = missionReleases
    .filter((r) => r.ms <= now)
    .reduce((m, r) => Math.max(m, r.ms), 0);
  // Until the data is in, the counts read "—" rather than a misleading 0.
  const stats = [
    { value: ready ? missionGroups.length : "—", label: "Processors" },
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

  // A marker opens its release; a second click on the same marker returns to the overview.
  const toggleRelease = (ipf: string, id: string) =>
    setSelected((prev) =>
      prev && prev.ipf === ipf && prev.id === id ? null : { ipf, id },
    );

  const stepRelease = (delta: -1 | 1) => {
    if (!detailGroup) return;
    const next = detailGroup.releases[detailIndex + delta];
    if (next) setSelected({ ipf: detailGroup.ipf, id: next.id });
  };

  const changeMission = (m: MissionId) => {
    setActiveMission(m);
    setSelected(null);
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

      <section className={ambientRoot(motion.paused, s.container)}>
        <SpaceBackdrop page={2} paused={motion.paused} />

        {/* Headline counts for the selected mission */}
        <Reveal className={s.counters}>
          {stats.map((st) => (
            <div key={st.label} className={s.counter}>
              <span className={s.counterV}>{st.value}</span>
              <span className={s.counterK}>{st.label}</span>
            </div>
          ))}
        </Reveal>

        {/* Filter bar: mission menu, timeline window, baseline menu, search */}
        <div className={s.filters}>
          <FilterDropdown<MissionId>
            id="mission-filter"
            label="Mission"
            value={activeMission}
            options={MISSION_ORDER.map((m) => ({
              value: m,
              label: MISSION_NAMES[m].toUpperCase(),
            }))}
            onChange={changeMission}
          />

          <div className={s.tabs} role="group" aria-label="Timeline range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${s.segBtn} ${range === r ? s.active : ""}`}
                aria-pressed={range === r}
                onClick={() => {
                  setRange(r);
                  setSelected(null); // a range always shows the overview
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <FilterDropdown<BaselineFilter>
            id="baseline-filter"
            label="Baseline"
            value={baselineFilter}
            displayValue={BASELINE_SHORT[baselineFilter]}
            options={BASELINE_OPTIONS}
            onChange={setBaselineFilter}
          />

          <label className={s.search}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M20 20l-4-4"></path>
            </svg>
            <input
              type="search"
              className={s.searchInput}
              placeholder="Search"
              aria-label="Search processors"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {/* Three panes: satellite, timeline, and the release detail. The satellite and the detail
            trade places on the grid so the timeline compresses to the left as the detail opens. */}
        <div className={`${s.split} ${isDetail ? s.isDetail : ""}`}>
          <section
            className={s.satpane}
            aria-label={`Sentinel-${activeMission}`}
            aria-hidden={isDetail || undefined}
          >
            <div className={s.artGlow} aria-hidden="true"></div>
            <div className={s.art} aria-hidden="true"></div>

            {satelliteImageUrl && (
              <img
                src={satelliteImageUrl}
                alt={`Sentinel-${activeMission} satellite`}
                className={s.satelliteImage}
              />
            )}

            <div className={s.placeholder}>
              <div className={s.placeholderText}>
                Sentinel-{activeMission} Visualization
              </div>
            </div>
          </section>

          <section className={s.procpane}>
            <h2 className={s.phead}>
              {MISSION_NAMES[activeMission]} processors
            </h2>

            <p className={s.caption}>Release timeline</p>
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
                moving={moving}
                onPick={toggleRelease}
              />
            ) : (
              <p className={s.none}>No processors for this mission.</p>
            )}
          </section>

          <section
            className={`${s.detailpane} ${isDetail ? s.detailOpen : ""}`}
            aria-live="polite"
            aria-hidden={!isDetail || undefined}
          >
            {detailGroup && detailIndex >= 0 && (
              <ReleaseDetail
                group={detailGroup}
                index={detailIndex}
                onClose={() => setSelected(null)}
                onStep={stepRelease}
              />
            )}
          </section>
        </div>
      </section>
    </>
  );
}
