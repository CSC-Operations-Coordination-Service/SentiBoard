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
  ALL_SATELLITES,
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_ICONS,
  CATEGORY_STROKE,
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
  dayStatus,
  eventStatus,
  eventsInMonth,
  filterEvents,
  groupByDay,
  marksLoss,
  missionOf,
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

/* ---------- sky ----------
 * The sign's constellation sits in a column to the left of the calendar, not behind it. The grid
 * mapping below (200 × 168 units, offset 90 / 80) is the layout the cells were planned against;
 * the DOM cells are fluid, so it is a mapping, not a pixel-exact overlay. */
const ZODIAC_VIEW = "-270 -230 540 460";
const CELL_W = 200;
const CELL_H = 168;
const START_X = 90;
const START_Y = 80;

/* Stylised constellation line-work, centred on (0,0) in its own units. These are decorative
 * shapes, not astronomical positions. */
const ZODIAC: Record<string, string> = {
  Capricornus:
    "M-200 -40 L-120 -80 L-40 -30 L40 -60 L120 -20 L200 -90 M120 -20 L90 60 L0 100 L-80 40 L-40 -30",
  Aquarius:
    "M-220 -40 L-160 -90 L-100 -40 L-40 -90 L20 -40 L80 -90 L140 -40 L200 -90 M-220 60 L-160 10 L-100 60 L-40 10 L20 60 L80 10 L140 60 L200 10",
  Pisces:
    "M-240 -110 Q-160 -40 -90 0 Q-160 40 -240 110 M90 -110 Q160 -40 240 0 Q160 40 90 110 M-90 0 L90 0",
  Aries: "M-200 40 Q-150 -130 -30 -70 L60 -20 L200 20",
  Taurus:
    "M-200 -120 L-40 0 L-200 120 M-40 0 L140 -40 M140 -40 L60 -140 M140 -40 L200 -130 M120 60 L130 40 L140 60 L120 62 Z",
  Gemini:
    "M-130 -150 L-120 110 M130 -150 L120 110 M-130 -150 Q-60 -170 -20 -120 M130 -150 Q60 -170 20 -120 M-120 -10 L120 -10",
  Cancer:
    "M-160 0 Q0 -180 160 0 Q0 180 -160 0 Z M-60 -120 L-120 -190 M60 -120 L120 -190 M-60 120 L-120 190 M60 120 L120 190",
  Leo: "M-220 -40 L-160 -90 L-100 -60 L-40 -20 L30 -60 L100 0 L200 10 L180 110 L80 90 L-20 60 L-80 110 L-160 120 Z",
  Virgo:
    "M-120 -180 L-60 -20 L-30 150 M-60 -20 L40 -60 L120 -150 M-60 -20 L60 40 L200 80 M-30 150 L80 190",
  Libra:
    "M-200 -40 L200 -40 M0 -40 L0 -130 M-200 -40 Q-150 60 -100 -40 M200 -40 Q150 60 100 -40 M-60 -130 L60 -130",
  Scorpius:
    "M-200 -120 L-120 -60 L-60 -120 L0 -40 L60 -20 L120 20 L170 90 L200 60 M120 20 L110 -40 L150 -80",
  Sagittarius:
    "M-180 120 L160 -120 M160 -120 L80 -110 M160 -120 L150 -40 M-120 40 L40 -20 M-60 80 L80 0",
};

/* Star nodes for each sign: the line vertices of ZODIAC, in the same units. */
const ZODIAC_STARS: Record<string, [number, number][]> = {
  Capricornus: [
    [-200, -40],
    [-120, -80],
    [-40, -30],
    [40, -60],
    [120, -20],
    [200, -90],
    [90, 60],
    [0, 100],
    [-80, 40],
  ],
  Aquarius: [
    [-220, -40],
    [-160, -90],
    [-100, -40],
    [-40, -90],
    [20, -40],
    [80, -90],
    [140, -40],
    [200, -90],
    [-220, 60],
    [-160, 10],
    [-100, 60],
    [-40, 10],
    [20, 60],
    [80, 10],
    [140, 60],
    [200, 10],
  ],
  Pisces: [
    [-240, -110],
    [-90, 0],
    [-240, 110],
    [90, -110],
    [240, 0],
    [90, 110],
  ],
  Aries: [
    [-200, 40],
    [-30, -70],
    [60, -20],
    [200, 20],
  ],
  Taurus: [
    [-200, -120],
    [-40, 0],
    [-200, 120],
    [140, -40],
    [60, -140],
    [200, -130],
    [120, 60],
    [130, 40],
    [140, 60],
    [120, 62],
  ],
  Gemini: [
    [-130, -150],
    [-120, 110],
    [130, -150],
    [120, 110],
    [-20, -120],
    [20, -120],
    [-120, -10],
    [120, -10],
  ],
  Cancer: [
    [-160, 0],
    [160, 0],
    [-60, -120],
    [-120, -190],
    [60, -120],
    [120, -190],
    [-60, 120],
    [-120, 190],
    [60, 120],
    [120, 190],
  ],
  Leo: [
    [-220, -40],
    [-160, -90],
    [-100, -60],
    [-40, -20],
    [30, -60],
    [100, 0],
    [200, 10],
    [180, 110],
    [80, 90],
    [-20, 60],
    [-80, 110],
    [-160, 120],
  ],
  Virgo: [
    [-120, -180],
    [-60, -20],
    [-30, 150],
    [40, -60],
    [120, -150],
    [60, 40],
    [200, 80],
    [80, 190],
  ],
  Libra: [
    [-200, -40],
    [200, -40],
    [0, -40],
    [0, -130],
    [-100, -40],
    [100, -40],
    [-60, -130],
    [60, -130],
  ],
  Scorpius: [
    [-200, -120],
    [-120, -60],
    [-60, -120],
    [0, -40],
    [60, -20],
    [120, 20],
    [170, 90],
    [200, 60],
    [110, -40],
    [150, -80],
  ],
  Sagittarius: [
    [-180, 120],
    [160, -120],
    [80, -110],
    [150, -40],
    [-120, 40],
    [40, -20],
    [-60, 80],
    [80, 0],
  ],
};

/* Timing of the lighting sequence: each star lights STAR_STEP_MS after the one before it, and each
 * star's own fade takes STAR_FADE_MS. Kept here, not only in CSS, because the path's draw length
 * is derived from the star count. */
const STAR_STEP_MS = 150;
const STAR_FADE_MS = 400;

/* Month number (1 = January, as in mock.ts) → the sign that dominates that month. */
const SIGN_BY_MONTH = [
  "Capricornus",
  "Aquarius",
  "Pisces",
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpius",
  "Sagittarius",
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
/** Where a cell sits in the sky grid: column 0–6, row, and its top-left in SVG units. */
function skyCell(index: number) {
  const col = index % 7;
  const row = Math.floor(index / 7);
  return { col, row, x: START_X + col * CELL_W, y: START_Y + row * CELL_H };
}

/** How many marks a day cell can show before it starts summarising. Four fits two rows of glyphs in
 *  the wide cell and in the ~45px phone cell; beyond that the marks would crowd out the day number. */
const MARKS_SHOWN = 4;

/** The marks inside a day cell. Closed, one coloured dot per event; while a day is zoomed in
 *  (`isZoomed`), the same events as their type icons. Past MARKS_SHOWN the rest collapse to "+N". */
/** The marks inside a day cell rendered as clickable buttons. */
function renderDayIndicators(
  events: ManifestEvent[],
  isZoomed: boolean,
  onSelectDay: (day: number) => void,
  onZoomOut: () => void,
  day: number,
) {
  if (events.length === 0) return null;
  return (
    <span className={`${s.marks} ${isZoomed ? s.zoomedIn : ""}`}>
      {events.slice(0, MARKS_SHOWN).map((e) => {
        const color = CATEGORY_COLOR[e.category];
        const title = `${e.time} · ${e.category} · ${e.satellite}`;
        if (!isZoomed) {
          return (
            <button
              key={e.id}
              type="button"
              className={s.dotMark}
              style={{ backgroundColor: color }}
              onClick={(evt) => {
                evt.stopPropagation();
                onSelectDay(day);
              }}
              title={title}
              aria-label={title}
            />
          );
        }
        const Icon = CATEGORY_ICONS[e.category];
        return (
          <button
            key={e.id}
            type="button"
            className={s.iconMark}
            style={{ color }}
            onClick={(evt) => {
              evt.stopPropagation();
              onZoomOut();
            }}
            title={`${title} · Back to the month`}
            aria-label={`${title}. Back to the month`}
          >
            <Icon size={14} strokeWidth={CATEGORY_STROKE} aria-hidden />
          </button>
        );
      })}
      {events.length > MARKS_SHOWN && (
        <button
          type="button"
          className={s.markMoreBtn}
          onClick={(evt) => {
            evt.stopPropagation();
            onSelectDay(day);
          }}
          aria-label={`+${events.length - MARKS_SHOWN} more events`}
        >
          <em className={s.markMore}>+{events.length - MARKS_SHOWN}</em>
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
 *  another (the delay is inline), as in the reference. */
function DayManifest({ events }: { events: ManifestEvent[] }) {
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
        const Icon = CATEGORY_ICONS[e.category];
        const unavailable = e.datatakes.filter(
          (d) => d.status === "unavailable",
        ).length;
        return (
          <section
            key={e.id}
            className={s.ziOcc}
            style={{ animationDelay: `${280 + i * 130}ms` }}
          >
            <div className={s.ziTop}>
              <span className={s.ziTime}>{e.time}</span>
              <span>
                <span className={s.ziTitle}>{e.title}</span>
                <span className={s.ziSub}>
                  <Icon
                    size={13}
                    strokeWidth={CATEGORY_STROKE}
                    color={CATEGORY_COLOR[e.category]}
                    aria-hidden
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
  const motion = useAmbientMotion();

  // A satellite from the old mission would contradict the new one, leaving zero results with no
  // visible cause, so changing mission clears it. Conversely a satellite implies its mission —
  // filling it in beats showing "All missions" next to "Sentinel-1A".
  const setMission = useCallback((mission: string) => {
    setFilters((f) => ({ ...f, mission, satellite: "" }));
  }, []);
  const setSatellite = useCallback((satellite: string) => {
    setFilters((f) => ({
      ...f,
      satellite,
      mission: satellite ? missionOf(satellite) : f.mission,
    }));
  }, []);
  const toggleCategory = useCallback((c: EventCategory) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(c)
        ? f.categories.filter((x) => x !== c)
        : [...f.categories, c],
    }));
  }, []);
  const setQuery = useCallback(
    (query: string) => setFilters((f) => ({ ...f, query })),
    [],
  );
  const setType = useCallback((value: string) => {
    setFilters((f) => ({
      ...f,
      categories: value ? [value as EventCategory] : CATEGORIES,
    }));
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
  // The event-type dropdown is single-choice: one category shows, and "All" stands for every one.
  const typeFilter =
    filters.categories.length === 1 ? filters.categories[0] : "";

  const cells = useMemo(
    () => calendarCells(YEAR, currentMonth),
    [currentMonth],
  );

  const sign = SIGN_BY_MONTH[currentMonth - 1];
  const monthName = MONTH_NAMES[currentMonth - 1];
  const canGoBack = currentMonth > 1;
  const canGoForward = currentMonth < 12;

  const dirty =
    filters.mission !== "" ||
    filters.satellite !== "" ||
    filters.query !== "" ||
    filters.categories.length !== CATEGORIES.length;

  const satellites = filters.mission
    ? MISSIONS[filters.mission]
    : ALL_SATELLITES;
  // Sentinel-5P flies alone, so there is nothing to choose — the production page disables the
  // selector in exactly this case rather than offering a list of one.
  const satelliteDisabled = satellites.length < 2;
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
    (day: number) => {
      const events = byDay.get(day) ?? [];
      if (events.length === 0) return;
      // Always measured on the real in-page grid, which never moves now.
      const geom = gridRef.current ? measureZoom(gridRef.current, day) : null;
      if (!geom) return;
      if (openDay === null) setZoomOn(false); // fresh open: mount flat first, then fly in
      setZoom(geom); // already open: glide straight to the new day
      setOpenDay(day);
      setPanelDay({ day, month: currentMonth, events });
    },
    [byDay, currentMonth, openDay],
  );

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
          {renderDayIndicators(events, zoomed, selectDay, () => close(), c.day)}
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
          const Icon = CATEGORY_ICONS[key];
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
                  color,
                  display: "flex",
                  alignItems: "center",
                  height: "1.6em",
                  flexShrink: 0,
                }}
              >
                <Icon aria-hidden size={14} strokeWidth={CATEGORY_STROKE} />
              </span>
              <span>
                <strong style={{ color }}>{key}:</strong> {text}
              </span>
            </li>
          );
        })}
      </ul>
      <p>
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
        <SpaceBackdrop page={1} paused={motion.paused} />
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
              <div className={s.inline}>
                <label className={s.inlineLabel} htmlFor="mf-type">
                  Event type
                </label>
                <select
                  id="mf-type"
                  className={s.inlineSelect}
                  value={typeFilter}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className={s.inline}>
                <label className={s.inlineLabel} htmlFor="mf-mission">
                  Mission
                </label>
                <select
                  id="mf-mission"
                  className={s.inlineSelect}
                  value={filters.mission}
                  onChange={(e) => setMission(e.target.value)}
                >
                  <option value="">All</option>
                  {MISSION_NAMES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className={s.inline}>
                <label className={s.inlineLabel} htmlFor="mf-satellite">
                  Satellite
                </label>
                <select
                  id="mf-satellite"
                  className={s.inlineSelect}
                  value={filters.satellite}
                  onChange={(e) => setSatellite(e.target.value)}
                  disabled={satelliteDisabled}
                  title={
                    satelliteDisabled
                      ? "Sentinel-5P has a single satellite"
                      : undefined
                  }
                >
                  <option value="">All</option>
                  {satellites.map((sat) => (
                    <option key={sat} value={sat}>
                      {sat}
                    </option>
                  ))}
                </select>
              </div>

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

              {dirty && (
                <button type="button" className={s.reset} onClick={reset}>
                  <RotateCcw size={12} aria-hidden /> Reset
                </button>
              )}
            </div>
          </div>

          {/* ---------- month grid ---------- */}
          <div className={s.calRow}>
            <aside className={s.zodiac} aria-hidden>
              <svg
                key={sign}
                className={s.zodiacSvg}
                viewBox={ZODIAC_VIEW}
                focusable="false"
              >
                <text
                  className={s.zodiacLabel}
                  x={0}
                  y={-196}
                  textAnchor="middle"
                >
                  {sign.toUpperCase()}
                </text>
                <g
                  stroke="rgba(255, 255, 255, 0.15)"
                  fill="none"
                  strokeWidth="1.5"
                >
                  <path
                    className={s.zodiacPath}
                    d={ZODIAC[sign]}
                    pathLength={1}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      animationDuration: `${ZODIAC_STARS[sign].length * STAR_STEP_MS + STAR_FADE_MS}ms`,
                    }}
                  />
                </g>
                <g className={s.zodiacStars}>
                  {ZODIAC_STARS[sign].map(([x, y], i) => (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={4}
                      style={{ animationDelay: `${i * STAR_STEP_MS}ms` }}
                    />
                  ))}
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
        </div>

        {/* Stage and drawer are portalled to <body>, above the sticky nav. */}
        {createPortal(
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
                  <DayManifest events={dayEvents} />
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
