import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/theme";
import { PERIODS, inPeriod, type PeriodId } from "@/data/period";

/* =============================================================================
   DEVOCS-219 — Events page concepts, telemetry register. PROPOSALS only; the real
   Events page (/events) is untouched. Reachable at /examples/events-spacex.

   Two layouts behind one tab bar, so they can be compared without leaving the page:

     A · ORBITAL TIMELINE — missions on the Y axis, the month's days on the X, every
         event a block on its mission's track. Answers "what was happening, to whom,
         and for how long" in one read. Lanes are packed so overlapping events on the
         same mission stack instead of hiding each other.

     B · TELEMETRY GRID — the month as day tiles carrying micro status pills. Answers
         "which days went wrong" first, then opens the day's log on the right.

   COMMON WITH THE DATA AVAILABILITY MOCK-UPS, as asked:
     · Theme is declared at the top of the app and only read here — no in-page toggle,
       no clock. The palette below is the same telemetry set the Data Availability
       concept uses, so the two read as one family.
     · The period filter is the shared control from data/period.ts — the same ids and
       labels production carries in its top navigation.

   ONE THING WORTH KNOWING ABOUT THE PERIOD PRESETS. The brief asks for August 2026
   data, so the events are pinned to that month. A preset like "Last 7 Days" measured
   against the real clock would therefore show an empty page from September onwards.
   The presets are measured against MOCK_NOW instead — a fixed instant inside the
   dataset — so the control stays demonstrable however long this mock-up lives. Swap
   it for anchorNow() the moment this is wired to real events.
   ============================================================================= */

// -----------------------------------------------------------------------------
// Domain
// -----------------------------------------------------------------------------

type EventKind = "SATELLITE" | "CALIBRATION" | "MANOEUVRE" | "ACQUISITION" | "PRODUCTION";
type DayStatus = "NOMINAL" | "INCIDENT" | "MAINTENANCE";
type ImpactStatus = "PARTIAL" | "UNAVAILABLE" | "RECOVERED" | "NONE";

interface ImpactedDatatake {
  id: string;
  status: ImpactStatus;
  completeness: number;
}

interface MissionEvent {
  id: string;
  kind: EventKind;
  /** Planned work reads as maintenance; everything else is an incident. */
  planned: boolean;
  mission: string;
  satellites: string[];
  title: string;
  summary: string;
  start: Date;
  end: Date;
  impact: ImpactStatus;
  datatakes: ImpactedDatatake[];
}

const MISSIONS = ["Sentinel-1", "Sentinel-2", "Sentinel-3", "Sentinel-5P"] as const;

const KIND_VAR: Record<EventKind, string> = {
  SATELLITE: "var(--evx-k-sat)",
  CALIBRATION: "var(--evx-k-cal)",
  MANOEUVRE: "var(--evx-k-man)",
  ACQUISITION: "var(--evx-k-acq)",
  PRODUCTION: "var(--evx-k-prod)",
};

const STATUS_VAR: Record<DayStatus, string> = {
  NOMINAL: "var(--evx-ok)",
  INCIDENT: "var(--evx-crit)",
  MAINTENANCE: "var(--evx-plan)",
};

const IMPACT_VAR: Record<ImpactStatus, string> = {
  PARTIAL: "var(--evx-warn)",
  UNAVAILABLE: "var(--evx-crit)",
  RECOVERED: "var(--evx-ok)",
  NONE: "var(--evx-faint)",
};

// -----------------------------------------------------------------------------
// Time
// -----------------------------------------------------------------------------

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DOW = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const pad = (n: number) => String(n).padStart(2, "0");
const utc = (y: number, m: number, d: number, h = 0, min = 0) => new Date(Date.UTC(y, m, d, h, min));
const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fmtTime = (d: Date) => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const fmtStamp = (d: Date) => `${fmtDate(d)} ${fmtTime(d)}Z`;

function durationLabel(a: Date, b: Date) {
  const mins = Math.round((b.getTime() - a.getTime()) / 60000);
  if (mins < 60) return `${mins} MIN`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}H ${pad(m)}M` : `${h}H`;
  return `${Math.floor(h / 24)}D ${h % 24}H`;
}

/** Monday-first weekday index, which is how the dashboard's calendar is laid out. */
const dowIndex = (d: Date) => (d.getUTCDay() + 6) % 7;
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// -----------------------------------------------------------------------------
// Mock data — August 2026
//
// Modelled on the taxonomy of the real Events page: Satellite / Calibration /
// Manoeuvre / Acquisition / Production, each carrying the datatakes it impacted and
// how complete they ended up. Ids follow the dashboard's JIRA-style keys.
// -----------------------------------------------------------------------------

const Y = 2026;
const M = 7; // August, zero-based

/** The instant the period presets measure back from — see the header note. */
const MOCK_NOW = utc(Y, M, 26, 12, 0);

function dtk(id: string, status: ImpactStatus, completeness: number): ImpactedDatatake {
  return { id, status, completeness };
}

const EVENTS: MissionEvent[] = [
  {
    id: "GSANOM-4802",
    kind: "ACQUISITION",
    planned: false,
    mission: "Sentinel-3",
    satellites: ["S3A"],
    title: "Svalbard downlink outage",
    summary:
      "X-band acquisition at the Svalbard station failed over two consecutive passes after an antenna drive fault. Data was recovered on the following orbit via Matera.",
    start: utc(Y, M, 2, 4, 12),
    end: utc(Y, M, 2, 9, 40),
    impact: "PARTIAL",
    datatakes: [
      dtk("S3A_OLCI_20260802T041200_A17C2E", "PARTIAL", 62),
      dtk("S3A_SLSTR_20260802T055400_B04F19", "RECOVERED", 100),
      dtk("S3A_SRAL_20260802T072100_9CE30D", "PARTIAL", 74),
    ],
  },
  {
    id: "GSCAL-1180",
    kind: "CALIBRATION",
    planned: true,
    mission: "Sentinel-2",
    satellites: ["S2A"],
    title: "MSI radiometric calibration campaign",
    summary:
      "Scheduled absolute radiometric calibration over the Libya-4 desert site. Acquisitions continue; L1C publication is held until the new coefficients are validated.",
    start: utc(Y, M, 3, 8, 0),
    end: utc(Y, M, 5, 18, 0),
    impact: "NONE",
    datatakes: [dtk("S2A_MSI_20260803T093015_44D1AB", "RECOVERED", 100)],
  },
  {
    id: "GSANOM-4811",
    kind: "PRODUCTION",
    planned: false,
    mission: "Sentinel-5P",
    satellites: ["S5P"],
    title: "NRTI processor backlog",
    summary:
      "A processor node failure in the NRTI chain produced a publication backlog of roughly nine hours. OFFL products were unaffected.",
    start: utc(Y, M, 4, 21, 30),
    end: utc(Y, M, 5, 6, 45),
    impact: "PARTIAL",
    datatakes: [
      dtk("S5P_TROPOMI_20260804T213000_7F2A11", "PARTIAL", 48),
      dtk("S5P_TROPOMI_20260805T012200_5B99C4", "PARTIAL", 55),
    ],
  },
  {
    id: "GSMAN-0774",
    kind: "MANOEUVRE",
    planned: true,
    mission: "Sentinel-1",
    satellites: ["S1C"],
    title: "Out-of-plane orbit correction",
    summary:
      "Planned out-of-plane manoeuvre to restore the reference ground track. Acquisitions suspended for the burn and the settling period that follows it.",
    start: utc(Y, M, 6, 10, 0),
    end: utc(Y, M, 6, 14, 20),
    impact: "NONE",
    datatakes: [],
  },
  {
    id: "GSANOM-4818",
    kind: "SATELLITE",
    planned: false,
    mission: "Sentinel-1",
    satellites: ["S1A"],
    title: "C-SAR safe mode",
    summary:
      "The instrument entered safe mode after a power-bus transient. Recovery took two orbits; all datatakes in the window were lost and could not be re-planned.",
    start: utc(Y, M, 7, 2, 5),
    end: utc(Y, M, 7, 16, 30),
    impact: "UNAVAILABLE",
    datatakes: [
      dtk("S1A_IW_20260807T020500_C11D08", "UNAVAILABLE", 0),
      dtk("S1A_IW_20260807T035100_D82B47", "UNAVAILABLE", 0),
      dtk("S1A_EW_20260807T053300_E904A2", "UNAVAILABLE", 0),
    ],
  },
  {
    id: "GSMNT-0321",
    kind: "PRODUCTION",
    planned: true,
    mission: "Sentinel-2",
    satellites: ["S2A", "S2B", "S2C"],
    title: "PDGS scheduled maintenance",
    summary:
      "Planned ground-segment maintenance window. Publication paused and drained afterwards; no acquisitions were lost.",
    start: utc(Y, M, 9, 6, 0),
    end: utc(Y, M, 9, 18, 0),
    impact: "NONE",
    datatakes: [dtk("S2B_MSI_20260809T101500_3A77F0", "RECOVERED", 100)],
  },
  {
    id: "GSANOM-4821",
    kind: "ACQUISITION",
    planned: false,
    mission: "Sentinel-3",
    satellites: ["S3A", "S3B"],
    title: "Inuvik station WAN degradation",
    summary:
      "Reduced WAN throughput at Inuvik delayed dump transfers across both units for most of the day. Publication caught up overnight.",
    start: utc(Y, M, 11, 5, 45),
    end: utc(Y, M, 12, 2, 15),
    impact: "PARTIAL",
    datatakes: [
      dtk("S3A_OLCI_20260811T060200_2D5E8B", "PARTIAL", 81),
      dtk("S3B_SLSTR_20260811T114500_66A0C3", "PARTIAL", 69),
      dtk("S3B_OLCI_20260811T193000_8E12F5", "RECOVERED", 100),
    ],
  },
  {
    id: "GSCAL-1186",
    kind: "CALIBRATION",
    planned: true,
    mission: "Sentinel-5P",
    satellites: ["S5P"],
    title: "TROPOMI irradiance calibration",
    summary: "Routine solar irradiance measurement. No user-facing impact on the L2 chain.",
    start: utc(Y, M, 12, 9, 15),
    end: utc(Y, M, 12, 11, 45),
    impact: "NONE",
    datatakes: [],
  },
  {
    id: "GSANOM-4829",
    kind: "SATELLITE",
    planned: false,
    mission: "Sentinel-2",
    satellites: ["S2C"],
    title: "Star tracker anomaly",
    summary:
      "One of the three star trackers dropped out, degrading geolocation accuracy. Products were published with a quality flag until the unit was recovered.",
    start: utc(Y, M, 14, 13, 20),
    end: utc(Y, M, 16, 8, 0),
    impact: "PARTIAL",
    datatakes: [
      dtk("S2C_MSI_20260814T134000_A0B3D1", "PARTIAL", 72),
      dtk("S2C_MSI_20260815T102200_F41C9E", "PARTIAL", 64),
      dtk("S2C_MSI_20260816T073000_1B8D55", "RECOVERED", 96),
    ],
  },
  {
    id: "GSMAN-0781",
    kind: "MANOEUVRE",
    planned: true,
    mission: "Sentinel-3",
    satellites: ["S3B"],
    title: "In-plane manoeuvre",
    summary: "Routine in-plane manoeuvre to maintain the repeat cycle. Brief acquisition suspension.",
    start: utc(Y, M, 17, 7, 30),
    end: utc(Y, M, 17, 10, 0),
    impact: "NONE",
    datatakes: [],
  },
  {
    id: "GSANOM-4834",
    kind: "PRODUCTION",
    planned: false,
    mission: "Sentinel-1",
    satellites: ["S1A", "S1C"],
    title: "IPF regression on IW SLC",
    summary:
      "A processor baseline rollout introduced a regression on IW SLC products. Affected products were withdrawn and reprocessed with the previous baseline.",
    start: utc(Y, M, 18, 11, 0),
    end: utc(Y, M, 20, 15, 30),
    impact: "UNAVAILABLE",
    datatakes: [
      dtk("S1A_IW_20260818T112000_74EE21", "UNAVAILABLE", 0),
      dtk("S1C_IW_20260819T054500_9033AC", "UNAVAILABLE", 12),
      dtk("S1A_IW_20260820T081500_C5D7B6", "RECOVERED", 100),
    ],
  },
  {
    id: "GSMNT-0327",
    kind: "ACQUISITION",
    planned: true,
    mission: "Sentinel-5P",
    satellites: ["S5P"],
    title: "Kiruna antenna maintenance",
    summary: "Planned antenna maintenance. Dumps rerouted to Svalbard for the duration; no data lost.",
    start: utc(Y, M, 21, 5, 0),
    end: utc(Y, M, 22, 17, 0),
    impact: "NONE",
    datatakes: [dtk("S5P_TROPOMI_20260821T093000_2C64FA", "RECOVERED", 100)],
  },
  {
    id: "GSANOM-4840",
    kind: "ACQUISITION",
    planned: false,
    mission: "Sentinel-2",
    satellites: ["S2B"],
    title: "Maspalomas pass loss",
    summary: "A single pass was lost to a ground-station scheduling conflict. The datatake was not recoverable.",
    start: utc(Y, M, 23, 16, 40),
    end: utc(Y, M, 23, 18, 10),
    impact: "UNAVAILABLE",
    datatakes: [dtk("S2B_MSI_20260823T164500_B7A2E8", "UNAVAILABLE", 0)],
  },
  {
    id: "GSCAL-1192",
    kind: "CALIBRATION",
    planned: true,
    mission: "Sentinel-1",
    satellites: ["S1A"],
    title: "C-SAR antenna pattern characterisation",
    summary: "Scheduled antenna pattern measurement over the Amazon rainforest reference target.",
    start: utc(Y, M, 24, 12, 0),
    end: utc(Y, M, 25, 6, 0),
    impact: "NONE",
    datatakes: [],
  },
  {
    id: "GSANOM-4847",
    kind: "SATELLITE",
    planned: false,
    mission: "Sentinel-3",
    satellites: ["S3A"],
    title: "OLCI thermal excursion",
    summary:
      "A thermal excursion on the OLCI focal plane forced a temporary instrument shutdown. Radiometric quality was flagged for the surrounding orbits.",
    start: utc(Y, M, 26, 3, 10),
    end: utc(Y, M, 27, 12, 45),
    impact: "PARTIAL",
    datatakes: [
      dtk("S3A_OLCI_20260826T033000_5E19B2", "PARTIAL", 41),
      dtk("S3A_OLCI_20260827T041000_A6C80F", "PARTIAL", 58),
    ],
  },
  {
    id: "GSMNT-0333",
    kind: "PRODUCTION",
    planned: true,
    mission: "Sentinel-5P",
    satellites: ["S5P"],
    title: "L2 chain baseline upgrade",
    summary: "Planned upgrade of the L2 processing baseline. NRTI publication delayed while the chain drained.",
    start: utc(Y, M, 28, 8, 0),
    end: utc(Y, M, 29, 20, 0),
    impact: "NONE",
    datatakes: [dtk("S5P_TROPOMI_20260828T113000_D2B4E7", "RECOVERED", 100)],
  },
  {
    id: "GSANOM-4853",
    kind: "ACQUISITION",
    planned: false,
    mission: "Sentinel-1",
    satellites: ["S1C"],
    title: "Neustrelitz dump failure",
    summary: "A dump failed on acquisition; the datatake was recovered on the next visibility window.",
    start: utc(Y, M, 30, 19, 25),
    end: utc(Y, M, 31, 4, 5),
    impact: "PARTIAL",
    datatakes: [
      dtk("S1C_EW_20260830T193000_11FA6D", "PARTIAL", 77),
      dtk("S1C_IW_20260831T021500_3D0E94", "RECOVERED", 100),
    ],
  },
];

// -----------------------------------------------------------------------------
// Derivation
// -----------------------------------------------------------------------------

/** An event belongs to every day it touches, not just the day it started. */
function eventDays(e: MissionEvent, year: number, month: number): number[] {
  const days: number[] = [];
  const last = daysInMonth(year, month);
  for (let d = 1; d <= last; d++) {
    const from = utc(year, month, d);
    const to = utc(year, month, d, 23, 59);
    if (e.start <= to && e.end >= from) days.push(d);
  }
  return days;
}

function dayStatus(events: MissionEvent[]): DayStatus {
  if (events.some((e) => !e.planned)) return "INCIDENT";
  if (events.length) return "MAINTENANCE";
  return "NOMINAL";
}

/** Greedy lane packing: overlapping events on one mission stack rather than hide each other. */
function packLanes(events: MissionEvent[]): { event: MissionEvent; lane: number }[] {
  const laneEnds: number[] = [];
  return [...events]
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((event) => {
      let lane = laneEnds.findIndex((end) => end <= event.start.getTime());
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = event.end.getTime();
      return { event, lane };
    });
}

// -----------------------------------------------------------------------------
// Icons — inline, so this file adds no dependency
// -----------------------------------------------------------------------------

const svgProps = (size: number) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "square" as const, strokeLinejoin: "miter" as const,
});
const IconPrev = () => <svg {...svgProps(14)} aria-hidden><path d="M15 6l-6 6 6 6" /></svg>;
const IconNext = () => <svg {...svgProps(14)} aria-hidden><path d="M9 6l6 6-6 6" /></svg>;
const IconClose = ({ size = 14 }: { size?: number }) => (
  <svg {...svgProps(size)} aria-hidden><path d="M5 5l14 14M19 5L5 19" /></svg>
);

// -----------------------------------------------------------------------------
// Shared pieces
// -----------------------------------------------------------------------------

function KindTag({ kind }: { kind: EventKind }) {
  return (
    <span className="evx-kind" style={{ ["--k" as string]: KIND_VAR[kind] }}>
      {kind}
    </span>
  );
}

function ImpactTag({ impact }: { impact: ImpactStatus }) {
  return (
    <span className="evx-impact" style={{ ["--k" as string]: IMPACT_VAR[impact] }}>
      {impact}
    </span>
  );
}

/** The event body both concepts show — A in a popover, B in the slide-over. */
function EventBody({ event }: { event: MissionEvent }) {
  return (
    <>
      <div className="evx-ev-head">
        <KindTag kind={event.kind} />
        <span className={event.planned ? "evx-flag planned" : "evx-flag"}>
          {event.planned ? "PLANNED" : "UNPLANNED"}
        </span>
        <ImpactTag impact={event.impact} />
      </div>
      <h4 className="evx-ev-title">{event.title}</h4>
      <div className="evx-ev-kvs">
        <div><span>EVENT ID</span><b>{event.id}</b></div>
        <div><span>MISSION</span><b>{event.mission}</b></div>
        <div><span>UNITS</span><b>{event.satellites.join(" · ")}</b></div>
        <div><span>START</span><b>{fmtStamp(event.start)}</b></div>
        <div><span>END</span><b>{fmtStamp(event.end)}</b></div>
        <div><span>DURATION</span><b>{durationLabel(event.start, event.end)}</b></div>
      </div>
      <p className="evx-ev-sum">{event.summary}</p>
      <div className="evx-ev-sec">
        <span>IMPACTED DATATAKES</span>
        <span>{event.datatakes.length}</span>
      </div>
      {event.datatakes.length === 0 ? (
        <p className="evx-ev-none">NO DATATAKES IMPACTED</p>
      ) : (
        <ul className="evx-dtk">
          {event.datatakes.map((d) => (
            <li key={d.id}>
              <span className="evx-dtk-id">{d.id}</span>
              <span className="evx-dtk-bar">
                <i style={{ width: `${d.completeness}%`, background: IMPACT_VAR[d.status] }} />
              </span>
              <span className="evx-dtk-pct">{pad(d.completeness)}%</span>
              <ImpactTag impact={d.status} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Escape, backdrop dismissal, focus capture and return, and the page behind held still.
 *  One implementation, both concepts — A mounts it as a popover, B as a slide-over. */
function Overlay({
  side,
  labelledBy,
  onClose,
  children,
}: {
  side: "center" | "right";
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fromBackdrop = useRef(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const inside = panelRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !inside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    const { body } = document;
    const overflow = body.style.overflow;
    const padding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padding;
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  return (
    <div
      className={`evx-backdrop ${side}`}
      onMouseDown={(e) => {
        fromBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (fromBackdrop.current && e.target === e.currentTarget) onClose();
        fromBackdrop.current = false;
      }}
    >
      <div
        className={side === "right" ? "evx-slideover" : "evx-popover"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        ref={panelRef}
      >
        {children}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CONCEPT A — orbital timeline
// -----------------------------------------------------------------------------

function ConceptA({
  events,
  year,
  month,
  onOpen,
}: {
  events: MissionEvent[];
  year: number;
  month: number;
  onOpen: (e: MissionEvent) => void;
}) {
  const total = daysInMonth(year, month);
  const monthStart = utc(year, month, 1).getTime();
  const span = utc(year, month, total, 23, 59).getTime() - monthStart;
  const days = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <div className="evx-gantt">
      <div className="evx-gantt-scroll">
        <div className="evx-gantt-inner">
          {/* day scale */}
          <div className="evx-gantt-row evx-gantt-head">
            <div className="evx-track-label" />
            <div className="evx-track-plot">
              {days.map((d) => {
                const wd = dowIndex(utc(year, month, d));
                return (
                  <span key={d} className={wd > 4 ? "evx-tick weekend" : "evx-tick"} style={{ left: `${((d - 1) / total) * 100}%`, width: `${100 / total}%` }}>
                    {d}
                  </span>
                );
              })}
            </div>
          </div>

          {MISSIONS.map((mission) => {
            const packed = packLanes(events.filter((e) => e.mission === mission));
            const laneCount = Math.max(1, ...packed.map((p) => p.lane + 1));
            return (
              <div className="evx-gantt-row" key={mission}>
                <div className="evx-track-label">
                  <b>{mission.replace("Sentinel-", "S")}</b>
                  <span>{packed.length} EV</span>
                </div>
                <div className="evx-track-plot" style={{ height: laneCount * 30 + 10 }}>
                  {days.map((d) => {
                    const wd = dowIndex(utc(year, month, d));
                    return (
                      <span
                        key={d}
                        className={wd > 4 ? "evx-col weekend" : "evx-col"}
                        style={{ left: `${((d - 1) / total) * 100}%`, width: `${100 / total}%` }}
                        aria-hidden
                      />
                    );
                  })}
                  {packed.map(({ event, lane }) => {
                    const from = Math.max(event.start.getTime(), monthStart);
                    const to = Math.min(event.end.getTime(), monthStart + span);
                    const left = ((from - monthStart) / span) * 100;
                    const width = Math.max(0.9, ((to - from) / span) * 100);
                    return (
                      <button
                        key={event.id}
                        className={event.planned ? "evx-block planned" : "evx-block"}
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          top: lane * 30 + 5,
                          ["--k" as string]: KIND_VAR[event.kind],
                        }}
                        onClick={() => onOpen(event)}
                        title={`${event.id} · ${event.title}`}
                      >
                        <span className="evx-block-t">{event.id}</span>
                      </button>
                    );
                  })}
                  {packed.length === 0 && <span className="evx-track-empty">NO EVENTS</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CONCEPT B — telemetry grid
// -----------------------------------------------------------------------------

function ConceptB({
  events,
  year,
  month,
  onOpen,
}: {
  events: MissionEvent[];
  year: number;
  month: number;
  onOpen: (day: number) => void;
}) {
  const total = daysInMonth(year, month);
  const lead = dowIndex(utc(year, month, 1));
  const byDay = useMemo(() => {
    const map = new Map<number, MissionEvent[]>();
    events.forEach((e) => eventDays(e, year, month).forEach((d) => map.set(d, [...(map.get(d) ?? []), e])));
    return map;
  }, [events, year, month]);

  return (
    <div className="evx-grid">
      <div className="evx-grid-dow">
        {DOW.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="evx-grid-tiles">
        {Array.from({ length: lead }, (_, i) => (
          <div className="evx-tile blank" key={`b${i}`} aria-hidden />
        ))}
        {Array.from({ length: total }, (_, i) => i + 1).map((day) => {
          const dayEvents = byDay.get(day) ?? [];
          const status = dayStatus(dayEvents);
          const impacted = dayEvents.reduce((n, e) => n + e.datatakes.length, 0);
          return (
            <button
              className={`evx-tile ${status.toLowerCase()}`}
              key={day}
              style={{ ["--k" as string]: STATUS_VAR[status] }}
              onClick={() => onOpen(day)}
              aria-label={`${fmtDate(utc(year, month, day))} — ${status}, ${dayEvents.length} events`}
            >
              <span className="evx-tile-d">{pad(day)}</span>
              <span className="evx-tile-s">{status}</span>
              <span className="evx-tile-pills">
                {dayEvents.slice(0, 4).map((e) => (
                  <i key={e.id} style={{ background: KIND_VAR[e.kind] }} />
                ))}
                {dayEvents.length > 4 && <em>+{dayEvents.length - 4}</em>}
              </span>
              {impacted > 0 && <span className="evx-tile-dtk">{impacted} DTK</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

type View = "A" | "B";

export default function EventsSpaceXConcepts() {
  // Theme is declared at the top of the app; this page only reads it.
  const { theme } = useTheme();
  const [view, setView] = useState<View>("A");
  const [year, setYear] = useState(Y);
  const [month, setMonth] = useState(M);
  const [period, setPeriod] = useState<PeriodId>("custom"); // "custom" = the whole displayed month
  const [openEvent, setOpenEvent] = useState<MissionEvent | null>(null);
  const [openDay, setOpenDay] = useState<number | null>(null);

  const step = useCallback((delta: number) => {
    setOpenEvent(null);
    setOpenDay(null);
    setMonth((m) => {
      const next = m + delta;
      if (next < 0) {
        setYear((y) => y - 1);
        return 11;
      }
      if (next > 11) {
        setYear((y) => y + 1);
        return 0;
      }
      return next;
    });
  }, []);

  /* Events of the displayed month, then narrowed by the period when one is chosen. The presets
     measure back from MOCK_NOW, not the wall clock — see the header note. */
  const monthEvents = useMemo(
    () => EVENTS.filter((e) => eventDays(e, year, month).length > 0),
    [year, month],
  );
  const events = useMemo(
    () => (period === "custom" ? monthEvents : monthEvents.filter((e) => inPeriod(e.end, period, MOCK_NOW))),
    [monthEvents, period],
  );

  const incidents = events.filter((e) => !e.planned).length;
  const planned = events.length - incidents;
  const impacted = events.reduce((n, e) => n + e.datatakes.length, 0);
  const lost = events.reduce((n, e) => n + e.datatakes.filter((d) => d.status === "UNAVAILABLE").length, 0);

  const dayEvents = useMemo(() => {
    if (openDay === null) return [];
    return events
      .filter((e) => eventDays(e, year, month).includes(openDay))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [openDay, events, year, month]);

  return (
    <div className="evx" data-theme={theme === "light" ? "light" : "dark"}>
      <style>{CSS}</style>

      <div className="evx-wrap">
        {/* ---------------- header ---------------- */}
        <header className="evx-head">
          <div>
            <div className="evx-tagline">
              <span className="evx-live" aria-hidden />
              COPERNICUS · SENTINEL OPERATIONS
            </div>
            <h1 className="evx-h1">EVENTS</h1>
            <p className="evx-lede">
              Calibration activities, manoeuvres, platform anomalies and ground-segment issues that could impede data
              production, against the month in which they occurred and the datatakes they impacted.
            </p>
          </div>

          <div className="evx-counters">
            <div><span>EVENTS</span><b>{pad(events.length)}</b></div>
            <div><span>INCIDENTS</span><b className="crit">{pad(incidents)}</b></div>
            <div><span>PLANNED</span><b>{pad(planned)}</b></div>
            <div><span>DTK IMPACTED</span><b className="warn">{pad(impacted)}</b></div>
            <div><span>DTK LOST</span><b className="crit">{pad(lost)}</b></div>
          </div>
        </header>

        {/* ---------------- controls ---------------- */}
        <div className="evx-bar">
          <div className="evx-tabs" role="tablist" aria-label="Layout concept">
            <button role="tab" aria-selected={view === "A"} className={view === "A" ? "on" : ""} onClick={() => setView("A")}>
              A · ORBITAL TIMELINE
            </button>
            <button role="tab" aria-selected={view === "B"} className={view === "B" ? "on" : ""} onClick={() => setView("B")}>
              B · TELEMETRY GRID
            </button>
          </div>

          <div className="evx-controls">
            <div className="evx-month">
              <button onClick={() => step(-1)} aria-label="Previous month"><IconPrev /></button>
              <span className="evx-month-l">{MONTH_ABBR[month]} {year}</span>
              <button onClick={() => step(1)} aria-label="Next month"><IconNext /></button>
            </div>

            <div className="evx-field">
              <label htmlFor="evx-period">PERIOD</label>
              <select id="evx-period" value={period} onChange={(e) => setPeriod(e.target.value as PeriodId)}>
                <option value="custom">FULL MONTH</option>
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="evx-legend">
          <span className="evx-legend-l">EVENT TYPE</span>
          {(Object.keys(KIND_VAR) as EventKind[]).map((k) => (
            <span className="evx-legend-i" key={k}>
              <i style={{ background: KIND_VAR[k] }} />
              {k}
            </span>
          ))}
          <span className="evx-legend-sep" aria-hidden />
          <span className="evx-legend-i"><i className="outline" />PLANNED</span>
          <span className="evx-legend-i"><i style={{ background: "var(--evx-dim)" }} />UNPLANNED</span>
        </div>

        {/* ---------------- the concept ---------------- */}
        {events.length === 0 ? (
          <p className="evx-none">NO EVENTS IN {MONTH_ABBR[month]} {year} FOR THE SELECTED PERIOD</p>
        ) : view === "A" ? (
          <ConceptA events={events} year={year} month={month} onOpen={setOpenEvent} />
        ) : (
          <ConceptB events={events} year={year} month={month} onOpen={setOpenDay} />
        )}

        <footer className="evx-foot">
          <span>MOCK DATA · AUGUST 2026 · NO BACKEND ATTACHED</span>
          <span>SENTIBOARD V2 · DEVOCS-219 · EVENTS CONCEPTS A/B</span>
        </footer>
      </div>

      {/* ---------------- A: event popover ---------------- */}
      {openEvent && (
        <Overlay side="center" labelledBy="evx-pop-t" onClose={() => setOpenEvent(null)}>
          <header className="evx-panel-head">
            <div>
              <span className="evx-panel-tag">EVENT TELEMETRY</span>
              <h3 id="evx-pop-t">{openEvent.id}</h3>
            </div>
            <button className="evx-x" onClick={() => setOpenEvent(null)} aria-label="Close event"><IconClose /></button>
          </header>
          <div className="evx-panel-body">
            <EventBody event={openEvent} />
          </div>
        </Overlay>
      )}

      {/* ---------------- B: day slide-over ---------------- */}
      {openDay !== null && (
        <Overlay side="right" labelledBy="evx-day-t" onClose={() => setOpenDay(null)}>
          <header className="evx-panel-head">
            <div>
              <span className="evx-panel-tag">DAY LOG · UTC</span>
              <h3 id="evx-day-t">{fmtDate(utc(year, month, openDay))}</h3>
            </div>
            <button className="evx-x" onClick={() => setOpenDay(null)} aria-label="Close day log"><IconClose /></button>
          </header>
          <div className="evx-panel-body">
            {dayEvents.length === 0 ? (
              <p className="evx-ev-none">NO EVENTS LOGGED — NOMINAL DAY</p>
            ) : (
              dayEvents.map((e) => (
                <article className="evx-log" key={e.id}>
                  <div className="evx-log-time">
                    <b>{fmtTime(e.start)}</b>
                    <span>{durationLabel(e.start, e.end)}</span>
                  </div>
                  <div className="evx-log-body">
                    <EventBody event={e} />
                  </div>
                </article>
              ))
            )}
          </div>
        </Overlay>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Styles — scoped under .evx and keyed off data-theme on this component's own root.
// The palette is the Data Availability telemetry set, so the concepts read as one
// family; it is repeated here rather than imported because the brief asks for a
// single self-contained component.
// -----------------------------------------------------------------------------

const CSS = `
.evx {
  --evx-mono: "JetBrains Mono", "Geist Mono", var(--font-mono, ui-monospace), "SFMono-Regular", Menlo, Consolas, monospace;
  --evx-sans: var(--font-display, var(--font-sans, "Inter")), system-ui, -apple-system, sans-serif;

  --evx-bg: #08090a;
  --evx-panel: #0d0e12;
  --evx-panel-2: #101218;
  --evx-line: #1b1e25;
  --evx-line-2: #2b303a;
  --evx-text: #e9ecf1;
  --evx-dim: #8a919d;
  --evx-faint: #565d6a;
  --evx-accent: #00e5ff;
  --evx-accent-soft: rgba(0, 229, 255, 0.1);

  --evx-ok: #00e08a;
  --evx-warn: #ffb020;
  --evx-crit: #ff4d5e;
  --evx-plan: #00d4ff;

  --evx-k-sat: #ff4d5e;
  --evx-k-cal: #c07dff;
  --evx-k-man: #00d4ff;
  --evx-k-acq: #4d8dff;
  --evx-k-prod: #ffb020;

  --evx-scrim: rgba(4, 6, 9, 0.72);

  min-height: 100vh;
  background: var(--evx-bg);
  color: var(--evx-text);
  font-family: var(--evx-sans);
  -webkit-font-smoothing: antialiased;
}

.evx[data-theme="light"] {
  --evx-bg: #f8f9fa;
  --evx-panel: #ffffff;
  --evx-panel-2: #f1f3f5;
  --evx-line: #dde1e6;
  --evx-line-2: #b9c0c9;
  --evx-text: #14171c;
  --evx-dim: #4d5560;
  --evx-faint: #79818d;
  --evx-accent: #007c93;
  --evx-accent-soft: rgba(0, 124, 147, 0.08);

  --evx-ok: #00875a;
  --evx-warn: #b45309;
  --evx-crit: #d92d3f;
  --evx-plan: #0284a8;

  --evx-k-sat: #d92d3f;
  --evx-k-cal: #7c3fbf;
  --evx-k-man: #0284a8;
  --evx-k-acq: #2563c9;
  --evx-k-prod: #b45309;

  --evx-scrim: rgba(20, 26, 34, 0.42);
}

.evx *, .evx *::before, .evx *::after { box-sizing: border-box; }
.evx-wrap { max-width: 1400px; margin: 0 auto; padding: 26px 26px 56px; }

/* ---------- header ---------- */
.evx-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 26px; flex-wrap: wrap; }
.evx-tagline { display: flex; align-items: center; gap: 8px; font-family: var(--evx-mono); font-size: 10px; letter-spacing: 0.26em; color: var(--evx-accent); }
.evx-live { width: 6px; height: 6px; background: var(--evx-ok); animation: evx-pulse 2.4s infinite; }
@keyframes evx-pulse { 0% { opacity: 1 } 70% { opacity: 0.4 } 100% { opacity: 1 } }
.evx-h1 { margin: 10px 0 0; font-size: clamp(28px, 4.4vw, 44px); font-weight: 700; letter-spacing: 0.01em; line-height: 1; text-transform: uppercase; }
.evx-lede { margin: 10px 0 0; max-width: 70ch; font-size: 13px; line-height: 1.6; color: var(--evx-dim); }
.evx-counters { display: grid; grid-template-columns: repeat(5, minmax(84px, auto)); gap: 1px; background: var(--evx-line); border: 1px solid var(--evx-line); }
.evx-counters div { display: flex; flex-direction: column; gap: 5px; padding: 10px 13px; background: var(--evx-panel); }
.evx-counters span { font-family: var(--evx-mono); font-size: 9px; letter-spacing: 0.16em; color: var(--evx-faint); }
.evx-counters b { font-family: var(--evx-mono); font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; }
.evx-counters b.crit { color: var(--evx-crit); }
.evx-counters b.warn { color: var(--evx-warn); }

/* ---------- control bar ---------- */
.evx-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin: 24px 0 14px; }
.evx-tabs { display: flex; gap: 1px; background: var(--evx-line); border: 1px solid var(--evx-line); }
.evx-tabs button {
  padding: 10px 18px; border: 0; background: var(--evx-panel); color: var(--evx-dim); cursor: pointer;
  font-family: var(--evx-mono); font-size: 10.5px; letter-spacing: 0.16em;
  transition: color 0.15s, background 0.15s;
}
.evx-tabs button:hover { color: var(--evx-text); }
.evx-tabs button.on { background: var(--evx-accent); color: var(--evx-bg); font-weight: 600; }
.evx-controls { display: flex; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.evx-month { display: flex; align-items: center; gap: 1px; background: var(--evx-line); border: 1px solid var(--evx-line); }
.evx-month button {
  display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;
  border: 0; background: var(--evx-panel); color: var(--evx-dim); cursor: pointer; transition: color 0.15s;
}
.evx-month button:hover { color: var(--evx-accent); }
.evx-month-l {
  padding: 0 16px; height: 34px; display: flex; align-items: center; background: var(--evx-panel);
  font-family: var(--evx-mono); font-size: 13px; letter-spacing: 0.14em; color: var(--evx-text);
}
.evx-field { display: flex; flex-direction: column; gap: 6px; }
.evx-field label { font-family: var(--evx-mono); font-size: 9.5px; letter-spacing: 0.18em; color: var(--evx-faint); }
.evx-field select {
  appearance: none; cursor: pointer; min-width: 168px; padding: 8px 26px 8px 10px;
  border: 1px solid var(--evx-line-2); border-radius: 2px; background: var(--evx-panel); color: var(--evx-text); outline: none;
  font-family: var(--evx-mono); font-size: 11px; letter-spacing: 0.08em;
  background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%);
  background-position: calc(100% - 13px) center, calc(100% - 9px) center;
  background-size: 4px 4px, 4px 4px; background-repeat: no-repeat;
}
.evx-field select:focus { border-color: var(--evx-accent); box-shadow: 0 0 0 2px var(--evx-accent-soft); }

/* ---------- legend ---------- */
.evx-legend {
  display: flex; align-items: center; flex-wrap: wrap; gap: 14px;
  padding: 10px 0; border-top: 1px solid var(--evx-line); border-bottom: 1px solid var(--evx-line); margin-bottom: 16px;
}
.evx-legend-l { font-family: var(--evx-mono); font-size: 9.5px; letter-spacing: 0.18em; color: var(--evx-faint); }
.evx-legend-i { display: inline-flex; align-items: center; gap: 6px; font-family: var(--evx-mono); font-size: 9.5px; letter-spacing: 0.1em; color: var(--evx-dim); }
.evx-legend-i i { width: 9px; height: 9px; }
.evx-legend-i i.outline { border: 1px dashed var(--evx-dim); background: transparent; }
.evx-legend-sep { width: 1px; height: 14px; background: var(--evx-line-2); }
.evx-none { margin: 40px 0; padding: 40px; border: 1px solid var(--evx-line); text-align: center; font-family: var(--evx-mono); font-size: 11px; letter-spacing: 0.16em; color: var(--evx-faint); }

/* ---------- concept A ---------- */
.evx-gantt { border: 1px solid var(--evx-line); background: var(--evx-panel); }
.evx-gantt-scroll { overflow-x: auto; }
.evx-gantt-inner { min-width: 980px; }
.evx-gantt-row { display: grid; grid-template-columns: 130px 1fr; border-top: 1px solid var(--evx-line); }
.evx-gantt-row:first-child { border-top: 0; }
.evx-gantt-head { background: var(--evx-panel-2); }
.evx-track-label {
  display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px;
  border-right: 1px solid var(--evx-line);
}
.evx-track-label b { font-family: var(--evx-mono); font-size: 13px; font-weight: 500; letter-spacing: 0.08em; }
.evx-track-label span { font-family: var(--evx-mono); font-size: 9px; letter-spacing: 0.12em; color: var(--evx-faint); }
.evx-track-plot { position: relative; min-height: 34px; }
.evx-tick {
  position: absolute; top: 0; height: 34px; display: flex; align-items: center; justify-content: center;
  border-left: 1px solid var(--evx-line);
  font-family: var(--evx-mono); font-size: 9px; color: var(--evx-faint); font-variant-numeric: tabular-nums;
}
.evx-tick.weekend { color: var(--evx-dim); background: var(--evx-panel); }
.evx-col { position: absolute; top: 0; bottom: 0; border-left: 1px solid var(--evx-line); }
.evx-col.weekend { background: var(--evx-panel-2); }
.evx-block {
  position: absolute; height: 24px; padding: 0 7px; overflow: hidden;
  border: 1px solid var(--k); border-radius: 2px;
  background: color-mix(in srgb, var(--k) 26%, transparent);
  color: var(--evx-text); cursor: pointer; text-align: left; white-space: nowrap;
  font-family: var(--evx-mono); font-size: 9.5px; letter-spacing: 0.06em;
  transition: filter 0.15s, box-shadow 0.15s;
}
.evx-block.planned { border-style: dashed; background: color-mix(in srgb, var(--k) 10%, transparent); }
.evx-block:hover { filter: brightness(1.35); box-shadow: 0 0 0 1px var(--k); }
.evx-block:focus-visible { outline: 1px solid var(--evx-accent); outline-offset: 1px; }
.evx-block-t { display: block; overflow: hidden; text-overflow: ellipsis; line-height: 22px; }
.evx-track-empty {
  position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
  font-family: var(--evx-mono); font-size: 9px; letter-spacing: 0.16em; color: var(--evx-faint);
}

/* ---------- concept B ---------- */
.evx-grid { border: 1px solid var(--evx-line); background: var(--evx-panel); }
.evx-grid-dow { display: grid; grid-template-columns: repeat(7, 1fr); background: var(--evx-panel-2); border-bottom: 1px solid var(--evx-line); }
.evx-grid-dow span { padding: 9px 12px; font-family: var(--evx-mono); font-size: 9px; letter-spacing: 0.18em; color: var(--evx-faint); }
.evx-grid-tiles { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; background: var(--evx-line); }
.evx-tile {
  position: relative; display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
  min-height: 104px; padding: 9px 10px; border: 0; background: var(--evx-panel);
  color: var(--evx-text); cursor: pointer; text-align: left; transition: background 0.12s;
}
.evx-tile.blank { background: var(--evx-panel-2); cursor: default; }
.evx-tile:not(.blank):hover { background: var(--evx-accent-soft); }
.evx-tile:focus-visible { outline: 1px solid var(--evx-accent); outline-offset: -1px; }
.evx-tile::before { content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 2px; background: var(--k); }
.evx-tile.blank::before { display: none; }
.evx-tile.nominal::before { opacity: 0.35; }
.evx-tile-d { font-family: var(--evx-mono); font-size: 17px; font-variant-numeric: tabular-nums; }
.evx-tile-s { font-family: var(--evx-mono); font-size: 8.5px; letter-spacing: 0.14em; color: var(--k); }
.evx-tile-pills { display: flex; align-items: center; gap: 3px; margin-top: auto; }
.evx-tile-pills i { width: 100%; min-width: 12px; max-width: 22px; height: 4px; }
.evx-tile-pills em { font-style: normal; font-family: var(--evx-mono); font-size: 8.5px; color: var(--evx-faint); }
.evx-tile-dtk { font-family: var(--evx-mono); font-size: 8.5px; letter-spacing: 0.1em; color: var(--evx-faint); }

/* ---------- overlays ---------- */
.evx-backdrop { position: fixed; inset: 0; z-index: 300; display: flex; background: var(--evx-scrim); animation: evx-fade 0.16s ease; }
.evx-backdrop.center { align-items: center; justify-content: center; padding: 24px; }
.evx-backdrop.right { justify-content: flex-end; }
@keyframes evx-fade { from { opacity: 0 } to { opacity: 1 } }
.evx-popover {
  width: 100%; max-width: 620px; max-height: calc(100vh - 48px); display: flex; flex-direction: column;
  border: 1px solid var(--evx-line-2); background: var(--evx-bg); border-radius: 2px; outline: none;
  animation: evx-rise 0.2s cubic-bezier(0.2, 0.7, 0.2, 1);
}
.evx-slideover {
  width: min(460px, 100%); height: 100%; display: flex; flex-direction: column;
  border-left: 1px solid var(--evx-line-2); background: var(--evx-bg); outline: none;
  animation: evx-slide 0.24s cubic-bezier(0.2, 0.7, 0.2, 1);
}
@keyframes evx-rise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes evx-slide { from { transform: translateX(100%) } to { transform: none } }
@media (prefers-reduced-motion: reduce) { .evx-backdrop, .evx-popover, .evx-slideover { animation: none } }
.evx-panel-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
  padding: 15px 18px; border-bottom: 1px solid var(--evx-line); background: var(--evx-panel);
}
.evx-panel-tag { display: block; font-family: var(--evx-mono); font-size: 9px; letter-spacing: 0.24em; color: var(--evx-accent); }
.evx-panel-head h3 { margin: 7px 0 0; font-family: var(--evx-mono); font-size: 14px; font-weight: 500; letter-spacing: 0.04em; }
.evx-x {
  flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  border: 1px solid var(--evx-line-2); background: transparent; color: var(--evx-dim); border-radius: 2px; cursor: pointer;
}
.evx-x:hover { color: var(--evx-accent); border-color: var(--evx-accent); }
.evx-panel-body { padding: 16px 18px 22px; overflow-y: auto; }

/* ---------- event body ---------- */
.evx-ev-head { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; }
.evx-kind, .evx-impact, .evx-flag {
  display: inline-flex; align-items: center; padding: 3px 7px; border-radius: 2px;
  font-family: var(--evx-mono); font-size: 9px; letter-spacing: 0.12em; white-space: nowrap;
}
.evx-kind { border: 1px solid color-mix(in srgb, var(--k) 45%, transparent); background: color-mix(in srgb, var(--k) 14%, transparent); color: var(--k); }
.evx-impact { border: 1px solid color-mix(in srgb, var(--k) 45%, transparent); color: var(--k); }
.evx-flag { border: 1px solid var(--evx-line-2); color: var(--evx-dim); }
.evx-flag.planned { border-style: dashed; }
.evx-ev-title { margin: 11px 0 0; font-size: 16px; font-weight: 600; letter-spacing: 0.01em; }
.evx-ev-kvs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; margin: 13px 0; background: var(--evx-line); border: 1px solid var(--evx-line); }
.evx-ev-kvs div { display: flex; flex-direction: column; gap: 4px; padding: 8px 11px; background: var(--evx-panel); }
.evx-ev-kvs span { font-family: var(--evx-mono); font-size: 8.5px; letter-spacing: 0.16em; color: var(--evx-faint); }
.evx-ev-kvs b { font-family: var(--evx-mono); font-size: 11px; font-weight: 500; font-variant-numeric: tabular-nums; }
.evx-ev-sum { margin: 0 0 14px; font-size: 13px; line-height: 1.65; color: var(--evx-dim); }
.evx-ev-sec {
  display: flex; justify-content: space-between; padding-bottom: 7px; margin-bottom: 9px;
  border-bottom: 1px solid var(--evx-line);
  font-family: var(--evx-mono); font-size: 9.5px; letter-spacing: 0.18em; color: var(--evx-faint);
}
.evx-ev-none { margin: 0; font-family: var(--evx-mono); font-size: 10px; letter-spacing: 0.14em; color: var(--evx-faint); }
.evx-dtk { list-style: none; margin: 0; padding: 0; }
.evx-dtk li { display: grid; grid-template-columns: 1fr 70px 42px auto; align-items: center; gap: 9px; padding: 7px 0; border-bottom: 1px solid var(--evx-line); }
.evx-dtk li:last-child { border-bottom: 0; }
.evx-dtk-id { font-family: var(--evx-mono); font-size: 10px; overflow: hidden; text-overflow: ellipsis; }
.evx-dtk-bar { height: 4px; background: var(--evx-line); overflow: hidden; }
.evx-dtk-bar i { display: block; height: 100%; }
.evx-dtk-pct { font-family: var(--evx-mono); font-size: 10px; color: var(--evx-dim); font-variant-numeric: tabular-nums; text-align: right; }

/* ---------- day log ---------- */
.evx-log { display: grid; grid-template-columns: 74px 1fr; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--evx-line); }
.evx-log:first-child { padding-top: 0; }
.evx-log:last-child { border-bottom: 0; }
.evx-log-time { display: flex; flex-direction: column; gap: 3px; font-family: var(--evx-mono); }
.evx-log-time b { font-size: 13px; color: var(--evx-accent); font-variant-numeric: tabular-nums; }
.evx-log-time span { font-size: 9px; letter-spacing: 0.1em; color: var(--evx-faint); }
.evx-log-body { min-width: 0; }
.evx-log-body .evx-ev-kvs { grid-template-columns: repeat(2, 1fr); }

/* ---------- footer ---------- */
.evx-foot {
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  margin-top: 24px; padding-top: 12px; border-top: 1px solid var(--evx-line);
  font-family: var(--evx-mono); font-size: 9.5px; letter-spacing: 0.14em; color: var(--evx-faint);
}

/* ---------- responsive ---------- */
@media (max-width: 1000px) {
  .evx-counters { grid-template-columns: repeat(3, 1fr); }
  .evx-ev-kvs { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
  .evx-wrap { padding: 20px 14px 44px; }
  .evx-counters { grid-template-columns: repeat(2, 1fr); }
  .evx-bar { align-items: stretch; }
  .evx-grid-tiles { grid-template-columns: repeat(7, minmax(64px, 1fr)); overflow-x: auto; }
  .evx-tile { min-height: 88px; }
  .evx-backdrop.center { padding: 0; }
  .evx-popover { max-height: 100vh; }
  .evx-log { grid-template-columns: 1fr; }
}
`;
