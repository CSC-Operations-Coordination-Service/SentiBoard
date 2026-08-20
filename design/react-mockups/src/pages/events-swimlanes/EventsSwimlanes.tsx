// DEVOCS-219 — Events page proposal: "Mission swimlanes".
//
// One of the two concepts replacing the rejected chronological list. The list failed because a flat
// stream of events answers "what happened last" and nothing else — an operator on Sentinel-3 had to
// read past everything else to find their own mission. Here the top level is the fleet, not time:
// four rows, one per mission, and each row states its own load before it is opened.
//
// The row header carries three things, all readable without expanding:
//   · the mission, with its satellites listed under it
//   · "N ACTIVE" — how many of its events have data still degraded, lost or in progress
//   · the total event count for the month, and the count of DISTINCT datatakes affected
//
// ON THE WORD "ACTIVE". The Events feed has no open/closed field — see
// design/events-kanban-data-gap.md for the full reading of the data model. What it does carry is
// datatake completeness, from which production derives an overall_status of ok / partial / failed.
// The badge here is that reading and says so on hover and in the footnote: it is not a claim that
// a ticket is open somewhere. Nothing on this page invents a lifecycle the data cannot support.
//
// Rows are collapsed by default. Four collapsed rows are a fleet summary that fits any screen
// without scrolling; four expanded ones are the list this concept exists to replace.
//
// Mock-up only — data is local (data/events-mock.ts); the shipping page is /v1/events.

import { useCallback, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import {
  ACTIVE_DEFINITION,
  CATEGORIES,
  CATEGORY_COLOR,
  CATEGORY_ICONS,
  CATEGORY_STROKE,
  COMPLETENESS,
  EMPTY_FILTERS,
  EVENTS,
  MISSIONS,
  MISSION_NAMES,
  MISSION_SHORT,
  MONTH_LABEL,
  STATUS_ORDER,
  completenessLabel,
  distinctDatatakeCount,
  eventStatus,
  filterEvents,
  groupByMission,
  isUnrecovered,
  satelliteShort,
  sensingWindow,
  shortDayLabel,
  type Datatake,
  type EventCategory,
  type Filters,
  type ManifestEvent,
  type Status,
} from "@/data/events-mock";
import { Collapse, PageDescription, useMediaQuery } from "@/components/ui";
import { EVENTS_SWIMLANES_DESCRIPTION } from "@/data/copy";
import s from "./swimlanes.module.css";

/* Matched to the nav's own breakpoint, so the burger and the folded controls arrive together. */
const NARROW = "(max-width: 760px)";

// ---------------------------------------------------------------------------
// Marks
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
      <span className={s.legendLabel}>Completeness</span>
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
// Datatakes, inside an opened event
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

// ---------------------------------------------------------------------------
// One event, inside an opened lane
// ---------------------------------------------------------------------------

function EventRow({
  event,
  open,
  onToggle,
}: {
  event: ManifestEvent;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = CATEGORY_ICONS[event.category];
  const status = eventStatus(event);
  const lost = event.datatakes.filter((d) => d.status === "unavailable").length;
  const active = isUnrecovered(event);

  return (
    <li className={s.event}>
      <button
        type="button"
        className={s.eventRow}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`sw-ev-${event.id}`}
      >
        <ChevronRight size={13} className={`${s.chev} ${open ? s.chevOpen : ""}`} aria-hidden />

        {/* Type is carried by its glyph in its own colour rather than a text tag: with a mission
            column, a date column and two counts already on the row, a sixth text field would be
            the one nobody reads. */}
        <span className={s.eventIcon} style={{ color: CATEGORY_COLOR[event.category] }}>
          <Icon size={15} strokeWidth={CATEGORY_STROKE} aria-hidden />
        </span>

        <span className={s.eventBody}>
          <span className={s.eventTitle}>{event.title}</span>
          <span className={s.eventMeta}>
            {event.category} · {satelliteShort(event.satellite)}
          </span>
        </span>

        {/* Date, counts, badge and completeness dot in one strip, so the whole block can drop
            under the title as a unit when the row runs out of width, instead of each field
            claiming a line of its own. */}
        <span className={s.eventTail}>
          <span className={s.eventDate}>{shortDayLabel(event.day)}</span>

          {/* The datatake count on the face of the row — the promise this concept makes is that no
              count needs a click. */}
          <span className={s.eventCount}>
            <b>{event.datatakes.length}</b>
            <span className={s.eventCountUnit}> DTK</span>
            {lost > 0 && <em className={s.eventLost}>{lost} lost</em>}
          </span>

          {active && (
            <span className={s.eventActive} title={ACTIVE_DEFINITION}>
              Active
            </span>
          )}

          <StatusCircle status={status} />
        </span>
      </button>

      {/* Rendered whether or not it is open, so the datatakes have a height to slide from —
          mounting them on expand would make the row appear at full size instead. */}
      <Collapse open={open} id={`sw-ev-${event.id}`}>
        <div className={s.eventDetail}>
          <p className={s.eventSummary}>{event.summary}</p>
          <div className={s.dtHead}>
            <span>Impacted datatakes · {event.datatakes.length}</span>
          </div>
          <ul className={s.dtList}>
            {event.datatakes.map((dt) => (
              <DatatakeRow key={`${event.id}-${dt.id}-${dt.product}`} dt={dt} />
            ))}
          </ul>
        </div>
      </Collapse>
    </li>
  );
}

// ---------------------------------------------------------------------------
// One lane
// ---------------------------------------------------------------------------

function Lane({
  mission,
  events,
  open,
  onToggle,
  expandedEvent,
  onToggleEvent,
}: {
  mission: string;
  events: ManifestEvent[];
  open: boolean;
  onToggle: () => void;
  expandedEvent: string | null;
  onToggleEvent: (id: string) => void;
}) {
  const bodyId = useId();
  const active = events.filter(isUnrecovered).length;
  const datatakes = distinctDatatakeCount(events);
  const empty = events.length === 0;

  /* The types present on this mission this month, as coloured pips on the header. Cheap to read,
     and it is the one thing the counts cannot say: five Production events and five Satellite
     anomalies are the same "5" and very different months. */
  const types = useMemo(() => {
    const seen = new Set(events.map((e) => e.category));
    return CATEGORIES.filter((c) => seen.has(c));
  }, [events]);

  return (
    <section className={`${s.lane} ${open ? s.laneOpen : ""} ${empty ? s.laneEmpty : ""}`}>
      <button
        type="button"
        className={s.laneHead}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        /* A lane with nothing in it has nothing to expand, so it is not a control. Disabled rather
           than hidden: a mission missing from the fleet reads as a bug, a quiet one reads as a
           quiet month. */
        disabled={empty}
      >
        <ChevronRight size={16} className={`${s.chev} ${open ? s.chevOpen : ""}`} aria-hidden />

        <span className={s.laneShort} aria-hidden>{MISSION_SHORT[mission]}</span>

        <span className={s.laneName}>
          <span className={s.laneTitle}>{mission}</span>
          <span className={s.laneSats}>{MISSIONS[mission].map(satelliteShort).join(" · ")}</span>
        </span>

        <span className={s.laneBadges}>
          {/* Only when there is something to say: a green "0 ACTIVE" chip on three of four rows is
              four chips of noise around the one that matters. */}
          {active > 0 && (
            <span className={s.activeBadge} title={ACTIVE_DEFINITION}>
              {active} active
            </span>
          )}

          <span className={s.laneTypes} aria-hidden>
            {types.map((c) => (
              <span key={c} className={s.lanePip} style={{ background: CATEGORY_COLOR[c] }} title={c} />
            ))}
          </span>

          <span className={s.laneCount}>
            <b>{events.length}</b> event{events.length === 1 ? "" : "s"}
          </span>

          <span className={s.laneDtk}>
            <b>{datatakes}</b> datatake{datatakes === 1 ? "" : "s"}
          </span>
        </span>
      </button>

      <Collapse open={open} id={bodyId}>
        <ul className={s.eventList}>
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              open={expandedEvent === e.id}
              onToggle={() => onToggleEvent(e.id)}
            />
          ))}
        </ul>
      </Collapse>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function EventsSwimlanes() {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  /* Collapsed by default, as a Set rather than one open lane: comparing two missions is the whole
     point of putting them in rows, and an accordion that closes S1 to open S2 prevents exactly
     that comparison. */
  const [openLanes, setOpenLanes] = useState<Set<string>>(() => new Set());
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const narrow = useMediaQuery(NARROW);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterFieldsId = useId();

  const toggleCategory = useCallback((c: EventCategory) => {
    setFilters((f) => ({
      ...f,
      categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c],
    }));
  }, []);
  const setQuery = useCallback((query: string) => setFilters((f) => ({ ...f, query })), []);
  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const toggleLane = useCallback((mission: string) => {
    setOpenLanes((prev) => {
      const next = new Set(prev);
      if (next.has(mission)) next.delete(mission);
      else next.add(mission);
      return next;
    });
  }, []);

  const toggleEvent = useCallback(
    (id: string) => setExpandedEvent((prev) => (prev === id ? null : id)),
    [],
  );

  /* No mission or satellite select here, unlike the calendar grid: the lanes ARE the mission
     filter, and a control that hides three of the four rows duplicates the collapse it sits
     above. Type and search remain, because neither is expressible by a row. */
  const filtered = useMemo(() => filterEvents(EVENTS, filters), [filters]);
  const byMission = useMemo(() => groupByMission(filtered), [filtered]);

  const totalActive = filtered.filter(isUnrecovered).length;
  const totalDatatakes = distinctDatatakeCount(filtered);
  const dirty = filters.query !== "" || filters.categories.length !== CATEGORIES.length;

  const allOpen = openLanes.size === MISSION_NAMES.length;
  const toggleAll = useCallback(() => {
    setOpenLanes((prev) => (prev.size === MISSION_NAMES.length ? new Set() : new Set(MISSION_NAMES)));
  }, []);

  const filterFields = (
    <>
      <div className={s.fieldRow}>
        <div className={`${s.field} ${s.fieldWide}`}>
          <label htmlFor="sw-search">Search</label>
          <div className={s.withIcon}>
            <span className={s.lead} aria-hidden><Search size={13} /></span>
            <input
              id="sw-search"
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
              style={on ? ({ ["--chip" as string]: CATEGORY_COLOR[c] }) : undefined}
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
            style={{ ["--ex-hero-img" as string]: 'url("/assets/img/modules/Earth_rainforests.jpg")' }}
            aria-hidden
          />
          <div>
            <div className={s.eyebrow}>
              <Link to="/examples">Mock-ups</Link>
              <span aria-hidden>/</span>
              <span>Mission swimlanes</span>
            </div>
            <h1 className={s.title}>Events</h1>
            <p className={s.sub}>
              The month by mission rather than by date. Each row states its event count, its
              affected datatakes and whether any of its data is still missing; open a row for that
              mission's events.
            </p>
            <PageDescription defaultOpen={!narrow}>{EVENTS_SWIMLANES_DESCRIPTION}</PageDescription>
          </div>
        </header>

        <div className={s.monthBar}>
          <span className={s.monthLabel}>{MONTH_LABEL}</span>
          <Legend />
        </div>

        {/* ---------- fleet totals ---------- */}
        <div className={s.totals}>
          <div className={s.total}>
            <span>Events</span>
            <b>{filtered.length}</b>
          </div>
          <div className={s.total}>
            <span title={ACTIVE_DEFINITION}>Active</span>
            <b className={totalActive > 0 ? s.totalWarn : undefined}>{totalActive}</b>
          </div>
          <div className={s.total}>
            <span>Datatakes affected</span>
            <b>{totalDatatakes}</b>
          </div>
          <div className={s.total}>
            <span>Missions with events</span>
            <b>{MISSION_NAMES.filter((m) => (byMission.get(m) ?? []).length > 0).length} / {MISSION_NAMES.length}</b>
          </div>
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

        {/* ---------- lanes ---------- */}
        <div className={s.lanesHead}>
          <span className={s.filtersLabel}>Missions</span>
          <button type="button" className={s.expandAll} onClick={toggleAll}>
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>

        <div className={s.lanes}>
          {MISSION_NAMES.map((m) => (
            <Lane
              key={m}
              mission={m}
              events={byMission.get(m) ?? []}
              open={openLanes.has(m)}
              onToggle={() => toggleLane(m)}
              expandedEvent={expandedEvent}
              onToggleEvent={toggleEvent}
            />
          ))}
        </div>

        <p className={s.hint}>
          {filtered.length === 0
            ? "No events match the current filters — every lane is empty."
            : ACTIVE_DEFINITION}
        </p>
      </div>

      <span className={`ex-badge ${s.badge}`}>
        Events proposal · Mission swimlanes
        <span className={s.badgeTail}> — collapsible rows per mission</span>
      </span>
    </div>
  );
}
