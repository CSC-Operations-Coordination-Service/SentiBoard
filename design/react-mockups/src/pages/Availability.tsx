import { useMemo, useState } from "react";
import { PageHeader, Pill, Reveal } from "@/components/ui";
import { Info } from "lucide-react";
import {
  AVAILABILITY, COMPLETENESS_COLOR, COMPLETENESS_LABEL, COMPLETENESS_ORDER, DATATAKES, STATUS_COLORS,
  Status, type Completeness, type Datatake as DatatakeRow,
} from "@/data/mock";
import { AVAILABILITY_DESCRIPTION, AVAILABILITY_SUMMARY } from "@/data/copy";
import { DEFAULT_PERIOD, PERIODS, inPeriod, type PeriodId } from "@/data/period";
import { missionOfPlatform, type DatatakeSummary } from "@/data/datatake-details";
import DatatakeModal from "@/components/DatatakeModal";

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

/* All five completeness states, in the legend's order — the table previously offered four and
   named them after mission health ("Nominal"), which is not what the dashboard calls them. */
const FILTERS: (Completeness | "all")[] = ["all", ...COMPLETENESS_ORDER];
const FILTER_LABEL: Record<string, string> = { all: "All", ...COMPLETENESS_LABEL };

/* Maps a row of the availability table onto what the details modal needs.
   The id used to be picked apart for the platform and the sensing start — it was a product-style
   name that happened to contain both. In the dashboard's own format (S1C-73089) it contains
   neither, so the platform comes off the id's prefix and the time off the row's own `start`. */
function toSummary(d: DatatakeRow): DatatakeSummary {
  const platform = d.id.split("-")[0];
  return {
    id: d.id,
    platform,
    mission: missionOfPlatform(platform),
    sensingStart: d.start,
    statusLabel: FILTER_LABEL[d.comp],
    statusColor: COMPLETENESS_COLOR[d.comp],
    completeness: d.pct,
  };
}

export default function Availability() {
  const [f, setF] = useState<Completeness | "all">("all");
  // Production carries this control in the top navigation; the mock-up puts it beside the table
  // it governs, which is the one place a reader looks when the row count changes.
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(() => {
    let out = DATATAKES;
    if (period === "custom") {
      if (from) out = out.filter((d) => d.start >= new Date(`${from}T00:00:00Z`));
      if (to) out = out.filter((d) => d.start <= new Date(`${to}T23:59:59Z`));
    } else {
      out = out.filter((d) => inPeriod(d.start, period));
    }
    return f === "all" ? out : out.filter((d) => d.comp === f);
  }, [f, period, from, to]);

  // Typing a date by hand is what "custom" means, so the selector follows the pickers.
  const onCustomDate = (which: "from" | "to", value: string) => {
    (which === "from" ? setFrom : setTo)(value);
    setPeriod("custom");
  };

  // The page owns the selection; the modal owns everything else about being a dialog.
  const [selected, setSelected] = useState<DatatakeSummary | null>(null);

  return (
    <>
      <PageHeader crumb="Data Availability" title="Data Availability"
        desc={AVAILABILITY_DESCRIPTION} />

      <section className="wrap pad">
        <Reveal className="section-head"><div><h2>By mission</h2></div></Reveal>
        <Reveal className="donut-grid">
          {AVAILABILITY.map((a) => <Donut key={a.label} pct={a.pct} label={a.label} sub={a.sub} status={a.status} />)}
        </Reveal>
      </section>

      <section className="wrap" style={{ paddingBottom: "clamp(56px,8vw,120px)" }}>
        <Reveal className="section-head"><div><h2>Recent datatakes</h2></div></Reveal>
        <div className="periodbar">
          <div className="pb-field">
            <label htmlFor="av-period">Period</label>
            <select
              id="av-period"
              className="select"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value as PeriodId);
                setFrom("");
                setTo("");
              }}
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
              <option value="custom">Custom range</option>
            </select>
          </div>
          <div className="pb-field">
            <label htmlFor="av-from">From</label>
            <input id="av-from" className="select" type="date" value={from}
              onChange={(e) => onCustomDate("from", e.target.value)} />
          </div>
          <div className="pb-field">
            <label htmlFor="av-to">To</label>
            <input id="av-to" className="select" type="date" value={to}
              onChange={(e) => onCustomDate("to", e.target.value)} />
          </div>
          <span className="pb-count">
            {rows.length} of {DATATAKES.length} datatakes
          </span>
        </div>

        <div className="filters">
          {FILTERS.map((k) => (
            <button
              key={k}
              className={"chipbtn" + (f === k ? " on" : "")}
              onClick={() => setF(k)}
              style={k === "all" ? undefined : { ["--cmp" as string]: COMPLETENESS_COLOR[k] }}
            >
              {k !== "all" && <span className="dot" />}
              {FILTER_LABEL[k]}
            </button>
          ))}
        </div>
        <Reveal className="tbl-wrap">
          <table className="data">
            <thead><tr><th>Datatake ID</th><th>Mission</th><th>Sensing</th><th>Completeness</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.id}</td>
                  <td>{d.mission}</td>
                  <td className="mono">{d.sensing}</td>
                  <td style={{ minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--bg-3)", overflow: "hidden" }}>
                        <div style={{ width: `${d.pct}%`, height: "100%", background: COMPLETENESS_COLOR[d.comp] }} />
                      </div>
                      <span className="mono" style={{ fontSize: 12 }}>{d.pct}%</span>
                    </div>
                  </td>
                  <td><Pill status={d.comp} /></td>
                  <td>
                    <button className="dtm-trigger" onClick={() => setSelected(toSummary(d))}>
                      <Info size={13} />View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      {/* Compact variant: the percentages and nothing else, as production's dialog does today.
          The identity panel is the /examples/data-availability proposal's idea, kept there so the
          two can be compared side by side. */}
      {selected && <DatatakeModal datatake={selected} onClose={() => setSelected(null)} variant="compact" />}
    </>
  );
}
