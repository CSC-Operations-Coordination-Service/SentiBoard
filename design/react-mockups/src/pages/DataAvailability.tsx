import { useCallback, useMemo, useState } from "react";
import {
  Activity, CalendarClock, Calendar, ChevronDown, ChevronUp, CircleCheckBig, CircleX, Eye,
  LayoutDashboard, LoaderCircle, Radio, RotateCcw, Search, SlidersHorizontal, TrendingUp,
  TriangleAlert, X,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { PageHeader, Reveal } from "@/components/ui";
import { AVAILABILITY_DESCRIPTION, AVAILABILITY_SUMMARY } from "@/data/copy";
import DatatakeModal from "@/components/DatatakeModal";
import type { DatatakeSummary } from "@/data/datatake-details";
import { DEFAULT_PERIOD, PERIODS, inPeriod, type PeriodId } from "@/data/period";
import { useTheme } from "@/theme";
import "@/styles/data-availability.css";

/* Data Availability page PROPOSAL — an ALTERNATIVE to the real page at "/availability",
   which is untouched.

   Where the real page opens with two big completeness donuts and a flat datatake list, this
   one leads with three breakdowns of whatever the filters currently select (mission share,
   acquisition status, sensor mode) and then a sortable table underneath, so the charts and the
   rows always describe the same set of datatakes.

   Adapted from the standalone sketch the same way as the other proposals: the styles live in
   data-availability.css rather than inline Tailwind; the sketch's own theme switch is gone,
   because the app already wraps every route in <Nav/> with the global toggle and this
   stylesheet reads the shared tokens that toggle flips; and the mock data carries types.

   Only the Recharts slices hold literal colours — SVG presentation attributes cannot resolve
   var() — so those are keyed off the active theme in CHART below. */

// ---------------------------------------------------------------------------
// MOCK DATA — the datatake shape the real availability views use: platform,
// sensor mode, acquisition status and a publication completeness percentage.
// ---------------------------------------------------------------------------

/* The five completeness states the dashboard actually uses, in the order and wording of the
   production legend (apps/templates/home/data-availability.html → "Completeness Status:"):
   Planned · Processing · Acquired · Partial · Unavailable. */
type Status = "Planned" | "Processing" | "Acquired" | "Partial" | "Unavailable";

interface Datatake {
  id: string;
  satellite: string;
  mission: string;
  sensorMode: string;
  status: Status;
  completeness: number;
  start: Date;
}

const MISSIONS: Record<string, string[]> = {
  "Sentinel-1": ["S1A", "S1C"],
  "Sentinel-2": ["S2A", "S2B", "S2C"],
  "Sentinel-3": ["S3A", "S3B"],
  "Sentinel-5P": ["S5P"],
};

const SENSOR_MODES: Record<string, string[]> = {
  S1A: ["IW", "EW", "SM", "WV"],
  S1C: ["IW", "EW", "SM", "WV"],
  S2A: ["MSI"],
  S2B: ["MSI"],
  S2C: ["MSI"],
  S3A: ["OLCI", "SLSTR", "SRAL"],
  S3B: ["OLCI", "SLSTR", "SRAL"],
  S5P: ["TROPOMI"],
};

const MISSION_NAMES = Object.keys(MISSIONS);
const ALL_SATELLITES = MISSION_NAMES.flatMap((m) => MISSIONS[m]);
const MISSION_OF: Record<string, string> = Object.fromEntries(
  MISSION_NAMES.flatMap((m) => MISSIONS[m].map((sat) => [sat, m])),
);
// Legend order: forward through the lifecycle, then the two failure states.
const STATUS_ORDER: Status[] = ["Planned", "Processing", "Acquired", "Partial", "Unavailable"];

const pad = (n: number) => String(n).padStart(2, "0");
const fmtDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

/** The window the real page describes: the past three months plus everything planned up to
 *  23:59:59 of the following day. Anchored to UTC midnight so the mock rows are stable for a
 *  whole day rather than shifting on every reload. */
function acquisitionWindow() {
  const n = new Date();
  const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
  const start = new Date(today);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const end = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1, 23, 59, 59));
  // `today` splits the window into what has flown and what is still scheduled — the line between
  // a Planned datatake and one that has already been acquired.
  return { start, end, today: new Date(today) };
}

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/* Status first, then a sensing time that agrees with it — the two are not independent in the real
   world and should not look independent here. A Planned datatake has not flown yet, so it sits in
   the scheduled tail of the window with nothing published; a Processing one flew in the last day
   and is still publishing; the settled states fill everything older. */
function statusFor(rng: () => number): Status {
  const r = rng();
  if (r < 0.08) return "Planned";
  if (r < 0.18) return "Processing";
  if (r < 0.78) return "Acquired";
  if (r < 0.93) return "Partial";
  return "Unavailable";
}

function completenessFor(status: Status, rng: () => number): number {
  switch (status) {
    case "Planned":
      return 0; // nothing acquired yet, so nothing to publish
    case "Processing":
      return Math.round(20 + rng() * 60); // products still arriving
    case "Acquired":
      return Math.round(90 + rng() * 10);
    case "Partial":
      return Math.round(30 + rng() * 55);
    case "Unavailable":
      return Math.round(rng() * 8);
  }
}

function startFor(status: Status, rng: () => number, w: ReturnType<typeof acquisitionWindow>): Date {
  const day = 86_400_000;
  if (status === "Planned") return new Date(w.today.getTime() + rng() * (w.end.getTime() - w.today.getTime()));
  if (status === "Processing") return new Date(w.today.getTime() - day + rng() * day);
  const settledEnd = w.today.getTime() - day;
  return new Date(w.start.getTime() + rng() * (settledEnd - w.start.getTime()));
}

function generateMockData(count = 240): Datatake[] {
  const rng = seededRandom(42);
  const window = acquisitionWindow();
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  const rows: Datatake[] = [];
  for (let i = 0; i < count; i++) {
    const sat = pick(ALL_SATELLITES);
    const mode = pick(SENSOR_MODES[sat]);
    const status = statusFor(rng);
    const completeness = completenessFor(status, rng);
    const start = startFor(status, rng, window);
    const hex = Math.floor(rng() * 0xffffff).toString(16).padStart(6, "0").toUpperCase();
    const id = `${sat}_${mode}_${fmtDate(start).replace(/-/g, "")}T${pad(start.getUTCHours())}${pad(
      start.getUTCMinutes(),
    )}${pad(start.getUTCSeconds())}_${hex}`;

    rows.push({ id, satellite: sat, mission: MISSION_OF[sat], sensorMode: mode, status, completeness, start });
  }
  return rows.sort((a, b) => b.start.getTime() - a.start.getTime());
}

const DATA = generateMockData();
const WINDOW = acquisitionWindow();
const RESULT_CAP = 15;

// ---------------------------------------------------------------------------
// Chart colours — the only place this page holds literal values (see header note).
//
// The completeness hues come from the production legend
// (apps/static/assets/css/dataAvailability.css → .status-circle-dt-*):
//   Planned #9e9e9e · Processing #9e9e9e · Acquired #0aa41b · Partial #bb8747 · Unavailable #FF0000
// Those exact values are used in the light theme. Two departures, both deliberate:
//   · Production paints Planned and Processing the SAME grey. That is readable in a legend where
//     the words sit next to the dots, but not in a pie chart where the slice is all you have, so
//     Processing is lifted to a paler grey — same hue family, still obviously "not a result yet".
//   · On the near-black canvas #0aa41b and #FF0000 are muddy and glaring respectively, so the dark
//     theme uses lighter values of the same hues.
// ---------------------------------------------------------------------------

const CHART = {
  dark: {
    panel: "#10151f",
    line: "rgba(255,255,255,0.16)",
    text: "#eef2f8",
    status: {
      Planned: "#8B9096",
      Processing: "#C3C9CF",
      Acquired: "#2FC04A",
      Partial: "#CC9A54",
      Unavailable: "#FF4D4D",
    } as Record<Status, string>,
    mission: ["#5AA9FF", "#6FCF97", "#F2C14E", "#D98CFF"],
    mode: {
      IW: "#5AA9FF", EW: "#85C3FF", SM: "#3D7FC4", WV: "#2A5A8F",
      MSI: "#6FCF97",
      OLCI: "#D98CFF", SLSTR: "#E9B6FF", SRAL: "#A85FD0",
      TROPOMI: "#F2C14E",
    } as Record<string, string>,
  },
  light: {
    panel: "#ffffff",
    line: "rgba(9,20,40,0.18)",
    text: "#0c1524",
    status: {
      Planned: "#9e9e9e",
      Processing: "#C6C6C6",
      Acquired: "#0aa41b",
      Partial: "#bb8747",
      Unavailable: "#FF0000",
    } as Record<Status, string>,
    mission: ["#2E7DF6", "#3F9E72", "#C98A1E", "#9B5BC4"],
    mode: {
      IW: "#2E7DF6", EW: "#5AA9FF", SM: "#1F5DB8", WV: "#16457F",
      MSI: "#3F9E72",
      OLCI: "#9B5BC4", SLSTR: "#B78BD8", SRAL: "#7A3EA0",
      TROPOMI: "#C98A1E",
    } as Record<string, string>,
  },
};

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

interface Slice { name: string; value: number; color: string; detail: string }

function missionSlices(rows: Datatake[], palette: typeof CHART.dark): Slice[] {
  const acc: Record<string, { sum: number; count: number }> = {};
  MISSION_NAMES.forEach((m) => (acc[m] = { sum: 0, count: 0 }));
  rows.forEach((r) => {
    acc[r.mission].sum += r.completeness;
    acc[r.mission].count += 1;
  });
  return MISSION_NAMES.map((m, i) => ({
    name: m.replace("Sentinel-", "S"),
    value: acc[m].count,
    color: palette.mission[i % palette.mission.length],
    detail: `${acc[m].count ? Math.round(acc[m].sum / acc[m].count) : 0}% avg completeness`,
  }));
}

function statusSlices(rows: Datatake[], palette: typeof CHART.dark): Slice[] {
  const acc = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<Status, number>;
  rows.forEach((r) => (acc[r.status] += 1));
  const total = rows.length || 1;
  return STATUS_ORDER.map((status) => ({
    name: status,
    value: acc[status],
    color: palette.status[status],
    detail: `${Math.round((acc[status] / total) * 100)}%`,
  }));
}

function modeSlices(rows: Datatake[], palette: typeof CHART.dark): Slice[] {
  const acc = new Map<string, number>();
  rows.forEach((r) => acc.set(r.sensorMode, (acc.get(r.sensorMode) || 0) + 1));
  const total = rows.length || 1;
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mode, count]) => ({
      name: mode,
      value: count,
      color: palette.mode[mode] ?? "var(--accent)",
      detail: `${Math.round((count / total) * 100)}%`,
    }));
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function DonutCard({ title, icon, slices, palette }: {
  title: string; icon: React.ReactNode; slices: Slice[]; palette: typeof CHART.dark;
}) {
  const empty = slices.length === 0 || slices.every((x) => x.value === 0);
  return (
    <div className="da-card">
      <div className="da-card-head">{icon}<span>{title}</span></div>
      {empty ? (
        <div className="da-chart-empty">No datatakes in the current filter window.</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72}
              paddingAngle={3} strokeWidth={0} isAnimationActive={false}>
              {slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: palette.panel, border: `1px solid ${palette.line}`,
                borderRadius: 10, fontSize: 12, color: palette.text,
              }}
              itemStyle={{ color: palette.text }}
              formatter={(value, _name, item) => {
                const slice = (item as { payload?: Slice }).payload;
                return [`${value} datatakes · ${slice?.detail ?? ""}`, slice?.name ?? ""];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/* One glyph per completeness state, so the table column reads at a glance and does not lean on
   colour alone — the two greys are nearly the same hue, and red/green is the commonest colour-
   vision confusion there is. The icon repeats what the legend of the status donut says. */
const STATUS_ICON: Record<Status, typeof CircleCheckBig> = {
  Planned: CalendarClock, // scheduled, has not flown yet
  Processing: LoaderCircle, // acquired, products still publishing
  Acquired: CircleCheckBig,
  Partial: TriangleAlert, // some products missing
  Unavailable: CircleX,
};

function StatusBadge({ status, palette }: { status: Status; palette: typeof CHART.dark }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className="da-badge" style={{ ["--badge" as string]: palette.status[status] }}>
      <Icon size={13} strokeWidth={2.25} />{status}
    </span>
  );
}

/* The meter takes the row's own status colour rather than reading a threshold off the percentage:
   a Planned datatake is at 0% because it has not flown, which is not the same failure as an
   Unavailable one at 0%, and a red bar for something merely scheduled would say the wrong thing. */
function CompletenessBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="da-bar">
      <div className="da-bar-track"><div className="da-bar-fill" style={{ width: `${value}%`, background: color }} /></div>
      <span className="da-bar-val">{value}%</span>
    </div>
  );
}

type SortKey = "id" | "satellite" | "sensorMode" | "start" | "status" | "completeness";
interface SortConfig { key: SortKey; dir: "asc" | "desc" }

function SortHeader({ label, sortKey, sortConfig, onSort }: {
  label: string; sortKey: SortKey; sortConfig: SortConfig; onSort: (k: SortKey) => void;
}) {
  const active = sortConfig.key === sortKey;
  return (
    <button className={"da-sort" + (active ? " on" : "")} onClick={() => onSort(sortKey)} aria-label={`Sort by ${label}`}>
      {label}
      <span className="da-arrows">
        <ChevronUp size={11} className={active && sortConfig.dir === "asc" ? "" : "dim"} />
        <ChevronDown size={11} className={active && sortConfig.dir === "desc" ? "" : "dim"} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/* This page's rows already carry everything the modal needs to identify a datatake; the orbit,
   station and per-product figures behind it are derived in data/datatake-details.ts. */
function toSummary(d: Datatake, palette: typeof CHART.dark): DatatakeSummary {
  return {
    id: d.id,
    platform: d.satellite,
    mission: d.mission,
    sensorMode: d.sensorMode,
    sensingStart: d.start,
    statusLabel: d.status,
    statusColor: palette.status[d.status],
    completeness: d.completeness,
  };
}

export default function DataAvailability() {
  const { theme } = useTheme();
  const palette = theme === "light" ? CHART.light : CHART.dark;

  const [mission, setMission] = useState("All");
  const [satellite, setSatellite] = useState("All");
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "start", dir: "desc" });

  // The page owns which datatake is open; the modal owns the rest of being a dialog.
  const [selected, setSelected] = useState<DatatakeSummary | null>(null);

  const missionOptions = ["All", ...MISSION_NAMES];
  const satelliteOptions = mission === "All" ? ["All", ...ALL_SATELLITES] : ["All", ...MISSIONS[mission]];

  const handleMissionChange = useCallback((val: string) => {
    setMission(val);
    setSatellite(val === "Sentinel-5P" ? "S5P" : "All");
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }, []);

  const reset = useCallback(() => {
    setPeriod(DEFAULT_PERIOD); setMission("All"); setSatellite("All");
    setDateFrom(""); setDateTo(""); setSearch("");
  }, []);

  /* Typing a date by hand is what "custom" means, so the selector follows the pickers — and
     picking a period clears them, since a preset and a hand-typed bound would otherwise both
     claim to own the range. */
  const onCustomDate = useCallback((which: "from" | "to", value: string) => {
    (which === "from" ? setDateFrom : setDateTo)(value);
    setPeriod("custom");
  }, []);

  const filtered = useMemo(() => {
    let rows = DATA;
    if (period !== "custom") rows = rows.filter((r) => inPeriod(r.start, period));
    if (mission !== "All") rows = rows.filter((r) => r.mission === mission);
    if (satellite !== "All") rows = rows.filter((r) => r.satellite === satellite);
    if (dateFrom) {
      const from = new Date(`${dateFrom}T00:00:00Z`);
      rows = rows.filter((r) => r.start >= from);
    }
    if (dateTo) {
      const to = new Date(`${dateTo}T23:59:59Z`);
      rows = rows.filter((r) => r.start <= to);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((r) => r.id.toLowerCase().includes(q));
    }
    return rows;
  }, [period, mission, satellite, dateFrom, dateTo, search]);

  const sorted = useMemo(() => {
    const { key, dir } = sortConfig;
    const sign = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === "start") return sign * (a.start.getTime() - b.start.getTime());
      if (key === "completeness") return sign * (a.completeness - b.completeness);
      return sign * a[key].localeCompare(b[key]);
    });
  }, [filtered, sortConfig]);

  const visible = sorted.slice(0, RESULT_CAP);
  const active = period !== DEFAULT_PERIOD || mission !== "All" || satellite !== "All" || dateFrom !== "" || dateTo !== "" || search !== "";

  const missions = useMemo(() => missionSlices(filtered, palette), [filtered, palette]);
  const statuses = useMemo(() => statusSlices(filtered, palette), [filtered, palette]);
  const modes = useMemo(() => modeSlices(filtered, palette), [filtered, palette]);

  return (
    <>
      <PageHeader crumb="Data Availability proposal" title="Data Availability"
        desc={AVAILABILITY_DESCRIPTION} />

      <section className="wrap pad">
        <Reveal className="section-head">
          <div>
            <div className="eyebrow">Overview{active ? " · filtered view" : ""}</div>
            <h2><LayoutDashboard size={19} style={{ verticalAlign: "-3px", marginRight: 9 }} />Datatake breakdown</h2>
          </div>
          <span className="meta">{filtered.length} DATATAKES</span>
        </Reveal>

        <Reveal className="da-grid3">
          <DonutCard title="Datatake share by mission" icon={<TrendingUp size={13} />} slices={missions} palette={palette} />
          <DonutCard title="Acquisition status breakdown" icon={<Activity size={13} />} slices={statuses} palette={palette} />
          <DonutCard title="Active sensor mode distribution" icon={<Radio size={13} />} slices={modes} palette={palette} />
        </Reveal>

        {/* Filters */}
        <div className="da-filters">
          <div className="da-filters-head">
            <SlidersHorizontal size={14} />
            <span className="lab">Filters</span>
            <button className="da-reset" onClick={reset} disabled={!active}><RotateCcw size={12} />Reset</button>
          </div>

          <div className="da-fields">
            <div className="da-field">
              <label htmlFor="da-period">Period</label>
              <select
                id="da-period"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as PeriodId);
                  setDateFrom("");
                  setDateTo("");
                }}
              >
                {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                <option value="custom">Custom range</option>
              </select>
            </div>

            <div className="da-field">
              <label htmlFor="da-mission">Mission</label>
              <select id="da-mission" value={mission} onChange={(e) => handleMissionChange(e.target.value)}>
                {missionOptions.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            <div className="da-field">
              <label htmlFor="da-sat">Satellite</label>
              <select id="da-sat" value={satellite} disabled={mission === "Sentinel-5P"}
                onChange={(e) => setSatellite(e.target.value)}>
                {satelliteOptions.map((sat) => <option key={sat} value={sat}>{sat}</option>)}
              </select>
            </div>

            <div className="da-field">
              <label htmlFor="da-from">From</label>
              <div className="da-input-wrap">
                <Calendar size={14} className="lead" />
                <input id="da-from" type="date" value={dateFrom} onChange={(e) => onCustomDate("from", e.target.value)} />
              </div>
            </div>

            <div className="da-field">
              <label htmlFor="da-to">To</label>
              <div className="da-input-wrap">
                <Calendar size={14} className="lead" />
                <input id="da-to" type="date" value={dateTo} onChange={(e) => onCustomDate("to", e.target.value)} />
              </div>
            </div>

            <div className="da-field">
              <label htmlFor="da-search">Datatake ID</label>
              <div className="da-input-wrap">
                <Search size={14} className="lead" />
                <input id="da-search" type="text" placeholder="Search by id…" value={search}
                  onChange={(e) => setSearch(e.target.value)} />
                {search && (
                  <button className="da-clear" onClick={() => setSearch("")} aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="da-count">
          Showing {visible.length} of {sorted.length} datatake{sorted.length !== 1 ? "s" : ""}
          {sorted.length > RESULT_CAP ? " · narrow the filters or search by Datatake ID to see more" : ""}
        </div>

        {/* Desktop table */}
        <Reveal className="da-table-wrap">
          <table className="da-table">
            <thead>
              <tr>
                <th><SortHeader label="Datatake ID" sortKey="id" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="Platform" sortKey="satellite" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="Sensor mode" sortKey="sensorMode" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="Start (UTC)" sortKey="start" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><SortHeader label="Publication completeness" sortKey="completeness" sortConfig={sortConfig} onSort={handleSort} /></th>
                <th><span className="da-th">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={row.id} className={i % 2 ? "alt" : ""}>
                  <td className="da-id">{row.id}</td>
                  <td><span className="da-sat">{row.satellite}</span></td>
                  <td className="da-mode">{row.sensorMode}</td>
                  <td className="da-time">{fmtDateTime(row.start)}</td>
                  <td><StatusBadge status={row.status} palette={palette} /></td>
                  <td><CompletenessBar value={row.completeness} color={palette.status[row.status]} /></td>
                  <td>
                    {/* Wordless on purpose: the table is already six columns wide. The eye is the
                        usual "look at this row" glyph, and the name it drops from the layout is
                        kept for assistive tech and as a hover tooltip. */}
                    <button
                      className="dtm-trigger icon"
                      onClick={() => setSelected(toSummary(row, palette))}
                      title={`View details — ${row.id}`}
                      aria-label={`View details for datatake ${row.id}`}
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={7} className="da-empty">No datatakes match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </Reveal>

        {/* Mobile cards */}
        <div className="da-cards">
          {visible.map((row) => (
            <div className="da-mcard" key={row.id}>
              <div className="da-mcard-head">
                <span className="da-id">{row.id}</span>
                <StatusBadge status={row.status} palette={palette} />
              </div>
              <div className="da-mcard-meta">
                <span className="da-sat">{row.satellite}</span>
                <span className="da-mode">{row.sensorMode}</span>
                <span className="da-time">{fmtDateTime(row.start)}</span>
              </div>
              <div className="da-mcard-lab">Publication completeness</div>
              <CompletenessBar value={row.completeness} color={palette.status[row.status]} />
              {/* The card has width to spare, so here the label stays visible. */}
              <button className="dtm-trigger da-mcard-act" onClick={() => setSelected(toSummary(row, palette))}>
                <Eye size={13} />View Details
              </button>
            </div>
          ))}
          {visible.length === 0 && <div className="da-mcard da-empty">No datatakes match the current filters.</div>}
        </div>
      </section>

      {selected && <DatatakeModal datatake={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
