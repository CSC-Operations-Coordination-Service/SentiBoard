import { useState } from "react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_DESCRIPTION } from "@/data/copy";
import { PROCESSORS, STATUS_COLORS, Processor } from "@/data/mock";

const MISSIONS = ["All", "S1 IPF", "S2 IPF", "S3 IPF", "S5P"];

export default function Processors() {
  const [mission, setMission] = useState("All");
  const [sel, setSel] = useState<Processor>(PROCESSORS[1]);
  const rows = mission === "All" ? PROCESSORS : PROCESSORS.filter((p) => p.mission === mission);
  const lanes = [...new Set(rows.map((r) => r.mission))];

  return (
    <>
      <PageHeader crumb="Processors" title="Processors"
        sub="The complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline. Zoom in / out with the mouse wheel, drag left / right, and click a coloured box to display the details of the selected processor release."
      />

      <section className="wrap pad">
        <div className="filters">
          <span className="meta" style={{ marginRight: 8 }}>Mission</span>
          {MISSIONS.map((m) => (
            <button key={m} className={"chipbtn" + (mission === m ? " on" : "")} onClick={() => setMission(m)}>{m}</button>
          ))}
        </div>

        <Reveal className="timeline">
          <div className="tl-row" style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10, marginBottom: 6 }}>
            <div className="tl-lab" />
            <div className="tl-track">
              {["Jan", "Mar", "May", "Jul", "Sep", "Nov"].map((m, i) => (
                <span key={m} className="meta" style={{ position: "absolute", left: `${i * 20}%`, top: 4 }}>{m}</span>
              ))}
            </div>
          </div>
          {lanes.map((lane) => (
            <div className="tl-row" key={lane}>
              <div className="tl-lab">{lane}</div>
              <div className="tl-track">
                {rows.filter((r) => r.mission === lane).map((r, i) => (
                  <div key={i} className="tl-box"
                    style={{ left: `${r.from}%`, width: `${r.to - r.from}%`, background: STATUS_COLORS[r.status], outline: sel === r ? "2px solid var(--text)" : "none" }}
                    onClick={() => setSel(r)}>{r.label}</div>
                ))}
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal className="card" style={{ marginTop: 20 }}>
          <div className="meta" style={{ marginBottom: 10 }}>Selected release</div>
          <div className="grid cols-4" style={{ gap: 24 }}>
            <div className="stat"><span className="k">Processor</span><span className="v" style={{ fontSize: 26 }}>{sel.mission}</span></div>
            <div className="stat"><span className="k">Baseline</span><span className="v" style={{ fontSize: 26 }}>{sel.label}</span></div>
            <div className="stat"><span className="k">Status</span><span className="v" style={{ fontSize: 26, color: STATUS_COLORS[sel.status], textTransform: "capitalize" }}>{sel.status === "info" ? "current" : sel.status}</span></div>
            <div className="stat"><span className="k">Applies to</span><span className="v" style={{ fontSize: 26 }}>All datatakes</span></div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
