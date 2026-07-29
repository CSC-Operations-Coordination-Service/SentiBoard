import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Activity } from "lucide-react";
import EventIcon from "@/components/EventIcon";
import type { IssueType } from "@/data/mock";
import "@/styles/events-log.css";

/* Events page PROPOSAL — chronological mission log (ALTERNATIVE to the real
   calendar-grid Events page at "/events", which is untouched).

   Idea: instead of a month grid where each day is a small cell, present the
   month as an operations log — a telemetry strip (counts + a per-day "pulse"
   sparkline) on top, then events grouped by day with the full advisory copy,
   impacted products and status visible without a click. Same data the real
   page consumes; different reading model.

   Both themes are driven by the shared tokens in styles/tokens.css, so the
   page follows the global light/dark toggle in the nav. */

// ---------------------------------------------------------------------------
// MOCK DATA — stand-in for the month payload the real page will be given.
// ---------------------------------------------------------------------------
const MISSIONS = {
  S1: { label: "Sentinel-1", color: "#4ea8ff" },
  S2: { label: "Sentinel-2", color: "#34d399" },
  S3: { label: "Sentinel-3", color: "#f5b544" },
  S5P: { label: "Sentinel-5P", color: "#a78bfa" },
} as const;
type MissionKey = keyof typeof MISSIONS;

// Statuses mirror prod's Instant-Message states (new / resolved / disaster).
const STATUSES = {
  PLANNED: { label: "Planned", color: "var(--planned)" },
  ACQUIRED: { label: "Acquired", color: "var(--ok)" },
  UNAVAILABLE: { label: "Unavailable", color: "var(--crit)" },
  PARTIAL: { label: "Partial", color: "var(--partial)" },
} as const;
type StatusKey = keyof typeof STATUSES;

// "kind" reuses the real page's issue types so the glyphs match the calendar
// mockup and the filter chips at /events.
const KIND_LABEL: Record<IssueType, string> = {
  acquisition: "Acquisition",
  calibration: "Calibration",
  manoeuvre: "Manoeuvre",
  production: "Production",
  satellite: "Satellite",
};

interface LogEvent {
  id: number; day: number; time: string;
  mission: MissionKey; status: StatusKey; kind: IssueType;
  title: string; desc: string; products: string[];
}

const EVENTS: LogEvent[] = [
  { id: 1, day: 2, time: "04:12", mission: "S1", status: "ACQUIRED", kind: "manoeuvre", title: "S1A in-plane orbit correction", desc: "Scheduled in-plane manoeuvre. No data gap expected.", products: ["GRD", "SLC"] },
  { id: 2, day: 4, time: "18:40", mission: "S3", status: "UNAVAILABLE", kind: "acquisition", title: "S3B trickle-dump data gap", desc: "Downlink interruption over Svalbard station; 41 min gap in OLCI/SLSTR delivery.", products: ["OL_1_EFR", "SL_1_RBT"] },
  { id: 3, day: 4, time: "19:05", mission: "S3", status: "PLANNED", kind: "satellite", title: "S3B ground-segment investigation opened", desc: "Root-cause analysis in progress with the operations team.", products: ["OL_1_EFR", "SL_1_RBT"] },
  { id: 4, day: 7, time: "09:00", mission: "S5P", status: "ACQUIRED", kind: "calibration", title: "TROPOMI solar calibration", desc: "Monthly radiometric calibration sequence, nominal.", products: ["L1B"] },
  { id: 5, day: 9, time: "06:22", mission: "S3", status: "PLANNED", kind: "manoeuvre", title: "S3B unavailability notice — IP manoeuvre #163", desc: "Planned in-plane manoeuvre, ~35 min instrument outage window.", products: ["OL_1_EFR", "OL_2_LFR"] },
  { id: 6, day: 12, time: "22:15", mission: "S1", status: "UNAVAILABLE", kind: "acquisition", title: "S1C acquisition-plan fragment loss", desc: "Acquisition-plan fragments not persisted for two consecutive passes.", products: ["Plan"] },
  { id: 7, day: 13, time: "07:50", mission: "S1", status: "ACQUIRED", kind: "production", title: "S1C fragment persistence restored", desc: "Cache write path patched; backfill completed for the affected passes.", products: ["Plan"] },
  { id: 8, day: 16, time: "11:30", mission: "S2", status: "PLANNED", kind: "calibration", title: "S2B MSI dark-signal calibration", desc: "Routine calibration slot; imaging suspended over the calibration site.", products: ["L1C"] },
  { id: 9, day: 19, time: "03:05", mission: "S5P", status: "ACQUIRED", kind: "manoeuvre", title: "S5P orbit-maintenance burn", desc: "Nominal maintenance manoeuvre, sun-synchronous orbit correction.", products: ["L1B", "L2"] },
  { id: 10, day: 22, time: "14:44", mission: "S3", status: "PLANNED", kind: "production", title: "S3A altimetry product delay", desc: "Processing backlog at the ground segment, ETA 3 h.", products: ["SR_1_SRA", "SR_2_LAN"] },
  { id: 11, day: 25, time: "08:18", mission: "S2", status: "ACQUIRED", kind: "manoeuvre", title: "S2A collision-avoidance manoeuvre", desc: "Precautionary avoidance manoeuvre executed; orbit nominal post-burn.", products: ["L1C", "L2A"] },
  { id: 12, day: 29, time: "20:02", mission: "S1", status: "PLANNED", kind: "acquisition", title: "S1A downlink station handover delay", desc: "Matera station handover delayed 12 min; minor queue backlog.", products: ["GRD"] },
];

const MONTH_LABEL = "July 2026";
const DAYS_IN_MONTH = 31;
const MONTH_INDEX = 6; // July, for weekday labels

// Ink used on colour-filled chips — mid-bright status/mission hues need a dark
// foreground in BOTH themes, so this is deliberately not --on-accent.
const CHIP_INK = "#04101f";

// Status glyphs mirror frontend/components/NewsStatus.tsx (filled circle "!",
// filled circle check, filled warning triangle) so the proposal reads as the
// same product, not a new icon set. The outer shape is currentColor; `ink` is
// the surface it sits on, so the inner mark stays legible on a plain card and
// on a colour-filled chip alike.
function StatusIcon({ status, size = 12, ink = "var(--bg-2)" }: { status: StatusKey; size?: number; ink?: string }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;
  if (status === "ACQUIRED")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "UNAVAILABLE")
    return (
      <svg {...common}>
        <path d="M12 3l9.5 16.5H2.5z" fill="currentColor" />
        <path d="M12 9.5v4.5" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.2" fill={ink} />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" fill="currentColor" />
      <path d="M12 7v6" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.2" fill={ink} />
    </svg>
  );
}

const MISSION_KEYS = Object.keys(MISSIONS) as MissionKey[];
const STATUS_KEYS = Object.keys(STATUSES) as StatusKey[];

export default function EventsLog() {
  const [missions, setMissions] = useState<MissionKey[]>([...MISSION_KEYS]);
  const [statuses, setStatuses] = useState<StatusKey[]>([...STATUS_KEYS]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [clock, setClock] = useState(() => new Date().toISOString().slice(11, 19));

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date().toISOString().slice(11, 19)), 1000);
    return () => window.clearInterval(t);
  }, []);

  const toggleMission = (m: MissionKey) =>
    setMissions((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const toggleStatus = (s: StatusKey) =>
    setStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const shown = useMemo(
    () => EVENTS.filter((e) => missions.includes(e.mission) && statuses.includes(e.status)),
    [missions, statuses]
  );

  // day → events, ordered by day then time
  const byDay = useMemo(() => {
    const map = new Map<number, LogEvent[]>();
    [...shown]
      .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
      .forEach((e) => map.set(e.day, [...(map.get(e.day) ?? []), e]));
    return [...map.entries()];
  }, [shown]);

  // per-day activity sparkline for the whole month (unfiltered, so the strip
  // always shows the month's real shape while you narrow the log below)
  const pulse = useMemo(
    () =>
      Array.from({ length: DAYS_IN_MONTH }, (_, i) => {
        const day = i + 1;
        const evs = EVENTS.filter((e) => e.day === day);
        return { day, count: evs.length, crit: evs.some((e) => e.status === "UNAVAILABLE") };
      }),
    []
  );

  const stats = [
    { n: shown.length, label: "Events" },
    { n: shown.filter((e) => e.kind === "manoeuvre").length, label: "Manoeuvres" },
    { n: shown.filter((e) => e.kind === "calibration").length, label: "Calibrations" },
    { n: shown.filter((e) => e.status === "ACQUIRED").length, label: "Acquired" },
    { n: shown.filter((e) => e.status === "UNAVAILABLE").length, label: "Unavailable", crit: true },
  ];

  const weekday = (d: number) =>
    new Date(2026, MONTH_INDEX, d).toLocaleDateString("en-GB", { weekday: "short" });

  return (
    <>
      {/* ---------- telemetry strip ---------- */}
      <div className="evl-head">
        <div className="wrap">
          <div className="evl-title-row">
            <h1>Events</h1>
          </div>
          <p className="evl-sub">
            Events over the past three months that could impede data production — planned
            calibration activities, manoeuvres or anomalies — with the products they impact.
          </p>

          <div className="evl-monthnav">
            <button aria-label="Previous month"><ChevronLeft size={15} /></button>
            <span className="label">{MONTH_LABEL}</span>
            <button aria-label="Next month"><ChevronRight size={15} /></button>
          </div>

          <div className="evl-stats">
            {stats.map((s) => (
              <div className="evl-stat" key={s.label}>
                <span className="n" style={s.crit && s.n ? { color: "var(--crit)" } : undefined}>
                  {s.n}
                </span>
                <span className="l">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- filters ---------- */}
      <section className="wrap evl-filterbar">
        <div className="filters">
          {MISSION_KEYS.map((k) => {
            const on = missions.includes(k);
            return (
              <button key={k} className={"chipbtn" + (on ? " on" : "")} onClick={() => toggleMission(k)}
                title={MISSIONS[k].label}
                style={on ? { background: MISSIONS[k].color, borderColor: "transparent", color: CHIP_INK } : {}}>
                <span className="evl-sw" style={{ background: on ? CHIP_INK : MISSIONS[k].color }} />
                {k}
              </button>
            );
          })}
        </div>
        <div className="filters">
          {STATUS_KEYS.map((k) => {
            const on = statuses.includes(k);
            return (
              <button key={k} className={"chipbtn chip-ico" + (on ? " on" : "")} onClick={() => toggleStatus(k)}
                style={on ? { background: STATUSES[k].color, borderColor: "transparent", color: CHIP_INK } : {}}>
                <span style={{ color: on ? CHIP_INK : STATUSES[k].color, display: "inline-flex" }}>
                  <StatusIcon status={k} ink={on ? STATUSES[k].color : "var(--bg-2)"} />
                </span>
                {STATUSES[k].label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ---------- day-grouped log ---------- */}
      <section className="wrap evl-log">
        {byDay.length === 0 && <p className="evl-empty">No events match the current filters.</p>}

        {byDay.map(([day, evs]) => (
          <div className="evl-day" key={day}>
            <div className="evl-daynum">
              <span className="n">{String(day).padStart(2, "0")}</span>
              <span className="wd">{weekday(day)}</span>
            </div>
            <div className="evl-cards">
              {evs.map((e) => {
                const mission = MISSIONS[e.mission];
                const st = STATUSES[e.status];
                const open = openId === e.id;
                return (
                  <article className={"evl-card" + (open ? " open" : "")} key={e.id}
                    style={{ borderLeftColor: mission.color }}>
                    <button className="evl-card-top" onClick={() => setOpenId(open ? null : e.id)}
                      aria-expanded={open}>
                      <span className="tag" style={{ color: mission.color, borderColor: mission.color }}>
                        {e.mission}
                      </span>
                      <span className="tag kind">
                        <EventIcon type={e.kind} size={12} /> {KIND_LABEL[e.kind]}
                      </span>
                      <span className="ts">{e.time} UTC</span>
                      <span className="st" style={{ color: st.color }}>
                        <StatusIcon status={e.status} size={11} /> {st.label}
                      </span>
                    </button>
                    <h3 className="evl-card-title">{e.title}</h3>
                    <p className="evl-card-desc">{e.desc}</p>
                    <div className="evl-products">
                      <span className="k">Impacted products</span>
                      {e.products.map((p) => <span className="p" key={p}>{p}</span>)}
                    </div>
                    {open && (
                      <div className="evl-more">
                        <div className="evl-field"><span className="k">Mission</span>{mission.label}</div>
                        <div className="evl-field"><span className="k">Occurrence</span>
                          {weekday(e.day)} {String(e.day).padStart(2, "0")} {MONTH_LABEL} {e.time}:00 UTC
                        </div>
                        <div className="evl-field"><span className="k">Issue type</span>{KIND_LABEL[e.kind]}</div>
                        <div className="evl-field"><span className="k">Status</span>
                          <span style={{ color: st.color }}>{st.label}</span>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <span className="ex-badge">Events proposal · Chronological log</span>
    </>
  );
}
