import { useCallback, useMemo, useRef, useState } from "react";
import SpaceBackdrop from "@/components/SpaceBackdrop";

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
  axisTicks,
  barColor,
  daysOf,
  daysSinceGap,
  framesOf,
  fmtDate,
  fmtDateTime,
  isGap,
  pad,
  trendSeries,
} from "./mock";
import s from "./availability.module.css";
import {
  AmbientSky,
  MotionToggle,
  ambientRoot,
  useAmbientMotion,
} from "@/components/ambient-motion";
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
  const acc = Object.fromEntries(STATUS_ORDER.map((st) => [st, 0])) as Record<
    Status,
    number
  >;
  rows.forEach((r) => (acc[r.status] += 1));
  return STATUS_ORDER.map((st) => ({
    key: st,
    label: st.toUpperCase(),
    value: acc[st],
    color: STATUS_COLOR[st],
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

/** How much a row's strip is magnified around the picked bar — PICK_Z in SentiBoard.html. */
const STRIP_ZOOM = 1.9;

type TrendWindow = 7 | 30 | 90;
type SortKey = "gap" | "recent" | "worst";

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

function GaugeRing({
  percent,
  label,
  caption,
  status,
}: {
  percent: number;
  label: string;
  caption: string;
  status: Status;
}) {
  const SIZE = 100;
  const THICK = 8;
  const r = (SIZE - THICK) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (percent / 100) * circumference;
  const ringColor = STATUS_COLOR[status] || "var(--accent-2, #38bdf8)";

  return (
    <div className={s.gaugeBox}>
      <span className={s.gaugeHeader}>{caption}</span>
      <div className={s.gaugeRingWrap}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke="var(--line)"
              strokeWidth={THICK}
            />
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={THICK}
              strokeDasharray={`${dash} ${circumference - dash}`}
            />
          </g>
        </svg>
        <div className={s.gaugeInner}>
          <span className={s.gaugeSub}>COMPLETENESS</span>
          <span className={s.gaugeVal}>{percent.toFixed(2)}%</span>
        </div>
      </div>
      <div className={s.gaugeFooterList}>
        <div className={s.gaugeFooterItem}>
          <span className={s.gaugeDot} style={{ background: ringColor }} />
          <span>{label}</span>
        </div>
        <div className={s.gaugeFooterItem}>
          <span className={s.gaugeDotMissing} />
          <span>MISSING</span>
        </div>
      </div>
    </div>
  );
}

export default function CoverageTimeline() {
  const motion = useAmbientMotion();

  const [period, setPeriod] = useState<PeriodId>("month");
  const [mission, setMission] = useState("All");
  const [status, setStatus] = useState<Status | "All">("All");
  const [openDrop, setOpenDrop] = useState<"mission" | "status" | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const fromPicker = useRef<HTMLInputElement>(null);
  const toPicker = useRef<HTMLInputElement>(null);
  const [focus, setFocus] = useState<{
    mission: string;
    key: string;
    date: Date;
    item: Datatake;
  } | null>(null);
  const [selected, setSelected] = useState<DatatakeSummary | null>(null);
  // Where each row's strip pivots when it zooms (px from the strip's left edge). Kept per row and
  // never cleared, so a strip that is zooming back out keeps its pivot until it is flat again.
  const [origins, setOrigins] = useState<Record<string, number>>({});

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

  const shiftRange = (direction: -1 | 1) => {
    const step = direction * days.length * DAY_MS;
    pinRange(
      fmtDate(new Date(range.from.getTime() + step)),
      fmtDate(new Date(range.to.getTime() + step)),
    );
  };
  const atToday = range.to.getTime() >= WINDOW.today.getTime();

  const inRange = useMemo(
    () =>
      DATA.filter(
        (r) =>
          r.start >= range.from &&
          r.start <= new Date(range.to.getTime() + DAY_MS - 1),
      ),
    [range],
  );

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

  // One row per mission: its datatakes folded into at most FRAMES evenly spaced bars, and one shared
  // set of date labels under every row — the layout of SentiBoard.html#data-availability.
  const ticks = useMemo(() => axisTicks(days), [days]);
  const lanes = useMemo(
    () =>
      MISSION_NAMES.map((m) => {
        const own = inRange.filter((r) => r.mission === m);
        const frames = framesOf(own);
        const mean = own.length
          ? Math.round(own.reduce((n, r) => n + r.completeness, 0) / own.length)
          : 0;
        // Bar width: 76% of the strip shared by the bars, so ~24% is the gaps between them.
        const tw = frames.length ? 76 / frames.length : 2;
        return { mission: m, mean, frames, tw };
      }),
    [inRange],
  );

  const matchingIds = useMemo(
    () => new Set(matching.map((r) => r.id)),
    [matching],
  );

  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title="Data Availability"
          subtitle="Real-time list of available collections delivered by the missions, with key metrics."
          desc={<p>{AVAILABILITY_DESCRIPTION}</p>}
          img="/assets/img/modules/availability.jpg"
        />
      </div>

      <section className={ambientRoot(motion.paused, s.page)}>
        <SpaceBackdrop page={1} paused={motion.paused} />
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

        {/* ---------------- filters ---------------- */}
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
                className={s.plabel}
                title="Pick the days on a calendar"
                onClick={() => fromPicker.current?.showPicker()}
              >
                {fmtDate(range.from)} <span aria-hidden>→</span>{" "}
                {fmtDate(range.to)}
                <CalendarDays size={12} aria-hidden />
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

        {/* ---------------- heatmap with inline row expansion below tiles ---------------- */}
        <Reveal className={s.panel}>
          <div className={`${s.mapScroll}`}>
            <div
              className={s.mapInner}
              style={{ ["--n" as string]: days.length }}
            >
              {lanes.map(({ mission: m, frames, tw }) => {
                const isRowFocused = focus?.mission === m;
                const zoomed = isRowFocused && focus?.item != null;
                const activeItem = isRowFocused ? focus?.item : null;
                const rowRows = isRowFocused && focus.item ? [focus.item] : [];
                return (
                  <div className={s.mapRowContainer} key={m}>
                    <div
                      className={`${s.mapRow} ${zoomed ? s.mapRowZoom : ""}`}
                    >
                      <div className={s.mapLabel}>
                        <b>{m.replace("Sentinel-", "S")}</b>
                      </div>

                      <div className={s.lane}>
                        <div
                          className={`${s.track} ${zoomed ? s.trackZoom : ""}`}
                          style={{
                            ["--tw" as string]: `${tw}%`,
                            transformOrigin: `${origins[m] ?? 0}px 50%`,
                            transform: zoomed
                              ? `scale(${STRIP_ZOOM})`
                              : undefined,
                          }}
                        >
                          {frames.length === 0 && (
                            <span className={s.trackNone}>
                              No datatakes in range
                            </span>
                          )}
                          {frames.map(({ item, n, leftPct }) => {
                            const on =
                              focus?.mission === m &&
                              focus?.item?.id === item.id;
                            const dim = !matchingIds.has(item.id);
                            const faded = focus !== null && !on;
                            const cls = [
                              s.tile,
                              on ? s.tileSelected : "",
                              faded ? s.tileFaded : "",
                              dim ? s.tileDim : "",
                            ]
                              .filter(Boolean)
                              .join(" ");

                            return (
                              <button
                                key={item.id}
                                type="button"
                                className={cls}
                                style={{
                                  ["--c" as string]: barColor(item),
                                  left: `${leftPct}%`,
                                }}
                                title={`${item.id} · ${item.status} · ${item.completeness}%${n > 1 ? ` (+${n - 1} more)` : ""}`}
                                aria-label={item.id}
                                onClick={(e) => {
                                  if (on) {
                                    setFocus(null); // zoom back out
                                    return;
                                  }
                                  // Bars are centred on `left` by translateX(-50%), and offsetLeft
                                  // ignores transforms: this is the bar's centre in the strip's own,
                                  // unscaled coordinates, even when the strip is already zoomed.
                                  const centre = e.currentTarget.offsetLeft;
                                  setOrigins((o) => ({ ...o, [m]: centre }));
                                  setFocus({
                                    mission: m,
                                    key: fmtDate(item.start),
                                    date: item.start,
                                    item,
                                  });
                                }}
                              />
                            );
                          })}
                        </div>

                        <div
                          className={`${s.axis} ${zoomed ? s.axisHidden : ""}`}
                        >
                          {ticks.map((t) => (
                            <span
                              key={t.key}
                              className={`${s.axisTick} ${t.edge === "first" ? s.axisFirst : t.edge === "last" ? s.axisLast : ""}`}
                              style={{ left: `${t.pct}%` }}
                            >
                              {t.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Inline Expanded Details & Zoomed View Directly Below Tiles */}
                    {isRowFocused && activeItem && (
                      <div className={s.referenceDetailWrap}>
                        <button
                          className={s.closeBtn}
                          onClick={() => setFocus(null)}
                          aria-label="Close details"
                        >
                          <X size={16} />
                        </button>

                        <div className={s.detailColumns}>
                          {/* Left Side: ID, timestamp & gauges */}
                          <div className={s.detailLeft}>
                            <h2 className={s.detailTitle}>{activeItem.id}</h2>
                            <p className={s.detailSubtime}>
                              {fmtDateTime(activeItem.start)}
                            </p>

                            <div className={s.gaugePair}>
                              <GaugeRing
                                percent={activeItem.completeness}
                                label="ACQUIRED"
                                caption="ACQUISITION"
                                status={activeItem.status}
                              />
                              <GaugeRing
                                percent={activeItem.completeness}
                                label="PUBLISHED"
                                caption="PUBLICATION"
                                status={activeItem.status}
                              />
                            </div>
                          </div>

                          {/* Right Side: Key/Value Grid */}
                          <div className={s.detailRight}>
                            <div className={s.metaGrid}>
                              <span className={s.metaKey}>DATA TAKE ID</span>
                              <span className={s.metaValBold}>
                                {activeItem.id}
                              </span>

                              <span className={s.metaKey}>PLATFORM</span>
                              <span className={s.metaValBold}>
                                {activeItem.satellite}
                              </span>

                              <span className={s.metaKey}>START DATE</span>
                              <span className={s.metaVal}>
                                {fmtDateTime(activeItem.start)}
                              </span>

                              <span className={s.metaKey}>STOP DATE</span>
                              <span className={s.metaVal}>
                                {fmtDateTime(
                                  new Date(
                                    activeItem.start.getTime() + 6 * 60000,
                                  ),
                                )}
                              </span>

                              <span className={s.metaKey}>ACQUISITION</span>
                              <span className={s.metaTag}>
                                {activeItem.status.toUpperCase()}
                              </span>

                              <span className={s.metaKey}>PUBLICATION</span>
                              <span className={s.metaTag}>MISSING</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

      {selected && (
        <DatatakeModal datatake={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
