import { useState } from "react";
import { PageHeader, Reveal } from "@/components/ui";
import EventIcon from "@/components/EventIcon";
import { EVENTS_LIST_DESCRIPTION } from "@/data/copy";
import { EVENTS, ISSUE_COLORS, IssueType, CalEvent } from "@/data/mock";

const TYPES: IssueType[] = ["acquisition", "calibration", "manoeuvre", "production", "satellite"];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function Events() {
  const [active, setActive] = useState<IssueType[]>([...TYPES]);
  const [selected, setSelected] = useState<CalEvent | null>(EVENTS[2]);

  const toggle = (t: IssueType) =>
    setActive((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));

  const shown = EVENTS.filter((e) => active.includes(e.type));
  // July 2026 starts on a Wednesday → 2 leading blanks (Mon,Tue). 31 days.
  const lead = 2, days = 31;
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];

  return (
    <>
      <PageHeader crumb="Events" title="Events"
        sub="Details of events over the past three months that could impede data production — planned calibration activities, manoeuvres, or anomalies — with information on the extent to which they affect data production and the products impacted."
        desc={EVENTS_LIST_DESCRIPTION} />

      <section className="wrap pad">
        <div className="filters">
          {TYPES.map((t) => {
            const on = active.includes(t);
            return (
              <button key={t} className={"chipbtn chip-ico" + (on ? " on" : "")}
                onClick={() => toggle(t)}
                style={on ? { background: ISSUE_COLORS[t], borderColor: "transparent", color: "#04101f" } : {}}>
                <span style={{ color: on ? "#04101f" : ISSUE_COLORS[t], display: "inline-flex" }}><EventIcon type={t} /></span>
                {t}
              </button>
            );
          })}
        </div>

        <Reveal className="grid" style={{ gridTemplateColumns: "1fr 320px", alignItems: "start", gap: 24 }}>
          <div>
            <div className="section-head" style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 22 }}>July 2026</h2><span className="meta">{shown.length} events</span>
            </div>
            <div className="cal">
              {DOW.map((d) => <div className="dow" key={d}>{d}</div>)}
              {cells.map((c, i) => {
                if (c === null) return <div className="cell empty" key={i} />;
                const evs = shown.filter((e) => e.day === c);
                return (
                  <div className="cell" key={i}>
                    <span className="dnum">{c}</span>
                    <div className="ev-row">
                      {evs.map((e, j) => (
                        <div className="ev" key={j} style={{ background: ISSUE_COLORS[e.type] }}
                          title={`${e.type} · ${e.satellites}`} onClick={() => setSelected(e)}>
                          <EventIcon type={e.type} size={13} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="card">
            <div className="meta" style={{ marginBottom: 14 }}>Event Details</div>
            {selected ? (
              <div className="evd">
                <span className="evd-ico" style={{ color: ISSUE_COLORS[selected.type] }}><EventIcon type={selected.type} size={18} /></span>
                <div className="evd-body">
                  <div className="evd-field"><span className="evd-k">Occurrence date:</span> {selected.occurrence}</div>
                  <div className="evd-field"><span className="evd-k">Impacted satellite(s):</span> {selected.satellites}</div>
                  <div className="evd-field"><span className="evd-k">Issue type:</span> <span style={{ textTransform: "capitalize" }}>{selected.type}</span></div>
                  <div className="evd-field"><span className="evd-k">List of impacted datatakes:</span></div>
                  <div className="evd-datatakes">
                    {selected.impacted.map((d) => (
                      <span className="dt-chip" key={d.id}><i className={"dt-dot " + d.cls} />{d.id}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : <p style={{ color: "var(--text-mute)" }}>Select an event in the calendar.</p>}
          </aside>
        </Reveal>
      </section>
    </>
  );
}
