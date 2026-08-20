import { useCallback, useMemo, useState } from "react";
import { Eye, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { AVAILABILITY_DESCRIPTION } from "@/data/copy";
import DatatakeModal from "@/components/DatatakeModal";
import type { DatatakeSummary } from "@/data/datatake-details";
import { DEFAULT_PERIOD, PERIODS, periodStart, type PeriodId } from "@/data/period";
import {
  ALL_SATELLITES, DATA, DAY_MS, MISSIONS, MISSION_NAMES, STATUS_COLOR, WINDOW,
  type Datatake, type DayCell, type Status,
  daysOf, daysSinceGap, fmtDate, fmtDateTime, isGap, missionRow, pad, trendSeries,
} from "./mock";
import s from "./coverage.module.css";
import "@/styles/data-availability.css"; // filter bar, shared with the "Filtered breakdown" proposal

/* Data Availability PROPOSAL 3 — "Coverage timeline". An ALTERNATIVE to /availability, which is
   untouched, and a third reading alongside /examples/data-availability-spacex (telemetry console)
   and /examples/data-availability (filtered breakdown).

   The other two answer "what is the state right now". This one answers "where did coverage break,
   and is it recovering" — so the donuts are gone entirely. In their place:

     · a heatmap, one row per mission and one column per day of the selected range, shaded by that
       day's mean publication completeness. Outages read as horizontal runs, which is the shape
       they actually have and the shape a snapshot cannot show;
     · a sparkline chip per mission over 7 / 30 / 90 days, carrying the one number an operator can
       act on — days since the last gap;
     · the same table and filters as the "Filtered breakdown" proposal, but sorted by MOST RECENT
       GAP rather than chronologically, so what is broken sits at the top rather than whatever
       happens to be newest.

   Colour comes entirely from the shared tokens, so this follows the app's global light/dark switch
   with no palette of its own — see coverage.module.css. Static mock data throughout. */

type TrendWindow = 7 | 30 | 90;
type SortKey = "gap" | "recent" | "worst";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "gap", label: "Most recent gap" },
  { id: "recent", label: "Most recent" },
  { id: "worst", label: "Lowest completeness" },
];

/** The heatmap ramp: unavailable → partial → acquired, mixed live so each theme re-weights it.
 *  Days with nothing scheduled return null and are hatched instead — "no pass planned" is a
 *  different fact from "nothing was published", and flattening the two would invent outages. */
function cellColor(mean: number | null): string | null {
  if (mean === null) return null;
  if (mean >= 50) {
    const t = Math.round(((mean - 50) / 50) * 100);
    return `color-mix(in srgb, var(--cmp-acquired) ${t}%, var(--cmp-partial))`;
  }
  const t = Math.round((mean / 50) * 100);
  return `color-mix(in srgb, var(--cmp-partial) ${t}%, var(--cmp-unavailable))`;
}

function Sparkline({ series }: { series: (number | null)[] }) {
  const W = 100;
  const H = 34;
  const points = series
    .map((v, i) => (v === null ? null : { x: (i / Math.max(1, series.length - 1)) * W, y: H - 3 - (v / 100) * (H - 6) }))
    .filter(Boolean) as { x: number; y: number }[];

  if (points.length < 2) return <svg className={s.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" />;

  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${points[0].x.toFixed(1)},${H} ${line} ${points[points.length - 1].x.toFixed(1)},${H}`;

  return (
    <svg className={s.spark} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <polygon className={s.sparkArea} points={area} />
      {/* 100% reference, so a line sitting below it reads as a shortfall rather than just a shape */}
      <line className={s.sparkBase} x1="0" y1="3" x2={W} y2="3" />
      <polyline className={s.sparkLine} points={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function CoverageTimeline() {
  /* A trend view opens on a month: "Last 7 Days" is seven columns, which is not a timeline. The
     other proposals default to the production default (week) because they are snapshots. */
  const [period, setPeriod] = useState<PeriodId>("month");
  const [mission, setMission] = useState("All");
  const [satellite, setSatellite] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [trend, setTrend] = useState<TrendWindow>(30);
  const [sort, setSort] = useState<SortKey>("gap");
  const [focus, setFocus] = useState<{ mission: string; key: string; date: Date } | null>(null);
  const [selected, setSelected] = useState<DatatakeSummary | null>(null);

  const satelliteOptions = mission === "All" ? ["All", ...ALL_SATELLITES] : ["All", ...MISSIONS[mission]];

  const onCustomDate = useCallback((which: "from" | "to", value: string) => {
    (which === "from" ? setDateFrom : setDateTo)(value);
    setPeriod("custom");
  }, []);

  const reset = useCallback(() => {
    setPeriod("month");
    setMission("All");
    setSatellite("All");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setFocus(null);
  }, []);

  /** The visible range — the heatmap's columns and the table's bounds are the same window. */
  const range = useMemo(() => {
    const to = dateTo && period === "custom" ? new Date(`${dateTo}T23:59:59Z`) : WINDOW.today;
    const from =
      period === "custom"
        ? dateFrom
          ? new Date(`${dateFrom}T00:00:00Z`)
          : new Date(WINDOW.today.getTime() - 29 * DAY_MS)
        : periodStart(period, WINDOW.today)!;
    return { from, to };
  }, [period, dateFrom, dateTo]);

  const days = useMemo(() => daysOf(range.from, range.to), [range]);

  /** Everything in range, before the mission/satellite/id filters — the heatmap keeps every
   *  mission visible so a filtered view still shows what else was happening. */
  const inRange = useMemo(
    () => DATA.filter((r) => r.start >= range.from && r.start <= new Date(range.to.getTime() + DAY_MS - 1)),
    [range],
  );

  const rows = useMemo(() => {
    let out = inRange;
    if (mission !== "All") out = out.filter((r) => r.mission === mission);
    if (satellite !== "All") out = out.filter((r) => r.satellite === satellite);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.id.toLowerCase().includes(q));
    }
    if (focus) out = out.filter((r) => r.mission === focus.mission && fmtDate(r.start) === focus.key);
    return out;
  }, [inRange, mission, satellite, search, focus]);

  /* Default order: the most recent GAP first. A datatake that published in full is not news, so
     complete rows fall below the incomplete ones however recent they are — which is the whole
     argument of this concept over a chronological list. */
  const sorted = useMemo(() => {
    const out = [...rows];
    if (sort === "recent") return out.sort((a, b) => b.start.getTime() - a.start.getTime());
    if (sort === "worst") return out.sort((a, b) => a.completeness - b.completeness || b.start.getTime() - a.start.getTime());
    return out.sort((a, b) => {
      const ga = isGap(a) ? 0 : 1;
      const gb = isGap(b) ? 0 : 1;
      return ga - gb || b.start.getTime() - a.start.getTime();
    });
  }, [rows, sort]);

  const visible = sorted.slice(0, 15);
  const active =
    period !== "month" || mission !== "All" || satellite !== "All" || dateFrom !== "" || dateTo !== "" || search !== "" || focus !== null;

  const gaps = rows.filter(isGap).length;
  const lost = rows.filter((r) => r.status === "Unavailable").length;
  const mean = rows.length ? Math.round(rows.reduce((n, r) => n + r.completeness, 0) / rows.length) : 0;

  const heat = useMemo(
    () => MISSION_NAMES.map((m) => ({ mission: m, cells: missionRow(inRange, m, days) })),
    [inRange, days],
  );

  // Axis ticks: every day when the range is short, otherwise roughly every seventh column.
  const tickEvery = days.length <= 14 ? 1 : days.length <= 40 ? 7 : 14;

  const toSummary = (d: Datatake): DatatakeSummary => ({
    id: d.id,
    platform: d.satellite,
    mission: d.mission,
    sensorMode: d.sensorMode,
    sensingStart: d.start,
    statusLabel: d.status,
    statusColor: STATUS_COLOR[d.status],
    completeness: d.completeness,
  });

  const ageOf = (d: Date) => {
    const n = Math.floor((WINDOW.today.getTime() - d.getTime()) / DAY_MS);
    if (n < 0) return "SCHEDULED";
    if (n === 0) return "TODAY";
    return `${n}D AGO`;
  };

  return (
    <>
      <PageHeader crumb="Data Availability proposal" title="Coverage Timeline" desc={AVAILABILITY_DESCRIPTION}
        img="/assets/img/modules/Protecting_Atlantic.jpg" />

      <section className="wrap pad">
        {/* ---------------- counters ---------------- */}
        <Reveal className={s.counters}>
          <div className={s.counter}>
            <span className={s.counterK}>Datatakes in range</span>
            <span className={s.counterV}>{pad(rows.length)}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Mean completeness</span>
            <span className={s.counterV}>{mean}%</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Coverage gaps</span>
            <span className={`${s.counterV} ${s.warn}`}>{pad(gaps)}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Datatakes lost</span>
            <span className={`${s.counterV} ${s.crit}`}>{pad(lost)}</span>
          </div>
        </Reveal>

        {/* ---------------- trend chips ---------------- */}
        <div className="section-head" style={{ marginBottom: 14 }}>
          <div>
            <div className="eyebrow">Trend · mean completeness per day</div>
            <h2 style={{ fontSize: 21 }}>By mission</h2>
          </div>
          <div className={s.segmented}>
            {([7, 30, 90] as TrendWindow[]).map((w) => (
              <button key={w} className={trend === w ? s.on : ""} onClick={() => setTrend(w)}>
                {w}D
              </button>
            ))}
          </div>
        </div>

        <Reveal className={s.chips}>
          {MISSION_NAMES.map((m) => {
            const series = trendSeries(DATA, m, trend, WINDOW.today);
            const seen = series.filter((v): v is number => v !== null);
            const avg = seen.length ? Math.round(seen.reduce((a, b) => a + b, 0) / seen.length) : 0;
            const since = daysSinceGap(DATA, m, WINDOW.today);
            const color = avg >= 95 ? "var(--cmp-acquired)" : avg >= 60 ? "var(--cmp-partial)" : "var(--cmp-unavailable)";
            return (
              <div className={s.chip} key={m} style={{ ["--c" as string]: color }}>
                <div className={s.chipHead}>
                  <span className={s.chipName}>{m}</span>
                  <span className={s.chipMean}>{avg}%</span>
                </div>
                <Sparkline series={series} />
                <div className={s.chipFoot}>
                  <span>{trend}-DAY MEAN</span>
                  <span className={s.chipGap}>
                    {since === null ? "NO GAPS" : since === 0 ? "GAP TODAY" : `LAST GAP ${since}D AGO`}
                  </span>
                </div>
              </div>
            );
          })}
        </Reveal>

        {/* ---------------- heatmap ---------------- */}
        <Reveal className={s.panel}>
          <div className={s.panelHead}>
            <span className={s.panelTitle}>
              Coverage map · {fmtDate(range.from)} → {fmtDate(range.to)} · {days.length} days
            </span>
            <span className={s.panelTitle} style={{ color: "var(--text-mute)" }}>
              Select a cell to focus the table
            </span>
          </div>

          <div className={s.mapScroll}>
            <div className={s.mapInner}>
              <div className={s.mapAxis}>
                {days.map((d, i) => (
                  <span className={s.axisTick} key={d.toISOString()}>
                    {i % tickEvery === 0 ? `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}` : ""}
                  </span>
                ))}
              </div>

              {heat.map(({ mission: m, cells }) => {
                const covered = cells.filter((c) => c.mean !== null);
                const rowMean = covered.length
                  ? Math.round(covered.reduce((n, c) => n + (c.mean ?? 0), 0) / covered.length)
                  : 0;
                return (
                  <div className={s.mapRow} key={m}>
                    <div className={s.mapLabel}>
                      <b>{m.replace("Sentinel-", "S")}</b>
                      <span>{rowMean}% MEAN</span>
                    </div>
                    <div className={s.cells}>
                      {cells.map((c: DayCell) => {
                        const color = cellColor(c.mean);
                        const on = focus?.mission === m && focus.key === c.key;
                        if (color === null) {
                          return (
                            <span
                              className={`${s.cell} ${s.cellEmpty}`}
                              key={c.key}
                              title={`${c.key} · ${m} · no datatakes`}
                              aria-hidden
                            />
                          );
                        }
                        return (
                          <button
                            key={c.key}
                            className={on ? `${s.cell} ${s.cellOn}` : s.cell}
                            style={{ ["--c" as string]: color }}
                            title={`${c.key} · ${m} · ${c.count} datatakes · ${c.mean}% mean${c.lost ? ` · ${c.lost} incomplete` : ""}`}
                            aria-label={`${c.key}, ${m}, ${c.mean}% mean completeness, ${c.count} datatakes`}
                            onClick={() => setFocus(on ? null : { mission: m, key: c.key, date: c.date })}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={s.legend}>
            <div className={s.ramp}>
              <span>0%</span>
              <span className={s.rampBar} aria-hidden />
              <span>100% MEAN COMPLETENESS</span>
            </div>
            <span className={s.legendItem}>
              <i className={s.none} aria-hidden />
              NO DATATAKES
            </span>
            {focus && (
              <span className={s.focus}>
                FOCUS · {focus.mission} · {focus.key}
                <button className={s.focusClear} onClick={() => setFocus(null)}>
                  <X size={11} />
                  CLEAR
                </button>
              </span>
            )}
          </div>
        </Reveal>

        {/* ---------------- filters (same set as the "Filtered breakdown" proposal) ---------------- */}
        <div className="da-filters">
          <div className="da-filters-head">
            <SlidersHorizontal size={14} />
            <span className="lab">Filters</span>
            <button className="da-reset" onClick={reset} disabled={!active}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>

          <div className="da-fields">
            <div className="da-field">
              <label htmlFor="ct-period">Period</label>
              <select
                id="ct-period"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as PeriodId);
                  setDateFrom("");
                  setDateTo("");
                  setFocus(null);
                }}
              >
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
                <option value="custom">Custom range</option>
              </select>
            </div>

            <div className="da-field">
              <label htmlFor="ct-mission">Mission</label>
              <select
                id="ct-mission"
                value={mission}
                onChange={(e) => {
                  setMission(e.target.value);
                  setSatellite(e.target.value === "Sentinel-5P" ? "S5P" : "All");
                }}
              >
                {["All", ...MISSION_NAMES].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="da-field">
              <label htmlFor="ct-sat">Satellite</label>
              <select
                id="ct-sat"
                value={satellite}
                disabled={mission === "Sentinel-5P"}
                onChange={(e) => setSatellite(e.target.value)}
              >
                {satelliteOptions.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>

            <div className="da-field">
              <label htmlFor="ct-from">From</label>
              <input id="ct-from" type="date" value={dateFrom} onChange={(e) => onCustomDate("from", e.target.value)} />
            </div>

            <div className="da-field">
              <label htmlFor="ct-to">To</label>
              <input id="ct-to" type="date" value={dateTo} onChange={(e) => onCustomDate("to", e.target.value)} />
            </div>

            <div className="da-field">
              <label htmlFor="ct-search">Datatake ID</label>
              <div className="da-input-wrap">
                <Search size={14} className="lead" />
                <input
                  id="ct-search"
                  type="text"
                  placeholder="Search by id…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="da-clear" onClick={() => setSearch("")} aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ---------------- table ---------------- */}
        <div className={s.tableHead}>
          <div className={s.sortRow}>
            Order
            <div className={s.segmented}>
              {SORTS.map((o) => (
                <button key={o.id} className={sort === o.id ? s.on : ""} onClick={() => setSort(o.id)}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <span className={s.count}>
            Showing {visible.length} of {sorted.length} datatake{sorted.length !== 1 ? "s" : ""}
            {focus ? ` · focused on ${focus.mission} ${focus.key}` : ""}
          </span>
        </div>

        <Reveal className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Datatake ID</th>
                <th>Platform</th>
                <th>Mode</th>
                <th>Start (UTC)</th>
                <th>Age</th>
                <th>Status</th>
                <th>Publication completeness</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const cls = row.status === "Unavailable" ? s.lossRow : isGap(row) ? s.gapRow : undefined;
                return (
                  <tr key={row.id} className={cls}>
                    <td className={s.id}>{row.id}</td>
                    <td><span className={s.sat}>{row.satellite}</span></td>
                    <td className={s.mode}>{row.sensorMode}</td>
                    <td className={s.time}>{fmtDateTime(row.start)}</td>
                    <td className={s.age}>{ageOf(row.start)}</td>
                    <td>
                      <span className={s.badge} style={{ ["--c" as string]: STATUS_COLOR[row.status as Status] }}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div className={s.bar}>
                        <div className={s.barTrack}>
                          <div
                            className={s.barFill}
                            style={{ width: `${row.completeness}%`, background: STATUS_COLOR[row.status as Status] }}
                          />
                        </div>
                        <span className={s.barVal}>{row.completeness}%</span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="dtm-trigger icon"
                        onClick={() => setSelected(toSummary(row))}
                        title={`View details — ${row.id}`}
                        aria-label={`View details for datatake ${row.id}`}
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className={s.empty}>No datatakes match the current filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Reveal>
      </section>

      {selected && <DatatakeModal datatake={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
