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
import { createPortal } from "react-dom";
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

/* ---- constellation of the month (index 0 = January; points as fractions of a 380×300 box) ---- */

const CONSTELLATIONS: Array<{ n: string; p: [number, number][]; e: [number, number][] }> = [
  {
    n: "Capricornus",
    p: [[0.1,0.22],[0.31,0.09],[0.56,0.16],[0.78,0.34],[0.88,0.62],[0.6,0.82],[0.34,0.74],[0.17,0.5]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]],
  },
  {
    n: "Aquarius",
    p: [[0.12,0.26],[0.33,0.14],[0.54,0.29],[0.76,0.17],[0.88,0.44],[0.66,0.56],[0.49,0.74],[0.28,0.88]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]],
  },
  {
    n: "Pisces",
    p: [[0.08,0.16],[0.26,0.34],[0.44,0.52],[0.63,0.63],[0.82,0.7],[0.9,0.48],[0.8,0.28],[0.3,0.78]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[2,7]],
  },
  {
    n: "Aries",
    p: [[0.16,0.62],[0.4,0.46],[0.64,0.37],[0.86,0.42],[0.52,0.22]],
    e: [[0,1],[1,2],[2,3],[2,4]],
  },
  {
    n: "Taurus",
    p: [[0.12,0.3],[0.34,0.46],[0.52,0.56],[0.72,0.42],[0.9,0.26],[0.5,0.78],[0.3,0.7]],
    e: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]],
  },
  {
    n: "Gemini",
    p: [[0.24,0.12],[0.29,0.36],[0.34,0.6],[0.3,0.84],[0.62,0.14],[0.67,0.38],[0.72,0.62],[0.68,0.86]],
    e: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[1,5]],
  },
  {
    n: "Cancer",
    p: [[0.18,0.2],[0.46,0.42],[0.46,0.66],[0.74,0.22],[0.56,0.88]],
    e: [[0,1],[1,3],[1,2],[2,4]],
  },
  {
    n: "Leo",
    p: [[0.16,0.32],[0.29,0.15],[0.47,0.19],[0.54,0.38],[0.41,0.51],[0.64,0.63],[0.88,0.55],[0.8,0.82]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,5]],
  },
  {
    n: "Virgo",
    p: [[0.12,0.24],[0.34,0.36],[0.56,0.29],[0.74,0.46],[0.59,0.62],[0.4,0.74],[0.86,0.74]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[3,6]],
  },
  {
    n: "Libra",
    p: [[0.24,0.3],[0.51,0.16],[0.76,0.32],[0.64,0.58],[0.34,0.62]],
    e: [[0,1],[1,2],[2,3],[0,4]],
  },
  {
    n: "Scorpius",
    p: [[0.1,0.22],[0.28,0.3],[0.45,0.3],[0.56,0.46],[0.64,0.64],[0.75,0.78],[0.88,0.8],[0.92,0.62]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]],
  },
  {
    n: "Sagittarius",
    p: [[0.18,0.46],[0.34,0.3],[0.53,0.35],[0.64,0.53],[0.48,0.64],[0.28,0.61],[0.8,0.42],[0.74,0.72]],
    e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[2,6],[3,7]],
  },
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
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
    (n, e) => n + e.datatakes.filter((dt) => classifyDatatake(dt) === "lost").length,
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
          · {unavailable} unavailable{" "}
          · times in UTC
        </span>
      </header>

      {dayEvents.map((event, i) => {
        const isSelected = event.id === selectedId;
        const color = CATEGORY_COLOR[event.category];
        const impactStatus = classifyImpact(event.datatakes);
        const impactColor = STATUS_COLOR[impactStatus];
        const unavailableCount = event.datatakes.filter((dt) => classifyDatatake(dt) === "lost").length;

        const isExpanded = expandedDtk.has(event.id);
        const shownDtk = isExpanded ? event.datatakes : event.datatakes.slice(0, DTK_SHOWN);
        const hiddenDtkCount = event.datatakes.length - DTK_SHOWN;

        return (
          <div
            key={event.id}
            className={`${s.ziOcc} ${isSelected ? s.ziOccSelected : s.ziOccDim}`}
            style={{ animationDelay: `${280 + i * 130}ms` }}
            ref={isSelected ? selectedRef : undefined}
            onClick={!isSelected ? () => onSelect(event.id) : undefined}
          >
            <button
              type="button"
              className={s.ziTop}
              onClick={(e) => { e.stopPropagation(); onSelect(event.id); }}
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

            <section style={{ marginTop: 4 }}>
              <div className={s.ziDtkHead}>
                Impacted datatakes · {event.datatakes.length}
                {unavailableCount > 0 ? ` · ${unavailableCount} unavailable` : ""}
              </div>
              {event.datatakes.length === 0 ? (
                <p className={s.emptyDetail}>No impacted datatakes recorded</p>
              ) : (
                <>
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
                </>
              )}
            </section>
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
  const r = 4;
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
  // Frozen snapshot rendered during the drawer's fade-out so it never goes blank
  const [drawerSnap, setDrawerSnap] = useState<{ dayEvents: EventDetail[]; selectedId: string | null } | null>(() => {
    if (!data.ok || data.dayEvents.length === 0) return null;
    return { dayEvents: data.dayEvents, selectedId: data.selectedEventId };
  });
  const [zoom, setZoom] = useState<ZoomGeom | null>(null);
  const [zoomOn, setZoomOn] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Tooltip state (null = hidden)
  const [tip, setTip] = useState<TipState>(null);

  // Filter accordion open state
  const [openFilter, setOpenFilter] = useState<"type" | "mission" | "satellite" | null>(null);
  const filterBtnRefs = useRef<Partial<Record<"type" | "mission" | "satellite", HTMLButtonElement | null>>>({});
  const fdropRefs = useRef<Partial<Record<"type" | "mission" | "satellite", HTMLDivElement | null>>>({});

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

  // Close open filter on outside pointerdown (lets subsequent calendar clicks through normally)
  useEffect(() => {
    if (openFilter === null) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = fdropRefs.current[openFilter];
      if (el && !el.contains(e.target as Node)) setOpenFilter(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openFilter]);

  // Escape closes open filter first, then drawer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openFilter !== null) {
        const btn = filterBtnRefs.current[openFilter];
        setOpenFilter(null);
        btn?.focus();
      } else if (openDay !== null) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay, openFilter, close]);

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

  // Keep drawer snapshot in sync: update when fresh server data arrives for the open day
  useEffect(() => {
    if (!data.ok || data.dayEvents.length === 0) return;
    const day = new Date(data.dayEvents[0].startDate + "T00:00:00Z").getUTCDate();
    if (day === openDay) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setDrawerSnap({ dayEvents: data.dayEvents, selectedId: data.selectedEventId });
      /* eslint-enable react-hooks/set-state-in-effect */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

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

  const con = CONSTELLATIONS[view.month - 1];
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
      const overflow = groups.length - MARKS_SHOWN;
      const shownGroups = overflow > 0 ? groups.slice(0, MARKS_SHOWN - 1) : groups;
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
                    onMouseMove={(e) => setTip({ category: group.category, events: group.events, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTip(null)}
                    onFocus={(e) => {
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setTip({ category: group.category, events: group.events, x: r.left + r.width / 2, y: r.top });
                    }}
                    onBlur={() => setTip(null)}
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

            {/* Event type fdrop — multi-select toggle, no "All" item */}
            <div
              className={`${s.fdrop} ${openFilter === "type" ? s.fdropOpen : ""}`}
              ref={(el) => { fdropRefs.current["type"] = el; }}
            >
              <button
                type="button"
                ref={(el) => { filterBtnRefs.current["type"] = el; }}
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
              ref={(el) => { fdropRefs.current["mission"] = el; }}
            >
              <button
                type="button"
                ref={(el) => { filterBtnRefs.current["mission"] = el; }}
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
              ref={(el) => { fdropRefs.current["satellite"] = el; }}
            >
              <button
                type="button"
                ref={(el) => { filterBtnRefs.current["satellite"] = el; }}
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
            <svg
              key={view.month}
              className={s.zodiacSvg}
              viewBox="0 -44 380 344"
              focusable="false"
            >
              {con.e.map(([a, b], i) => (
                <path
                  key={i}
                  className={s.conLine}
                  d={`M${(con.p[a][0] * 380).toFixed(1)} ${(con.p[a][1] * 300).toFixed(1)} L${(con.p[b][0] * 380).toFixed(1)} ${(con.p[b][1] * 300).toFixed(1)}`}
                  pathLength={1}
                  vectorEffect="non-scaling-stroke"
                  style={{ animationDelay: `${1400 + i * 110}ms` }}
                />
              ))}
              {con.p.map(([px, py], i) => (
                <g key={i} className={s.conStar} style={{ animationDelay: `${i * 120}ms` }}>
                  <circle cx={(px * 380).toFixed(1)} cy={(py * 300).toFixed(1)} r={9} fill="var(--con-halo)" opacity={0.16} />
                  <circle cx={(px * 380).toFixed(1)} cy={(py * 300).toFixed(1)} r={3.2} fill="var(--con-core)" />
                </g>
              ))}
              <text className={s.conLabel} x={190} y={-20} textAnchor="middle">
                {con.n.toUpperCase()}
              </text>
            </svg>
          </aside>

          <div className={s.calWrap}>
            <div className={s.dow} aria-hidden>{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
            <div className={s.grid} ref={gridRef}>{renderCells(false)}</div>
          </div>
        </div>
        <div style={{ height: "clamp(150px, 20vh, 300px)" }} aria-hidden />
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
        onTransitionEnd={(e: React.TransitionEvent<HTMLElement>) => {
          if (e.target === e.currentTarget && e.propertyName === "opacity" && openDay === null) {
            setDrawerSnap(null);
          }
        }}
      >
        {(() => {
          if (drawerSnap) {
            return (
              <DayManifest dayEvents={drawerSnap.dayEvents} selectedId={drawerSnap.selectedId} onSelect={selectEventId} />
            );
          }
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

      {/* Hover tooltip — portalled to body so it appears above the zoom stage */}
      {tip && typeof document !== "undefined" && createPortal(
        <div
          className={s.tipEl}
          style={{
            left: tipLeft,
            top: tipTop,
            transform: tipFlip ? "translateX(calc(-100% - 28px))" : undefined,
            zIndex: 10000,
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
        </div>,
        document.body,
      )}
    </div>
  );
}
