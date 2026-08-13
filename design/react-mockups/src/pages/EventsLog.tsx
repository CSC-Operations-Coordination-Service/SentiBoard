import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import EventIcon from "@/components/EventIcon";
import { PageDescription } from "@/components/ui";
import { EVENTS_LOG_DESCRIPTION } from "@/data/copy";
import { ISSUE_COLORS, IssueType } from "@/data/mock";
import "@/styles/events-log.css";

/* Events page PROPOSAL — chronological mission log (ALTERNATIVE to the real
   calendar-grid Events page at "/events", which is untouched).

   v2: title is no longer a single string. Each event carries a list of
   impacted datatakes; the card groups them by mission and renders them the
   same way the real Event Details aside does (colored link chip + hash +
   dot) instead of one plain heading. Kind tags now pull their color from the
   same ISSUE_COLORS map the real page uses, so a "Manoeuvre" tag here is the
   same orange as the "Manoeuvre" row in the Event Types legend everywhere
   else in the app — no separate color list to keep in sync. */

// ---------------------------------------------------------------------------
// MOCK DATA
// ---------------------------------------------------------------------------
const MISSIONS = {
  S1: { label: "Sentinel-1", color: "#4ea8ff" },
  S2: { label: "Sentinel-2", color: "#34d399" },
  S3: { label: "Sentinel-3", color: "#f5b544" },
  S5P: { label: "Sentinel-5P", color: "#a78bfa" },
} as const;
type MissionKey = keyof typeof MISSIONS;

// Event status and datatake completeness share one vocabulary in production, so
// they share one palette here too — the --cmp-* tokens, which carry
// production's legend values adjusted per theme.
const STATUSES = {
  PLANNED: { label: "Planned", color: "var(--cmp-planned)" },
  ACQUIRED: { label: "Acquired", color: "var(--cmp-acquired)" },
  UNAVAILABLE: { label: "Unavailable", color: "var(--cmp-unavailable)" },
  PARTIAL: { label: "Partial", color: "var(--cmp-partial)" },
} as const;
type StatusKey = keyof typeof STATUSES;

// Completeness of a single datatake — production's five legend states. The
// event-level status set above has no PROCESSING, because an event is never
// "processing"; only the datatakes under it are.
const COMPLETENESS = {
  planned: { label: "Planned", color: "var(--cmp-planned)" },
  processing: { label: "Processing", color: "var(--cmp-processing)" },
  acquired: { label: "Acquired", color: "var(--cmp-acquired)" },
  partial: { label: "Partial", color: "var(--cmp-partial)" },
  unavailable: { label: "Unavailable", color: "var(--cmp-unavailable)" },
} as const;
type CompKey = keyof typeof COMPLETENESS;

// An event's status implies its datatakes' completeness unless an item says
// otherwise — so the mock data only spells `comp` out where a datatake
// disagrees with its event (a partially recovered outage, say).
const COMP_FROM_STATUS: Record<StatusKey, CompKey> = {
  PLANNED: "planned",
  ACQUIRED: "acquired",
  UNAVAILABLE: "unavailable",
  PARTIAL: "partial",
};

const KIND_LABEL: Record<IssueType, string> = {
  acquisition: "Acquisition",
  calibration: "Calibration",
  manoeuvre: "Manoeuvre",
  production: "Production",
  satellite: "Satellite",
};

// A single impacted datatake — this is what "title" used to be.
interface ImpactedItem {
  mission: MissionKey;
  id: string;   // e.g. "S1D-25325"
  hash: string; // e.g. "62ed"
  comp?: CompKey; // defaults to COMP_FROM_STATUS[event.status]
}

interface LogEvent {
  id: number; day: number; time: string;
  status: StatusKey; kind: IssueType;
  desc: string;
  items: ImpactedItem[]; // grouped by mission at render time
}

const EVENTS: LogEvent[] = [
  {
    id: 1, day: 2, time: "04:12", status: "ACQUIRED", kind: "manoeuvre",
    desc: "Scheduled in-plane manoeuvre. No data gap expected.",
    items: [
      { mission: "S1", id: "S1A-25214", hash: "71ba" },
      { mission: "S1", id: "S1A-25219", hash: "71c2" },
    ],
  },
  {
    id: 2, day: 4, time: "18:40", status: "UNAVAILABLE", kind: "acquisition",
    desc: "Downlink interruption over Svalbard station; 41 min gap in OLCI/SLSTR delivery.",
    items: [
      // The gap cut across the pass: the first two datatakes were recovered in
      // part, the last two lost outright.
      { mission: "S3", id: "S3B-25325", hash: "62ed", comp: "partial" },
      { mission: "S3", id: "S3B-25311", hash: "62df", comp: "partial" },
      { mission: "S3", id: "S3B-25330", hash: "62f2" },
      { mission: "S3", id: "S3B-25333", hash: "62f5" },
    ],
  },
  {
    id: 3, day: 4, time: "19:05", status: "PLANNED", kind: "satellite",
    desc: "Root-cause analysis in progress with the operations team.",
    items: [{ mission: "S3", id: "S3B-25341", hash: "630a" }],
  },
  {
    id: 4, day: 7, time: "09:00", status: "ACQUIRED", kind: "calibration",
    desc: "Monthly radiometric calibration sequence, nominal.",
    items: [{ mission: "S5P", id: "S5P-88120", hash: "1a4c" }],
  },
  {
    id: 5, day: 9, time: "06:22", status: "PLANNED", kind: "manoeuvre",
    desc: "Planned in-plane manoeuvre, ~35 min instrument outage window.",
    items: [
      { mission: "S3", id: "S3B-25402", hash: "6390" },
      { mission: "S3", id: "S3B-25406", hash: "6394" },
    ],
  },
  {
    id: 6, day: 12, time: "22:15", status: "UNAVAILABLE", kind: "acquisition",
    desc: "Acquisition-plan fragments not persisted for two consecutive passes.",
    items: [
      { mission: "S1", id: "S1C-40118", hash: "9c21" },
      { mission: "S1", id: "S1C-40122", hash: "9c25", comp: "partial" },
    ],
  },
  {
    id: 7, day: 13, time: "07:50", status: "ACQUIRED", kind: "production",
    desc: "Cache write path patched; backfill completed for the affected passes.",
    items: [{ mission: "S1", id: "S1C-40118", hash: "9c21" }],
  },
  {
    id: 8, day: 16, time: "11:30", status: "PLANNED", kind: "calibration",
    desc: "Routine calibration slot; imaging suspended over the calibration site.",
    items: [{ mission: "S2", id: "S2B-71209", hash: "3e88" }],
  },
  {
    id: 9, day: 19, time: "03:05", status: "ACQUIRED", kind: "manoeuvre",
    desc: "Nominal maintenance manoeuvre, sun-synchronous orbit correction.",
    items: [{ mission: "S5P", id: "S5P-88204", hash: "1a77" }],
  },
  {
    id: 10, day: 22, time: "14:44", status: "PARTIAL", kind: "production",
    desc: "Processing backlog at the ground segment, ETA 3 h. Altimetry and atmospheric chains both queued behind it.",
    // A ground-segment backlog is not mission-specific — this is the case the
    // per-mission grouping exists for.
    items: [
      { mission: "S3", id: "S3A-25501", hash: "6412", comp: "processing" },
      { mission: "S3", id: "S3A-25505", hash: "6416", comp: "processing" },
      { mission: "S5P", id: "S5P-88315", hash: "1ab4", comp: "processing" },
    ],
  },
  {
    id: 11, day: 25, time: "08:18", status: "ACQUIRED", kind: "manoeuvre",
    desc: "Precautionary avoidance manoeuvre executed; orbit nominal post-burn.",
    items: [{ mission: "S2", id: "S2A-71340", hash: "3f02" }],
  },
  {
    id: 12, day: 29, time: "20:02", status: "PLANNED", kind: "acquisition",
    desc: "Matera station handover delayed 12 min; minor queue backlog.",
    items: [{ mission: "S1", id: "S1A-25612", hash: "72e0" }],
  },
];

const MONTH_LABEL = "July 2026";
const MONTH_INDEX = 6;
const MONTH_YEAR = 2026;
const CHIP_INK = "#04101f";

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

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "02 Jul 2026 12:30:00 UTC" — the occurrence format the real Event Details uses. */
function occurrence(day: number, time: string) {
  return `${String(day).padStart(2, "0")} ${MONTH_ABBR[MONTH_INDEX]} ${MONTH_YEAR} ${time}:00 UTC`;
}

/** Satellite units touched by an event, from the datatake ids ("S1A-25214" → "S1A"). */
function satellites(items: ImpactedItem[]) {
  return [...new Set(items.map((it) => it.id.split("-")[0]))];
}

// Groups an event's impacted items by mission, preserving mission order.
function groupByMission(items: ImpactedItem[]) {
  const order: MissionKey[] = [];
  const map = new Map<MissionKey, ImpactedItem[]>();
  items.forEach((it) => {
    if (!map.has(it.mission)) { map.set(it.mission, []); order.push(it.mission); }
    map.get(it.mission)!.push(it);
  });
  return order.map((m) => ({ mission: m, items: map.get(m)! }));
}

const MISSION_KEYS = Object.keys(MISSIONS) as MissionKey[];
const STATUS_KEYS = Object.keys(STATUSES) as StatusKey[];
const KIND_KEYS = Object.keys(KIND_LABEL) as IssueType[];

export default function EventsLog() {
  const [missions, setMissions] = useState<MissionKey[]>([...MISSION_KEYS]);
  const [statuses, setStatuses] = useState<StatusKey[]>([...STATUS_KEYS]);
  const [kinds, setKinds] = useState<IssueType[]>([...KIND_KEYS]);

  const toggleMission = (m: MissionKey) =>
    setMissions((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]));
  const toggleStatus = (s: StatusKey) =>
    setStatuses((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const toggleKind = (k: IssueType) =>
    setKinds((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const shown = useMemo(
    () =>
      EVENTS.filter(
        (e) =>
          statuses.includes(e.status) &&
          kinds.includes(e.kind) &&
          e.items.some((it) => missions.includes(it.mission))
      ),
    [missions, statuses, kinds]
  );

  const byDay = useMemo(() => {
    const map = new Map<number, LogEvent[]>();
    [...shown]
      .sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
      .forEach((e) => map.set(e.day, [...(map.get(e.day) ?? []), e]));
    return [...map.entries()];
  }, [shown]);

  const weekday = (d: number) =>
    new Date(2026, MONTH_INDEX, d).toLocaleDateString("en-GB", { weekday: "short" });

  return (
    <>
      <div className="evl-head">
        <div className="wrap">
          <div className="evl-title-row"><h1>Events</h1></div>
          <p className="evl-sub">
            Events over the past three months that could impede data production — planned
            calibration activities, manoeuvres or anomalies — with the products they impact.
          </p>
          <PageDescription>{EVENTS_LOG_DESCRIPTION}</PageDescription>
          <div className="evl-monthnav">
            <button aria-label="Previous month"><ChevronLeft size={15} /></button>
            <span className="label">{MONTH_LABEL}</span>
            <button aria-label="Next month"><ChevronRight size={15} /></button>
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
          {KIND_KEYS.map((k) => {
            const on = kinds.includes(k);
            const color = ISSUE_COLORS[k];
            return (
              <button key={k} className={"chipbtn chip-ico" + (on ? " on" : "")} onClick={() => toggleKind(k)}
                style={on ? { background: color, borderColor: "transparent", color: CHIP_INK } : {}}>
                <span style={{ color: on ? CHIP_INK : color, display: "inline-flex" }}>
                  <EventIcon type={k} size={12} />
                </span>
                {KIND_LABEL[k]}
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

      {/* The dot after each datatake carries its completeness, which is not the
          same thing as the event's own status — so it needs a key. */}
      <section className="wrap evl-legend">
        <span className="k">Datatake completeness</span>
        {(Object.keys(COMPLETENESS) as CompKey[]).map((c) => (
          <span className="evl-legend-item" key={c}>
            <span className="dot" style={{ background: COMPLETENESS[c].color }} />
            {COMPLETENESS[c].label}
          </span>
        ))}
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
                const st = STATUSES[e.status];
                const kindColor = ISSUE_COLORS[e.kind];
                // Only the missions still selected in the filter bar are shown,
                // so a mixed-mission event can't smuggle a deselected mission
                // onto the card just because one of its siblings matched.
                const groups = groupByMission(e.items.filter((it) => missions.includes(it.mission)));
                if (groups.length === 0) return null; // no items, or none selected
                const borderColor = MISSIONS[groups[0].mission].color;
                const shownItems = groups.flatMap((g) => g.items);
                return (
                  <article className="evl-card" key={e.id} style={{ borderLeftColor: borderColor }}>
                    <div className="evl-card-top">
                      <span className="ts">{e.time} UTC</span>
                      <span className="st" style={{ color: st.color }}>
                        <StatusIcon status={e.status} size={11} /> {st.label}
                      </span>
                    </div>

                    {/* Event Details, laid out like the real aside: the type glyph
                        in a left gutter, top-aligned with the first field. */}
                    <div className="evl-detail">
                      <span className="evl-detail-ico" style={{ color: kindColor, borderColor: kindColor }}>
                        <EventIcon type={e.kind} size={18} />
                      </span>
                      <div className="evl-detail-body">
                        <div className="evl-field">
                          <span className="k">Occurrence date:</span> {occurrence(e.day, e.time)}
                        </div>
                        <div className="evl-field">
                          <span className="k">Impacted satellite(s):</span> {satellites(shownItems).join(" · ")}
                        </div>
                        <div className="evl-field">
                          <span className="k">Issue type:</span>{" "}
                          <span style={{ color: kindColor }}>{KIND_LABEL[e.kind]}</span>
                        </div>
                        <p className="evl-card-desc">{e.desc}</p>

                        <div className="evl-field"><span className="k">List of impacted datatakes:</span></div>
                        <div className="evl-groups">
                          {groups.map((g) => (
                            <div className="evl-group" key={g.mission}>
                              <span className="evl-group-mission" style={{ color: MISSIONS[g.mission].color }}>
                                <span className="sw" style={{ background: MISSIONS[g.mission].color }} />
                                {MISSIONS[g.mission].label}
                              </span>
                              <div className="evl-items">
                                {g.items.map((it) => {
                                  const comp = COMPLETENESS[it.comp ?? COMP_FROM_STATUS[e.status]];
                                  return (
                                    <a
                                      key={it.id}
                                      className="evl-item"
                                      href={`#/datatakes/${it.id}`}
                                      title={`${it.id} — ${comp.label}`}
                                    >
                                      {it.id} <span className="hash">[{it.hash}]</span>
                                      <span className="dot" style={{ background: comp.color }} />
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
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
