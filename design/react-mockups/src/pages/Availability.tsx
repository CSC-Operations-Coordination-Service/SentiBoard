import { useState } from "react";
import { PageHeader, Pill, Reveal } from "@/components/ui";
import { AVAILABILITY, DATATAKES, STATUS_COLORS, Status } from "@/data/mock";

function Donut({ pct, label, sub, status }: { pct: number; label: string; sub: string; status: Status }) {
  const r = 42, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="donut">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle className="track" cx="55" cy="55" r={r} />
        <circle className="val" cx="55" cy="55" r={r} stroke={STATUS_COLORS[status]}
          strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div style={{ marginTop: -74, textAlign: "center" }}>
        <div className="pct" style={{ color: STATUS_COLORS[status] }}>{pct}%</div>
      </div>
      <div style={{ height: 30 }} />
      <div className="lbl">{label}</div>
      <div className="sub">{sub}</div>
    </div>
  );
}

const FILTERS: (Status | "all")[] = ["all", "nominal", "info", "degraded", "critical"];
const FILTER_LABEL: Record<string, string> = { all: "All", nominal: "Acquired", info: "Processing", degraded: "Partial", critical: "Unavailable" };

export default function Availability() {
  const [f, setF] = useState<Status | "all">("all");
  const rows = f === "all" ? DATATAKES : DATATAKES.filter((d) => d.comp === f);

  return (
    <>
      <PageHeader crumb="Data Availability" title="Data Availability"
        sub="A real-time list of available collections delivered by the missions. Scan through these products to find data meeting your research requirements, verify whether specific data of interest is available, check its current status, and review key availability metrics such as availability percentage." />

      <section className="wrap pad">
        <Reveal className="section-head"><div><div className="eyebrow">Global availability · last 24h</div><h2>By mission</h2></div></Reveal>
        <Reveal className="donut-grid">
          {AVAILABILITY.map((a) => <Donut key={a.label} pct={a.pct} label={a.label} sub={a.sub} status={a.status} />)}
        </Reveal>
      </section>

      <section className="wrap" style={{ paddingBottom: "clamp(56px,8vw,120px)" }}>
        <Reveal className="section-head"><div><div className="eyebrow">Detail data availability</div><h2>Recent datatakes</h2></div></Reveal>
        <div className="filters">
          {FILTERS.map((k) => (
            <button key={k} className={"chipbtn" + (f === k ? " on" : "")} onClick={() => setF(k)}>{FILTER_LABEL[k]}</button>
          ))}
        </div>
        <Reveal className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Datatake ID</th><th>Mission</th><th>Sensing</th><th>Completeness</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td>
                  <td>{d.mission}</td>
                  <td className="mono">{d.sensing}</td>
                  <td style={{ minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--bg-3)", overflow: "hidden" }}>
                        <div style={{ width: `${d.pct}%`, height: "100%", background: STATUS_COLORS[d.comp] }} />
                      </div>
                      <span className="mono" style={{ fontSize: 12 }}>{d.pct}%</span>
                    </div>
                  </td>
                  <td><Pill status={d.comp} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>
    </>
  );
}
