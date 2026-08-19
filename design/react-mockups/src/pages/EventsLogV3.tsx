import { useState, useMemo, useId, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, X, SlidersHorizontal, ChevronRight as ChevronRightSm } from "lucide-react";
import EventIcon from "@/components/EventIcon";
import { Collapse, PageDescription, useMediaQuery } from "@/components/ui";
import { EVENTS_LOG_DESCRIPTION } from "@/data/copy";
import type { IssueType } from "@/data/mock";
import "@/styles/events-log-v3.css";

/* Events page PROPOSAL v3 — mission manifest (ALTERNATIVE to the real
   calendar-grid Events page at "/events", which is untouched).

   A month grid where every day is a cell carrying one tile per event — the
   issue-type glyph tinted with the mission color — beside a day panel whose
   occurrences expand into the impacted datatakes and their completeness status.

   Adapted from the standalone sketch in three ways, all plumbing rather than
   design: the styles live in events-log-v3.css instead of a <style> tag; the
   page's own nav bar and theme switch are gone, because the app already wraps
   every route in <Nav/> with the global toggle, and the stylesheet keys off the
   `:root[data-theme]` attribute that toggle writes; the mock data carries types.

   The palette is intentionally local to this page — near-black canvas, condensed
   display type, one orange signal accent — rather than the shared tokens, since
   the point of the proposal is a different visual direction. */

// ---------------------------------------------------------------------------
// MOCK DATA — modeled on the real Events page taxonomy:
// issue types: Satellite / Calibration / Manoeuvre / Acquisition / Production
// datatake completeness status: Planned / Processing / Acquired / Partial /
// Unavailable — the same five states the real datatake views use
// ---------------------------------------------------------------------------
const MISSIONS = {
  S1: { label: "Sentinel-1", color: "#5AA9FF" },
  S2: { label: "Sentinel-2", color: "#6FCF97" },
  S3: { label: "Sentinel-3", color: "#F2C14E" },
  S5P: { label: "Sentinel-5P", color: "#D98CFF" },
} as const;
type MissionKey = keyof typeof MISSIONS;

// Display label → the app's own issue type. The glyphs then come from
// components/EventIcon, the same component the real /events page renders, so a
// Manoeuvre here is the same joystick as a Manoeuvre there — for good, not just
// until someone edits one of the two lists.
const TYPES: Record<string, { issue: IssueType }> = {
  Satellite: { issue: "satellite" },
  Calibration: { issue: "calibration" },
  Manoeuvre: { issue: "manoeuvre" },
  Acquisition: { issue: "acquisition" },
  Production: { issue: "production" },
};
type TypeKey = keyof typeof TYPES;

const COMPLETENESS = {
  planned: { label: "Planned", color: "var(--status-grey)" },
  processing: { label: "Processing", color: "var(--status-grey)" },
  acquired: { label: "Acquired", color: "var(--green)" },
  partial: { label: "Partial", color: "var(--orange)" },
  unavailable: { label: "Unavailable", color: "var(--red)" },
} as const;
type StatusKey = keyof typeof COMPLETENESS;

// How alarming each state is. Planned and Processing tie: neither has lost data,
// so neither should outrank the other when summarising a day.
const STATUS_RANK: Record<StatusKey, number> = {
  unavailable: 3,
  partial: 2,
  processing: 1,
  planned: 1,
  acquired: 0,
};

interface Datatake {
  id: string;
  status: StatusKey;
  pct: number;
}

interface ManifestEvent {
  id: number;
  day: number;
  time: string;
  mission: MissionKey;
  type: TypeKey;
  title: string;
  desc: string;
  datatakes: Datatake[];
}

const worstStatus = (datatakes: Datatake[]): StatusKey =>
  datatakes.reduce<StatusKey>(
    (worst, d) => (STATUS_RANK[d.status] > STATUS_RANK[worst] ? d.status : worst),
    datatakes[0]?.status ?? "acquired"
  );

const EVENTS: ManifestEvent[] = [
  {
    id: 1, day: 2, time: "04:12", mission: "S1", type: "Manoeuvre", title: "S1A in-plane orbit correction", desc: "Scheduled IPM. No data gap expected.",
    datatakes: [{ id: "GRD_047A", status: "acquired", pct: 100 }, { id: "SLC_047A", status: "acquired", pct: 100 }]
  },
  {
    id: 2, day: 4, time: "18:40", mission: "S3", type: "Acquisition", title: "S3B Trickle Dump data gap", desc: "Downlink interruption over Svalbard station, 41 min gap.",
    datatakes: [{ id: "OL_1_ERR", status: "unavailable", pct: 0 }, { id: "SL_1_RBT", status: "partial", pct: 62 }]
  },
  {
    id: 3, day: 4, time: "19:05", mission: "S3", type: "Production", title: "S3B ground segment investigation opened", desc: "Root-cause analysis in progress with ops team.",
    datatakes: [{ id: "OL_1_ERR", status: "processing", pct: 71 }]
  },
  {
    id: 4, day: 7, time: "09:00", mission: "S5P", type: "Calibration", title: "TROPOMI solar calibration", desc: "Monthly radiometric calibration sequence, nominal.",
    datatakes: [{ id: "L1B_RA_BD3", status: "acquired", pct: 100 }]
  },
  {
    id: 5, day: 9, time: "06:22", mission: "S3", type: "Manoeuvre", title: "S3B unavailability notice — IP Manoeuvre #163", desc: "Planned in-plane manoeuvre, ~35 min instrument outage window.",
    datatakes: [{ id: "OL_1_EFR", status: "planned", pct: 0 }, { id: "OL_2_LFR", status: "planned", pct: 0 }]
  },
  {
    id: 6, day: 12, time: "22:15", mission: "S1", type: "Acquisition", title: "S1C KML acquisition fragment loss", desc: "Acquisition plan fragments not persisted for two consecutive passes.",
    datatakes: [{ id: "PLAN_C_118", status: "unavailable", pct: 0 }]
  },
  {
    id: 7, day: 13, time: "07:50", mission: "S1", type: "Production", title: "S1C fragment persistence restored", desc: "Cache write path patched, backfill completed for affected passes.",
    datatakes: [{ id: "PLAN_C_118", status: "acquired", pct: 100 }]
  },
  {
    id: 8, day: 16, time: "11:30", mission: "S2", type: "Calibration", title: "S2B MSI dark signal calibration", desc: "Routine calibration slot, imaging suspended over calibration site.",
    datatakes: [{ id: "L1C_T33UX", status: "acquired", pct: 100 }]
  },
  {
    id: 9, day: 19, time: "03:05", mission: "S5P", type: "Manoeuvre", title: "S5P orbit maintenance burn", desc: "Nominal maintenance manoeuvre, sun-synchronous orbit correction.",
    datatakes: [{ id: "L1B_RA_BD6", status: "acquired", pct: 100 }, { id: "L2_NO2", status: "processing", pct: 64 }]
  },
  {
    id: 10, day: 22, time: "14:44", mission: "S3", type: "Production", title: "S3A altimetry product delay", desc: "Processing backlog at ground segment, ETA 3h.",
    datatakes: [{ id: "SR_1_SRA", status: "partial", pct: 80 }, { id: "SR_2_LAN", status: "partial", pct: 80 }]
  },
  {
    id: 11, day: 25, time: "08:18", mission: "S2", type: "Manoeuvre", title: "S2A collision avoidance manoeuvre", desc: "Precautionary avoidance manoeuvre executed, orbit nominal post-burn.",
    datatakes: [{ id: "L1C_T31TF", status: "acquired", pct: 100 }]
  },
  {
    id: 12, day: 29, time: "20:02", mission: "S1", type: "Acquisition", title: "S1A downlink station handover delay", desc: "Matera station handover delayed 12 min, minor queue backlog.",
    datatakes: [{ id: "GRD_212B", status: "partial", pct: 91 }]
  },
];

const YEAR = 2026;
const MONTH = 6; // July
const DAYS_IN_MONTH = new Date(YEAR, MONTH + 1, 0).getDate();
const FIRST_WEEKDAY = (new Date(YEAR, MONTH, 1).getDay() + 6) % 7; // Monday = 0
const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const MISSION_KEYS = Object.keys(MISSIONS) as MissionKey[];
const TYPE_KEYS = Object.keys(TYPES) as TypeKey[];
const STATUS_KEYS = Object.keys(COMPLETENESS) as StatusKey[];

/* Matches the nav's own breakpoint so the burger and the one-column layout arrive together. */
const NARROW = "(max-width: 760px)";

const FILTER_TOTAL = MISSION_KEYS.length + TYPE_KEYS.length;

export default function EventsLogV3() {
  const [activeMissions, setActiveMissions] = useState<MissionKey[]>([...MISSION_KEYS]);
  const [activeTypes, setActiveTypes] = useState<TypeKey[]>([...TYPE_KEYS]);
  const [selectedDay, setSelectedDay] = useState<number | null>(4);
  const [openOccurrence, setOpenOccurrence] = useState<number | null>(2);

  const narrow = useMediaQuery(NARROW);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const activeCount = activeMissions.length + activeTypes.length;

  const toggleMission = (m: MissionKey) =>
    setActiveMissions((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const toggleType = (t: TypeKey) =>
    setActiveTypes((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]));

  const filtered = useMemo(
    () => EVENTS.filter((e) => activeMissions.includes(e.mission) && activeTypes.includes(e.type)),
    [activeMissions, activeTypes]
  );

  const byDay = useMemo(() => {
    const map: Record<number, ManifestEvent[]> = {};
    filtered.forEach((e) => {
      map[e.day] = map[e.day] || [];
      map[e.day].push(e);
    });
    return map;
  }, [filtered]);

  const cells = useMemo(() => {
    const arr: (number | null)[] = Array.from({ length: FIRST_WEEKDAY }, () => null);
    for (let d = 1; d <= DAYS_IN_MONTH; d++) arr.push(d);
    return arr;
  }, []);

  const dayEvents = selectedDay ? byDay[selectedDay] ?? [] : [];

  const selectDay = (d: number) => {
    setSelectedDay(d);
    setOpenOccurrence(null);
    // Side by side, picking a day visibly refills the panel next to the grid. Stacked, the panel
    // is below the fold, so the tap would appear to do nothing at all — bring it into view.
    if (narrow) {
      requestAnimationFrame(() =>
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
  };

  const filters = (
    <div className="sb2-filters">
      <div className="sb2-fgroup">
        <span className="sb2-flabel">MISSION</span>
        {MISSION_KEYS.map((key) => {
          const on = activeMissions.includes(key);
          return (
            <button
              key={key}
              className={`sb2-ftab ${on ? "on" : ""}`}
              /* Only set when on. The off state's colour is the stylesheet's business, and it
                 differs per layout: a transparent underline on a desktop, a visible pill border
                 on a phone — an inline "transparent" would flatten the latter. */
              style={on ? { borderColor: MISSIONS[key].color } : undefined}
              onClick={() => toggleMission(key)}
              title={MISSIONS[key].label}
              aria-pressed={on}
            >
              <span className="sb2-dotlegend" style={{ background: MISSIONS[key].color }} />
              {key}
            </button>
          );
        })}
      </div>
      <div className="sb2-fgroup">
        <span className="sb2-flabel">TYPE</span>
        {TYPE_KEYS.map((key) => {
          const on = activeTypes.includes(key);
          return (
            <button
              key={key}
              className={`sb2-ftab ${on ? "on" : ""}`}
              onClick={() => toggleType(key)}
              aria-pressed={on}
            >
              <EventIcon type={TYPES[key].issue} size={12} /> {key}
            </button>
          );
        })}
      </div>
      <div className="sb2-fgroup">
        {/* the space before the break matters: on a phone the <br> is hidden and the two words
            run together into one line, so they need something between them */}
        <span className="sb2-flabel">COMPLETENESS <br />STATUS</span>
        <div className="sb2-legend">
          {STATUS_KEYS.map((key) => (
            <div className="sb2-legend-item" key={key}>
              <span className="sb2-dotlegend" style={{ background: COMPLETENESS[key].color }} />
              {COMPLETENESS[key].label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="sb2-root">
      <div className="sb2-header">
        <div>
          <div className="sb2-h1">July 2026</div>
        </div>
        <div className="sb2-monthnav">
          <button aria-label="Previous month"><ChevronLeft size={narrow ? 18 : 14} /></button>
          <div className="lbl">{filtered.length} events</div>
          <button aria-label="Next month"><ChevronRight size={narrow ? 18 : 14} /></button>
        </div>
      </div>

      <PageDescription defaultOpen={!narrow}>{EVENTS_LOG_DESCRIPTION}</PageDescription>

      {narrow ? (
        <>
          <div className="sb2-filter-toggle-row">
            <button
              type="button"
              className="sb2-filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls={filtersId}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal size={16} aria-hidden />
              FILTERS
              <span className="count">{activeCount}/{FILTER_TOTAL}</span>
              <ChevronDown className="chev" size={17} aria-hidden />
            </button>
          </div>
          <Collapse open={filtersOpen} id={filtersId}>{filters}</Collapse>
        </>
      ) : (
        filters
      )}

      <div className="sb2-body">
        <div className="sb2-grid">
          <div className="sb2-weekrow">
            {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
          </div>
          <div className="sb2-cellgrid">
            {cells.map((d, i) => {
              if (d === null) return <div className="sb2-cell empty" key={`e${i}`} />;
              const events = byDay[d] ?? [];
              const worst = events.length ? worstStatus(events.flatMap((e) => e.datatakes)) : null;
              return (
                <button
                  key={d}
                  className={`sb2-cell ${selectedDay === d ? "selected" : ""} ${worst === "unavailable" || worst === "partial" ? `status-${worst}` : ""}`}
                  onClick={() => selectDay(d)}
                >
                  <div className="sb2-cellnum">{String(d).padStart(2, "0")}</div>
                  <div className="sb2-dots">
                    {events.map((e) => {
                      const mColor = MISSIONS[e.mission].color;
                      return (
                        <span
                          key={e.id}
                          className="sb2-typeicon"
                          style={{ background: `${mColor}33`, color: mColor, borderColor: `${mColor}80` }}
                          title={`${e.mission} · ${e.type}`}
                        >
                          <EventIcon type={TYPES[e.type].issue} size={13} />
                        </span>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="sb2-panel" ref={panelRef}>
          <div className="sb2-panel-head">
            <div>
              <div className="sb2-panel-day">{selectedDay ? String(selectedDay).padStart(2, "0") : "--"} JUL</div>
              <div className="sb2-panel-sub">{dayEvents.length} OCCURRENCE{dayEvents.length !== 1 ? "S" : ""}</div>
            </div>
            <button className="sb2-panel-close" aria-label="Clear day selection" onClick={() => setSelectedDay(null)}>
              <X size={14} />
            </button>
          </div>

          {dayEvents.length === 0 && (
            <div className="sb2-empty-panel">NO EVENTS LOGGED<br />FOR THIS DAY</div>
          )}

          {dayEvents.map((e) => {
            const status = worstStatus(e.datatakes);
            const isOpen = openOccurrence === e.id;
            return (
              <div className="sb2-occ" key={e.id}>
                <button
                  className="sb2-occ-row"
                  onClick={() => setOpenOccurrence(isOpen ? null : e.id)}
                  aria-expanded={isOpen}
                  aria-controls={`sb2-occ-${e.id}`}
                >
                  <ChevronRightSm size={13} className={`sb2-chev ${isOpen ? "open" : ""}`} />
                  <span className="sb2-sw" style={{ background: MISSIONS[e.mission].color }} />
                  <div className="sb2-occ-body">
                    <div className="sb2-occ-title">{e.title}</div>
                    <div className="sb2-occ-meta">
                      <EventIcon type={TYPES[e.type].issue} size={12} /> {e.mission} · {e.type}
                    </div>
                  </div>
                  <span
                    className="sb2-impactdot"
                    style={{ background: COMPLETENESS[status].color }}
                    title={COMPLETENESS[status].label}
                  />
                  <span className="sb2-occ-time">{e.time}</span>
                </button>
                {/* Rendered whether or not it is open, so the datatakes have a height to
                    slide from — mounting them on expand would make the panel appear at
                    full size instead. */}
                <Collapse open={isOpen} id={`sb2-occ-${e.id}`}>
                  <div className="sb2-datatakes">
                    <p className="sb2-occ-desc">{e.desc}</p>
                    {e.datatakes.map((dt) => (
                      <div className="sb2-dt-row" key={dt.id}>
                        <span className="sb2-impactdot" style={{ background: COMPLETENESS[dt.status].color, width: 6, height: 6 }} />
                        <span className="sb2-dt-id">{dt.id}</span>
                        {/* the percentage only means something mid-flight: a
                            Planned datatake has none yet, Acquired is 100 by
                            definition and Unavailable is 0 */}
                        <span className="sb2-dt-pct">
                          {COMPLETENESS[dt.status].label}
                          {dt.status === "processing" || dt.status === "partial" ? ` · ${dt.pct}%` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </Collapse>
              </div>
            );
          })}
        </div>
      </div>

      {/* The badge is fixed over the page, so on a phone the restatement of what the proposal
          looks like is dropped and only its name is kept — otherwise the caption wraps to three
          lines and sits on top of the first occurrence. */}
      <span className="ex-badge sb2-badge">
        Events proposal · Mission manifest
        <span className="tail"> — mission tiles + side panel</span>
      </span>
    </div>
  );
}
