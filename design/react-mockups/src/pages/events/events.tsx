import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TransitionEvent,
} from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from "lucide-react";
import { PageHeader } from "@/components/ui";
import {
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_SVG_PATHS,
  COMPLETENESS,
  EMPTY_FILTERS,
  EVENTS,
  MISSIONS,
  MISSION_NAMES,
  STATUS_ORDER,
  WEEKDAYS,
  YEAR,
  calendarCells,
  completenessLabel,
  sensingWindow,
  eventStatus,
  eventsInMonth,
  filterEvents,
  groupByDay,
  marksLoss,
  type Datatake,
  type EventCategory,
  type Filters,
  type ManifestEvent,
  type Status,
} from "./mock";
import { Collapse, DescriptionModal } from "@/components/ui";
import s from "./events.module.css";
import {
  AmbientSky,
  MotionToggle,
  ambientRoot,
  useAmbientMotion,
} from "@/components/ambient-motion";
import SpaceBackdrop from "@/components/SpaceBackdrop";

/* ---------- sky: constellation of the month ----------
 * Straight-edge constellations from the reference (events-prototype-ref.md).
 * Points p are fractions of a 380×300 box; e lists edges between point indexes.
 * Index 0 = January, matching SIGN_BY_MONTH order. */
type Constellation = {
  n: string;
  p: [number, number][];
  e: [number, number][];
};

const CONSTELLATIONS: Constellation[] = [
  { n: "Capricornus", p: [[0.1,0.22],[0.31,0.09],[0.56,0.16],[0.78,0.34],[0.88,0.62],[0.6,0.82],[0.34,0.74],[0.17,0.5]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,0]] },
  { n: "Aquarius",    p: [[0.12,0.26],[0.33,0.14],[0.54,0.29],[0.76,0.17],[0.88,0.44],[0.66,0.56],[0.49,0.74],[0.28,0.88]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  { n: "Pisces",      p: [[0.08,0.16],[0.26,0.34],[0.44,0.52],[0.63,0.63],[0.82,0.7],[0.9,0.48],[0.8,0.28],[0.3,0.78]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[2,7]] },
  { n: "Aries",       p: [[0.16,0.62],[0.4,0.46],[0.64,0.37],[0.86,0.42],[0.52,0.22]], e: [[0,1],[1,2],[2,3],[2,4]] },
  { n: "Taurus",      p: [[0.12,0.3],[0.34,0.46],[0.52,0.56],[0.72,0.42],[0.9,0.26],[0.5,0.78],[0.3,0.7]], e: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]] },
  { n: "Gemini",      p: [[0.24,0.12],[0.29,0.36],[0.34,0.6],[0.3,0.84],[0.62,0.14],[0.67,0.38],[0.72,0.62],[0.68,0.86]], e: [[0,1],[1,2],[2,3],[4,5],[5,6],[6,7],[1,5]] },
  { n: "Cancer",      p: [[0.18,0.2],[0.46,0.42],[0.46,0.66],[0.74,0.22],[0.56,0.88]], e: [[0,1],[1,3],[1,2],[2,4]] },
  { n: "Leo",         p: [[0.16,0.32],[0.29,0.15],[0.47,0.19],[0.54,0.38],[0.41,0.51],[0.64,0.63],[0.88,0.55],[0.8,0.82]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,5]] },
  { n: "Virgo",       p: [[0.12,0.24],[0.34,0.36],[0.56,0.29],[0.74,0.46],[0.59,0.62],[0.4,0.74],[0.86,0.74]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[3,6]] },
  { n: "Libra",       p: [[0.24,0.3],[0.51,0.16],[0.76,0.32],[0.64,0.58],[0.34,0.62]], e: [[0,1],[1,2],[2,3],[0,4]] },
  { n: "Scorpius",    p: [[0.1,0.22],[0.28,0.3],[0.45,0.3],[0.56,0.46],[0.64,0.64],[0.75,0.78],[0.88,0.8],[0.92,0.62]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  { n: "Sagittarius", p: [[0.18,0.46],[0.34,0.3],[0.53,0.35],[0.64,0.53],[0.48,0.64],[0.28,0.61],[0.8,0.42],[0.74,0.72]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[2,6],[3,7]] },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "August 2026" for a 1-based month. */
function monthLabel(month: number) {
  return `${MONTH_NAMES[month - 1]} ${YEAR}`;
}

/** "09 SEPTEMBER 2026" for a day of a 1-based month, as the detail header sets it. */
function dayHeading(day: number, month: number) {
  return `${String(day).padStart(2, "0")} ${MONTH_NAMES[month - 1].toUpperCase()} ${YEAR}`;
}

type ZoomGeom = {
  left: number;
  top: number;
  width: number;
  scale: number;
  tx: number;
  ty: number;
};

/** Where the zoomed grid copy starts (the real grid's viewport rect) and the translate/scale that
 *  puts `day`'s cell in the middle of the area the drawer leaves free. transform-origin is 0 0, so
 *  a local point p lands at left + tx + scale·p. */
function measureZoom(grid: HTMLElement, day: number): ZoomGeom | null {
  const cell = grid.querySelector<HTMLElement>(`[data-day="${day}"]`);
  if (!cell) return null;
  const g = grid.getBoundingClientRect();
  const c = cell.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // The reference's camera (targetBox in SentiBoard.html): the view spans 1.8 cells on its tighter
  // axis, and the day sits at 30% of the width so the manifest has the right side to itself. Below
  // 900px the manifest rises from the bottom instead, so the day moves up to 24% of the height.
  const wide = vw > 900;
  const scale = Math.min(vw / (1.8 * c.width), vh / (1.8 * c.height));
  const targetX = wide ? vw * 0.3 : vw / 2;
  const targetY = wide ? vh / 2 : vh * 0.24;
  const cx = c.left - g.left + c.width / 2;
  const cy = c.top - g.top + c.height / 2;
  return {
    left: g.left,
    top: g.top,
    width: g.width,
    scale,
    tx: targetX - g.left - scale * cx,
    ty: targetY - g.top - scale * cy,
  };
}
/** Where a cell sits in the calendar grid: column 0–6 and row. */
function skyCell(index: number) {
  const col = index % 7;
  const row = Math.floor(index / 7);
  return { col, row };
}

/** At most this many type-dots before a "+N" overflow badge appears. */
const MARKS_SHOWN = 4;

/** Inline SVG icon for an event category (16×16 viewBox, stroke 1.3, round caps). */
function CategoryIcon({
  type,
  size = 14,
  color,
}: {
  type: EventCategory;
  size?: number;
  color: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: CATEGORY_SVG_PATHS[type] }}
    />
  );
}

type TooltipData = {
  x: number;
  y: number;
  type: EventCategory;
  events: ManifestEvent[];
};

/** One dot per event TYPE, positioned at 60% cell height, 27% cell-width apart.
 *  Each dot is a button (≥34px hit area). In zoomed mode the type icon fades in to the right. */
function renderDayIndicators(
  events: ManifestEvent[],
  isZoomed: boolean,
  onDotClick: (type: EventCategory) => void,
  tooltipHandlers: {
    onEnter: (e: React.PointerEvent, type: EventCategory, evs: ManifestEvent[]) => void;
    onMove: (e: React.PointerEvent) => void;
    onLeave: () => void;
    onFocus: (type: EventCategory, evs: ManifestEvent[]) => void;
    onBlur: () => void;
  },
) {
  if (events.length === 0) return null;

  // One slot per unique category, in order of first appearance.
  const typeMap = new Map<EventCategory, ManifestEvent[]>();
  for (const e of events) {
    if (!typeMap.has(e.category)) typeMap.set(e.category, []);
    typeMap.get(e.category)!.push(e);
  }
  const types = [...typeMap.keys()];
  const overflow = Math.max(0, types.length - MARKS_SHOWN);
  // If there is overflow, sacrifice one dot slot for the "+N" badge.
  const dotsToShow = overflow > 0 ? types.slice(0, MARKS_SHOWN - 1) : types;
  const totalSlots = dotsToShow.length + (overflow > 0 ? 1 : 0);
  const rr = 4;

  const dotAt = (i: number) =>
    `${50 + (i - (totalSlots - 1) / 2) * 27}%`;

  return (
    <span className={s.dotLayer}>
      {dotsToShow.map((type, i) => {
        const color = CATEGORY_COLOR[type];
        const evs = typeMap.get(type)!;
        const ariaLabel =
          evs.length === 1
            ? `${type} · ${evs[0].satellite}: ${evs[0].title}`
            : `${type} · ${evs.length} events`;
        return (
          <button
            key={type}
            type="button"
            className={`${s.starDotBtn} ${isZoomed ? s.starDotZoomed : ""}`}
            style={{ left: dotAt(i) }}
            aria-label={ariaLabel}
            onClick={(e) => {
              e.stopPropagation();
              onDotClick(type);
            }}
            onPointerEnter={(e) => tooltipHandlers.onEnter(e, type, evs)}
            onPointerMove={(e) => tooltipHandlers.onMove(e)}
            onPointerLeave={() => tooltipHandlers.onLeave()}
            onFocus={() => tooltipHandlers.onFocus(type, evs)}
            onBlur={() => tooltipHandlers.onBlur()}
          >
            <svg
              className={s.starDotSvg}
              viewBox={isZoomed ? "-17 -17 50 34" : "-17 -17 34 34"}
              width={isZoomed ? 50 : 34}
              height={34}
              overflow="visible"
            >
              <circle r={rr * 3.8} fill={color} opacity="0.1" />
              <circle r={rr * 2} fill={color} opacity="0.2" />
              <circle className={s.starCore} r={rr} fill={color} />
              {isZoomed && (
                <g
                  className={s.zicon}
                  transform={`translate(${rr * 2.4}, -7.5)`}
                  fill="none"
                  stroke={color}
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  dangerouslySetInnerHTML={{ __html: CATEGORY_SVG_PATHS[type] }}
                />
              )}
            </svg>
          </button>
        );
      })}
      {overflow > 0 && (
        <button
          type="button"
          className={s.starDotBtn}
          style={{ left: dotAt(dotsToShow.length) }}
          aria-label={`+${overflow + 1} more event types`}
          onClick={(e) => {
            e.stopPropagation();
            onDotClick(types[dotsToShow.length]);
          }}
        >
          <em className={s.markMore}>+{overflow + 1}</em>
        </button>
      )}
    </span>
  );
}
/** "1 acquisition, 1 production" — what the day's glyphs say, for the cell's aria-label. In
 *  CATEGORIES order rather than event order, so the same mix of types always reads the same way. */
function typeSummary(events: ManifestEvent[]): string {
  return CATEGORIES.filter((c) => events.some((e) => e.category === c))
    .map((c) => {
      const n = events.filter((e) => e.category === c).length;
      return `${n} ${c.toLowerCase()}`;
    })
    .join(", ");
}

// ---------------------------------------------------------------------------
// Status marks
// ---------------------------------------------------------------------------

/** One figure in the summary row. A lost count is the only one drawn in the alarm colour. */
function Metric({
  value,
  label,
  lost = false,
}: {
  value: number;
  label: string;
  lost?: boolean;
}) {
  return (
    <div className={`${s.metric} ${lost ? s.metricLost : ""}`}>
      <span className={s.metricValue}>{String(value).padStart(2, "0")}</span>
      <span className={s.metricLabel}>{label}</span>
    </div>
  );
}

function Legend() {
  return (
    <div className={s.legend}>
      <span className={s.legendLabel}>Completeness status</span>
      {STATUS_ORDER.map((k) => (
        <span key={k} className={s.legendItem}>
          <span
            className={s.legendDot}
            style={{ background: COMPLETENESS[k].color }}
            aria-hidden
          />
          {COMPLETENESS[k].label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day manifest: occurrences and their datatakes, as SentiBoard.html's zoom panel
// ---------------------------------------------------------------------------

/** Downloads the day's occurrences, with their datatakes, as a JSON file. Not wired to a button in
 *  the reference layout (it has no footer); kept so it can be hung off a link if wanted. */
function exportDay(day: number, month: number, events: ManifestEvent[]) {
  const date = `${YEAR}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const blob = new Blob(
    [JSON.stringify({ date, occurrences: events }, null, 2)],
    {
      type: "application/json",
    },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sentiboard-events-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** One impacted datatake: a status dot and the ID (a link-styled label with ↗), the product code and
 *  the sensing window underneath; the status name and completeness on the right, in its colour. */
function DatatakeRow({ dt }: { dt: Datatake }) {
  const color = COMPLETENESS[dt.status].color;
  return (
    <div className={s.dtkRow}>
      <span className={s.dtkLeft}>
        <span className={s.dtkId}>
          <i style={{ background: color }} aria-hidden />
          {/* Styled as a link, as the reference's jump to Data Availability. Swap the span for a
              <Link to=…> once that page takes a datatake ID. */}
          <span className={s.dtkLink} title={`${dt.id} · ${dt.satellite}`}>
            {dt.id}
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
            >
              <path
                d="M3.5 8.5l5-5M4.5 3.5h4v4"
                stroke="currentColor"
                strokeWidth="1.3"
              />
            </svg>
          </span>
        </span>
        <span className={s.dtkProd}>{dt.product.replace(/ /g, "_")}</span>
        <span className={s.dtkWhen}>{sensingWindow(dt)}</span>
      </span>
      <span className={s.dtkRight} style={{ color }}>
        <b>{COMPLETENESS[dt.status].label}</b>
        <span>{completenessLabel(dt)}</span>
      </span>
    </div>
  );
}

/** The whole day, every occurrence open: time | title with type · satellite | status dot, then
 *  "Impacted datatakes · n · m unavailable" and one row per datatake. Occurrences rise in one after
 *  another (the delay is inline), as in the reference. Selected occurrence is at full opacity;
 *  others dim to 0.42 (0.8 on hover) and can be clicked to become the selection. */
function DayManifest({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: ManifestEvent[];
  selectedEventId: string | null;
  onSelectEvent: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <p className={s.emptyDetail}>
        No events on this day match the current filters.
      </p>
    );
  }
  return (
    <>
      {events.map((e, i) => {
        const isSelected = selectedEventId === null || e.id === selectedEventId;
        const unavailable = e.datatakes.filter(
          (d) => d.status === "unavailable",
        ).length;
        return (
          <section
            key={e.id}
            className={`${s.ziOcc} ${isSelected ? "" : s.ziOccDim}`}
            style={{ animationDelay: `${280 + i * 130}ms` }}
            onClick={isSelected ? undefined : () => onSelectEvent(e.id)}
          >
            <div className={s.ziTop}>
              <span className={s.ziTime}>{e.time}</span>
              <span>
                <span className={s.ziTitle}>{e.title}</span>
                <span className={s.ziSub}>
                  <CategoryIcon
                    type={e.category}
                    size={13}
                    color={CATEGORY_COLOR[e.category]}
                  />
                  {e.category} · {e.satellite}
                </span>
              </span>
              <span
                className={s.ziDot}
                style={{ background: COMPLETENESS[eventStatus(e)].color }}
                title={COMPLETENESS[eventStatus(e)].label}
              />
            </div>
            <div className={s.ziDtkHead}>
              Impacted datatakes · {e.datatakes.length}
              {unavailable > 0 ? ` · ${unavailable} unavailable` : ""}
            </div>
            {e.datatakes.map((dt) => (
              <DatatakeRow key={`${dt.id}-${dt.product}`} dt={dt} />
            ))}
          </section>
        );
      })}
    </>
  );
}

/** "2 occurrences · 5 datatakes · 1 unavailable" — the unavailable count always shows, 0 included. */
function DaySummary({ events }: { events: ManifestEvent[] }) {
  const datatakes = events.reduce((n, e) => n + e.datatakes.length, 0);
  const unavailable = events.reduce(
    (n, e) => n + e.datatakes.filter((d) => d.status === "unavailable").length,
    0,
  );
  return (
    <span className={s.ziSum}>
      {events.length} occurrence{events.length === 1 ? "" : "s"} · {datatakes}{" "}
      datatake{datatakes === 1 ? "" : "s"} · {unavailable} unavailable
    </span>
  );
}

// ---------------------------------------------------------------------------
// Filter dropdowns (reference: .fdrop / .ftype / .fmis / .fsat)
// ---------------------------------------------------------------------------

/** "Sentinel-1A" → "S1A", "Sentinel-5P" → "S5P". */
function shortSat(name: string): string {
  const m = name.match(/^Sentinel-(\d+)([A-Z]?)$/);
  return m ? `S${m[1]}${m[2]}` : name;
}

/** A single collapsible filter row: caption + value in the head, animated body below it.
 *  The body opens in the page flow, pushing the calendar down.
 *  pointerdown is stopped at this element so the document outside-click listener cannot fire. */
function FilterDrop({
  label,
  val,
  open,
  onToggle,
  headRef,
  children,
}: {
  label: string;
  val: string;
  open: boolean;
  onToggle: () => void;
  headRef?: React.RefObject<HTMLButtonElement>;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${s.fdrop} ${open ? s.fdropOpen : ""}`}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        ref={headRef}
        type="button"
        className={s.fdropHead}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className={s.fdropVal}>{val}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </button>
      <div className={s.fdropBody}>
        <div className={s.fdropInner}>{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EventsManifest() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openDay, setOpenDay] = useState<number | null>(null);
  // What the drawer shows. Kept after the drawer closes so its content does not vanish mid
  // slide-out; cleared once the panel has finished sliding away.
  const [panelDay, setPanelDay] = useState<{
    day: number;
    month: number;
    events: ManifestEvent[];
  } | null>(null);
  // Opens on the real current month, read once on mount. The mock's events are all in YEAR, so a
  // month outside that year still renders — it just has no events to show.
  const [currentMonth, setCurrentMonth] = useState<number>(
    () => new Date().getMonth() + 1,
  );
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const motion = useAmbientMotion();
  const [openDrop, setOpenDrop] = useState<"types" | "missions" | "sats" | null>(null);

  const toggleType = useCallback((c: EventCategory) => {
    setFilters((f) => {
      const s = new Set(f.offTypes);
      s.has(c) ? s.delete(c) : s.add(c);
      return { ...f, offTypes: s };
    });
  }, []);
  const toggleMission = useCallback((m: string) => {
    setFilters((f) => {
      const s = new Set(f.offMissions);
      s.has(m) ? s.delete(m) : s.add(m);
      return { ...f, offMissions: s };
    });
  }, []);
  const toggleSat = useCallback((sat: string) => {
    setFilters((f) => {
      const s = new Set(f.offSats);
      s.has(sat) ? s.delete(sat) : s.add(sat);
      return { ...f, offSats: s };
    });
  }, []);
  const setQuery = useCallback(
    (query: string) => setFilters((f) => ({ ...f, query })),
    [],
  );
  const toggleDrop = useCallback((which: "types" | "missions" | "sats") => {
    setOpenDrop((d) => (d === which ? null : which));
  }, []);
  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const filtered = useMemo(() => filterEvents(EVENTS, filters), [filters]);
  const byDay = useMemo(
    () => groupByDay(filtered, YEAR, currentMonth),
    [filtered, currentMonth],
  );
  // The summary row describes what the month shows: the events that survive the filters, and the
  // datatakes they carry. A lost datatake is one whose status marks a loss, as on the day cells.
  const monthEvents = useMemo(
    () => eventsInMonth(filtered, YEAR, currentMonth),
    [filtered, currentMonth],
  );
  const datatakesInScope = monthEvents.reduce(
    (n, e) => n + e.datatakes.length,
    0,
  );
  const lostDatatakes = monthEvents.reduce(
    (n, e) => n + e.datatakes.filter((d) => marksLoss(d.status)).length,
    0,
  );
  const satellitesMonitored = new Set(monthEvents.map((e) => e.satellite)).size;

  // Dropdown header values: "All" when everything is on, else "<on>/<total>".
  const visibleSats = MISSION_NAMES
    .filter((m) => !filters.offMissions.has(m))
    .flatMap((m) => MISSIONS[m]);
  const typeVal =
    filters.offTypes.size === 0
      ? "All"
      : `${CATEGORIES.length - filters.offTypes.size}/${CATEGORIES.length}`;
  const misVal =
    filters.offMissions.size === 0
      ? "All"
      : `${MISSION_NAMES.length - filters.offMissions.size}/${MISSION_NAMES.length}`;
  const offVisibleSats = visibleSats.filter((sat) => filters.offSats.has(sat));
  const satVal =
    offVisibleSats.length === 0
      ? "All"
      : `${visibleSats.length - offVisibleSats.length}/${visibleSats.length}`;

  const cells = useMemo(
    () => calendarCells(YEAR, currentMonth),
    [currentMonth],
  );

  const constellation = CONSTELLATIONS[currentMonth - 1];
  const monthName = MONTH_NAMES[currentMonth - 1];
  const canGoBack = currentMonth > 1;
  const canGoForward = currentMonth < 12;

  const dirty =
    filters.offTypes.size > 0 ||
    filters.offMissions.size > 0 ||
    filters.offSats.size > 0 ||
    filters.query !== "";

  const typesHeadRef = useRef<HTMLButtonElement>(null);
  const missionsHeadRef = useRef<HTMLButtonElement>(null);
  const satsHeadRef = useRef<HTMLButtonElement>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomGeom | null>(null); // mounted while the stage exists
  const [zoomOn, setZoomOn] = useState(false); // true = flown in

  const close = useCallback(() => {
    setOpenDay(null);
    setZoomOn(false);
    // with reduced motion there is no transitionend to unmount the stage
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setZoom(null);
  }, []);

  // Moving month closes any open day: its manifest belongs to the month it was opened in.
  const stepMonth = useCallback(
    (delta: number) => {
      setCurrentMonth((m) => Math.min(12, Math.max(1, m + delta)));
      close();
    },
    [close],
  );

  const selectDay = useCallback(
    (day: number, eventId?: string) => {
      const events = byDay.get(day) ?? [];
      if (events.length === 0) return;
      // Always measured on the real in-page grid, which never moves now.
      const geom = gridRef.current ? measureZoom(gridRef.current, day) : null;
      if (!geom) return;
      if (openDay === null) setZoomOn(false); // fresh open: mount flat first, then fly in
      setZoom(geom); // already open: glide straight to the new day
      setOpenDay(day);
      setSelectedEventId(eventId ?? events[0].id);
      setPanelDay({ day, month: currentMonth, events });
    },
    [byDay, currentMonth, openDay],
  );

  const tooltipHandlers = {
    onEnter: (e: React.PointerEvent, type: EventCategory, evs: ManifestEvent[]) => {
      setTooltip({ x: e.clientX, y: e.clientY, type, events: evs });
    },
    onMove: (e: React.PointerEvent) => {
      setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    },
    onLeave: () => setTooltip(null),
    onFocus: (type: EventCategory, evs: ManifestEvent[]) => {
      setTooltip({ x: 0, y: 0, type, events: evs });
    },
    onBlur: () => setTooltip(null),
  };

  const renderCells = (zoomed: boolean) =>
    cells.map((c, i) => {
      const pos = skyCell(i);
      if (c.dim)
        return (
          <div
            key={`dim-${i}`}
            className={`${s.cell} ${s.cellDim}`}
            data-col={pos.col}
            data-row={pos.row}
            aria-hidden
          />
        );
      const events = byDay.get(c.day) ?? [];
      const selected = zoomed && openDay === c.day;
      // In the zoomed copy every other day goes out of focus. A blurred day that has events can
      // still be clicked: the camera glides straight to it, as the reference does.
      const blurred = zoomed && openDay !== c.day;
      const pickable = blurred && events.length > 0;

      const onDotClick = (type: EventCategory) => {
        if (zoomed && c.day === openDay) {
          close();
        } else {
          // First event of that type
          const eventsOfType = events.filter((e) => e.category === type);
          selectDay(c.day, eventsOfType[0]?.id);
        }
      };

      return (
        <div
          key={c.day}
          data-day={c.day}
          className={`${s.cell} ${selected ? s.cellSel : ""} ${blurred ? s.cellBlur : ""} ${pickable ? s.cellPick : ""}`}
          data-col={pos.col}
          data-row={pos.row}
          onClick={
            pickable
              ? (evt) => {
                  evt.stopPropagation();
                  selectDay(c.day);
                }
              : undefined
          }
        >
          <span className={s.cellNum}>{String(c.day).padStart(2, "0")}</span>
          {renderDayIndicators(events, zoomed, onDotClick, tooltipHandlers)}
        </div>
      );
    });

  // Fly in on the frame after the flat copy has painted, so the transform has a start to animate from.
  useEffect(() => {
    if (openDay === null || !zoom || zoomOn) return;
    let r2 = 0;
    const r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setZoomOn(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, [openDay, zoom, zoomOn]);

  // Keep the day centred if the window is resized while zoomed.
  useEffect(() => {
    if (openDay === null) return;
    const onResize = () => {
      const g = gridRef.current && measureZoom(gridRef.current, openDay);
      if (g) setZoom(g);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openDay]);

  const onPanelTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLElement>) => {
      // Child transitions (rows, the chevron) bubble up here too; only the panel's own slide counts.
      if (e.target === e.currentTarget && openDay === null) setPanelDay(null);
    },
    [openDay],
  );

  // Escape closes the drawer — the overlay is modal in feel, so it should behave like one.
  useEffect(() => {
    if (openDay === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay, close]);

  // Close open filter dropdown on outside pointerdown (calendar cells still receive their click).
  useEffect(() => {
    if (!openDrop) return;
    const onPointerDown = () => setOpenDrop(null);
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openDrop]);

  // Escape closes the open filter dropdown and returns focus to its trigger.
  useEffect(() => {
    if (!openDrop) return;
    const headRefs = { types: typesHeadRef, missions: missionsHeadRef, sats: satsHeadRef };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        headRefs[openDrop]?.current?.focus();
        setOpenDrop(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDrop]);

  // While the drawer is open the page behind it must not move at all. Overflow is cleared on the
  // root and the body, with the scrollbar's width padded back in so the layout does not shift. Wheel
  // and touch gestures are cancelled everywhere except inside the drawer's own scrolling list, and
  // that list is set to contain its scroll so it cannot chain the gesture through to the page.
  const drawerOpen = openDay !== null;
  useEffect(() => {
    if (!drawerOpen) return;
    const { documentElement: html, body } = document;
    const prev = {
      html: html.style.overflow,
      body: body.style.overflow,
      pad: body.style.paddingRight,
    };
    const gutter = window.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (gutter > 0) body.style.paddingRight = `${gutter}px`;

    const freeze = (e: Event) => {
      const inList =
        e.target instanceof Element && e.target.closest(`.${s.drawerBody}`);
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
  }, [drawerOpen]);

  const dayEvents = panelDay?.events ?? [];

  // Colour of the last description paragraph — mirrors the month's worst completeness status.
  const descStatusColor = (() => {
    const statuses = monthEvents.flatMap((e) => e.datatakes.map((d) => d.status));
    if (statuses.includes("unavailable")) return COMPLETENESS.unavailable.color;
    if (statuses.includes("partial")) return COMPLETENESS.partial.color;
    if (statuses.includes("acquired")) return COMPLETENESS.acquired.color;
    return COMPLETENESS.planned.color;
  })();

  const DESCRIPTION = (
    <>
      <p>
        This view shows the events occurred on a given date and the possible
        impact on user products completeness. Events are categorized according
        to the following issue types:
      </p>
      <ul style={{ listStyle: "none" }}>
        {(
          [
            {
              key: "Acquisition",
              text: "issue occurring during the reception of the data at the ground station",
            },
            {
              key: "Calibration",
              text: "issue occurred during sensor calibration",
            },
            {
              key: "Manoeuvre",
              text: "issue occurred during the execution of a manoeuvre",
            },
            {
              key: "Production",
              text: "issue occurred during data processing",
            },
            {
              key: "Satellite",
              text: "issue due to instrument unavailability",
            },
          ] as { key: EventCategory; text: string }[]
        ).map(({ key, text }) => {
          const color = CATEGORY_COLOR[key];
          return (
            <li
              key={key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              {/* A box one line tall, so the icon centres on the first line of text. */}
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: "1.6em",
                  flexShrink: 0,
                }}
              >
                <CategoryIcon type={key} size={14} color={color} />
              </span>
              <span>
                <strong style={{ color }}>{key}:</strong> {text}
              </span>
            </li>
          );
        })}
      </ul>
      <p style={{ color: descStatusColor }}>
        Clicking a star flies into that day and lists the datatakes it
        potentially impacted, determined by their sensing times, along with
        further details about the event. The impact on datatake completeness is
        given by the coloured dot beside each datatake: green when the total
        completeness is spared, orange in case of medium impact, red when the
        datatake is lost.
      </p>
    </>
  );

  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title="Events"
          subtitle="Every occurrence across the constellation, mapped onto the datatakes it puts at risk. Pick a day to inspect its events, their origin and the completeness they cost."
          desc={DESCRIPTION}
          img="/assets/img/modules/events.jpg"
        />
      </div>

      <div className={ambientRoot(motion.paused, s.page)}>
        <SpaceBackdrop page={0} paused={motion.paused} />
        <div className={s.inner}>
          {/* ---------- key metrics ---------- */}
          <div className={s.metrics} aria-label="Summary for the month">
            <Metric value={monthEvents.length} label="Events this month" />
            <Metric value={datatakesInScope} label="Datatakes in scope" />
            <Metric value={lostDatatakes} label="Lost datatakes" lost />
            <Metric value={satellitesMonitored} label="Satellites monitored" />
          </div>

          {/* ---------- month navigation and filters: one row ---------- */}
          <div className={s.monthBar}>
            <div className={s.monthNav}>
              <button
                type="button"
                onClick={() => stepMonth(-1)}
                disabled={!canGoBack}
                aria-label="Previous month"
              >
                <ChevronLeft size={16} strokeWidth={1.4} aria-hidden />
              </button>
              <span className={s.monthLabel} aria-live="polite">
                {monthLabel(currentMonth)}
              </span>
              <button
                type="button"
                onClick={() => stepMonth(1)}
                disabled={!canGoForward}
                aria-label="Next month"
              >
                <ChevronRight size={16} strokeWidth={1.4} aria-hidden />
              </button>
            </div>

            <div className={s.barFilters}>
              {/* Event type — icon + uppercase label in the type colour */}
              <FilterDrop
                label="Event type"
                val={typeVal}
                open={openDrop === "types"}
                onToggle={() => toggleDrop("types")}
                headRef={typesHeadRef}
              >
                {CATEGORIES.map((c) => {
                  const on = !filters.offTypes.has(c);
                  const color = on ? CATEGORY_COLOR[c] : "#8A96A6";
                  return (
                    <button
                      key={c}
                      type="button"
                      className={`${s.ftypeBtn} ${on ? "" : s.ftypeOff}`}
                      style={{ color }}
                      aria-pressed={on}
                      onClick={() => toggleType(c)}
                    >
                      <CategoryIcon type={c} size={14} color={color} />
                      {c}
                    </button>
                  );
                })}
              </FilterDrop>

              {/* Mission — uppercase names */}
              <FilterDrop
                label="Mission"
                val={misVal}
                open={openDrop === "missions"}
                onToggle={() => toggleDrop("missions")}
                headRef={missionsHeadRef}
              >
                {MISSION_NAMES.map((m) => {
                  const on = !filters.offMissions.has(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      className={`${s.fmisBtn} ${on ? "" : s.fmisOff}`}
                      aria-pressed={on}
                      onClick={() => toggleMission(m)}
                    >
                      {m}
                    </button>
                  );
                })}
              </FilterDrop>

              {/* Satellite — short codes (S1A, S2B…) in a wrapping row; only missions that are on */}
              <FilterDrop
                label="Satellite"
                val={satVal}
                open={openDrop === "sats"}
                onToggle={() => toggleDrop("sats")}
                headRef={satsHeadRef}
              >
                <div className={s.fsatRow}>
                  {visibleSats.map((sat) => {
                    const on = !filters.offSats.has(sat);
                    return (
                      <button
                        key={sat}
                        type="button"
                        className={`${s.fsatBtn} ${on ? "" : s.fsatOff}`}
                        aria-pressed={on}
                        onClick={() => toggleSat(sat)}
                      >
                        {shortSat(sat)}
                      </button>
                    );
                  })}
                </div>
              </FilterDrop>

              <div className={`${s.inline} ${s.inlineSearch}`}>
                <Search size={13} aria-hidden />
                <input
                  id="mf-search"
                  className={s.inlineInput}
                  type="search"
                  placeholder="Search"
                  aria-label="Search events"
                  value={filters.query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

            </div>

            {/* Absolutely positioned so it is never in the flex flow of barFilters or monthBar —
                it cannot change the row width or trigger wrapping. */}
            <button
              type="button"
              className={s.reset}
              onClick={reset}
              style={{ visibility: dirty ? "visible" : "hidden" }}
            >
              <RotateCcw size={12} aria-hidden /> Reset
            </button>
          </div>

          {/* ---------- month grid ---------- */}
          <div className={s.calRow}>
            <aside className={s.zodiac} aria-hidden>
              <svg
                key={constellation.n}
                className={s.zodiacSvg}
                viewBox="0 -44 380 344"
                focusable="false"
              >
                <g className={s.conGroup}>
                  {constellation.e.map(([a, b], i) => {
                    const ax = (constellation.p[a][0] * 380).toFixed(1);
                    const ay = (constellation.p[a][1] * 300).toFixed(1);
                    const bx = (constellation.p[b][0] * 380).toFixed(1);
                    const by = (constellation.p[b][1] * 300).toFixed(1);
                    return (
                      <line
                        key={i}
                        className={s.conLine}
                        x1={ax} y1={ay} x2={bx} y2={by}
                        pathLength="1"
                        vectorEffect="non-scaling-stroke"
                        style={{ animationDelay: `${1400 + i * 110}ms` }}
                      />
                    );
                  })}
                  {constellation.p.map(([px, py], i) => (
                    <g
                      key={i}
                      className={s.conStar}
                      style={{ animationDelay: `${i * 120}ms` }}
                    >
                      <circle cx={px * 380} cy={py * 300} r={9} fill="#BFE6F2" opacity="0.16" />
                      <circle cx={px * 380} cy={py * 300} r={3.2} fill="#F2F8FF" />
                    </g>
                  ))}
                  <text
                    className={s.conLabel}
                    x="190"
                    y="-20"
                    textAnchor="middle"
                  >
                    {constellation.n.toUpperCase()}
                  </text>
                </g>
              </svg>
            </aside>

            <div className={s.calWrap}>
              <div className={s.dow} aria-hidden>
                {WEEKDAYS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </div>
              {/* The real grid: never transformed, only measured. */}
              <div className={s.grid} ref={gridRef}>
                {renderCells(false)}
              </div>
            </div>
          </div>
          {/* Spacer so the 6-week calendar never touches the Earth image at the bottom. */}
          <div style={{ height: "clamp(150px, 20vh, 300px)" }} aria-hidden />
        </div>

        {/* Stage, drawer, and tooltip are portalled to <body>, above the sticky nav. */}
        {createPortal(
          <>
            {tooltip && (
              <div
                className={`${s.startip} ${s.startipOn} ${tooltip.x > window.innerWidth - 260 ? s.startipFlip : ""}`}
                style={{
                  left: tooltip.x + (tooltip.x > window.innerWidth - 260 ? -18 : 18),
                  top: tooltip.y - 16,
                }}
              >
                <CategoryIcon type={tooltip.type} size={14} color={CATEGORY_COLOR[tooltip.type]} />
                <span className={s.stTxt}>
                  <span className={s.stType} style={{ color: CATEGORY_COLOR[tooltip.type] }}>
                    {tooltip.type}
                    {" · "}
                    {tooltip.events.length === 1
                      ? tooltip.events[0].satellite
                      : `${tooltip.events.length} events`}
                  </span>
                  {tooltip.events.slice(0, 3).map((e) => (
                    <span key={e.id} className={s.stName}>{e.title}</span>
                  ))}
                  {tooltip.events.length > 3 && (
                    <span className={s.stName}>+{tooltip.events.length - 3} more</span>
                  )}
                </span>
              </div>
            )}
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
                  style={
                    {
                      left: zoom.left,
                      top: zoom.top,
                      width: zoom.width,
                      transform: zoomOn
                        ? `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`
                        : "none",
                      // the zoom factor, so the CSS can keep blur and borders a constant
                      // size on screen instead of growing with the scale
                      "--k": zoom.scale,
                    } as CSSProperties
                  }
                  onClick={(e) => e.stopPropagation()}
                  onTransitionEnd={(e) => {
                    if (
                      e.target === e.currentTarget &&
                      e.propertyName === "transform" &&
                      !zoomOn
                    )
                      setZoom(null);
                  }}
                >
                  {renderCells(true)}
                </div>
              </div>
            )}

            <aside
              className={`${s.drawer} ${openDay !== null ? s.drawerOn : ""}`}
              aria-label="Day manifest"
              aria-hidden={openDay === null}
              onTransitionEnd={onPanelTransitionEnd}
            >
              {panelDay !== null && (
                // One scrolling column, as the reference's .zoom-info: no box, no buttons — the
                // stage's back link, a click outside the day or Escape close it.
                <div
                  className={s.drawerBody}
                  key={`${panelDay.month}-${panelDay.day}`}
                >
                  <header className={s.ziHead}>
                    <span className={s.detailEyebrow}>Selected day</span>
                    <h2 className={s.ziDate}>
                      {dayHeading(panelDay.day, panelDay.month)}
                    </h2>
                    <DaySummary events={dayEvents} />
                  </header>
                  <DayManifest
                    events={dayEvents}
                    selectedEventId={selectedEventId}
                    onSelectEvent={setSelectedEventId}
                  />
                </div>
              )}
            </aside>
          </>,
          document.body,
        )}
      </div>
    </>
  );
}
