"use client";

/* Interactive Data Availability explorer: toolbar, KPIs, strip bands, zoom, tooltip.
   Session 3: strips with folded bars, entrance animation, zoom, hover/focus tooltip.
   Session 4 adds the datatake card; Session 5 replaces mock data with the real backend. */

import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Reveal } from "@/components/Reveal";
import {
  DAY_MS,
  FRAMES,
  MISSION_DISPLAY,
  MISSION_ORDER,
  SATELLITES_OF,
  STATUS_COLOR,
  STATUS_ORDER,
  axisTicks,
  barColor,
  cardSides,
  daysOf,
  filterDatatakes,
  fmtDateTime,
  framesOf,
  kpiFmt,
  kpiStats,
  type Datatake,
  type MissionId,
} from "./model";
import { MISSION_COLOR } from "@/lib/mission-colors";
import DatatakeCard, { type CardPhase } from "./DatatakeCard";
import { DATATAKES_NOT_AVAILABLE } from "./copy";
import {
  AVAILABILITY_PATH,
  DEFAULT_VIEW,
  RANGE_LABEL,
  clampCustomRange,
  parseView,
  viewHref,
  viewParams,
  type AvailabilityView,
  type RangeId,
} from "./url-state";
import {
  isAllSelected,
  selectAll,
  selectedIds,
  toggleOption,
} from "@/lib/filter-logic";
import { withBasePath } from "@/lib/asset";
import { useHoverCapable, useMediaQuery } from "@/lib/use-media-query";
import s from "./availability.module.css";

const STRIP_ZOOM = 1.9;

// ---------------------------------------------------------------------------
// Tooltip content — rendered inside the single fixed portal element
// ---------------------------------------------------------------------------

function Tip({ item }: { item: Datatake }): ReactNode {
  const { acq, pub } = cardSides(item);
  return (
    <>
      <b className={s.tipH}>{item.id}</b>
      <div className={s.tipTwo}>
        <div>
          <em>Acquisition</em>
          <b style={{ color: acq.color }}>
            {acq.pct !== null ? `${acq.pct.toFixed(2)}%` : "—"}
          </b>
        </div>
        <div>
          <em>Publication</em>
          <b style={{ color: pub.color }}>
            {pub.pct !== null ? `${pub.pct.toFixed(2)}%` : "—"}
          </b>
        </div>
      </div>
      <div className={s.tipWhen}>
        <span>Start</span>
        <b>{fmtDateTime(item.start)}</b>
        <span>Stop</span>
        <b>{fmtDateTime(item.stop)}</b>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Window computation (matches the prototype's semantics)
// ---------------------------------------------------------------------------

function computeWindow(
  view: AvailabilityView,
  windowLast: Date,
): { from: Date; to: Date } {
  if (view.range === null) {
    // Custom: use the stored dates (fall back to 30-day window if missing)
    const to = view.customTo
      ? new Date(view.customTo + "T23:59:59Z")
      : windowLast;
    const from = view.customFrom
      ? new Date(view.customFrom + "T00:00:00Z")
      : new Date(to.getTime() - 30 * DAY_MS);
    return { from, to };
  }
  const to = new Date(windowLast.getTime() - view.offset * DAY_MS);
  if (view.range === 90) {
    const from = new Date(to);
    from.setUTCMonth(from.getUTCMonth() - 3);
    return { from, to };
  }
  const from = new Date(to.getTime() - view.range * DAY_MS);
  return { from, to };
}

function toDateInput(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ---------------------------------------------------------------------------
// ViewLink: <a href> with JS pushState intercept (no-JS: browser navigates normally)
// ---------------------------------------------------------------------------

function isPlainClick(e: React.MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function ViewLink({
  view,
  navigate,
  onNavigate,
  className,
  children,
  ...rest
}: {
  view: AvailabilityView;
  navigate: (next: AvailabilityView) => void;
  onNavigate?: () => void;
  className?: string;
  children?: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      {...rest}
      href={withBasePath(viewHref(view))}
      className={className}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        navigate(view);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// SVG icons (inline — no external dependency)
// ---------------------------------------------------------------------------

function ChevLeft() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3L5 8l5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6 3l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 6l5 5 5-5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10.4 10.4L14 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden
    >
      <rect x="2" y="3.2" width="12" height="11" rx="1.2" />
      <path d="M2 6.6h12M5.4 1.8v2.6M10.6 1.8v2.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Explorer
// ---------------------------------------------------------------------------

type DropKey = "mission" | "status";

export default function Explorer({
  datatakes,
  windowStart,
  windowLast,
  notice,
}: {
  datatakes: Datatake[];
  windowStart: Date;
  windowLast: Date;
  /** Shown in place of the strips when the data could not be loaded (degraded state). */
  notice?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<AvailabilityView>(() =>
    parseView(searchParams),
  );

  // Dropdown state: one open at a time
  const [openDrop, setOpenDrop] = useState<DropKey | null>(null);
  const dropBtnRefs = useRef<
    Partial<Record<DropKey, HTMLButtonElement | null>>
  >({});
  const dropRefs = useRef<Partial<Record<DropKey, HTMLDivElement | null>>>({});

  // Ref for the From date input (to call showPicker on pager label click)
  const fromInputRef = useRef<HTMLInputElement | null>(null);

  // Strip zoom: zoom pivot in px per mission row, recorded from the clicked bar's offsetLeft
  const [origins, setOrigins] = useState<Partial<Record<MissionId, number>>>(
    {},
  );

  // Animation: true for 900 ms after load, range change, Custom apply, or Reset.
  // animTimerRef holds the pending turn-off timeout so navigateWithAnim can reset it.
  const [animating, setAnimating] = useState(true);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Turn off animation after initial mount (setAnimating called in setTimeout callback, not in
  // the effect body, to satisfy the react-hooks/set-state-in-effect rule).
  useEffect(() => {
    animTimerRef.current = setTimeout(() => setAnimating(false), 900);
    return () => {
      if (animTimerRef.current !== null) clearTimeout(animTimerRef.current);
    };
  }, []);

  // Client-only guard for the tooltip portal: returns false on the server, true on the client.
  // useSyncExternalStore is the correct way to conditionally render client-only content without
  // hydration mismatch (DECISIONS.md 2026-11-09).
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // True only on pointer devices that can hover (mouse/trackpad). False on touch-primary
  // devices where browsers synthesise mouseenter/mouseleave after a tap.
  const hoverCapable = useHoverCapable();

  // True on phone-width viewports (≤480px): DatatakeCard renders as a bottom sheet.
  // Guarded by isClient so the first hydration render matches the SSR (sheet=false).
  const isSheet = useMediaQuery("(max-width: 480px)");

  // Tooltip: one fixed portal element populated on bar mouseenter/focus, hidden on leave/scroll.
  const [tipItem, setTipItem] = useState<Datatake | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const positionTip = useCallback((clientX: number, clientY: number) => {
    const el = tipRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    let x = clientX + 18;
    let y = clientY - h - 14;
    if (x + w + 12 > window.innerWidth) x = clientX - w - 18;
    if (y < 12) y = clientY + 20;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  useEffect(() => {
    const hide = () => setTipItem(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const navigate = useCallback((next: AvailabilityView) => {
    setView(next);
    const qs = viewParams(next).toString();
    const href = withBasePath(
      qs ? `${AVAILABILITY_PATH}?${qs}` : AVAILABILITY_PATH,
    );
    history.pushState(null, "", href);
  }, []);

  // Animated navigation: sets animating=true (OK in event handler context) and restarts the
  // 900 ms turn-off timer so bars replay their entrance on the new view.
  const navigateWithAnim = useCallback(
    (next: AvailabilityView) => {
      navigate(next);
      if (animTimerRef.current !== null) clearTimeout(animTimerRef.current);
      setAnimating(true);
      animTimerRef.current = setTimeout(() => setAnimating(false), 900);
    },
    [navigate],
  );

  // ---------------------------------------------------------------------------
  // Sync view when the URL changes through external navigation (browser Back /
  // Forward, menu link to /availability with no params). Skips the initial
  // mount because useState already read the right value from searchParams.
  // ---------------------------------------------------------------------------

  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    setView(parseView(searchParams));
  }, [searchParams]);

  // ---------------------------------------------------------------------------
  // Keyboard: ←/→ move the pager when no input is focused and no bar is picked
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (view.range === null) return; // custom mode: no arrow-key pager
      if (view.pick !== null) return; // bar picked: Escape should close it instead
      if (e.key === "ArrowLeft") {
        navigate({ ...view, offset: view.offset + 1, pick: null });
      } else if (e.key === "ArrowRight" && view.offset > 0) {
        navigate({ ...view, offset: view.offset - 1, pick: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view, navigate]);

  // ---------------------------------------------------------------------------
  // Keyboard: Escape closes the open dropdown, or zooms out the picked bar
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openDrop !== null) {
        const btn = dropBtnRefs.current[openDrop];
        setOpenDrop(null);
        btn?.focus();
        return;
      }
      if (view.pick !== null) {
        navigate({ ...view, pick: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDrop, view, navigate]);

  // ---------------------------------------------------------------------------
  // Click outside closes the open dropdown
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (openDrop === null) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = dropRefs.current[openDrop];
      if (el && !el.contains(e.target as Node)) setOpenDrop(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openDrop]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const { from: winFrom, to: winTo } = useMemo(
    () => computeWindow(view, windowLast),
    [view, windowLast],
  );
  const days = useMemo(() => daysOf(winFrom, winTo), [winFrom, winTo]);

  const { stripFrom, stripTo } = useMemo(() => {
    const sf = days[0] ?? new Date(0);
    const last = days[days.length - 1];
    return { stripFrom: sf, stripTo: new Date((last ?? new Date(0)).getTime() + DAY_MS) };
  }, [days]);

  const dataStart = windowStart;
  const dataLast = windowLast;

  const pagerPrevDisabled = view.range === null || view.range === 90 || winFrom <= dataStart;
  const pagerNextDisabled = view.range === null || view.offset === 0;

  const matching = useMemo(
    () => filterDatatakes(datatakes, stripFrom, stripTo, view.missionsOff, view.statusesOff, view.q),
    [datatakes, stripFrom, stripTo, view.missionsOff, view.statusesOff, view.q],
  );

  const activeSatellites = useMemo(
    () =>
      MISSION_ORDER.filter((m) => !view.missionsOff.has(m)).flatMap(
        (m) => SATELLITES_OF[m],
      ),
    [view.missionsOff],
  );

  const kpis = useMemo(
    () =>
      datatakes.length === 0
        ? { inRange: 0, meanCompleteness: null, coverageGaps: 0, lost: 0 }
        : kpiStats(matching, days, activeSatellites),
    [datatakes.length, matching, days, activeSatellites],
  );

  // Strip lanes: one per active mission, bars folded by framesOf; axis ticks shared across all rows
  const ticks = useMemo(() => axisTicks(days), [days]);
  const lanes = useMemo(() => {
    return MISSION_ORDER.filter((m) => !view.missionsOff.has(m)).map((missionId) => {
      const own = matching.filter((d) => d.missionId === missionId);
      const frames = framesOf(own, stripFrom, stripTo);
      const tw = 76 / FRAMES;
      return { missionId, frames, tw };
    });
  }, [matching, view.missionsOff, stripFrom, stripTo]);

  // ---------------------------------------------------------------------------
  // Datatake card lifecycle
  // ---------------------------------------------------------------------------

  // The datatake currently shown in the card (stays set during the close animation).
  // Lazy initializers derive state from the URL pick on first render so a reload or
  // shared link shows the card already open (phase "swap" = instant, no animation).
  const [cardItem, setCardItem] = useState<Datatake | null>(() => {
    if (!view.pick) return null;
    for (const { frames } of lanes) {
      const f = frames.find((fr) => fr.item.id === view.pick);
      if (f) return f.item;
    }
    return null;
  });
  const [cardMission, setCardMission] = useState<MissionId | null>(() => {
    if (!view.pick) return null;
    for (const { missionId, frames } of lanes) {
      const f = frames.find((fr) => fr.item.id === view.pick);
      if (f) return missionId;
    }
    return null;
  });
  // "swap" = instant display; used when a pick is already in the URL on first render.
  const [cardPhase, setCardPhase] = useState<CardPhase>(() =>
    view.pick !== null ? "swap" : "open",
  );

  // Stable ref to the latest lanes so the pick-sync effect can find items without
  // having lanes in its dependency array (we only want to trigger transitions on
  // view.pick changes, not on every filter change).
  const lanesRef = useRef(lanes);
  useEffect(() => {
    lanesRef.current = lanes;
  }, [lanes]);

  // Seed prevPickRef to view.pick so the sync effect returns early on first render
  // (prevId === nextId) and does not re-trigger the already-open card.
  const prevPickRef = useRef<string | null>(view.pick);

  // The ID of the bar that was showing when a close started — used to restore focus.
  const closingIdRef = useRef<string | null>(null);

  // Map: datatake ID → bar button element, populated via ref callbacks in the render.
  const barBtnRefs = useRef(new Map<string, HTMLButtonElement>());

  // Sync view.pick changes to the card lifecycle.
  useEffect(() => {
    const prevId = prevPickRef.current;
    const nextId = view.pick;
    if (nextId === prevId) return;
    prevPickRef.current = nextId;

    if (nextId !== null) {
      // Find the item in the current lanes.
      for (const { missionId, frames } of lanesRef.current) {
        const f = frames.find((fr) => fr.item.id === nextId);
        if (f) {
          setCardItem(f.item);
          setCardMission(missionId);
          setCardPhase(prevId === null ? "open" : "swap");
          return;
        }
      }
      // Item not found (unknown pick in URL) — leave card as-is.
    } else if (prevId !== null) {
      // Pick cleared: start close animation.
      closingIdRef.current = prevId;
      setCardPhase("close");
    }
  }, [view.pick]);

  // When a filter change removes the picked datatake from the visible set, defer a
  // navigation to clear the pick so the card closes and the zoom unsets.
  useEffect(() => {
    if (view.pick === null) return;
    const exists = lanes.some((l) =>
      l.frames.some((f) => f.item.id === view.pick),
    );
    if (!exists && cardItem !== null) {
      const nextView = { ...view, pick: null };
      const t = setTimeout(() => navigate(nextView), 0);
      return () => clearTimeout(t);
    }
  }, [lanes, view, navigate, cardItem]);

  // Called by DatatakeCard when its close animation finishes.
  const onClosed = useCallback(() => {
    setCardItem(null);
    setCardMission(null);
    const id = closingIdRef.current;
    closingIdRef.current = null;
    if (id) {
      requestAnimationFrame(() => {
        barBtnRefs.current.get(id)?.focus();
      });
    }
  }, []);

  // Which row is zoomed and what bar's leftPct to use as a fallback origin (plain computation
  // — no useMemo so React Compiler can memoize it without conflict).
  let pickedState: { missionId: MissionId; leftPct: number } | null = null;
  if (view.pick) {
    for (const { missionId, frames } of lanes) {
      const fi = frames.findIndex((f) => f.item.id === view.pick);
      if (fi !== -1) {
        pickedState = { missionId, leftPct: frames[fi].leftPct };
        break;
      }
    }
  }

  // Hidden inputs for the search form: all current params except q, so a no-JS
  // form submit preserves range/offset/filters alongside the typed query.
  const hiddenParams = useMemo(
    () => Array.from(viewParams({ ...view, q: "" }).entries()),
    [view],
  );

  // Selected ids for the summary row (null = all on = hide the row)
  const missionIds = selectedIds(MISSION_ORDER, view.missionsOff);
  const statusIds = selectedIds(STATUS_ORDER, view.statusesOff);

  // Range heading and pager label
  const rangeHeading =
    view.range === null ? RANGE_LABEL.custom : RANGE_LABEL[String(view.range)];
  const pagerLabel = `${toDateInput(winFrom)} → ${toDateInput(winTo)}`;

  // Min/max for the date inputs
  const dateMin = toDateInput(dataStart);
  const dateMax = toDateInput(dataLast);

  // ---------------------------------------------------------------------------
  // Pager label click: switch to custom, pre-fill From/To, open From picker
  // ---------------------------------------------------------------------------

  const onPagerLabelClick = useCallback(() => {
    const next: AvailabilityView = {
      ...view,
      range: null,
      customFrom: toDateInput(winFrom),
      customTo: toDateInput(winTo),
    };
    navigateWithAnim(next);
    setTimeout(() => {
      fromInputRef.current?.showPicker?.();
    }, 0);
  }, [view, winFrom, winTo, navigateWithAnim]);

  // ---------------------------------------------------------------------------
  // Custom range: change From or To
  // ---------------------------------------------------------------------------

  const onFromChange = useCallback(
    (val: string) => {
      if (!val) return; // "" (Clear) or empty: ignore, keep current view
      const to = view.customTo ?? toDateInput(winTo);
      const { from, to: ct } = clampCustomRange(val, to, dateMin, dateMax);
      navigateWithAnim({
        ...view,
        range: null,
        customFrom: from,
        customTo: ct,
        pick: null,
      });
    },
    [view, winTo, dateMin, dateMax, navigateWithAnim],
  );

  const onToChange = useCallback(
    (val: string) => {
      if (!val) return; // "" (Clear) or empty: ignore, keep current view
      const from = view.customFrom ?? toDateInput(winFrom);
      const { from: cf, to } = clampCustomRange(from, val, dateMin, dateMax);
      navigateWithAnim({
        ...view,
        range: null,
        customFrom: cf,
        customTo: to,
        pick: null,
      });
    },
    [view, winFrom, dateMin, dateMax, navigateWithAnim],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* KPI counters — driven by URL state and mock data */}
      <Reveal className={s.counters}>
        <div className={s.counter}>
          <span className={s.counterV}>{notice ? "—" : kpiFmt(kpis.inRange)}</span>
          <span className={s.counterK}>Datatakes in range</span>
        </div>
        <div className={s.counter}>
          <span className={s.counterV}>
            {notice
              ? "—"
              : kpis.meanCompleteness !== null
                ? `${Math.round(kpis.meanCompleteness)}%`
                : "—"}
          </span>
          <span className={s.counterK}>Mean completeness</span>
        </div>
        <div className={s.counter}>
          <span className={s.counterV}>{notice ? "—" : kpiFmt(kpis.coverageGaps)}</span>
          <span className={s.counterK}>Coverage gaps</span>
        </div>
        <div className={s.counter}>
          <span className={notice ? s.counterV : `${s.counterV} ${s.crit}`}>
            {notice ? "—" : kpiFmt(kpis.lost)}
          </span>
          <span className={s.counterK}>Datatakes lost</span>
        </div>
      </Reveal>

      {/* Filter toolbar */}
      <div className={s.filters}>
        {/* Range heading + preset buttons */}
        <div className={s.filterGroup}>
          <div className={s.fhead}>
            <h2>{rangeHeading}</h2>
          </div>
          <div className={s.frange} role="group" aria-label="Time range">
            {([1, 7, 30, 90] as RangeId[]).map((id) => (
              <ViewLink
                key={id}
                view={{
                  ...view,
                  range: id,
                  offset: 0,
                  customFrom: null,
                  customTo: null,
                  pick: null,
                }}
                navigate={navigateWithAnim}
                role="button"
                aria-pressed={view.range === id}
              >
                {id === 90 ? "3M" : `${id}D`}
              </ViewLink>
            ))}
            <ViewLink
              view={{
                ...view,
                range: null,
                customFrom: toDateInput(winFrom),
                customTo: toDateInput(winTo),
                pick: null,
              }}
              navigate={navigateWithAnim}
              role="button"
              aria-pressed={view.range === null}
            >
              Custom
            </ViewLink>
          </div>
        </div>

        {/* Pager: ‹ date range ›
            Without JS: ‹ and › are <a href> links; disabled state is a <span> (non-navigable).
            Pager label button (📅) is JS-only (calls showPicker). Pager moves do NOT animate.
            Hidden in CUSTOM mode (view.range === null): FROM/TO row controls the range there. */}
        {view.range !== null && <div className={s.pager}>
          {pagerPrevDisabled ? (
            <span
              className={s.pagerBtn}
              aria-disabled="true"
              aria-label="Previous period"
            >
              <ChevLeft />
            </span>
          ) : (
            <ViewLink
              view={{ ...view, offset: view.offset + 1, pick: null }}
              navigate={navigate}
              className={s.pagerBtn}
              aria-label="Previous period"
            >
              <ChevLeft />
            </ViewLink>
          )}
          <button
            type="button"
            className={s.plabel}
            title="Pick the days on a calendar"
            onClick={onPagerLabelClick}
          >
            {pagerLabel}
            <CalendarIcon />
          </button>
          {pagerNextDisabled ? (
            <span
              className={s.pagerBtn}
              aria-disabled="true"
              aria-label="Next period"
            >
              <ChevRight />
            </span>
          ) : (
            <ViewLink
              view={{ ...view, offset: view.offset - 1, pick: null }}
              navigate={navigate}
              className={s.pagerBtn}
              aria-label="Next period"
            >
              <ChevRight />
            </ViewLink>
          )}
        </div>}

        {/* From / To — only visible in custom mode */}
        {view.range === null && (
          <div className={s.fdates}>
            <label>
              <span className={s.fdate} style={{ "--lbl-w": "34px" } as CSSProperties}>
                <span className={s.fdatesMicro}>From</span>
                <input
                  ref={fromInputRef}
                  type="date"
                  value={view.customFrom ?? toDateInput(winFrom)}
                  min={dateMin}
                  max={dateMax}
                  onChange={(e) => onFromChange(e.target.value)}
                />
                <button
                  type="button"
                  className={s.fcal}
                  aria-label="Open calendar"
                  onClick={() => fromInputRef.current?.showPicker?.()}
                >
                  <CalendarIcon />
                </button>
              </span>
            </label>
            <label>
              <span className={s.fdate} style={{ "--lbl-w": "18px" } as CSSProperties}>
                <span className={s.fdatesMicro}>To</span>
                <input
                  type="date"
                  value={view.customTo ?? toDateInput(winTo)}
                  min={dateMin}
                  max={dateMax}
                  onChange={(e) => onToChange(e.target.value)}
                />
                <button
                  type="button"
                  className={s.fcal}
                  aria-label="Open calendar"
                  onClick={(e) => {
                    const input = (e.currentTarget as HTMLButtonElement)
                      .previousElementSibling as HTMLInputElement | null;
                    input?.showPicker?.();
                  }}
                >
                  <CalendarIcon />
                </button>
              </span>
            </label>
          </div>
        )}

        {/* Tablet line break: pushes MISSION to its own row (see .rowBreak in availability.module.css) */}
        <span className={s.rowBreak} aria-hidden />

        {/* Mission dropdown */}
        <div
          className={s.fdrop}
          ref={(el) => {
            dropRefs.current["mission"] = el;
          }}
        >
          <button
            type="button"
            ref={(el) => {
              dropBtnRefs.current["mission"] = el;
            }}
            className={s.fdropHead}
            aria-expanded={openDrop === "mission"}
            onClick={() =>
              setOpenDrop((o) => (o === "mission" ? null : "mission"))
            }
          >
            <span className={s.fdropLabel}>Mission</span>
            {isAllSelected(view.missionsOff) && (
              <span className={s.fdropVal}>All</span>
            )}
            <ChevDown />
          </button>
          <div className={s.fdropBody}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
                <button
                  type="button"
                  className={`${s.fitem} ${s.fitemMission}`}
                  aria-pressed={isAllSelected(view.missionsOff)}
                  onClick={() => {
                    if (!isAllSelected(view.missionsOff)) {
                      navigate({
                        ...view,
                        missionsOff: selectAll(),
                        pick: null,
                      });
                    }
                  }}
                >
                  <u>All</u>
                </button>
                {MISSION_ORDER.map((m) => {
                  const isOff = view.missionsOff.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${s.fitem} ${s.fitemMission} ${isOff ? s.fitemOff : ""}`}
                      aria-pressed={!isOff}
                      onClick={() => {
                        navigate({
                          ...view,
                          missionsOff: toggleOption(view.missionsOff, m),
                          pick: null,
                        });
                      }}
                    >
                      <u>{MISSION_DISPLAY[m]}</u>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Status dropdown */}
        <div
          className={s.fdrop}
          ref={(el) => {
            dropRefs.current["status"] = el;
          }}
        >
          <button
            type="button"
            ref={(el) => {
              dropBtnRefs.current["status"] = el;
            }}
            className={s.fdropHead}
            aria-expanded={openDrop === "status"}
            onClick={() =>
              setOpenDrop((o) => (o === "status" ? null : "status"))
            }
          >
            <span className={s.fdropLabel}>Status</span>
            {isAllSelected(view.statusesOff) && (
              <span className={s.fdropVal}>All</span>
            )}
            <ChevDown />
          </button>
          <div className={s.fdropBody}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
                <button
                  type="button"
                  className={s.fitem}
                  aria-pressed={isAllSelected(view.statusesOff)}
                  onClick={() => {
                    if (!isAllSelected(view.statusesOff)) {
                      navigate({
                        ...view,
                        statusesOff: selectAll(),
                        pick: null,
                      });
                    }
                  }}
                >
                  <u>All</u>
                </button>
                {STATUS_ORDER.map((st) => {
                  const isOff = view.statusesOff.has(st);
                  const dot = STATUS_COLOR[st];
                  return (
                    <button
                      key={st}
                      type="button"
                      className={`${s.fitem} ${isOff ? s.fitemOff : ""}`}
                      aria-pressed={!isOff}
                      onClick={() => {
                        navigate({
                          ...view,
                          statusesOff: toggleOption(view.statusesOff, st),
                          pick: null,
                        });
                      }}
                    >
                      <i style={{ background: dot } as CSSProperties} />
                      <u>{st}</u>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className={s.searchReset}>
          {/* Search: <form method="get"> so Enter submits without JS (other params preserved via
              hidden inputs). With JS, onChange filters live and onSubmit prevents the page reload. */}
          <form
            className={s.fsearch}
            method="get"
            action={withBasePath(AVAILABILITY_PATH)}
            onSubmit={(e) => e.preventDefault()}
          >
            {hiddenParams.map(([k, v]) => (
              <input key={k} type="hidden" name={k} value={v} />
            ))}
            <SearchIcon />
            <label htmlFor="da-search" className="sr-only">
              Search datatakes
            </label>
            <input
              id="da-search"
              type="search"
              name="q"
              placeholder="Datatake ID"
              value={view.q}
              onChange={(e) =>
                navigate({ ...view, q: e.target.value, pick: null })
              }
            />
          </form>

          {/* Reset: navigates to default view and replays the bar entrance animation */}
          <ViewLink
            view={DEFAULT_VIEW}
            navigate={navigateWithAnim}
            onNavigate={() => setOpenDrop(null)}
            className={s.freset}
          >
            Reset
          </ViewLink>
        </div>
      </div>

      {/* Filter summary row: shown only when at least one dropdown is partial */}
      {(missionIds !== null || statusIds !== null) && (
        <div className={s.fsummary} aria-live="polite">
          {missionIds !== null && (
            <span className={s.fsummaryItem}>
              <span className={s.fdropLabel}>Mission:</span>
              <span className={s.fsummaryChips}>
                {missionIds.length === 0 ? (
                  <span className={s.fdropVal}>none</span>
                ) : (
                  missionIds.map((m) => (
                    <span key={m} className={s.fsummaryChip}>
                      <i aria-hidden style={{ background: MISSION_COLOR[m] } as CSSProperties} />
                      <span className={s.fdropVal}>{MISSION_DISPLAY[m]}</span>
                    </span>
                  ))
                )}
              </span>
            </span>
          )}
          {statusIds !== null && (
            <span className={s.fsummaryItem}>
              <span className={s.fdropLabel}>Status:</span>
              <span className={s.fsummaryChips}>
                {statusIds.length === 0 ? (
                  <span className={s.fdropVal}>none</span>
                ) : (
                  statusIds.map((st) => (
                    <span key={st} className={s.fsummaryChip}>
                      <i aria-hidden style={{ background: STATUS_COLOR[st] } as CSSProperties} />
                      <span className={s.fdropVal}>{st}</span>
                    </span>
                  ))
                )}
              </span>
            </span>
          )}
        </div>
      )}

      {/* Strip bands: one per active mission, folded bars, shared axis */}
      <Reveal className={s.panel}>
        <div className={s.mapInner}>
          {datatakes.length === 0 ? (
            <div
              className={notice ? `${s.emptyData} ${s.emptyDataError}` : s.emptyData}
              role={notice ? "alert" : undefined}
            >
              {notice ? (
                <>
                  <span aria-hidden="true" className={s.emptyDataIcon}>⚠</span>
                  <span>{notice}</span>
                  <button
                    type="button"
                    className={s.retryBtn}
                    onClick={() => router.refresh()}
                  >
                    Retry
                  </button>
                </>
              ) : (
                DATATAKES_NOT_AVAILABLE
              )}
            </div>
          ) : (
            lanes.map(({ missionId, frames, tw }, rowIndex) => {
              const isRowZoomed = pickedState?.missionId === missionId && !isSheet;
              // Zoom pivot: use the recorded click offset (px) when available; fall back to the
              // bar's leftPct as a percentage origin for initial load from URL state.
              const originPx = origins[missionId];
              const transformOriginStr =
                originPx !== undefined
                  ? `${originPx}px 50%`
                  : isRowZoomed && pickedState
                    ? `${pickedState.leftPct}% 50%`
                    : "50% 50%";

              return (
                <div className={s.mapRowContainer} key={missionId}>
                  <div className={s.mapRow}>
                    <div className={s.mapLabel}>
                      <b>{missionId}</b>
                    </div>

                    <div className={s.lane}>
                      <div
                        className={`${s.track}${isRowZoomed ? ` ${s.trackZoom}` : ""}`}
                        style={
                          {
                            "--tw": `${tw}%`,
                            transformOrigin: transformOriginStr,
                            transform: isRowZoomed
                              ? `scale(${STRIP_ZOOM})`
                              : undefined,
                          } as CSSProperties
                        }
                      >
                        {frames.length === 0 ? (
                          <span className={s.trackNone}>
                            No datatakes in range
                          </span>
                        ) : (
                          frames.map(({ item, leftPct }, barIndex) => {
                            const isPicked = view.pick === item.id;
                            // All bars except the picked one step back
                            const isFaded = view.pick !== null && !isPicked;
                            return (
                              <button
                                key={item.id}
                                ref={(el) => {
                                  if (el) barBtnRefs.current.set(item.id, el);
                                  else barBtnRefs.current.delete(item.id);
                                }}
                                type="button"
                                className={[
                                  s.tile,
                                  isPicked ? s.tileSelected : "",
                                  isFaded ? s.tileFaded : "",
                                  !animating ? s.tileNoAnim : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                                style={
                                  {
                                    "--c": barColor(item),
                                    left: `${leftPct.toFixed(4)}%`,
                                    ...(animating && {
                                      animationDelay: `${Math.min(420, rowIndex * 45 + barIndex * 2.4)}ms`,
                                    }),
                                  } as CSSProperties
                                }
                                aria-label={`${item.id} ${item.status}`}
                                onMouseEnter={(e) => {
                                  if (!hoverCapable) return;
                                  const x = e.clientX;
                                  const y = e.clientY;
                                  setTipItem(item);
                                  requestAnimationFrame(() =>
                                    positionTip(x, y),
                                  );
                                }}
                                onMouseMove={(e) => {
                                  if (!hoverCapable) return;
                                  positionTip(e.clientX, e.clientY);
                                }}
                                onMouseLeave={() => {
                                  if (!hoverCapable) return;
                                  setTipItem(null);
                                }}
                                onFocus={(e) => {
                                  if (!(e.currentTarget as HTMLElement).matches(":focus-visible")) return;
                                  const rect =
                                    e.currentTarget.getBoundingClientRect();
                                  setTipItem(item);
                                  requestAnimationFrame(() =>
                                    positionTip(
                                      rect.left + rect.width / 2,
                                      rect.top,
                                    ),
                                  );
                                }}
                                onBlur={() => setTipItem(null)}
                                onClick={(e) => {
                                  if (isPicked) {
                                    navigate({ ...view, pick: null });
                                    return;
                                  }
                                  // Record the bar's offsetLeft as the zoom pivot for this row
                                  const centre = e.currentTarget.offsetLeft;
                                  setOrigins((o) => ({
                                    ...o,
                                    [missionId]: centre,
                                  }));
                                  navigate({ ...view, pick: item.id });
                                }}
                              />
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Axis hidden while the row is zoomed */}
                    <div
                      className={`${s.axis}${isRowZoomed ? ` ${s.axisHidden}` : ""}`}
                    >
                      {ticks.map((t) => (
                        <span
                          key={t.key}
                          className={[
                            s.axisTick,
                            t.edge === "first" ? s.axisFirst : "",
                            t.edge === "last" ? s.axisLast : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{ left: `${t.pct}%` }}
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  {cardItem !== null && cardMission === missionId && (
                    <DatatakeCard
                      d={cardItem}
                      phase={cardPhase}
                      onClose={() => navigate({ ...view, pick: null })}
                      onClosed={onClosed}
                      sheet={isClient && isSheet}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </Reveal>

      {/* Hover / focus tooltip — single fixed element in a portal, aria-hidden.
          isClient (useSyncExternalStore) is false on the server and true on the client, so React
          renders matching HTML on both sides and the portal is added after hydration.
          hoverCapable gates the portal so it is never mounted on touch-primary devices. */}
      {isClient && hoverCapable &&
        createPortal(
          <div
            ref={tipRef}
            className={`${s.tip}${tipItem ? ` ${s.tipOn}` : ""}`}
            aria-hidden="true"
          >
            {tipItem && <Tip item={tipItem} />}
          </div>,
          document.body,
        )}
    </>
  );
}
