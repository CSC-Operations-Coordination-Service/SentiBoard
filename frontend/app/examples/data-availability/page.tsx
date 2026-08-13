"use client";
import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  CircleX,
  LayoutDashboard,
  Moon,
  RotateCcw,
  Satellite,
  Search,
  SlidersHorizontal,
  Sun,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  ALL_SATELLITES,
  DARK,
  LIGHT,
  MISSIONS,
  MISSION_NAMES,
  acquisitionWindow,
  formatDate,
  formatDateTime,
  generateMockData,
  missionShare,
  modeDistribution,
  statusBreakdown,
  statusColor,
  type Datatake,
  type Palette,
  type Status,
} from "./mock";
import PageDescription from "@/components/PageDescription";
import { AVAILABILITY_DESCRIPTION } from "@/lib/copy";
import s from "./styles.module.css";

// DEVOCS-219 — mock-up of a reworked Data Availability page, kept under /examples so it cannot be
// mistaken for the shipping page at /v1/availability. All data is generated locally (mock.ts);
// nothing is fetched. The theme toggle is part of the proposal — the app itself is dark-only.

// Charts render client-side only; see Charts.tsx for why.
const DataAvailabilityCharts = dynamic(() => import("./Charts"), {
  ssr: false,
  loading: () => (
    <div className={s.grid3}>
      {[0, 1, 2].map((i) => (
        <div className={s.card} key={i}>
          <div className={s.chartEmpty}>Loading charts…</div>
        </div>
      ))}
    </div>
  ),
});

// Module scope: the generator is seeded and its window is anchored to UTC midnight, so this is the
// same array on every render and on both sides of hydration.
const MOCK_DATA = generateMockData();
const WINDOW = acquisitionWindow();

const RESULT_CAP = 15;

type SortKey = "id" | "satellite" | "sensorMode" | "start" | "status" | "completeness";
type SortConfig = { key: SortKey; dir: "asc" | "desc" };

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function CompletenessBar({ value, palette }: { value: number; palette: Palette }) {
  const color = value >= 85 ? palette.nominal : value >= 40 ? palette.degraded : palette.critical;
  return (
    <div className={s.bar}>
      <div className={s.barTrack}>
        <div className={s.barFill} style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className={s.barValue}>{value}%</span>
    </div>
  );
}

function StatusBadge({ status, palette }: { status: Status; palette: Palette }) {
  const Icon = status === "Nominal" ? CircleCheckBig : status === "Degraded" ? TriangleAlert : CircleX;
  return (
    <span className={s.badge} style={{ ["--badge-color" as string]: statusColor(status, palette) }}>
      <Icon size={13} strokeWidth={2.25} />
      {status}
    </span>
  );
}

function SortHeader({
  label,
  sortKey,
  sortConfig,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sortConfig: SortConfig;
  onSort: (key: SortKey) => void;
}) {
  const active = sortConfig.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={active ? `${s.sortBtn} ${s.on}` : s.sortBtn}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span className={s.arrows}>
        <ChevronUp size={11} className={active && sortConfig.dir === "asc" ? undefined : s.dim} />
        <ChevronDown size={11} className={active && sortConfig.dir === "desc" ? undefined : s.dim} />
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataAvailabilityMockup() {
  const [isDark, setIsDark] = useState(true);
  const palette = isDark ? DARK : LIGHT;

  const [mission, setMission] = useState("All");
  const [satellite, setSatellite] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "start", dir: "desc" });

  const missionOptions = ["All", ...MISSION_NAMES];
  const satelliteOptions = mission === "All" ? ["All", ...ALL_SATELLITES] : ["All", ...MISSIONS[mission]];
  const satelliteDisabled = mission === "Sentinel-5P";

  const handleMissionChange = useCallback((val: string) => {
    setMission(val);
    setSatellite(val === "Sentinel-5P" ? "S5P" : "All");
  }, []);

  const handleSort = useCallback((key: SortKey) => {
    setSortConfig((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" },
    );
  }, []);

  const resetFilters = useCallback(() => {
    setMission("All");
    setSatellite("All");
    setDateFrom("");
    setDateTo("");
    setSearch("");
  }, []);

  const filtered = useMemo(() => {
    let rows: Datatake[] = MOCK_DATA;
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
  }, [mission, satellite, dateFrom, dateTo, search]);

  const sorted = useMemo(() => {
    const { key, dir } = sortConfig;
    const sign = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (key === "start") return sign * (a.start.getTime() - b.start.getTime());
      if (key === "completeness") return sign * (a.completeness - b.completeness);
      return sign * a[key].localeCompare(b[key]);
    });
  }, [filtered, sortConfig]);

  const visibleRows = sorted.slice(0, RESULT_CAP);
  const filtersActive = mission !== "All" || satellite !== "All" || dateFrom !== "" || dateTo !== "" || search !== "";

  const missions = useMemo(() => missionShare(filtered), [filtered]);
  const statuses = useMemo(() => statusBreakdown(filtered), [filtered]);
  const modes = useMemo(() => modeDistribution(filtered), [filtered]);

  // The palette drives both the CSS module (via these custom properties) and the charts (which
  // get the object itself — SVG presentation attributes cannot read var()).
  const cssVars = useMemo(() => {
    const vars: Record<string, string> = {};
    (Object.keys(palette) as (keyof Palette)[]).forEach((k) => {
      const v = palette[k];
      if (typeof v === "string") vars[`--da-${k}`] = v;
    });
    return vars as React.CSSProperties;
  }, [palette]);

  return (
    <div className={s.page} style={cssVars}>
      <div className={s.inner}>
        {/* Header */}
        <div className={s.head}>
          <div>
            <div className={s.eyebrow}>
              <Satellite size={14} />
              <Link href="/examples">SentiBoard mock-ups</Link> / Operations
            </div>
            <h1 className={s.title}>Data Availability</h1>
            <p className={s.sub}>
              Datatakes from {formatDate(WINDOW.start)} through {formatDate(WINDOW.end)} UTC · refreshed hourly
            </p>
            <PageDescription>{AVAILABILITY_DESCRIPTION}</PageDescription>
          </div>
          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            className={s.themeBtn}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Analytics */}
        <div className={s.sectionLabel}>
          <LayoutDashboard size={13} />
          Overview{filtersActive ? " · filtered view" : ""}
        </div>
        <DataAvailabilityCharts missions={missions} statuses={statuses} modes={modes} palette={palette} />

        {/* Filters */}
        <div className={s.filters}>
          <div className={s.filtersHead}>
            <SlidersHorizontal size={14} />
            <span className={s.label}>Filters</span>
            <button type="button" onClick={resetFilters} className={s.reset}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>

          <div className={s.fieldGrid}>
            <div className={s.field}>
              <label htmlFor="da-mission">Mission</label>
              <select
                id="da-mission"
                className={s.control}
                value={mission}
                onChange={(e) => handleMissionChange(e.target.value)}
              >
                {missionOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.field}>
              <label htmlFor="da-satellite">Satellite</label>
              <select
                id="da-satellite"
                className={s.control}
                value={satellite}
                disabled={satelliteDisabled}
                onChange={(e) => setSatellite(e.target.value)}
              >
                {satelliteOptions.map((sat) => (
                  <option key={sat} value={sat}>
                    {sat}
                  </option>
                ))}
              </select>
            </div>

            <div className={s.field}>
              <label htmlFor="da-from">From</label>
              <div className={s.withIcon}>
                <span className={s.lead}>
                  <Calendar size={14} />
                </span>
                <input
                  id="da-from"
                  type="date"
                  className={s.control}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
            </div>

            <div className={s.field}>
              <label htmlFor="da-to">To</label>
              <div className={s.withIcon}>
                <span className={s.lead}>
                  <Calendar size={14} />
                </span>
                <input
                  id="da-to"
                  type="date"
                  className={s.control}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className={s.field}>
              <label htmlFor="da-search">Datatake ID</label>
              <div className={s.withIcon}>
                <span className={s.lead}>
                  <Search size={14} />
                </span>
                <input
                  id="da-search"
                  type="text"
                  placeholder="Search by id…"
                  className={s.control}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className={s.clear} aria-label="Clear search">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Result count */}
        <div className={s.count}>
          Showing {visibleRows.length} of {sorted.length} datatake{sorted.length !== 1 ? "s" : ""}
          {sorted.length > RESULT_CAP ? " · narrow the filters or search by Datatake ID to see more" : ""}
        </div>

        {/* Desktop table */}
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>
                  <SortHeader label="Datatake ID" sortKey="id" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th>
                  <SortHeader label="Platform" sortKey="satellite" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th>
                  <SortHeader label="Sensor mode" sortKey="sensorMode" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th>
                  <SortHeader label="Start (UTC)" sortKey="start" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th>
                  <SortHeader label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                </th>
                <th>
                  <SortHeader
                    label="Publication completeness"
                    sortKey="completeness"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => (
                <tr key={row.id} className={idx % 2 === 1 ? s.alt : undefined}>
                  <td className={s.idCell}>{row.id}</td>
                  <td>
                    <span className={s.satPill}>{row.satellite}</span>
                  </td>
                  <td className={s.modeCell}>{row.sensorMode}</td>
                  <td className={s.timeCell}>{formatDateTime(row.start)}</td>
                  <td>
                    <StatusBadge status={row.status} palette={palette} />
                  </td>
                  <td>
                    <CompletenessBar value={row.completeness} palette={palette} />
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={6} className={s.empty}>
                    No datatakes match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={s.cards}>
          {visibleRows.map((row) => (
            <div key={row.id} className={s.mcard}>
              <div className={s.mcardHead}>
                <span className={s.idCell}>{row.id}</span>
                <StatusBadge status={row.status} palette={palette} />
              </div>
              <div className={s.mcardMeta}>
                <span className={s.satPill}>{row.satellite}</span>
                <span className={s.modeCell}>{row.sensorMode}</span>
                <span className={s.timeCell}>{formatDateTime(row.start)}</span>
              </div>
              <div>
                <div className={s.mcardLabel}>Publication completeness</div>
                <CompletenessBar value={row.completeness} palette={palette} />
              </div>
            </div>
          ))}
          {visibleRows.length === 0 && (
            <div className={`${s.mcard} ${s.empty}`}>No datatakes match the current filters.</div>
          )}
        </div>
      </div>
    </div>
  );
}
