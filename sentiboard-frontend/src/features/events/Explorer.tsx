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
} from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
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
  type EventDatatake,
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
import {
  CATEGORY_COLOR,
  CATEGORY_SVG_INNER,
  STATUS_COLOR,
  STATUS_LABEL,
  CategoryIcon,
  classifyDatatake,
  classifyImpact,
  meanCompleteness,
} from "./event-types";
import s from "./events.module.css";

const SpaceBackdrop = dynamic(() => import("@/components/SpaceBackdrop"), { ssr: false });

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
/* How many event dots a day cell shows before collapsing the rest to "+N". */
const MARKS_SHOWN = 4;
const WEEKDAYS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
/* Show at most this many datatakes per event before the "+N more" button */
const DTK_SHOWN = 5;

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

function DatatakeRow({ dt }: { dt: EventDatatake }) {
  const status = classifyDatatake(dt);
  const statusColor = STATUS_COLOR[status];
  const label = STATUS_LABEL[status];
  const pct = meanCompleteness(dt);
  const levels = [
    dt.L0 !== null ? `L0: ${dt.L0.toFixed(1)}%` : null,
    dt.L1 !== null ? `L1: ${dt.L1.toFixed(1)}%` : null,
    dt.L2 !== null ? `L2: ${dt.L2.toFixed(1)}%` : null,
  ].filter(Boolean);
  return (
    <div className={s.dtkRow}>
      <span className={s.dtkLeft}>
        <span className={s.dtkId}>
          <i style={{ background: statusColor, display: "inline-block", width: 9, height: 9, borderRadius: "50%" }} aria-hidden />
          <span className={s.dtkLink}>{dt.datatakeId}</span>
        </span>
        {status !== "noData" ? (
          <span className={s.dtkProd}>{levels.join("  ")}</span>
        ) : (
          <span className={s.dtkProd} style={{ color: "var(--mf-faint)" }}>no data</span>
        )}
      </span>
      <span className={s.dtkRight}>
        <b style={{ color: statusColor }}>{label}</b>
        {pct !== null && <span>{pct.toFixed(0)}%</span>}
      </span>
    </div>
  );
}

/** All events of the selected day, all expanded.
 *  Selected event at full opacity; others dimmed (0.42, 0.8 on hover).
 *  Clicking a dimmed occurrence selects it.
 *  Datatakes: show at most DTK_SHOWN per event, then "+N more" / "Show less". */
function DayManifest({
  dayEvents,
  selectedId,
  onSelect,
}: {
  dayEvents: EventDetail[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const selectedRef = useRef<HTMLDivElement>(null);
  const [expandedDtk, setExpandedDtk] = useState<Set<string>>(new Set());

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (dayEvents.length === 0) return null;

  const totalDatatakes = dayEvents.reduce((n, e) => n + e.datatakes.length, 0);
  const unavailable = dayEvents.reduce(
    (n, e) => n + e.datatakes.filter((dt) => dt.noData).length,
    0,
  );

  return (
    <div className={s.drawerBody}>
      <header className={s.ziHead}>
        <span className={s.detailEyebrow}>Selected day</span>
        <h2 className={s.ziDate}>{dayHeading(dayEvents[0].startDate)}</h2>
        <span className={s.ziSum}>
          {dayEvents.length} occurrence{dayEvents.length === 1 ? "" : "s"}{" "}
          · {totalDatatakes} datatake{totalDatatakes === 1 ? "" : "s"}{" "}
          · {unavailable} unavailable
        </span>
      </header>

      {dayEvents.map((event, i) => {
        const isSelected = event.id === selectedId;
        const color = CATEGORY_COLOR[event.category];
        const impactStatus = classifyImpact(event.datatakes);
        const impactColor = STATUS_COLOR[impactStatus];
        const unavailableCount = event.datatakes.filter((dt) => dt.noData).length;

        const isExpanded = expandedDtk.has(event.id);
        const shownDtk = isExpanded ? event.datatakes : event.datatakes.slice(0, DTK_SHOWN);
        const hiddenDtkCount = event.datatakes.length - DTK_SHOWN;

        return (
          <div
            key={event.id}
            className={`${s.ziOcc} ${isSelected ? s.ziOccSelected : s.ziOccDim}`}
            style={{ animationDelay: `${280 + i * 130}ms` }}
            ref={isSelected ? selectedRef : undefined}
          >
            <button
              type="button"
              className={s.ziTop}
              onClick={() => onSelect(event.id)}
            >
              <span className={s.ziTime}>{event.startTime}</span>
              <span>
                <span className={s.ziTitle}>{event.title}</span>
                <span className={s.ziSub}>
                  <CategoryIcon category={event.category} color={color} size={13} />
                  {event.category} · {event.satellite}
                </span>
              </span>
              <span className={s.ziDot} style={{ background: impactColor }} />
            </button>

            {event.impactedItem && (
              <div style={{ marginTop: 14, paddingBottom: 12, borderBottom: "1px solid var(--mf-line)" }}>
                <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mf-faint)" }}>Impacted item</span>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 500 }}>{event.impactedItem}</div>
              </div>
            )}

            {event.newsLink && (
              <div style={{ marginTop: 12, paddingBottom: 12, borderBottom: "1px solid var(--mf-line)" }}>
                <a href={event.newsLink} target="_blank" rel="noopener noreferrer" className={s.dtkLink}>
                  {event.newsTitle ?? "News article"} ↗
                </a>
              </div>
            )}

            {event.textSegments.length > 0 && (
              <details className={s.ziDesc}>
                <summary className={s.ziDescToggle}>
                  Description
                  <ChevronDown size={11} className={s.ziDescChev} aria-hidden />
                </summary>
                <p style={{ fontSize: 13, lineHeight: 1.65, color: "var(--mf-muted)", marginTop: 10 }}>
                  {renderSegments(event.textSegments)}
                </p>
              </details>
            )}

            {event.datatakes.length > 0 && (
              <section style={{ marginTop: 4 }}>
                <div className={s.ziDtkHead}>
                  Impacted datatakes · {event.datatakes.length}
                  {unavailableCount > 0 ? ` · ${unavailableCount} unavailable` : ""}
                  {/* Note: "+N more → Data Availability" link comes in legacy-parity pass */}
                </div>
                {shownDtk.map((dt) => <DatatakeRow key={dt.datatakeId} dt={dt} />)}
                {!isExpanded && hiddenDtkCount > 0 && (
                  <button
                    type="button"
                    className={s.dtkMoreBtn}
                    onClick={() => setExpandedDtk((prev) => new Set([...prev, event.id]))}
                  >
                    +{hiddenDtkCount} more
                  </button>
                )}
                {isExpanded && hiddenDtkCount > 0 && (
                  <button
                    type="button"
                    className={s.dtkMoreBtn}
                    onClick={() =>
                      setExpandedDtk((prev) => {
                        const next = new Set(prev);
                        next.delete(event.id);
                        return next;
                      })
                    }
                  >
                    Show less
                  </button>
                )}
              </section>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---- star dot (three concentric circles + optional type icon) ---- */

function StarDot({
  color,
  category,
  withIcon,
}: {
  color: string;
  category: EventCategory;
  withIcon: boolean;
}) {
  const r = 3.5;
  const cx = 17, cy = 17;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden>
      <circle cx={cx} cy={cy} r={r * 3.8} fill={color} opacity={0.1} />
      <circle cx={cx} cy={cy} r={r * 2} fill={color} opacity={0.2} />
      <circle className={s.starCore} cx={cx} cy={cy} r={r} fill={color} />
      {withIcon && (
        <g
          className={s.zicon}
          transform={`translate(${(cx + r * 2.4).toFixed(1)} ${(cy - 7.5).toFixed(1)})`}
          stroke={color}
          strokeWidth="1.3"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          dangerouslySetInnerHTML={{ __html: CATEGORY_SVG_INNER[category] }}
        />
      )}
    </svg>
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

/* ---- tip state ---- */

type TipState = { category: EventCategory; events: EventCard[]; x: number; y: number } | null;

/* ---- Explorer data type ---- */

export type ExplorerData =
  | {
      ok: true;
      /** ALL events (compact) for client-side filtering and month navigation. */
      cards: EventCard[];
      /** Full details for every event on the selected day (empty when no event is in the URL). */
      dayEvents: EventDetail[];
      /** The URL-selected event id, highlighted and scrolled into view in the drawer. */
      selectedEventId: string | null;
      /** Current UTC year/month computed dynamically on the server (not from cache). */
      now: { year: number; month: number };
    }
  | { ok: false; unreachable: boolean; message: string; now: { year: number; month: number } };

/* ---- main component ---- */

export default function Explorer({ data }: { data: ExplorerData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [view, setView] = useState<EventsView>(() =>
    resolveView(parseView(searchParams, data.now), data.ok ? data.cards : []),
  );

  // Drawer state
  const [openDay, setOpenDay] = useState<number | null>(() => {
    if (!data.ok || data.dayEvents.length === 0) return null;
    return new Date(data.dayEvents[0].startDate + "T00:00:00Z").getUTCDate();
  });
  const [zoom, setZoom] = useState<ZoomGeom | null>(null);
  const [zoomOn, setZoomOn] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Tooltip state (null = hidden)
  const [tip, setTip] = useState<TipState>(null);

  // Filter accordion open state
  const [openFilter, setOpenFilter] = useState<"type" | "mission" | "satellite" | null>(null);

  // Navigate: update local state AND URL
  const navigate = useCallback(
    (next: EventsView, mode: "push" | "replace" = "push") => {
      setView(next);
      const qs = viewParams(next, data.now).toString();
      const href = qs ? `${EVENTS_PATH}?${qs}` : EVENTS_PATH;
      if (mode === "push") history.pushState(null, "", href);
      else history.replaceState(null, "", href);
    },
    [data],
  );

  // Event selection → router.push so the server renders the EventDetail
  const selectEventId = useCallback(
    (id: string) => {
      const next = { ...view, event: id };
      setView(next);
      startTransition(() => {
        router.push(viewHref(next, data.now), { scroll: false });
      });
    },
    [view, router, data],
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

  // One group per event TYPE per day, ordered by the canonical CATEGORIES list.
  const byDayByType = useMemo(() => {
    const map = new Map<number, { category: EventCategory; events: EventCard[] }[]>();
    byDay.forEach((events, day) => {
      const grouped = new Map<EventCategory, EventCard[]>();
      for (const event of events) {
        const list = grouped.get(event.category) ?? [];
        list.push(event);
        grouped.set(event.category, list);
      }
      map.set(
        day,
        CATEGORIES.filter((c) => grouped.has(c)).map((c) => ({ category: c, events: grouped.get(c)! })),
      );
    });
    return map;
  }, [byDay]);

  const cells = useMemo(() => calendarCells(view.year, view.month), [view.year, view.month]);

  // Open a specific event by day + eventId
  const selectDayEvent = useCallback(
    (day: number, eventId: string) => {
      const events = byDay.get(day) ?? [];
      if (events.length === 0) return;
      const geom = gridRef.current ? measureZoom(gridRef.current, day) : null;
      if (!geom) return;
      if (openDay === null) setZoomOn(false);
      setZoom(geom);
      setOpenDay(day);
      selectEventId(eventId);
    },
    [byDay, openDay, selectEventId],
  );

  // Close drawer: also clears event from view and URL so filter changes don't re-open the zoom.
  const close = useCallback(() => {
    setOpenDay(null);
    setZoomOn(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setZoom(null);
    setView((prev) => (prev.event ? { ...prev, event: null } : prev));
    const sp = new URLSearchParams(window.location.search);
    if (sp.has("event")) {
      sp.delete("event");
      const qs = sp.toString();
      history.replaceState(null, "", qs ? `${EVENTS_PATH}?${qs}` : EVENTS_PATH);
    }
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
      if (events[0]) selectEventId(events[0].id);
    },
    [byDay, openDay, selectEventId],
  );

  // Sync view and drawer when the URL changes through external navigation
  const hasMounted = useRef(false);
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return; }
    const newView = resolveView(
      parseView(searchParams, data.now),
      data.ok ? data.cards : [],
    );
    /* eslint-disable react-hooks/set-state-in-effect */
    setView(newView);
    if (!newView.event) {
      setOpenDay(null);
      setZoomOn(false);
    } else if (data.ok && data.dayEvents.length > 0) {
      const day = new Date(data.dayEvents[0].startDate + "T00:00:00Z").getUTCDate();
      setOpenDay(day);
      const geom = gridRef.current ? measureZoom(gridRef.current, day) : null;
      setZoom(null);
      if (geom) setZoom(geom);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // For deep-linked events, initialise zoom on mount when openDay is already set.
  useEffect(() => {
    if (openDay === null || zoom !== null) return;
    const geom = gridRef.current ? measureZoom(gridRef.current, openDay) : null;
    if (geom) setZoom(geom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Hide tooltip when zoom opens
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (openDay !== null) setTip(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [openDay]);

  // Metrics computed from the filtered events in the current month
  const datatakesInScope = useMemo(
    () => monthEvents.reduce((n, e) => n + e.datatakeCount, 0),
    [monthEvents],
  );
  const lostDatatakes = useMemo(
    () => monthEvents.reduce((n, e) => n + e.lostDatatakeCount, 0),
    [monthEvents],
  );

  // All hooks above this line. Early-return for the degraded state.
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

  /* ---- filter derived state ---- */

  // Satellites visible = those belonging to missions that are ON
  const visibleSats = MISSION_ORDER
    .filter((m) => !view.missionsOff.has(m))
    .flatMap((m) => MISSIONS[m]);
  const visibleSatsOnCount = visibleSats.filter((sat) => !view.satellitesOff.has(sat)).length;

  const typeOnCount = CATEGORIES.length - view.typesOff.size;
  const typeDisplayVal = view.typesOff.size === 0 ? "All" : `${typeOnCount}/${CATEGORIES.length}`;

  const missionOnCount = MISSION_ORDER.length - view.missionsOff.size;
  const missionDisplayVal = view.missionsOff.size === 0 ? "All" : `${missionOnCount}/${MISSION_ORDER.length}`;

  const satDisplayVal =
    visibleSatsOnCount === visibleSats.length
      ? "All"
      : `${visibleSatsOnCount}/${visibleSats.length}`;

  const satelliteDisabled = visibleSats.length < 2;

  const dirty =
    view.typesOff.size > 0 ||
    view.missionsOff.size > 0 ||
    view.satellitesOff.size > 0 ||
    !!view.q;

  const satellitesMonitored = new Set(monthEvents.map((e) => e.satellite)).size;

  /* ---- calendar cell rendering ---- */

  const renderCells = (zoomed: boolean) =>
    cells.map((c, i) => {
      const pos = skyCell(i);
      if (c.dim)
        return (
          <div key={`dim-${i}`} className={`${s.cell} ${s.cellDim}`} data-col={pos.col} data-row={pos.row} aria-hidden />
        );
      const events = byDay.get(c.day) ?? [];
      const groups = byDayByType.get(c.day) ?? [];
      const shownGroups = groups.slice(0, MARKS_SHOWN);
      const hiddenCount = groups.length - shownGroups.length;
      const totalItems = shownGroups.length + (hiddenCount > 0 ? 1 : 0);

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
              : undefined
          }
        >
          <span className={s.cellNum}>{pad(c.day)}</span>
          {shownGroups.length > 0 && (
            <>
              {shownGroups.map((group, idx) => {
                const color = CATEGORY_COLOR[group.category];
                const leftPct = (idx - (totalItems - 1) / 2) * 27;
                const n = group.events.length;
                const ariaLabel = `${group.category}, ${n} event${n === 1 ? "" : "s"}: ${group.events.map((e) => e.title).join(", ")}`;
                return (
                  <button
                    key={group.category}
                    type="button"
                    className={s.starBtn}
                    style={{ left: `calc(50% + ${leftPct}%)`, top: "60%" }}
                    aria-label={ariaLabel}
                    onClick={(evt) => {
                      evt.stopPropagation();
                      if (zoomed && selected) {
                        close();
                      } else if (!zoomed) {
                        selectDayEvent(c.day, group.events[0]!.id);
                      }
                    }}
                    onMouseMove={!zoomed ? (e) => setTip({ category: group.category, events: group.events, x: e.clientX, y: e.clientY }) : undefined}
                    onMouseLeave={!zoomed ? () => setTip(null) : undefined}
                    onFocus={!zoomed ? (e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTip({ category: group.category, events: group.events, x: r.left + r.width / 2, y: r.top });
                    } : undefined}
                    onBlur={!zoomed ? () => setTip(null) : undefined}
                  >
                    <StarDot color={color} category={group.category} withIcon={zoomed} />
                  </button>
                );
              })}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  className={`${s.starBtn} ${s.markMoreBtn}`}
                  style={{ left: `calc(50% + ${(shownGroups.length - (totalItems - 1) / 2) * 27}%)`, top: "60%" }}
                  onClick={(evt) => { evt.stopPropagation(); if (zoomed) close(); else selectDay(c.day); }}
                  aria-label={`+${hiddenCount} more type${hiddenCount > 1 ? "s" : ""}`}
                >
                  <em className={s.markMore}>+{hiddenCount}</em>
                </button>
              )}
            </>
          )}
        </div>
      );
    });

  /* ---- tooltip ---- */

  const tipFlip = tip !== null && tip.x > window.innerWidth - 230;
  const tipLeft = tip !== null ? tip.x + (tipFlip ? -18 : 18) : 0;
  const tipTop = tip !== null ? tip.y - 16 : 0;

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

        {/* Month navigation + filter accordions.
            When any filter is active (dirty), the month nav wraps to its own row above the filters. */}
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

            {/* Invisible overlay: intercepts outside-clicks when a dropdown is open, preventing
                them from reaching calendar dots. Sits above the calendar (z 98) but below the
                monthBar (z 99), which contains the fdrop elements. */}
            {openFilter && (
              <div
                className={s.fdropOverlay}
                onClick={() => setOpenFilter(null)}
                aria-hidden
              />
            )}

            {/* Event type fdrop — multi-select toggle, no "All" item */}
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
                  {CATEGORIES.map((c) => {
                    const isOff = view.typesOff.has(c);
                    const color = isOff ? "#8A96A6" : CATEGORY_COLOR[c];
                    return (
                      <button
                        key={c}
                        type="button"
                        className={`${s.ftypeItem} ${isOff ? s.filterItemOff : ""}`}
                        style={{ color }}
                        aria-pressed={!isOff}
                        onClick={() => {
                          const next = new Set(view.typesOff);
                          if (isOff) next.delete(c); else next.add(c);
                          navigate({ ...view, typesOff: next, event: null });
                        }}
                      >
                        <CategoryIcon category={c} color={color} size={14} />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Mission fdrop — multi-select toggle */}
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
                  {MISSION_ORDER.map((m) => {
                    const isOff = view.missionsOff.has(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        className={`${s.fmisItem} ${isOff ? s.filterItemOff : ""}`}
                        aria-pressed={!isOff}
                        onClick={() => {
                          const next = new Set(view.missionsOff);
                          if (isOff) next.delete(m); else next.add(m);
                          navigate({ ...view, missionsOff: next, event: null });
                        }}
                      >
                        {MISSION_DISPLAY[m]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Satellite fdrop — multi-select toggle, codes in wrapping row */}
            <div
              className={`${s.fdrop} ${openFilter === "satellite" ? s.fdropOpen : ""} ${satelliteDisabled ? s.fdropDisabled : ""}`}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openFilter === "satellite"}
                disabled={satelliteDisabled}
                title={satelliteDisabled ? "No satellite choice available" : undefined}
                onClick={() => !satelliteDisabled && setOpenFilter((o) => (o === "satellite" ? null : "satellite"))}
              >
                <span className={s.fdropLabel}>Satellite</span>
                <span className={s.fdropVal}>{satDisplayVal}</span>
                <span className={s.fdropChev}><ChevronDown size={12} strokeWidth={1.4} aria-hidden /></span>
              </button>
              <div className={s.fdropBody}>
                <div className={s.fdropInner}>
                  <div className={s.fsatRow}>
                    {visibleSats.map((sat) => {
                      const isOff = view.satellitesOff.has(sat);
                      return (
                        <button
                          key={sat}
                          type="button"
                          className={`${s.fsatItem} ${isOff ? s.filterItemOff : ""}`}
                          aria-pressed={!isOff}
                          onClick={() => {
                            const next = new Set(view.satellitesOff);
                            if (isOff) next.delete(sat); else next.add(sat);
                            navigate({ ...view, satellitesOff: next, event: null });
                          }}
                        >
                          {sat}
                        </button>
                      );
                    })}
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
                onChange={(e) => navigate({ ...view, q: e.target.value, event: null }, "replace")}
              />
            </div>

          </div>
          {dirty && (
            <button
              type="button"
              className={s.reset}
              onClick={() => {
                navigate({
                  ...view,
                  typesOff: new Set(),
                  missionsOff: new Set(),
                  satellitesOff: new Set(),
                  q: "",
                  event: null,
                });
                setOpenFilter(null);
              }}
            >
              <RotateCcw size={12} aria-hidden /> Reset
            </button>
          )}
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

      {/* Zoom stage */}
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

      {/* Drawer */}
      <aside
        className={`${s.drawer} ${openDay !== null ? s.drawerOn : ""}`}
        aria-label="Event detail"
        aria-hidden={openDay === null}
        inert={openDay === null}
      >
        {(() => {
          if (!data.ok) return null;
          const drawerMatchesDay =
            data.dayEvents.length > 0 &&
            new Date(data.dayEvents[0].startDate + "T00:00:00Z").getUTCDate() === openDay;
          if (drawerMatchesDay)
            return (
              <DayManifest
                dayEvents={data.dayEvents}
                selectedId={data.selectedEventId}
                onSelect={selectEventId}
              />
            );
          if (openDay !== null)
            return (
              <div className={s.drawerBody}>
                <header className={s.ziHead}>
                  <span className={s.detailEyebrow}>Loading…</span>
                </header>
              </div>
            );
          return null;
        })()}
      </aside>

      {/* Hover tooltip — only shown on hover-capable devices */}
      {tip && (
        <div
          className={s.tipEl}
          style={{
            left: tipLeft,
            top: tipTop,
            transform: tipFlip ? "translateX(calc(-100% - 28px))" : undefined,
          }}
          aria-hidden
        >
          <CategoryIcon category={tip.category} color={CATEGORY_COLOR[tip.category]} size={14} />
          <span className={s.tipTxt}>
            <span className={s.tipType} style={{ color: CATEGORY_COLOR[tip.category] }}>
              {tip.category}{" · "}{tip.events.length === 1 ? tip.events[0]!.satellite : `${tip.events.length} events`}
            </span>
            {tip.events.slice(0, 3).map((e, i) => (
              <span key={i} className={s.tipName}>{e.title} · {e.satellite}</span>
            ))}
            {tip.events.length > 3 && (
              <span className={s.tipName} style={{ color: "var(--mf-faint)" }}>+{tip.events.length - 3} more</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
