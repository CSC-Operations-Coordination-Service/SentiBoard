"use client";

/* Interactive Data Availability explorer: toolbar, KPIs.
   Session 2: toolbar + KPIs driven by URL state and mock data.
   Sessions 3-4 add the strips and datatake card.
   Session 5 replaces mock data with the real backend. */

import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Reveal } from "@/components/Reveal";
import { MOCK_DATA, MOCK_WINDOW } from "./mock-data";
import {
  DAY_MS,
  MISSION_DISPLAY,
  MISSION_ORDER,
  SATELLITES_OF,
  STATUS_COLOR,
  STATUS_ORDER,
  daysOf,
  kpiFmt,
  kpiStats,
  type Status,
} from "./model";
import {
  AVAILABILITY_PATH,
  DEFAULT_VIEW,
  RANGE_LABEL,
  parseView,
  viewHref,
  viewParams,
  type AvailabilityView,
  type RangeId,
} from "./url-state";
import { withBasePath } from "@/lib/asset";
import s from "./availability.module.css";

// ---------------------------------------------------------------------------
// Window computation (matches the prototype's semantics)
// ---------------------------------------------------------------------------

function computeWindow(view: AvailabilityView): { from: Date; to: Date } {
  if (view.range === null) {
    // Custom: use the stored dates (fall back to 30-day window if missing)
    const to = view.customTo
      ? new Date(view.customTo + "T23:59:59Z")
      : MOCK_WINDOW.last;
    const from = view.customFrom
      ? new Date(view.customFrom + "T00:00:00Z")
      : new Date(to.getTime() - 30 * DAY_MS);
    return { from, to };
  }
  const to = new Date(MOCK_WINDOW.last.getTime() - view.offset * DAY_MS);
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
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevRight() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M10.4 10.4L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <rect x="2" y="3.2" width="12" height="11" rx="1.2" />
      <path d="M2 6.6h12M5.4 1.8v2.6M10.6 1.8v2.6" strokeLinecap="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Explorer
// ---------------------------------------------------------------------------

type DropKey = "mission" | "status";

export default function Explorer() {
  const searchParams = useSearchParams();
  const [view, setView] = useState<AvailabilityView>(() => parseView(searchParams));

  // Dropdown state: one open at a time
  const [openDrop, setOpenDrop] = useState<DropKey | null>(null);
  const dropBtnRefs = useRef<Partial<Record<DropKey, HTMLButtonElement | null>>>({});
  const dropRefs = useRef<Partial<Record<DropKey, HTMLDivElement | null>>>({});

  // Ref for the From date input (to call showPicker on pager label click)
  const fromInputRef = useRef<HTMLInputElement | null>(null);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const navigate = useCallback((next: AvailabilityView) => {
    setView(next);
    const qs = viewParams(next).toString();
    const href = withBasePath(qs ? `${AVAILABILITY_PATH}?${qs}` : AVAILABILITY_PATH);
    history.pushState(null, "", href);
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard: ←/→ move the pager when no input is focused and no card is open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (view.range === null) return; // custom mode: no arrow-key pager
      if (view.pick !== null) return;  // card open: Escape should close it, not move the pager
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
  // Keyboard: Escape closes the open dropdown
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || openDrop === null) return;
      const btn = dropBtnRefs.current[openDrop];
      setOpenDrop(null);
      btn?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDrop]);

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

  const { from: winFrom, to: winTo } = useMemo(() => computeWindow(view), [view]);
  const days = useMemo(() => daysOf(winFrom, winTo), [winFrom, winTo]);

  const dataStart = MOCK_WINDOW.start;
  const dataLast = MOCK_WINDOW.last;

  const pagerPrevDisabled = view.range === null || winFrom <= dataStart;
  const pagerNextDisabled = view.range === null || view.offset === 0;

  const matching = useMemo(() => {
    const q = view.q.trim().toLowerCase();
    return MOCK_DATA.filter((d) => {
      if (d.start < winFrom || d.start > winTo) return false;
      if (view.missionsOff.has(d.missionId)) return false;
      if (view.statusesOff.has(d.status)) return false;
      if (q && !d.id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [winFrom, winTo, view.missionsOff, view.statusesOff, view.q]);

  const activeSatellites = useMemo(
    () => MISSION_ORDER.filter((m) => !view.missionsOff.has(m)).flatMap((m) => SATELLITES_OF[m]),
    [view.missionsOff],
  );

  const kpis = useMemo(() => kpiStats(matching, days, activeSatellites), [matching, days, activeSatellites]);

  // Hidden inputs for the search form: all current params except q, so a no-JS
  // form submit preserves range/offset/filters alongside the typed query.
  const hiddenParams = useMemo(
    () => Array.from(viewParams({ ...view, q: "" }).entries()),
    [view],
  );

  // Dropdown value labels
  const missionOnCount = MISSION_ORDER.length - view.missionsOff.size;
  const missionVal = view.missionsOff.size === 0 ? "" : `${missionOnCount}/${MISSION_ORDER.length}`;

  const statusOnCount = STATUS_ORDER.length - view.statusesOff.size;
  const statusVal = view.statusesOff.size === 0 ? "" : `${statusOnCount}/${STATUS_ORDER.length}`;

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
    navigate(next);
    // Open the From picker after state update
    setTimeout(() => { fromInputRef.current?.showPicker?.(); }, 0);
  }, [view, winFrom, winTo, navigate]);

  // ---------------------------------------------------------------------------
  // Custom range: change From or To
  // ---------------------------------------------------------------------------

  const onFromChange = useCallback(
    (val: string) => {
      let from = val;
      let to = view.customTo ?? toDateInput(winTo);
      if (from > to) { [from, to] = [to, from]; }
      navigate({ ...view, range: null, customFrom: from, customTo: to, pick: null });
    },
    [view, winTo, navigate],
  );

  const onToChange = useCallback(
    (val: string) => {
      let to = val;
      let from = view.customFrom ?? toDateInput(winFrom);
      if (from > to) { [from, to] = [to, from]; }
      navigate({ ...view, range: null, customFrom: from, customTo: to, pick: null });
    },
    [view, winFrom, navigate],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* KPI counters — driven by URL state and mock data */}
      <Reveal className={s.counters}>
        <div className={s.counter}>
          <span className={s.counterV}>{kpiFmt(kpis.inRange)}</span>
          <span className={s.counterK}>Datatakes in range</span>
        </div>
        <div className={s.counter}>
          <span className={s.counterV}>
            {kpis.meanCompleteness !== null
              ? `${Math.round(kpis.meanCompleteness)}%`
              : "—"}
          </span>
          <span className={s.counterK}>Mean completeness</span>
        </div>
        <div className={s.counter}>
          <span className={s.counterV}>{kpiFmt(kpis.coverageGaps)}</span>
          <span className={s.counterK}>Coverage gaps</span>
        </div>
        <div className={s.counter}>
          <span className={`${s.counterV} ${s.crit}`}>{kpiFmt(kpis.lost)}</span>
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
            {([1, 7, 30] as RangeId[]).map((id) => (
              <ViewLink
                key={id}
                view={{ ...view, range: id, offset: 0, customFrom: null, customTo: null, pick: null }}
                navigate={navigate}
                role="button"
                aria-pressed={view.range === id}
              >
                {id}D
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
              navigate={navigate}
              role="button"
              aria-pressed={view.range === null}
            >
              Custom
            </ViewLink>
          </div>
        </div>

        {/* Pager: ‹ date range ›
            Without JS: ‹ and › are <a href> links; disabled state is a <span> (non-navigable).
            Pager label button (📅) is JS-only (calls showPicker). */}
        <div className={s.pager}>
          {pagerPrevDisabled ? (
            <span className={s.pagerBtn} aria-disabled="true" aria-label="Previous period">
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
            <span className={s.pagerBtn} aria-disabled="true" aria-label="Next period">
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
        </div>

        {/* From / To — only visible in custom mode */}
        {view.range === null && (
          <div className={s.fdates}>
            <label>
              <span className={s.fdatesMicro}>From</span>
              <span className={s.fdate}>
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
              <span className={s.fdatesMicro}>To</span>
              <span className={s.fdate}>
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

        {/* Mission dropdown */}
        <div
          className={s.fdrop}
          ref={(el) => { dropRefs.current["mission"] = el; }}
        >
          <button
            type="button"
            ref={(el) => { dropBtnRefs.current["mission"] = el; }}
            className={s.fdropHead}
            aria-expanded={openDrop === "mission"}
            onClick={() => setOpenDrop((o) => (o === "mission" ? null : "mission"))}
          >
            <span className={s.fdropLabel}>Mission</span>
            <span className={s.fdropVal}>{missionVal}</span>
            <ChevDown />
          </button>
          <div className={s.fdropBody}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
                {MISSION_ORDER.map((m) => {
                  const isOff = view.missionsOff.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${s.fitem} ${s.fitemMission} ${isOff ? s.fitemOff : ""}`}
                      aria-pressed={!isOff}
                      onClick={() => {
                        const next = new Set(view.missionsOff);
                        if (isOff) next.delete(m); else next.add(m);
                        navigate({ ...view, missionsOff: next, pick: null });
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
          ref={(el) => { dropRefs.current["status"] = el; }}
        >
          <button
            type="button"
            ref={(el) => { dropBtnRefs.current["status"] = el; }}
            className={s.fdropHead}
            aria-expanded={openDrop === "status"}
            onClick={() => setOpenDrop((o) => (o === "status" ? null : "status"))}
          >
            <span className={s.fdropLabel}>Status</span>
            <span className={s.fdropVal}>{statusVal}</span>
            <ChevDown />
          </button>
          <div className={s.fdropBody}>
            <div className={s.fdropInner}>
              <div className={s.fdropPad}>
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
                        const next = new Set(view.statusesOff);
                        if (isOff) next.delete(st); else next.add(st as Status);
                        navigate({ ...view, statusesOff: next, pick: null });
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
          <label htmlFor="da-search" className="sr-only">Search datatakes</label>
          <input
            id="da-search"
            type="search"
            name="q"
            placeholder="Datatake ID"
            value={view.q}
            onChange={(e) => navigate({ ...view, q: e.target.value, pick: null })}
          />
        </form>

        {/* Reset: ViewLink to /availability (no params = default view).
            Without JS: navigates to bare /availability URL. */}
        <ViewLink
          view={DEFAULT_VIEW}
          navigate={navigate}
          onNavigate={() => setOpenDrop(null)}
          className={s.freset}
        >
          Reset
        </ViewLink>

      </div>

      {/* Strip bands (Session 3) and datatake card (Session 4) go here */}
      <div className={s.panel}>
        <div className={s.mapInner}>
          {/* placeholder until Session 3 */}
        </div>
      </div>
    </>
  );
}
