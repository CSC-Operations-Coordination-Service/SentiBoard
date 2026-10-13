import { useCallback, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Collapse, PageHeader, Reveal } from "@/components/ui";
import { AVAILABILITY_DESCRIPTION } from "@/data/copy";
import DatatakeModal from "@/components/DatatakeModal";
import type { DatatakeSummary } from "@/data/datatake-details";
import {
  DEFAULT_PERIOD,
  PERIODS,
  PERIOD_LABEL,
  periodStart,
  type PeriodId,
} from "@/data/period";
import {
  DATA,
  DAY_MS,
  MISSION_NAMES,
  STATUS_COLOR,
  WINDOW,
  type Datatake,
  type Status,
  daysOf,
  daysSinceGap,
  fmtDate,
  fmtDateTime,
  isGap,
  pad,
  trendSeries,
} from "./mock";
import s from "./availability.module.css";
import "@/styles/data-availability.css";

type Slice = { key: string; label: string; value: number; color: string };

function Donut({
  slices,
  total,
  caption,
}: {
  slices: Slice[];
  total: number;
  caption: string;
}) {
  const SIZE = 120;
  const THICK = 9;
  const r = (SIZE - THICK) / 2;
  const circumference = 2 * Math.PI * r;
  const sum = slices.reduce((s, x) => s + x.value, 0) || 1;
  const GAP = 2;

  let offset = 0;
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / sum) * circumference;
      const drawn = Math.max(1, len - GAP);
      const node = (
        <circle
          key={s.key}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={r}
          fill="none"
          strokeWidth={THICK}
          strokeDasharray={`${drawn} ${circumference - drawn}`}
          strokeDashoffset={-offset}
          style={{ stroke: s.color }}
        />
      );
      offset += len;
      return node;
    });

  return (
    <div className={s.donutChart}>
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={caption}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={r}
            fill="none"
            strokeWidth={THICK}
            className={s.donutTrack}
          />
          {arcs}
        </g>
      </svg>
      <div className={s.donutMid}>
        <span className={s.donutN}>{total}</span>
        <span className={s.donutC}>{caption}</span>
      </div>
    </div>
  );
}

function DonutLegend({ slices, total }: { slices: Slice[]; total: number }) {
  const denom = total || 1;
  return (
    <ul className={s.donutLegend}>
      {slices.map((slice) => (
        <li key={slice.key}>
          <span
            className={s.donutDot}
            style={{ background: slice.color }}
            aria-hidden
          />
          <span className={s.donutLabel}>{slice.label}</span>
          <span className={s.donutValue}>{slice.value}</span>
          <span className={s.donutPercent}>
            {Math.round((slice.value / denom) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function statusSlices(rows: Datatake[]): Slice[] {
  const STATUS_ORDER: Status[] = [
    "Planned",
    "Processing",
    "Acquired",
    "Partial",
    "Unavailable",
  ];
  const acc = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
    Status,
    number
  >;
  rows.forEach((r) => (acc[r.status] += 1));
  return STATUS_ORDER.map((s) => ({
    key: s,
    label: s.toUpperCase(),
    value: acc[s],
    color: STATUS_COLOR[s],
  }));
}

function modeSlices(rows: Datatake[]): Slice[] {
  const acc = new Map<string, number>();
  rows.forEach((r) => acc.set(r.sensorMode, (acc.get(r.sensorMode) ?? 0) + 1));
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mode, n]) => ({
      key: mode,
      label: mode,
      value: n,
      color: STATUS_COLOR["Acquired"],
    }));
}

/** How bad a day looks when several datatakes fall on it: a loss outranks everything. */
const SEVERITY: Record<Status, number> = {
  Acquired: 0,
  Planned: 1,
  Processing: 2,
  Partial: 3,
  Unavailable: 4,
};

type TrendWindow = 7 | 30 | 90;
type SortKey = "gap" | "recent" | "worst";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "gap", label: "Most recent gap" },
  { id: "recent", label: "Most recent" },
  { id: "worst", label: "Lowest completeness" },
];

function Sparkline({ series }: { series: (number | null)[] }) {
  const W = 100;
  const H = 34;
  const points = series
    .map((v, i) =>
      v === null
        ? null
        : {
            x: (i / Math.max(1, series.length - 1)) * W,
            y: H - 3 - (v / 100) * (H - 6),
          },
    )
    .filter(Boolean) as { x: number; y: number }[];

  if (points.length < 2)
    return (
      <svg
        className={s.spark}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
      />
    );

  const line = points
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const area = `${points[0].x.toFixed(1)},${H} ${line} ${points[points.length - 1].x.toFixed(1)},${H}`;

  return (
    <svg
      className={s.spark}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polygon className={s.sparkArea} points={area} />
      {/* 100% reference, so a line sitting below it reads as a shortfall rather than just a shape */}
      <line className={s.sparkBase} x1="0" y1="3" x2={W} y2="3" />
      <polyline
        className={s.sparkLine}
        points={line}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const DESCRIPTION = (
  <>
    <p>{AVAILABILITY_DESCRIPTION}</p>
  </>
);

/* The reference's range buttons, mapped onto the page's periods. 30D is the default, as in the
   reference, and Custom is the state the pager and the date fields put the page into. */
const RANGES: { id: PeriodId; label: string }[] = [
  { id: "day", label: "1D" },
  { id: "week", label: "7D" },
  { id: "month", label: "30D" },
  { id: "custom", label: "Custom" },
];

const STATUSES: Status[] = [
  "Planned",
  "Processing",
  "Acquired",
  "Partial",
  "Unavailable",
];

function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function CoverageTimeline() {
  /* A trend view opens on a month: "Last 7 Days" is seven columns, which is not a timeline. The
     other proposals default to the production default (week) because they are snapshots. */
  const [period, setPeriod] = useState<PeriodId>("month");
  const [mission, setMission] = useState("All");
  const [status, setStatus] = useState<Status | "All">("All");
  const [openDrop, setOpenDrop] = useState<"mission" | "status" | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const fromPicker = useRef<HTMLInputElement>(null);
  const toPicker = useRef<HTMLInputElement>(null);
  const [trend, setTrend] = useState<TrendWindow>(30);
  const [sort, setSort] = useState<SortKey>("gap");
  const [focus, setFocus] = useState<{
    mission: string;
    key: string;
    date: Date;
  } | null>(null);
  const [selected, setSelected] = useState<DatatakeSummary | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  /** Any change to the dates pins both bounds and leaves the presets, so the pager and the
   *  FROM/TO fields always describe the same window. */
  const pinRange = useCallback((from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPeriod("custom");
  }, []);

  const reset = useCallback(() => {
    setPeriod("month");
    setMission("All");
    setStatus("All");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setFocus(null);
    setOpenDrop(null);
  }, []);

  /** The visible range — the heatmap's columns and the table's bounds are the same window. */
  const range = useMemo(() => {
    const to =
      dateTo && period === "custom"
        ? new Date(`${dateTo}T23:59:59Z`)
        : WINDOW.today;
    const from =
      period === "custom"
        ? dateFrom
          ? new Date(`${dateFrom}T00:00:00Z`)
          : new Date(WINDOW.today.getTime() - 29 * DAY_MS)
        : periodStart(period, WINDOW.today)!;
    return { from, to };
  }, [period, dateFrom, dateTo]);

  const days = useMemo(() => daysOf(range.from, range.to), [range]);

  /** The pager moves the window by its own length, so "earlier" and "later" are the same step. */
  const shiftRange = (direction: -1 | 1) => {
    const step = direction * days.length * DAY_MS;
    pinRange(
      fmtDate(new Date(range.from.getTime() + step)),
      fmtDate(new Date(range.to.getTime() + step)),
    );
  };
  const atToday = range.to.getTime() >= WINDOW.today.getTime();

  /** Everything in range, before the mission/satellite/id filters — the heatmap keeps every
   *  mission visible so a filtered view still shows what else was happening. */
  const inRange = useMemo(
    () =>
      DATA.filter(
        (r) =>
          r.start >= range.from &&
          r.start <= new Date(range.to.getTime() + DAY_MS - 1),
      ),
    [range],
  );

  /** Datatakes that pass the mission, status and ID filters. The heatmap dims everything else,
   *  so a filtered-out slot stays on the grid instead of looking like a day with no data. */
  const matching = useMemo(() => {
    let out = inRange;
    if (mission !== "All") out = out.filter((r) => r.mission === mission);
    if (status !== "All") out = out.filter((r) => r.status === status);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.id.toLowerCase().includes(q));
    }
    return out;
  }, [inRange, mission, status, search]);

  const rows = useMemo(
    () =>
      focus
        ? matching.filter(
            (r) =>
              r.mission === focus.mission && fmtDate(r.start) === focus.key,
          )
        : matching,
    [matching, focus],
  );

  /* Default order: the most recent GAP first. A datatake that published in full is not news, so
     complete rows fall below the incomplete ones however recent they are — which is the whole
     argument of this concept over a chronological list. */
  const sorted = useMemo(() => {
    const out = [...rows];
    if (sort === "recent")
      return out.sort((a, b) => b.start.getTime() - a.start.getTime());
    if (sort === "worst")
      return out.sort(
        (a, b) =>
          a.completeness - b.completeness ||
          b.start.getTime() - a.start.getTime(),
      );
    return out.sort((a, b) => {
      const ga = isGap(a) ? 0 : 1;
      const gb = isGap(b) ? 0 : 1;
      return ga - gb || b.start.getTime() - a.start.getTime();
    });
  }, [rows, sort]);

  const visible = sorted.slice(0, 15);
  const active =
    period !== "month" ||
    mission !== "All" ||
    status !== "All" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    search !== "" ||
    focus !== null;

  const gaps = rows.filter(isGap).length;
  const lost = rows.filter((r) => r.status === "Unavailable").length;
  const mean = rows.length
    ? Math.round(rows.reduce((n, r) => n + r.completeness, 0) / rows.length)
    : 0;

  /* One column per calendar day. A day with datatakes shows one summary tile in the worst status
     among them (SEVERITY), so a loss is never hidden. A day with none keeps its column as an idle
     tile. Every row has exactly one column per day, so the rows line up by date. Date labels fall
     every 6 days and sit inside the same grid, so each one is directly under its day's column. */
  const SLOTS_PER_DAY = 3; // 3 slots per day * 30 days = 90 total tiles
  const TICK_STEP = 6; // Date tick every 6 days

  const lanes = useMemo(
    () =>
      MISSION_NAMES.map((m) => {
        const own = inRange.filter((r) => r.mission === m);

        let slots: Array<{
          key: string;
          date: Date;
          item: Datatake | null;
          slotIndex: number;
        }> = [];

        let ticks: Array<{ key: string; index: number; label: string }> = [];

        if (period === "day") {
          // ---------------- 1D / 24-HOUR MODE ----------------
          const startMs = range.from.getTime();
          const totalMs = Math.max(1, days.length * DAY_MS);

          slots = own.map((r, idx) => {
            const offsetMs = r.start.getTime() - startMs;
            const pct = Math.max(0, Math.min(100, (offsetMs / totalMs) * 100));
            return {
              key: `dt-${r.id}-${idx}`,
              date: r.start,
              item: r,
              slotIndex: idx,
              leftPct: pct,
            };
          });

          days.forEach((d, dayIdx) => {
            [0, 6, 12, 18].forEach((h) => {
              const tickMs = d.getTime() + h * 3600 * 1000;
              const pct = Math.max(
                0,
                Math.min(100, ((tickMs - startMs) / totalMs) * 100),
              );
              const dateStr = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
              const timeStr = `${pad(h)}:00`;
              ticks.push({
                key: `tick-${dayIdx}-${h}`,
                index: pct,
                label: `${dateStr} ${timeStr}`,
              });
            });
          });
        } else {
          // ---------------- MULTI-DAY (30D) MODE ----------------
          const SLOTS_PER_DAY = 3;
          const TICK_STEP = 6;

          const byDay = new Map<string, Datatake[]>();
          own.forEach((r) => {
            const k = fmtDate(r.start);
            byDay.set(k, [...(byDay.get(k) ?? []), r]);
          });

          days.forEach((d) => {
            const key = fmtDate(d);
            const dayItems = (byDay.get(key) ?? []).sort(
              (a, b) => a.start.getTime() - b.start.getTime(),
            );

            for (let s = 0; s < SLOTS_PER_DAY; s++) {
              slots.push({
                key: `${key}-slot-${s}`,
                date: d,
                item: dayItems[s] ?? null,
                slotIndex: s,
              });
            }
          });

          ticks = days
            .map((d, dayIdx) => ({
              key: fmtDate(d),
              index: dayIdx * SLOTS_PER_DAY,
              label: `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`,
            }))
            .filter((_, dayIdx) => dayIdx % TICK_STEP === 0);
        }

        const mean = own.length
          ? Math.round(own.reduce((n, r) => n + r.completeness, 0) / own.length)
          : 0;

        return { mission: m, mean, slots, ticks };
      }),
    [inRange, days, period, range],
  );

  const matchingIds = useMemo(
    () => new Set(matching.map((r) => r.id)),
    [matching],
  );

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
      <div className={s.headArt}>
        <PageHeader
          title="Data Availability"
          desc={DESCRIPTION}
          img="/assets/img/modules/availability.jpg"
        />
      </div>

      <section className={s.page}>
        {/* ---------------- counters ---------------- */}
        <Reveal className={s.counters}>
          <div className={s.counter}>
            <span className={s.counterV}>{pad(rows.length)}</span>
            <span className={s.counterK}>Datatakes in range</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterV}>{mean}%</span>
            <span className={s.counterK}>Mean completeness</span>
          </div>
          <div className={s.counter}>
            <span className={`${s.counterV} ${s.warn}`}>{pad(gaps)}</span>
            <span className={s.counterK}>Coverage gaps</span>
          </div>
          <div className={s.counter}>
            <span className={`${s.counterV} ${s.crit}`}>{pad(lost)}</span>
            <span className={s.counterK}>Datatakes lost</span>
          </div>
        </Reveal>
        {/* ---------------- filters: one row, left to right as the reference toolbar ---------------- */}
        <div className={s.filters}>
          <div className={s.filterGroup}>
            <span className={s.filterHeading}>{PERIOD_LABEL[period]}</span>

            <div className={s.frange} role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={period === r.id}
                  onClick={() => setPeriod(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <div className={s.pager}>
              <button
                type="button"
                className={s.pagerBtn}
                aria-label="Earlier days"
                onClick={() => shiftRange(-1)}
              >
                <ChevronLeft size={13} aria-hidden />
              </button>
              <button
                type="button"
                className={s.dateBtn}
                onClick={() => fromPicker.current?.showPicker()}
              >
                {fmtDate(range.from)}
              </button>
              <span className={s.dateSep} aria-hidden>
                →
              </span>
              <button
                type="button"
                className={s.dateBtn}
                onClick={() => toPicker.current?.showPicker()}
              >
                {fmtDate(range.to)}
              </button>
              <button
                type="button"
                className={s.pagerBtn}
                aria-label="Pick the dates on a calendar"
                onClick={() => fromPicker.current?.showPicker()}
              >
                <CalendarDays size={13} aria-hidden />
              </button>
              <button
                type="button"
                className={s.pagerBtn}
                aria-label="Later days"
                disabled={atToday}
                onClick={() => shiftRange(1)}
              >
                <ChevronRight size={13} aria-hidden />
              </button>
              {/* The native pickers behind the dates. Kept off-screen rather than display:none,
                  because a picker only opens from an element that is rendered. */}
              <input
                ref={fromPicker}
                className={s.hiddenDate}
                type="date"
                tabIndex={-1}
                aria-hidden
                value={fmtDate(range.from)}
                onChange={(e) => pinRange(e.target.value, fmtDate(range.to))}
              />
              <input
                ref={toPicker}
                className={s.hiddenDate}
                type="date"
                tabIndex={-1}
                aria-hidden
                value={fmtDate(range.to)}
                onChange={(e) => pinRange(fmtDate(range.from), e.target.value)}
              />
            </div>
          </div>

          <div className={s.filterGroup}>
            <div className={s.fdrop}>
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openDrop === "mission"}
                aria-controls="avail-mission"
                onClick={() =>
                  setOpenDrop(openDrop === "mission" ? null : "mission")
                }
              >
                <span className={s.fdropLabel}>Mission</span>
                {mission !== "All" && (
                  <span className={s.fdropVal}>{mission}</span>
                )}
                <ChevronDown />
              </button>
              <Collapse open={openDrop === "mission"} id="avail-mission">
                <div className={s.fdropInner}>
                  {["All", ...MISSION_NAMES].map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={s.fitem}
                      aria-pressed={mission === m}
                      onClick={() => {
                        setMission(m);
                        setOpenDrop(null);
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </Collapse>
            </div>

            <div className={s.fdrop}>
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openDrop === "status"}
                aria-controls="avail-status"
                onClick={() =>
                  setOpenDrop(openDrop === "status" ? null : "status")
                }
              >
                <span className={s.fdropLabel}>Status</span>
                {status !== "All" && (
                  <span className={s.fdropVal}>{status}</span>
                )}
                <ChevronDown />
              </button>
              <Collapse open={openDrop === "status"} id="avail-status">
                <div className={s.fdropInner}>
                  {(["All", ...STATUSES] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={s.fitem}
                      aria-pressed={status === st}
                      onClick={() => {
                        setStatus(st);
                        setOpenDrop(null);
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </Collapse>
            </div>

            <span className={s.fsearch}>
              <Search size={13} aria-hidden />
              <label className="sr-only" htmlFor="avail-q">
                Search datatakes
              </label>
              <input
                id="avail-q"
                type="search"
                placeholder="Datatake ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </span>
          </div>

          <button
            type="button"
            className={s.freset}
            onClick={reset}
            disabled={!active}
          >
            Reset filters
          </button>
        </div>

        {/* ---------------- heatmap ---------------- */}
        <Reveal className={s.panel}>
          <div className={s.mapScroll}>
            <div
              className={s.mapInner}
              style={{ ["--n" as string]: days.length }}
            >
              {lanes.map(({ mission: m, mean, slots, ticks }) => (
                <div className={s.mapRow} key={m}>
                  <div className={s.mapLabel}>
                    <b>{m.replace("Sentinel-", "S")}</b>
                    <span>{mean}% MEAN</span>
                  </div>

                  <div className={s.lane}>
                    <div
                      className={`${s.track} ${period === "day" ? s.trackDay : ""}`}
                      style={{ ["--total-slots" as string]: slots.length }}
                    >
                      {slots.map((slot: any) => {
                        const { item, key, date, leftPct } = slot;

                        if (!item) {
                          if (period === "day") return null;
                          return (
                            <span
                              key={key}
                              className={`${s.tile} ${s.tileIdle}`}
                              aria-hidden
                            />
                          );
                        }

                        const on =
                          focus?.mission === m && focus.key === fmtDate(date);
                        const dim = !matchingIds.has(item.id);
                        const cls = [
                          s.tile,
                          on ? s.tileOn : "",
                          dim ? s.tileDim : "",
                        ]
                          .filter(Boolean)
                          .join(" ");

                        return (
                          <button
                            key={item.id ?? key}
                            type="button"
                            className={cls}
                            style={{
                              ["--c" as string]:
                                STATUS_COLOR[item.status as Status],
                              ...(period === "day" && leftPct !== undefined
                                ? { left: `${leftPct}%` }
                                : {}),
                            }}
                            title={`${item.id} · ${m} · ${item.status}`}
                            onClick={() =>
                              setFocus(
                                on
                                  ? null
                                  : { mission: m, key: fmtDate(date), date },
                              )
                            }
                          />
                        );
                      })}
                    </div>

                    <div
                      className={s.axis}
                      style={{ ["--total-slots" as string]: slots.length }}
                    >
                      {ticks.map((t: any) => (
                        <span
                          className={s.axisTick}
                          key={t.key}
                          style={{
                            ...(period === "day"
                              ? { left: `${t.index}%` }
                              : {
                                  left: `calc(${t.index} * (100% / var(--total-slots, 24)))`,
                                }),
                          }}
                        >
                          {t.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        {/* ---------------- focused view (charts + list) — only shown when a cell is clicked -------- */}
        {focus && (
          <>
            <div className={s.focusedHeader}>
              <h3>
                {focus.mission} · {focus.key} · {rows.length} datatake
                {rows.length !== 1 ? "s" : ""}
              </h3>
              <button className={s.focusClear} onClick={() => setFocus(null)}>
                <X size={14} />
                Clear focus
              </button>
            </div>

            <div className={s.focusedLayout}>
              <div className={s.focusedList}>
                <div className={s.listHeader}>DATATAKES</div>
                <ul className={s.listItems}>
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className={
                        row.status === "Unavailable"
                          ? s.lossItem
                          : isGap(row)
                            ? s.gapItem
                            : undefined
                      }
                    >
                      <div className={s.listIdRow}>
                        <span className={s.listId}>{row.id}</span>
                        <span className={s.listSat}>{row.satellite}</span>
                      </div>
                      <div className={s.listDetails}>
                        <span className={s.listMode}>{row.sensorMode}</span>
                        <span className={s.listTime}>
                          {fmtDateTime(row.start)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className={s.focusedCharts}>
                {rows.length === 0 ? (
                  <p className={s.emptyCharts}>
                    No datatakes for this selection.
                  </p>
                ) : (
                  <>
                    <div className={s.chartCard}>
                      <h4 className={s.chartTitle}>STATUS DISTRIBUTION</h4>
                      <Donut
                        slices={statusSlices(rows)}
                        total={rows.length}
                        caption="DATATAKES"
                      />
                      <DonutLegend
                        slices={statusSlices(rows)}
                        total={rows.length}
                      />
                    </div>

                    <div className={s.chartCard}>
                      <h4 className={s.chartTitle}>SENSOR MODES</h4>
                      <Donut
                        slices={modeSlices(rows)}
                        total={modeSlices(rows).length}
                        caption="MODES"
                      />
                      <DonutLegend
                        slices={modeSlices(rows)}
                        total={rows.length}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {selected && (
        <DatatakeModal datatake={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
