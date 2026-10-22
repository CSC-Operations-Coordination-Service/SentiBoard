"use client";

/* Interactive Events & Anomalies page: calendar, month navigation, filters, drawer.
   Ported from the prototype's EventsManifest (src/pages/events/events.tsx).

   Data split: the server passes compact EventCard[] (all events, for instant client-side
   filtering) plus the full EventDetail for the URL-selected event. Filter and month changes
   update the URL via history.pushState (instant, no server round-trip). Event selection uses
   router.push so the server can render the selected event's full details. */

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type TransitionEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cog,
  Compass,
  HelpCircle,
  Joystick,
  RotateCcw,
  Satellite,
  SatelliteDish,
  Search,
} from "lucide-react";
import {
  CATEGORIES,
  MISSIONS,
  MISSION_DISPLAY,
  MISSION_ORDER,
  type EventCard,
  type EventCategory,
  type EventDetail,
  type MissionId,
  type TextSegment,
} from "./model";
import {
  EVENTS_PATH,
  calendarCells,
  filterEvents,
  parseView,
  resolveView,
  viewHref,
  viewParams,
  type EventsView,
} from "./url-state";
import s from "./events.module.css";

const SpaceBackdrop = dynamic(() => import("@/components/SpaceBackdrop"), { ssr: false });

/* ---- category icons / colours (prototype's exact set + Platform + Other) ---- */

const CATEGORY_ICONS: Record<EventCategory, React.ComponentType<{ size?: number; strokeWidth?: number; color?: string; "aria-hidden"?: boolean | "true" }>> = {
  Acquisition: SatelliteDish,
  Calibration: Compass,
  Manoeuvre: Joystick,
  Production: Cog,
  Satellite: Satellite,
  Other: HelpCircle,
};

const CATEGORY_STROKE = 1.9;

const CATEGORY_COLOR: Record<EventCategory, string> = {
  Acquisition: "#aeb8c4",
  Calibration: "#b0dfe5",
  Manoeuvre: "#ffad00",
  Production: "#c77dff",
  Satellite: "#ee8216",
  Other: "#a0a0a0",
};

/* ---- zodiac ---- */

const SIGN_BY_MONTH = [
  "Capricornus","Aquarius","Pisces","Aries","Taurus","Gemini",
  "Cancer","Leo","Virgo","Libra","Scorpius","Sagittarius",
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const ZODIAC: Record<string, string> = {
  Capricornus: "M-200 -40 L-120 -80 L-40 -30 L40 -60 L120 -20 L200 -90 M120 -20 L90 60 L0 100 L-80 40 L-40 -30",
  Aquarius: "M-220 -40 L-160 -90 L-100 -40 L-40 -90 L20 -40 L80 -90 L140 -40 L200 -90 M-220 60 L-160 10 L-100 60 L-40 10 L20 60 L80 10 L140 60 L200 10",
  Pisces: "M-240 -110 Q-160 -40 -90 0 Q-160 40 -240 110 M90 -110 Q160 -40 240 0 Q160 40 90 110 M-90 0 L90 0",
  Aries: "M-200 40 Q-150 -130 -30 -70 L60 -20 L200 20",
  Taurus: "M-200 -120 L-40 0 L-200 120 M-40 0 L140 -40 M140 -40 L60 -140 M140 -40 L200 -130 M120 60 L130 40 L140 60 L120 62 Z",
  Gemini: "M-130 -150 L-120 110 M130 -150 L120 110 M-130 -150 Q-60 -170 -20 -120 M130 -150 Q60 -170 20 -120 M-120 -10 L120 -10",
  Cancer: "M-160 0 Q0 -180 160 0 Q0 180 -160 0 Z M-60 -120 L-120 -190 M60 -120 L120 -190 M-60 120 L-120 190 M60 120 L120 190",
  Leo: "M-220 -40 L-160 -90 L-100 -60 L-40 -20 L30 -60 L100 0 L200 10 L180 110 L80 90 L-20 60 L-80 110 L-160 120 Z",
  Virgo: "M-120 -180 L-60 -20 L-30 150 M-60 -20 L40 -60 L120 -150 M-60 -20 L60 40 L200 80 M-30 150 L80 190",
  Libra: "M-200 -40 L200 -40 M0 -40 L0 -130 M-200 -40 Q-150 60 -100 -40 M200 -40 Q150 60 100 -40 M-60 -130 L60 -130",
  Scorpius: "M-200 -120 L-120 -60 L-60 -120 L0 -40 L60 -20 L120 20 L170 90 L200 60 M120 20 L110 -40 L150 -80",
  Sagittarius: "M-180 120 L160 -120 M160 -120 L80 -110 M160 -120 L150 -40 M-120 40 L40 -20 M-60 80 L80 0",
};

const ZODIAC_STARS: Record<string, [number, number][]> = {
  Capricornus: [[-200,-40],[-120,-80],[-40,-30],[40,-60],[120,-20],[200,-90],[90,60],[0,100],[-80,40]],
  Aquarius: [[-220,-40],[-160,-90],[-100,-40],[-40,-90],[20,-40],[80,-90],[140,-40],[200,-90],[-220,60],[-160,10],[-100,60],[-40,10],[20,60],[80,10],[140,60],[200,10]],
  Pisces: [[-240,-110],[-90,0],[-240,110],[90,-110],[240,0],[90,110]],
  Aries: [[-200,40],[-30,-70],[60,-20],[200,20]],
  Taurus: [[-200,-120],[-40,0],[-200,120],[140,-40],[60,-140],[200,-130],[120,60],[130,40],[140,60],[120,62]],
  Gemini: [[-130,-150],[-120,110],[130,-150],[120,110],[-20,-120],[20,-120],[-120,-10],[120,-10]],
  Cancer: [[-160,0],[160,0],[-60,-120],[-120,-190],[60,-120],[120,-190],[-60,120],[-120,190],[60,120],[120,190]],
  Leo: [[-220,-40],[-160,-90],[-100,-60],[-40,-20],[30,-60],[100,0],[200,10],[180,110],[80,90],[-20,60],[-80,110],[-160,120]],
  Virgo: [[-120,-180],[-60,-20],[-30,150],[40,-60],[120,-150],[60,40],[200,80],[80,190]],
  Libra: [[-200,-40],[200,-40],[0,-40],[0,-130],[-100,-40],[100,-40],[-60,-130],[60,-130]],
  Scorpius: [[-200,-120],[-120,-60],[-60,-120],[0,-40],[60,-20],[120,20],[170,90],[200,60],[110,-40],[150,-80]],
  Sagittarius: [[-180,120],[160,-120],[80,-110],[150,-40],[-120,40],[40,-20],[-60,80],[80,0]],
};

const STAR_STEP_MS = 150;
const STAR_FADE_MS = 400;
const ZODIAC_VIEW = "-270 -230 540 460";
const CELL_W = 200;
const CELL_H = 168;
const START_X = 90;
const START_Y = 80;
/* How many category groups a day cell shows before collapsing the rest to "+N". */
const MARKS_SHOWN = 4;
const WEEKDAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];

/* ---- geometry ---- */

type ZoomGeom = { left: number; top: number; width: number; scale: number; tx: number; ty: number };

function measureZoom(grid: HTMLElement, day: number): ZoomGeom | null {
  const cell = grid.querySelector<HTMLElement>(`[data-day="${day}"]`);
  if (!cell) return null;
  const g = grid.getBoundingClientRect();
  const c = cell.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const wide = vw > 900;
  const scale = Math.min(vw / (1.8 * c.width), vh / (1.8 * c.height));
  const targetX = wide ? vw * 0.3 : vw / 2;
  const targetY = wide ? vh / 2 : vh * 0.24;
  const cx = c.left - g.left + c.width / 2;
  const cy = c.top - g.top + c.height / 2;
  return { left: g.left, top: g.top, width: g.width, scale, tx: targetX - g.left - scale * cx, ty: targetY - g.top - scale * cy };
}

function skyCell(index: number) {
  const col = index % 7;
  const row = Math.floor(index / 7);
  return { col, row, x: START_X + col * CELL_W, y: START_Y + row * CELL_H };
}

/* ---- text segments ---- */

function renderSegments(segments: TextSegment[]): React.ReactNode[] {
  return segments.map((seg, i) => {
    if (seg.type === "br") return <br key={i} />;
    if (seg.type === "code") return (
      <pre key={i} style={{ margin: "8px 0", padding: "10px 14px", background: "var(--mf-panel)", border: "1px solid var(--mf-line)", overflow: "auto", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        <code>{seg.text}</code>
      </pre>
    );
    return <span key={i}>{seg.text}</span>;
  });
}

/* ---- drawer content ---- */

function pad(n: number) { return String(n).padStart(2, "0"); }

/** "09 SEPTEMBER 2023" */
function dayHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${pad(d.getUTCDate())} ${MONTH_NAMES[d.getUTCMonth()].toUpperCase()} ${d.getUTCFullYear()}`;
}

function DatatakeRow({ dt }: { dt: EventDetail["datatakes"][number] }) {
  const levels = [
    dt.L0 !== null ? `L0: ${dt.L0.toFixed(1)}%` : null,
    dt.L1 !== null ? `L1: ${dt.L1.toFixed(1)}%` : null,
    dt.L2 !== null ? `L2: ${dt.L2.toFixed(1)}%` : null,
  ].filter(Boolean);
  return (
    <div className={s.dtkRow}>
      <span className={s.dtkLeft}>
        <span className={s.dtkId}>
          <i style={{ background: "var(--mf-signal)", display: "inline-block", width: 9, height: 9, borderRadius: "50%" }} aria-hidden />
          <span className={s.dtkLink}>{dt.datatakeId}</span>
        </span>
        {!dt.noData ? (
          <span className={s.dtkProd}>{levels.join("  ")}</span>
        ) : (
          <span className={s.dtkProd} style={{ color: "var(--mf-faint)" }}>no data</span>
        )}
      </span>
    </div>
  );
}

function EventDrawerContent({ event }: { event: EventDetail }) {
  const Icon = CATEGORY_ICONS[event.category];
  const color = CATEGORY_COLOR[event.category];
  return (
    <div className={s.drawerBody} key={event.id}>
      <header className={s.ziHead}>
        <span className={s.detailEyebrow}>Selected event</span>
        <h2 className={s.ziDate}>{dayHeading(event.startDate)}</h2>
        <span className={s.ziSum}>
          <Icon size={13} strokeWidth={CATEGORY_STROKE} color={color} aria-hidden />
          {" "}{event.category} · {event.satellite}
        </span>
      </header>

      <section style={{ marginTop: 24, paddingBottom: 4 }}>
        <div className={s.ziDtkHead} style={{ marginTop: 0 }}>{event.title}</div>
      </section>

      {event.impactedItem && (
        <div style={{ marginTop: 16, paddingBottom: 14, borderBottom: "1px solid var(--mf-line)" }}>
          <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mf-faint)" }}>Impacted item</span>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500 }}>{event.impactedItem}</div>
        </div>
      )}

      {event.newsLink && (
        <div style={{ marginTop: 16, paddingBottom: 14, borderBottom: "1px solid var(--mf-line)" }}>
          <a href={event.newsLink} target="_blank" rel="noopener noreferrer" className={s.dtkLink}>
            {event.newsTitle ?? "News article"} ↗
          </a>
        </div>
      )}

      {event.textSegments.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <div className={s.ziDtkHead}>Description</div>
          <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--mf-muted)", marginTop: 8 }}>
            {renderSegments(event.textSegments)}
          </p>
        </section>
      )}

      {event.datatakes.length > 0 && (
        <section style={{ marginTop: 20 }}>
          <div className={s.ziDtkHead}>Datatakes completeness · {event.datatakes.length}</div>
          {event.datatakes.map((dt) => <DatatakeRow key={dt.datatakeId} dt={dt} />)}
        </section>
      )}
    </div>
  );
}

/* ---- metrics ---- */

function Metric({ value, label, lost = false }: { value: number; label: string; lost?: boolean }) {
  return (
    <div className={`${s.metric} ${lost ? s.metricLost : ""}`}>
      <span className={s.metricValue}>{String(value).padStart(2, "0")}</span>
      <span className={s.metricLabel}>{label}</span>
    </div>
  );
}

/* ---- Explorer data type ---- */

export type ExplorerData =
  | {
      ok: true;
      /** ALL events (compact) for client-side filtering and month navigation. */
      cards: EventCard[];
      /** Full detail for the URL-selected event, rendered server-side. */
      selectedEvent: EventDetail | null;
      /** Current UTC year/month computed dynamically on the server (not from cache). */
      now: { year: number; month: number };
    }
  | { ok: false; unreachable: boolean; message: string };

/* ---- main component ---- */

export default function Explorer({ data }: { data: ExplorerData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<EventsView>(() =>
    resolveView(parseView(searchParams, data.ok ? data.now : undefined), data.ok ? data.cards : []),
  );

  // Drawer state
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [panelDay, setPanelDay] = useState<{ day: number; cards: EventCard[] } | null>(null);
  const [zoom, setZoom] = useState<ZoomGeom | null>(null);
  const [zoomOn, setZoomOn] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Filter accordion open state
  const [openFilter, setOpenFilter] = useState<"type" | "mission" | "satellite" | null>(null);

  // Navigate: update local state AND URL
  const navigate = useCallback(
    (next: EventsView, mode: "push" | "replace" = "push") => {
      setView(next);
      const qs = viewParams(next).toString();
      const href = qs ? `${EVENTS_PATH}?${qs}` : EVENTS_PATH;
      if (mode === "push") history.pushState(null, "", href);
      else history.replaceState(null, "", href);
    },
    [],
  );

  // Event selection → router.push so the server renders the EventDetail
  const selectEventId = useCallback(
    (id: string) => {
      const next = { ...view, event: id };
      setView(next);
      startTransition(() => {
        router.push(viewHref(next), { scroll: false });
      });
    },
    [view, router],
  );

  const cards = useMemo(() => (data.ok ? data.cards : []), [data]);

  const monthEvents = useMemo(
    () => filterEvents(cards, view),
    [cards, view],
  );

  const byDay = useMemo(() => {
    const map = new Map<number, EventCard[]>();
    [...monthEvents]
      .sort((a, b) => a.startDay - b.startDay || a.startTime.localeCompare(b.startTime))
      .forEach((e) => {
        const list = map.get(e.startDay) ?? [];
        list.push(e);
        map.set(e.startDay, list);
      });
    return map;
  }, [monthEvents]);

  const cells = useMemo(() => calendarCells(view.year, view.month), [view.year, view.month]);

  // Close drawer
  const close = useCallback(() => {
    setOpenDay(null);
    setZoomOn(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setZoom(null);
  }, []);

  const stepMonth = useCallback(
    (delta: number) => {
      let nm = view.month + delta;
      let ny = view.year;
      if (nm > 12) { nm -= 12; ny++; }
      if (nm < 1) { nm += 12; ny--; }
      navigate({ ...view, month: nm, year: ny, event: null });
      close();
    },
    [view, navigate, close],
  );

  const selectDay = useCallback(
    (day: number) => {
      const events = byDay.get(day) ?? [];
      if (events.length === 0) return;
      const geom = gridRef.current ? measureZoom(gridRef.current, day) : null;
      if (!geom) return;
      if (openDay === null) setZoomOn(false);
      setZoom(geom);
      setOpenDay(day);
      setPanelDay({ day, cards: events });
      if (events[0]) selectEventId(events[0].id);
    },
    [byDay, openDay, selectEventId],
  );

  // Fly in after mount
  useEffect(() => {
    if (openDay === null || !zoom || zoomOn) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setZoomOn(true)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [openDay, zoom, zoomOn]);

  // Keep day centred on resize
  useEffect(() => {
    if (openDay === null) return;
    const onResize = () => { const g = gridRef.current && measureZoom(gridRef.current, openDay); if (g) setZoom(g); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openDay]);

  const onPanelTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLElement>) => {
      if (e.target === e.currentTarget && openDay === null) setPanelDay(null);
    },
    [openDay],
  );

  // Escape closes drawer
  useEffect(() => {
    if (openDay === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay, close]);

  // Freeze scroll while drawer is open
  useEffect(() => {
    if (openDay === null) return;
    const { documentElement: html, body } = document;
    const prev = { html: html.style.overflow, body: body.style.overflow, pad: body.style.paddingRight };
    const gutter = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;
    const freeze = (e: Event) => {
      const inList = e.target instanceof Element && e.target.closest(`.${s.drawerBody}`);
      if (!inList) e.preventDefault();
    };
    window.addEventListener("wheel", freeze, { passive: false });
    window.addEventListener("touchmove", freeze, { passive: false });
    return () => {
      window.removeEventListener("wheel", freeze);
      window.removeEventListener("touchmove", freeze);
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
      body.style.paddingRight = prev.pad;
    };
  }, [openDay]);

  // Close filter accordions on outside click
  useEffect(() => {
    if (!openFilter) return;
    const close = () => setOpenFilter(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openFilter]);

  // Metrics computed from the filtered events in the current month (must be before early-return)
  const datatakesInScope = useMemo(
    () => monthEvents.reduce((n, e) => n + e.datatakeCount, 0),
    [monthEvents],
  );
  const lostDatatakes = useMemo(
    () => monthEvents.reduce((n, e) => n + e.lostDatatakeCount, 0),
    [monthEvents],
  );

  // All hooks are above this line. Early-return for the degraded state is safe here.
  if (!data.ok) {
    return (
      <div className={s.page} style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh" }}>
        <p style={{ color: "var(--mf-muted)", fontFamily: "var(--font-mono, var(--mono))", fontSize: 13 }}>
          {data.unreachable ? "Backend unreachable — " : "Could not load events — "}
          {data.message}
        </p>
      </div>
    );
  }

  const sign = SIGN_BY_MONTH[view.month - 1];
  const monthName = MONTH_NAMES[view.month - 1];
  const monthLabel = `${monthName} ${view.year}`;

  const missionSatellites = view.mission ? MISSIONS[view.mission as MissionId] : [];
  const allMissionSatellites = MISSION_ORDER.flatMap((m) => MISSIONS[m]);
  const satellites = view.mission ? missionSatellites : allMissionSatellites;
  const satelliteDisabled = satellites.length < 2;

  const dirty =
    !!view.mission ||
    !!view.satellite ||
    !!view.q ||
    view.categories.length < CATEGORIES.length;

  const typeFilter = view.categories.length === 1 ? view.categories[0] : "";

  const satellitesMonitored = new Set(monthEvents.map((e) => e.satellite)).size;

  /* ---- calendar cell rendering ---- */

  /** Group events by category so the cell shows one dot/icon per type + count badge. */
  function groupByCategory(events: EventCard[]): { category: EventCategory; count: number }[] {
    const map = new Map<EventCategory, number>();
    for (const e of events) map.set(e.category, (map.get(e.category) ?? 0) + 1);
    return [...map.entries()].map(([category, count]) => ({ category, count }));
  }

  const renderCells = (zoomed: boolean) =>
    cells.map((c, i) => {
      const pos = skyCell(i);
      if (c.dim)
        return (
          <div key={`dim-${i}`} className={`${s.cell} ${s.cellDim}`} data-col={pos.col} data-row={pos.row} aria-hidden />
        );
      const events = byDay.get(c.day) ?? [];
      const groups = groupByCategory(events);
      const shownGroups = groups.slice(0, MARKS_SHOWN);
      const hiddenCount = groups.length - shownGroups.length;

      const selected = zoomed && openDay === c.day;
      const blurred = zoomed && openDay !== c.day;
      const pickable = blurred && events.length > 0;
      return (
        <div
          key={c.day}
          data-day={c.day}
          className={`${s.cell} ${selected ? s.cellSel : ""} ${blurred ? s.cellBlur : ""} ${pickable ? s.cellPick : ""}`}
          data-col={pos.col}
          data-row={pos.row}
          onClick={
            pickable
              ? (evt) => { evt.stopPropagation(); selectDay(c.day); }
              : events.length > 0
                ? () => selectDay(c.day)
                : undefined
          }
        >
          <span className={s.cellNum}>{pad(c.day)}</span>
          {groups.length > 0 && (
            <span className={`${s.marks} ${zoomed ? s.zoomedIn : ""}`}>
              {shownGroups.map(({ category, count }) => {
                const color = CATEGORY_COLOR[category];
                const Icon = CATEGORY_ICONS[category];
                const title = zoomed
                  ? `${category} · Back to the month`
                  : `${count} ${category} event${count > 1 ? "s" : ""}`;
                return (
                  <button
                    key={category}
                    type="button"
                    className={s.markGroup}
                    onClick={(evt) => { evt.stopPropagation(); if (zoomed) close(); else selectDay(c.day); }}
                    title={title}
                    aria-label={title}
                  >
                    {zoomed ? (
                      <span className={s.iconMark} style={{ color }}>
                        <Icon size={14} strokeWidth={CATEGORY_STROKE} aria-hidden />
                      </span>
                    ) : (
                      <span className={s.dotMark} style={{ backgroundColor: color }} />
                    )}
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className={s.markMoreBtn}
                  onClick={(evt) => { evt.stopPropagation(); if (zoomed) close(); else selectDay(c.day); }}
                  aria-label={`+${hiddenCount} more type${hiddenCount > 1 ? "s" : ""}`}
                >
                  <em className={s.markMore}>+{hiddenCount}</em>
                </button>
              )}
            </span>
          )}
        </div>
      );
    });

  /* ---- filter accordion helpers ---- */

  const missionDisplayVal = view.mission ? MISSION_DISPLAY[view.mission as MissionId] : "All";
  const satDisplayVal = view.satellite || "All";
  const typeDisplayVal = typeFilter || "All";

  return (
    <div className={s.page} style={{ opacity: isPending ? 0.7 : 1, transition: "opacity 200ms" }}>
      <SpaceBackdrop page={1} paused={false} />
      <div className={s.inner}>

        {/* Metrics — 4 figures as in the prototype */}
        <div className={s.metrics} aria-label="Summary for the month">
          <Metric value={monthEvents.length} label="Events this month" />
          <Metric value={datatakesInScope} label="Datatakes in scope" />
          <Metric value={lostDatatakes} label="Lost datatakes" lost />
          <Metric value={satellitesMonitored} label="Satellites monitored" />
        </div>

        {/* Month navigation + filter accordions */}
        <div className={s.monthBar}>
          <div className={s.monthNav}>
            <button type="button" onClick={() => stepMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} strokeWidth={1.4} aria-hidden />
            </button>
            <span className={s.monthLabel} aria-live="polite">{monthLabel}</span>
            <button type="button" onClick={() => stepMonth(1)} aria-label="Next month">
              <ChevronRight size={16} strokeWidth={1.4} aria-hidden />
            </button>
          </div>

          <div className={s.barFilters}>

            {/* Event type fdrop */}
            <div
              className={`${s.fdrop} ${openFilter === "type" ? s.fdropOpen : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openFilter === "type"}
                onClick={() => setOpenFilter((o) => (o === "type" ? null : "type"))}
              >
                <span className={s.fdropLabel}>Event type</span>
                <span className={s.fdropVal}>{typeDisplayVal}</span>
                <span className={s.fdropChev}><ChevronDown size={12} strokeWidth={1.4} aria-hidden /></span>
              </button>
              <div className={s.fdropBody}>
                <div className={s.fdropInner}>
                  <div className={s.typeChipGrid}>
                    <button
                      type="button"
                      className={`${s.typeChip} ${typeFilter === "" ? s.typeChipOn : ""}`}
                      onClick={() => { navigate({ ...view, categories: [...CATEGORIES] }); setOpenFilter(null); }}
                    >
                      All
                    </button>
                    {CATEGORIES.map((c) => {
                      const Icon = CATEGORY_ICONS[c];
                      const color = CATEGORY_COLOR[c];
                      const active = typeFilter === c;
                      return (
                        <button
                          key={c}
                          type="button"
                          className={`${s.typeChip} ${active ? s.typeChipOn : ""}`}
                          style={active ? {} : { "--type-color": color } as CSSProperties}
                          onClick={() => { navigate({ ...view, categories: [c] }); setOpenFilter(null); }}
                        >
                          <Icon size={14} strokeWidth={CATEGORY_STROKE} color={active ? "currentColor" : color} aria-hidden />
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Mission fdrop */}
            <div
              className={`${s.fdrop} ${openFilter === "mission" ? s.fdropOpen : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openFilter === "mission"}
                onClick={() => setOpenFilter((o) => (o === "mission" ? null : "mission"))}
              >
                <span className={s.fdropLabel}>Mission</span>
                <span className={s.fdropVal}>{missionDisplayVal}</span>
                <span className={s.fdropChev}><ChevronDown size={12} strokeWidth={1.4} aria-hidden /></span>
              </button>
              <div className={s.fdropBody}>
                <div className={s.fdropInner}>
                  <div className={s.typeChipGrid}>
                    <button
                      type="button"
                      className={`${s.chip} ${view.mission === "" ? s.chipOn : ""}`}
                      onClick={() => { navigate({ ...view, mission: "", satellite: "" }); setOpenFilter(null); }}
                    >
                      All missions
                    </button>
                    {MISSION_ORDER.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`${s.chip} ${view.mission === m ? s.chipOn : ""}`}
                        onClick={() => { navigate({ ...view, mission: m, satellite: "" }); setOpenFilter(null); }}
                      >
                        {MISSION_DISPLAY[m]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Satellite fdrop */}
            <div
              className={`${s.fdrop} ${openFilter === "satellite" ? s.fdropOpen : ""} ${satelliteDisabled ? s.fdropDisabled : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openFilter === "satellite"}
                disabled={satelliteDisabled}
                title={satelliteDisabled ? "Sentinel-5P has a single satellite" : undefined}
                onClick={() => !satelliteDisabled && setOpenFilter((o) => (o === "satellite" ? null : "satellite"))}
              >
                <span className={s.fdropLabel}>Satellite</span>
                <span className={s.fdropVal}>{satDisplayVal}</span>
                <span className={s.fdropChev}><ChevronDown size={12} strokeWidth={1.4} aria-hidden /></span>
              </button>
              <div className={s.fdropBody}>
                <div className={s.fdropInner}>
                  <div className={s.satChipGrid}>
                    <button
                      type="button"
                      className={`${s.chip} ${view.satellite === "" ? s.chipOn : ""}`}
                      onClick={() => { navigate({ ...view, satellite: "" }); setOpenFilter(null); }}
                    >
                      All
                    </button>
                    {satellites.map((sat) => (
                      <button
                        key={sat}
                        type="button"
                        className={`${s.chip} ${view.satellite === sat ? s.chipOn : ""}`}
                        onClick={() => {
                          const m = MISSION_ORDER.find((mid) => MISSIONS[mid].includes(sat)) ?? view.mission;
                          navigate({ ...view, satellite: sat, mission: m || "" });
                          setOpenFilter(null);
                        }}
                      >
                        {sat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className={`${s.inline} ${s.inlineSearch}`}>
              <Search size={13} aria-hidden />
              <input
                id="ef-search"
                className={s.inlineInput}
                type="search"
                placeholder="Search"
                aria-label="Search events"
                value={view.q}
                onChange={(e) => navigate({ ...view, q: e.target.value }, "replace")}
              />
            </div>

            {dirty && (
              <button
                type="button"
                className={s.reset}
                onClick={() => { navigate({ ...view, mission: "", satellite: "", categories: [...CATEGORIES], q: "" }); setOpenFilter(null); }}
              >
                <RotateCcw size={12} aria-hidden /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Calendar */}
        <div className={s.calRow}>
          <aside className={s.zodiac} aria-hidden>
            <svg key={sign} className={s.zodiacSvg} viewBox={ZODIAC_VIEW} focusable="false">
              <text className={s.zodiacLabel} x={0} y={-196} textAnchor="middle">{sign.toUpperCase()}</text>
              <g stroke="rgba(255,255,255,0.15)" fill="none" strokeWidth="1.5">
                <path
                  className={s.zodiacPath}
                  d={ZODIAC[sign]}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDuration: `${ZODIAC_STARS[sign].length * STAR_STEP_MS + STAR_FADE_MS}ms` }}
                />
              </g>
              <g className={s.zodiacStars}>
                {ZODIAC_STARS[sign].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={4} style={{ animationDelay: `${i * STAR_STEP_MS}ms` }} />
                ))}
              </g>
            </svg>
          </aside>

          <div className={s.calWrap}>
            <div className={s.dow} aria-hidden>{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
            <div className={s.grid} ref={gridRef}>{renderCells(false)}</div>
          </div>
        </div>
      </div>

      {/* Portal: zoom stage + drawer.
          Gated on panelDay (null on both server and client until the user opens a day), so the
          server and the first client render agree — no hydration mismatch. The close CSS
          transition completes before panelDay is cleared (via onPanelTransitionEnd). */}
      {panelDay !== null &&
        createPortal(
          <>
            {zoom && (
              <div
                className={`${s.page} ${s.stage} ${zoomOn ? s.stageOn : ""}`}
                onClick={close}
              >
                <button type="button" className={s.stageBack} onClick={close}>
                  <ChevronLeft size={15} aria-hidden /> Back to the month
                </button>
                <div
                  className={`${s.grid} ${s.stageGrid}`}
                  style={{
                    left: zoom.left,
                    top: zoom.top,
                    width: zoom.width,
                    transform: zoomOn
                      ? `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`
                      : "none",
                    "--k": zoom.scale,
                  } as CSSProperties}
                  onClick={(e) => e.stopPropagation()}
                  onTransitionEnd={(e) => {
                    if (e.target === e.currentTarget && e.propertyName === "transform" && !zoomOn) setZoom(null);
                  }}
                >
                  {renderCells(true)}
                </div>
              </div>
            )}

            <aside
              className={`${s.drawer} ${openDay !== null ? s.drawerOn : ""}`}
              aria-label="Event detail"
              aria-hidden={openDay === null}
              onTransitionEnd={onPanelTransitionEnd}
            >
              {data.selectedEvent ? (
                <EventDrawerContent event={data.selectedEvent} />
              ) : (
                <div className={s.drawerBody}>
                  <header className={s.ziHead}>
                    <span className={s.detailEyebrow}>Loading…</span>
                  </header>
                </div>
              )}
            </aside>
          </>,
          document.body,
        )}
    </div>
  );
}
