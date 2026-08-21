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

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import {
  ALL_SATELLITES,
  CATEGORIES,
  CATEGORY_ICONS,
  CATEGORY_STROKE,
  COMPLETENESS,
  EMPTY_FILTERS,
  EVENTS,
  MISSIONS,
  MISSION_NAMES,
  MONTH,
  MONTH_LABEL,
  STATUS_ORDER,
  WEEKDAYS,
  YEAR,
  calendarCells,
  completenessLabel,
  dayLabel,
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
import { Collapse, PageDescription, useMediaQuery } from "@/components/ui";
import { EVENTS_DESCRIPTION } from "@/data/copy";
import s from "./manifest.module.css";

/* Matched to the nav's own breakpoint, so the burger and this layout arrive together. */
const NARROW = "(max-width: 760px)";

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
      style={{ background: COMPLETENESS[status].color, width: size, height: size }}
      title={COMPLETENESS[status].label}
    />
  );
}

function Legend() {
  return (
    <div className={s.legend}>
      <span className={s.legendLabel}>Completeness status</span>
      {STATUS_ORDER.map((k) => (
        <span key={k} className={s.legendItem}>
          <span className={s.legendDot} style={{ background: COMPLETENESS[k].color }} aria-hidden />
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
      <span className={s.dtStatus} style={{ color: COMPLETENESS[dt.status].color }}>
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
  expanded: string | null;
  onToggle: (id: string) => void;
}) {
  if (events.length === 0) {
    return <p className={s.emptyDetail}>No events on this day match the current filters.</p>;
  }

  return (
    <ol className={s.occList}>
      {events.map((e) => {
        const Icon = CATEGORY_ICONS[e.category];
        const status = eventStatus(e);
        const open = expanded === e.id;
        const unavailable = e.datatakes.filter((d) => d.status === "unavailable").length;

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
              <ChevronRight size={13} className={`${s.chev} ${open ? s.chevOpen : ""}`} aria-hidden />
              <span className={s.occBody}>
                <span className={s.occTitle}>{e.title}</span>
                <span className={s.occMeta}>
                  <Icon size={12} strokeWidth={CATEGORY_STROKE} aria-hidden /> {e.category} · {e.satellite}
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
                    <DatatakeRow key={`${e.id}-${dt.id}-${dt.product}`} dt={dt} />
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
      {events.length} occurrence{events.length === 1 ? "" : "s"} · {datatakes} datatake
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
  const [expanded, setExpanded] = useState<string | null>(null);

  /* Three fields plus five type chips is most of a phone's first screen, and none of it is the
     month. On a narrow viewport the controls fold away; the head keeps the matching-event count
     and the reset, so a filter left on is still visible while its controls are not. */
  const narrow = useMediaQuery(NARROW);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterFieldsId = useId();

  // A satellite from the old mission would contradict the new one, leaving zero results with no
  // visible cause, so changing mission clears it. Conversely a satellite implies its mission —
  // filling it in beats showing "All missions" next to "Sentinel-1A".
  const setMission = useCallback((mission: string) => {
    setFilters((f) => ({ ...f, mission, satellite: "" }));
  }, []);
  const setSatellite = useCallback((satellite: string) => {
    setFilters((f) => ({ ...f, satellite, mission: satellite ? missionOf(satellite) : f.mission }));
  }, []);
  const toggleCategory = useCallback((c: EventCategory) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));
  }, []);
  const setQuery = useCallback((query: string) => setFilters((f) => ({ ...f, query })), []);
  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const filtered = useMemo(() => filterEvents(EVENTS, filters), [filters]);
  const byDay = useMemo(() => groupByDay(filtered), [filtered]);
  const cells = useMemo(() => calendarCells(YEAR, MONTH), []);

  const dirty =
    filters.mission !== "" ||
    filters.satellite !== "" ||
    filters.query !== "" ||
    filters.categories.length !== CATEGORIES.length;

  const satellites = filters.mission ? MISSIONS[filters.mission] : ALL_SATELLITES;
  // Sentinel-5P flies alone, so there is nothing to choose — the production page disables the
  // selector in exactly this case rather than offering a list of one.
  const satelliteDisabled = satellites.length < 2;

  const close = useCallback(() => setOpenDay(null), []);
  const selectDay = useCallback((day: number) => {
    setOpenDay(day);
    // A newly opened day starts collapsed: the timeline answers "what happened", and
    // auto-expanding the first event would bury it under one event's datatakes.
    setExpanded(null);
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

  const dayEvents = openDay === null ? [] : byDay.get(openDay) ?? [];

  /* The controls themselves, kept out of the markup below so the narrow layout can put them behind
     a toggle without the wide layout gaining a wrapper it has no use for. */
  const filterFields = (
    <>
      <div className={s.fieldRow}>
        <div className={s.field}>
          <label htmlFor="mf-mission">Mission</label>
          <select
            id="mf-mission"
            className={s.control}
            value={filters.mission}
            onChange={(e) => setMission(e.target.value)}
          >
            <option value="">All missions</option>
            {MISSION_NAMES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className={s.field}>
          <label htmlFor="mf-satellite">Satellite</label>
          <select
            id="mf-satellite"
            className={s.control}
            value={filters.satellite}
            onChange={(e) => setSatellite(e.target.value)}
            disabled={satelliteDisabled}
            title={satelliteDisabled ? "Sentinel-5P has a single satellite" : undefined}
          >
            <option value="">All satellites</option>
            {satellites.map((sat) => (
              <option key={sat} value={sat}>{sat}</option>
            ))}
          </select>
        </div>

        <div className={`${s.field} ${s.fieldWide}`}>
          <label htmlFor="mf-search">Search</label>
          <div className={s.withIcon}>
            <span className={s.lead} aria-hidden><Search size={13} /></span>
            <input
              id="mf-search"
              className={s.control}
              type="search"
              placeholder="Event, satellite or datatake ID…"
              value={filters.query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {filters.query && (
              <button type="button" className={s.clear} onClick={() => setQuery("")} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={s.chipRow}>
        <span className={s.chipRowLabel}>Event type</span>
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          const on = filters.categories.includes(c);
          return (
            <button
              key={c}
              type="button"
              className={`${s.chip} ${on ? s.chipOn : ""}`}
              onClick={() => toggleCategory(c)}
              aria-pressed={on}
            >
              <Icon size={13} strokeWidth={CATEGORY_STROKE} aria-hidden /> {c}
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <div className={s.page}>
      <div className={s.inner}>
        {/* The header art — the shared /examples backdrop recipe (.ex-hero-bg in global.css),
            sitting inside the header this page already had. The header keeps its own geometry;
            .ex-hero-host only adds a positioning context and lifts the copy above the image. */}
        <header className={`${s.head} ex-hero-host ${s.headArt}`}>
          <div
            className="ex-hero-bg"
            style={{ ["--ex-hero-img" as string]: 'url("/assets/img/modules/Tibetan_Plateau.jpg")' }}
            aria-hidden
          />
          <div>
            <div className={s.eyebrow}>
              <Link to="/examples">Mock-ups</Link>
              <span aria-hidden>/</span>
              <span>Mission Manifest</span>
            </div>
            <h1 className={s.title}>Events</h1>
            <p className={s.sub}>
              Events that could impede data production — calibration activities, manoeuvres,
              platform anomalies and ground-segment issues — with the datatakes each one impacts.
              Select a day to open its manifest.
            </p>
            <PageDescription defaultOpen={!narrow}>{EVENTS_DESCRIPTION}</PageDescription>
          </div>
        </header>

        <div className={s.monthBar}>
          <div className={s.monthNav}>
            <button type="button" disabled title="Mock data covers August 2026 only" aria-label="Previous month">
              <ChevronLeft size={15} aria-hidden />
            </button>
            <span className={s.monthLabel}>{MONTH_LABEL}</span>
            <button type="button" disabled title="Mock data covers August 2026 only" aria-label="Next month">
              <ChevronRight size={15} aria-hidden />
            </button>
          </div>
          <Legend />
        </div>

        {/* ---------- filters ---------- */}
        <section className={s.filters} aria-label="Filters">
          <div className={s.filtersHead}>
            <SlidersHorizontal size={13} aria-hidden />
            <span className={s.filtersLabel}>Filters</span>
            <span className={s.count}>
              {filtered.length} event{filtered.length === 1 ? "" : "s"}
            </span>
            {dirty && (
              <button type="button" className={s.reset} onClick={reset}>
                <RotateCcw size={12} aria-hidden /> Reset
              </button>
            )}
            {/* Its own button rather than the whole head row: the reset lives in that row too, and
                a button cannot be nested inside another button. */}
            {narrow && (
              <button
                type="button"
                className={s.filtersToggle}
                aria-expanded={filtersOpen}
                aria-controls={filterFieldsId}
                aria-label={filtersOpen ? "Hide filter controls" : "Show filter controls"}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <ChevronDown size={16} aria-hidden />
              </button>
            )}
          </div>

          {narrow ? <Collapse open={filtersOpen} id={filterFieldsId}>{filterFields}</Collapse> : filterFields}
        </section>

        {/* ---------- month grid ---------- */}
        <div className={s.calWrap}>
          <div className={s.dow} aria-hidden>
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className={s.grid}>
            {cells.map((c, i) => {
              // Neighbouring-month cells exist only so the weeks line up; they carry no events and
              // are inert <div>s rather than disabled buttons, which keeps them out of the tab order.
              if (c.dim) return <div key={`dim-${i}`} className={`${s.cell} ${s.cellDim}`} aria-hidden />;

              const events = byDay.get(c.day) ?? [];
              const status = events.length ? dayStatus(events) : null;
              const selected = openDay === c.day;

              return (
                <button
                  key={c.day}
                  type="button"
                  className={`${s.cell} ${selected ? s.cellSel : ""}`}
                  onClick={() => selectDay(c.day)}
                  aria-pressed={selected}
                  /* The glyphs are aria-hidden, so the types they now encode have to reach a
                     screen reader through the label. The dots carried no type at all, so this is
                     information the cell gained rather than information it is repeating. */
                  aria-label={
                    events.length
                      ? `${c.day} August, ${events.length} event${events.length === 1 ? "" : "s"}, ${typeSummary(events)}, worst completeness ${COMPLETENESS[status!].label}`
                      : `${c.day} August, no events`
                  }
                >
                  <span className={s.cellNum}>{String(c.day).padStart(2, "0")}</span>

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
                        return (
                          <span
                            key={e.id}
                            className={s.mark}
                            title={`${e.time} · ${e.category} · ${e.satellite}`}
                          >
                            <Icon size={13} strokeWidth={CATEGORY_STROKE} aria-hidden />
                          </span>
                        );
                      })}
                      {/* A glyph is far bigger than the 5px dot it replaces, so a busy day can no
                          longer show one mark per event. The mock's busiest day has two; a real
                          month will have more, and silently dropping them would make the grid
                          under-report. */}
                      {events.length > MARKS_SHOWN && (
                        <em className={s.markMore}>+{events.length - MARKS_SHOWN}</em>
                      )}
                    </span>
                  )}

                  {/* Loss stripe, drawn only for Partial and Unavailable. Planned, Processing and
                      Acquired days stay unmarked — nothing has been lost there. */}
                  {status && marksLoss(status) && (
                    <span className={s.lossBar} style={{ background: COMPLETENESS[status].color }} aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <p className={s.hint}>
          {filtered.length === 0
            ? "No events match the current filters."
            : "Every icon is one event, drawn with its event type's glyph — the same icons as the type filters above. A coloured stripe marks a day where completeness was degraded or lost."}
        </p>
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
                <h2 className={s.detailDay}>{dayLabel(openDay)}</h2>
                <DaySummary events={dayEvents} />
              </div>
              <button type="button" className={s.iconBtn} onClick={close} aria-label="Close">
                <X size={15} aria-hidden />
              </button>
            </div>
            <div className={s.drawerBody}>
              <OccurrenceList
                events={dayEvents}
                expanded={expanded}
                onToggle={(id) => setExpanded((prev) => (prev === id ? null : id))}
              />
            </div>
          </>
        )}
      </aside>
      {/* The badge is fixed over the page; on a phone the description of the layout is dropped and
          only the proposal's name kept, or the caption wraps across the content underneath it. */}
      <span className={`ex-badge ${s.badge}`}>
        Events proposal · Mission manifest
        <span className={s.badgeTail}> — filters + day drawer</span>
      </span>
    </div>
  );
}
