// DEVOCS-219 — Events page proposal: "Mission Manifest".
//
// The two earlier variants (full-width grid + overlay drawer, and a 65/35 split with an always-on
// inspector) are merged here. The grid keeps the full width and day detail arrives as the Day
// Manifest drawer; the split layout's hover-preview is deliberately gone, because previewing a day
// on hover and opening it in an overlay are the same gesture answered twice — an overlay that
// followed the pointer would flicker across the month.
//
// Everything lives in this one file except the data: with a single consumer there is nothing for a
// shared module to keep honest, and a stakeholder reading the proposal can now follow it top to
// bottom. Mock-up only — data is local (mock.ts); the shipping page is /v1/events.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
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
  MONTH,
  STATUS_ORDER,
  WEEKDAYS,
  YEAR,
  calendarCells,
  completenessLabel,
  dayStatus,
  eventStatus,
  filterEvents,
  groupByDay,
  marksLoss,
  missionOf,
  sensingWindow,
  type Datatake,
  type EventCategory,
  type Filters,
  type ManifestEvent,
  type Status,
} from "./mock";
import { Collapse, DescriptionModal } from "@/components/ui";
import s from "./events.module.css";

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

/* Star nodes for each sign: the line vertices of ZODIAC, in the same units. */
const ZODIAC_STARS: Record<string, [number, number][]> = {
  Capricornus: [[-200, -40], [-120, -80], [-40, -30], [40, -60], [120, -20], [200, -90], [90, 60], [0, 100], [-80, 40]],
  Aquarius: [[-220, -40], [-160, -90], [-100, -40], [-40, -90], [20, -40], [80, -90], [140, -40], [200, -90], [-220, 60], [-160, 10], [-100, 60], [-40, 10], [20, 60], [80, 10], [140, 60], [200, 10]],
  Pisces: [[-240, -110], [-90, 0], [-240, 110], [90, -110], [240, 0], [90, 110]],
  Aries: [[-200, 40], [-30, -70], [60, -20], [200, 20]],
  Taurus: [[-200, -120], [-40, 0], [-200, 120], [140, -40], [60, -140], [200, -130], [120, 60], [130, 40], [140, 60], [120, 62]],
  Gemini: [[-130, -150], [-120, 110], [130, -150], [120, 110], [-20, -120], [20, -120], [-120, -10], [120, -10]],
  Cancer: [[-160, 0], [160, 0], [-60, -120], [-120, -190], [60, -120], [120, -190], [-60, 120], [-120, 190], [60, 120], [120, 190]],
  Leo: [[-220, -40], [-160, -90], [-100, -60], [-40, -20], [30, -60], [100, 0], [200, 10], [180, 110], [80, 90], [-20, 60], [-80, 110], [-160, 120]],
  Virgo: [[-120, -180], [-60, -20], [-30, 150], [40, -60], [120, -150], [60, 40], [200, 80], [80, 190]],
  Libra: [[-200, -40], [200, -40], [0, -40], [0, -130], [-100, -40], [100, -40], [-60, -130], [60, -130]],
  Scorpius: [[-200, -120], [-120, -60], [-60, -120], [0, -40], [60, -20], [120, 20], [170, 90], [200, 60], [110, -40], [150, -80]],
  Sagittarius: [[-180, 120], [160, -120], [80, -110], [150, -40], [-120, 40], [40, -20], [-60, 80], [80, 0]],
};

/* Month number (1 = January, as in mock.ts) → the sign that dominates that month. */
const SIGN_BY_MONTH = [
  "Capricornus", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini",
  "Cancer", "Leo", "Virgo", "Libra", "Scorpius", "Sagittarius",
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT_NAMES = MONTH_NAMES.map((m) => m.slice(0, 3));

/** "August 2026" for a 1-based month. */
function monthLabel(month: number) {
  return `${MONTH_NAMES[month - 1]} ${YEAR}`;
}

/** "05 Aug 2026" for a day of a 1-based month. */
function dayHeading(day: number, month: number) {
  return `${String(day).padStart(2, "0")} ${MONTH_SHORT_NAMES[month - 1]} ${YEAR}`;
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

function StatusCircle({ status, size = 9 }: { status: Status; size?: number }) {
  return (
    <span
      className={s.circle}
      style={{
        background: COMPLETENESS[status].color,
        width: size,
        height: size,
      }}
      title={COMPLETENESS[status].label}
    />
  );
}

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
// Drawer body: occurrences and their datatakes
// ---------------------------------------------------------------------------

function DatatakeRow({ dt }: { dt: Datatake }) {
  return (
    <li className={s.dtRow}>
      <StatusCircle status={dt.status} size={7} />
      <span className={s.dtId}>{dt.id}</span>
      <span className={s.dtProduct}>{dt.product}</span>
      <span className={s.dtTime}>{sensingWindow(dt)}</span>
      <span
        className={s.dtStatus}
        style={{ color: COMPLETENESS[dt.status].color }}
      >
        <span className={s.dtStatusLabel}>{COMPLETENESS[dt.status].label}</span>
        <span className={s.dtPct}>{completenessLabel(dt)}</span>
      </span>
    </li>
  );
}

function OccurrenceList({
  events,
  expanded,
  onToggle,
}: {
  events: ManifestEvent[];
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <p className={s.emptyDetail}>
        No events on this day match the current filters.
      </p>
    );
  }

  return (
    <ol className={s.occList}>
      {events.map((e) => {
        const Icon = CATEGORY_ICONS[e.category];
        const status = eventStatus(e);
        const open = expanded.has(e.id);
        const unavailable = e.datatakes.filter(
          (d) => d.status === "unavailable",
        ).length;

        return (
          <li key={e.id} className={s.occ}>
            <button
              type="button"
              className={s.occRow}
              onClick={() => onToggle(e.id)}
              aria-expanded={open}
              aria-controls={`occ-${e.id}`}
            >
              <span className={s.occTime}>{e.time}</span>
              <ChevronRight
                size={13}
                className={`${s.chev} ${open ? s.chevOpen : ""}`}
                aria-hidden
              />
              <span className={s.occBody}>
                <span className={s.occTitle}>{e.title}</span>
                <span className={s.occMeta}>
                  <span
                    style={{
                      color: CATEGORY_COLOR[e.category],
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Icon size={12} strokeWidth={CATEGORY_STROKE} aria-hidden />
                  </span>{" "}
                  {e.category} · {e.satellite}
                </span>
              </span>
              <StatusCircle status={status} />
            </button>

            {/* Rendered whether or not it is open, so the datatakes have a height to slide from —
                mounting them on expand would make the panel appear at full size instead. */}
            <Collapse open={open} id={`occ-${e.id}`}>
              <div className={s.occDetail}>
                <div className={s.dtHead}>
                  <span>
                    Impacted datatakes · {e.datatakes.length}
                    {unavailable > 0 ? ` · ${unavailable} unavailable` : ""}
                  </span>
                </div>
                <ul className={s.dtList}>
                  {e.datatakes.map((dt) => (
                    <DatatakeRow
                      key={`${e.id}-${dt.id}-${dt.product}`}
                      dt={dt}
                    />
                  ))}
                </ul>
              </div>
            </Collapse>
          </li>
        );
      })}
    </ol>
  );
}

/** "2 occurrences · 4 datatakes · 1 unavailable" */
function DaySummary({ events }: { events: ManifestEvent[] }) {
  const datatakes = events.reduce((n, e) => n + e.datatakes.length, 0);
  const unavailable = events.reduce(
    (n, e) => n + e.datatakes.filter((d) => d.status === "unavailable").length,
    0,
  );
  return (
    <span className={s.detailSub}>
      {events.length} occurrence{events.length === 1 ? "" : "s"} · {datatakes}{" "}
      datatake
      {datatakes === 1 ? "" : "s"}
      {unavailable > 0 ? ` · ${unavailable} unavailable` : ""}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EventsManifest() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number>(MONTH);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [descriptionOpen, setDescriptionOpen] = useState(false);


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
  // The mock only holds August's events, and it keys them by day-of-month alone. Any other month
  // would show August's events on its own dates, so those months open empty instead.
  const hasMockEvents = currentMonth === MONTH;
  const byDay = useMemo(
    () => (hasMockEvents ? groupByDay(filtered) : new Map<number, ManifestEvent[]>()),
    [filtered, hasMockEvents],
  );
  // The summary row describes what the month shows: the events that survive the filters, and the
  // datatakes they carry. A lost datatake is one whose status marks a loss, as on the day cells.
  const monthEvents = hasMockEvents ? filtered : [];
  const datatakesInScope = monthEvents.reduce((n, e) => n + e.datatakes.length, 0);
  const lostDatatakes = monthEvents.reduce(
    (n, e) => n + e.datatakes.filter((d) => marksLoss(d.status)).length,
    0,
  );
  const satellitesMonitored = new Set(monthEvents.map((e) => e.satellite)).size;
  // The event-type dropdown is single-choice: one category shows, and "All" stands for every one.
  const typeFilter = filters.categories.length === 1 ? filters.categories[0] : "";

  const cells = useMemo(() => calendarCells(YEAR, currentMonth), [currentMonth]);
  const sign = SIGN_BY_MONTH[currentMonth - 1];
  const monthName = MONTH_NAMES[currentMonth - 1];
  const canGoBack = currentMonth > 1;
  const canGoForward = currentMonth < 12;

  // Moving month closes any open day: its manifest belongs to the month it was opened in.
  const stepMonth = useCallback((delta: number) => {
    setCurrentMonth((m) => Math.min(12, Math.max(1, m + delta)));
    setOpenDay(null);
  }, []);

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

  const close = useCallback(() => setOpenDay(null), []);
  const selectDay = useCallback((day: number) => {
    setOpenDay(day);
    // A newly opened day starts collapsed: the timeline answers "what happened", and
    // auto-expanding the first event would bury it under one event's datatakes.
    setExpanded(new Set());
  }, []);

  // Escape closes the drawer — the overlay is modal in feel, so it should behave like one.
  useEffect(() => {
    if (openDay === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openDay, close]);

  const dayEvents = openDay === null ? [] : (byDay.get(openDay) ?? []);

  const toggleAllExpanded = useCallback(() => {
    if (expanded.size === dayEvents.length && dayEvents.length > 0) {
      // All are expanded, collapse all
      setExpanded(new Set());
    } else if (dayEvents.length > 0) {
      // Expand all events
      setExpanded(new Set(dayEvents.map((e) => e.id)));
    }
  }, [expanded, dayEvents]);

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
            { key: "Production", text: "issue occurred during data processing" },
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
        When an occurrence is clicked, the bottom panel shows a list of
        potentially impacted datatakes, determined by their sensing times, along
        with further details about the event. The impact on datatake
        completeness is represented by the right-side coloured circle. The
        "green" colour indicates that the total completeness is spared; "orange"
        is used in case of medium impact; the "red" colour is used when the
        datatake is lost.
      </p>
      <p>
        Events can be filtered by mission, event type, satellite name (e.g.,
        'Sentinel-1A'), or by entering a category of interest in the search box.
      </p>
    </>
  );

  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title="Events"
          desc={DESCRIPTION}
          img="/assets/img/modules/events.jpg"
        />
      </div>

      <div className={s.page}>
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
                <ChevronLeft size={15} aria-hidden />
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
                <ChevronRight size={15} aria-hidden />
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
                      {c.charAt(0).toUpperCase() + c.slice(1)}
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
                className="zodiac-path"
                data-sign={sign}
                stroke="rgba(255, 255, 255, 0.15)"
                fill="none"
                strokeWidth="1.5"
              >
                <path d={ZODIAC[sign]} vectorEffect="non-scaling-stroke" />
              </g>
              <g className={s.zodiacStars}>
                {ZODIAC_STARS[sign].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={4} />
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
            <div className={s.grid}>
              {cells.map((c, i) => {
                const pos = skyCell(i);
                // Neighbouring-month cells exist only so the weeks line up; they carry no events and
                // are inert <div>s rather than disabled buttons, which keeps them out of the tab order.
                if (c.dim)
                  return (
                    <div
                      key={`dim-${i}`}
                      className={`${s.cell} ${s.cellDim}`}
                      data-col={pos.col}
                      data-row={pos.row}
                      data-x={pos.x}
                      data-y={pos.y}
                      aria-hidden
                    />
                  );

                const events = byDay.get(c.day) ?? [];
                const status = events.length ? dayStatus(events) : null;
                const selected = openDay === c.day;

                return (
                  <button
                    key={c.day}
                    type="button"
                    className={`${s.cell} ${selected ? s.cellSel : ""}`}
                    data-col={pos.col}
                    data-row={pos.row}
                    data-x={pos.x}
                    data-y={pos.y}
                    onClick={() => selectDay(c.day)}
                    aria-pressed={selected}
                    /* The glyphs are aria-hidden, so the types they now encode have to reach a
                     screen reader through the label. The dots carried no type at all, so this is
                     information the cell gained rather than information it is repeating. */
                    aria-label={
                      events.length
                        ? `${c.day} ${monthName}, ${events.length} event${events.length === 1 ? "" : "s"}, ${typeSummary(events)}, worst completeness ${COMPLETENESS[status!].label}`
                        : `${c.day} ${monthName}, no events`
                    }
                  >
                    <span className={s.cellNum}>
                      {String(c.day).padStart(2, "0")}
                    </span>

                    {/* One mark per event, drawn with that event's TYPE GLYPH — the same five icons
                      the filter pills carry at the top of the page (components/EventIcon's set), so
                      a day reads as "a manoeuvre and a production issue" rather than "two things".
                      Replaces the neutral dots that were here.

                      Still uncoloured: this page reserves colour for completeness, and the pills
                      draw these same glyphs in the accent rather than in a per-type hue, so a second
                      palette would contradict both. The glyph identifies the type; the stripe below
                      identifies the loss. */}
                    {events.length > 0 && (
                      <span className={s.marks}>
                        {events.slice(0, MARKS_SHOWN).map((e) => {
                          const Icon = CATEGORY_ICONS[e.category];
                          const categoryColor = CATEGORY_COLOR[e.category];
                          return (
                            <span
                              key={e.id}
                              className={s.mark}
                              title={`${e.time} · ${e.category} · ${e.satellite}`}
                              style={{ color: categoryColor }}
                            >
                              <Icon
                                size={13}
                                strokeWidth={CATEGORY_STROKE}
                                aria-hidden
                              />
                            </span>
                          );
                        })}
                        {/* A glyph is far bigger than the 5px dot it replaces, so a busy day can no
                          longer show one mark per event. The mock's busiest day has two; a real
                          month will have more, and silently dropping them would make the grid
                          under-report. */}
                        {events.length > MARKS_SHOWN && (
                          <em className={s.markMore}>
                            +{events.length - MARKS_SHOWN}
                          </em>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          </div>
          <Legend />
        </div>

        {/* ---------- Day Manifest drawer ---------- */}
        {/* The scrim is a button rather than a div with onClick: click-to-dismiss then comes with
          keyboard access for free, and screen readers announce it instead of finding a bare
          clickable region. */}
        <button
          type="button"
          className={`${s.scrim} ${openDay !== null ? s.scrimOn : ""}`}
          onClick={close}
          tabIndex={openDay !== null ? 0 : -1}
          aria-label="Close day manifest"
        />

        <aside
          className={`${s.drawer} ${openDay !== null ? s.drawerOn : ""}`}
          aria-label="Day manifest"
          aria-hidden={openDay === null}
        >
          {openDay !== null && (
            <>
              <div className={s.drawerHead}>
                <div>
                  <span className={s.detailEyebrow}>Day manifest</span>
                  <h2 className={s.detailDay}>
                    {dayHeading(openDay, currentMonth)}
                  </h2>
                  <DaySummary events={dayEvents} />
                </div>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button
                    type="button"
                    className={s.expandAllBtn}
                    onClick={toggleAllExpanded}
                    title={
                      expanded.size === dayEvents.length
                        ? "Collapse all events"
                        : "Expand all events"
                    }
                  >
                    {expanded.size === dayEvents.length
                      ? "Collapse All"
                      : "Expand All"}
                  </button>
                  <button
                    type="button"
                    className={s.iconBtn}
                    onClick={close}
                    aria-label="Close"
                  >
                    <X size={15} aria-hidden />
                  </button>
                </div>
              </div>
              <div className={s.drawerBody}>
                <OccurrenceList
                  events={dayEvents}
                  expanded={expanded}
                  onToggle={(id) =>
                    setExpanded((prev) => {
                      const newSet = new Set(prev);
                      if (newSet.has(id)) {
                        newSet.delete(id);
                      } else {
                        newSet.add(id);
                      }
                      return newSet;
                    })
                  }
                />
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
