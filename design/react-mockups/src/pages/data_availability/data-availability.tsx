import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SpaceBackdrop from "@/components/SpaceBackdrop";

import { Search, X } from "lucide-react";
import { Collapse, PageHeader, Reveal } from "@/components/ui";
import { AVAILABILITY_DESCRIPTION } from "@/data/copy";
import {
  DATA,
  DAY_MS,
  LAST,
  MISSION_NAMES,
  WINDOW,
  type Datatake,
  type Status,
  axisTicks,
  barColor,
  daysOf,
  framesOf,
  fmtDate,
  fmtDateTime,
  isGap,
  pad,
} from "./mock";
import s from "./availability.module.css";
import { ambientRoot, useAmbientMotion } from "@/components/ambient-motion";

/** How much a row's strip is magnified around the picked bar — PICK_Z in SentiBoard.html. */
const STRIP_ZOOM = 1.9;

const RANGES: { id: 1 | 7 | 30 | null; label: string }[] = [
  { id: 1, label: "1D" },
  { id: 7, label: "7D" },
  { id: 30, label: "30D" },
  { id: null, label: "Custom" },
];

const RANGE_HEADING: Record<number, string> = {
  1: "Last 24 hours",
  7: "Last 7 days",
  30: "Last 30 days",
};

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

/* ---------- the datatake card (SentiBoard.html#data-availability, cardHTML) ---------- */

/** A small, stable 0–1 number from a datatake ID, so the derived figures below never change
 *  between renders. */
function idUnit(id: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++)
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

type CardSide = { pct: number | null; label: string; color: string };

/** Acquisition and publication for one datatake, as the reference card derives them. The mock only
 *  carries one completeness, so publication follows the reference's rules: nothing yet while
 *  Planned, part-way while Processing, zero when the datatake is lost, a little under acquisition
 *  when Partial, and equal to it (occasionally just under) once Acquired. */
function cardSides(d: Datatake): { acq: CardSide; pub: CardSide } {
  const band = (pct: number) =>
    barColor({ ...d, status: "Acquired", completeness: pct });
  const r = idUnit(d.id, 7);
  const acqPct = d.status === "Planned" ? null : d.completeness;
  const acqLabel =
    d.status === "Planned"
      ? "PLANNED"
      : d.status === "Processing"
        ? "ACQUIRED"
        : d.status.toUpperCase();
  const acq: CardSide = {
    pct: acqPct,
    label: acqLabel,
    color: d.status === "Planned" ? barColor(d) : band(d.completeness),
  };

  let pub: CardSide;
  if (d.status === "Planned") {
    pub = { pct: null, label: "PLANNED", color: barColor(d) };
  } else if (d.status === "Processing") {
    pub = {
      pct: Math.round(d.completeness * (0.3 + r * 0.45) * 100) / 100,
      label: "PROCESSING",
      color: barColor(d),
    };
  } else if (d.status === "Unavailable") {
    pub = { pct: 0, label: "MISSING", color: band(0) };
  } else if (d.status === "Partial") {
    const p = Math.round(d.completeness * (0.82 + r * 0.16) * 100) / 100;
    pub = { pct: p, label: "PARTIAL", color: band(p) };
  } else {
    const p =
      r > 0.12
        ? d.completeness
        : Math.round(d.completeness * (0.9 + r * 0.09) * 100) / 100;
    pub = {
      pct: p,
      label: p >= d.completeness ? "PUBLISHED" : "PARTIAL",
      color: band(p),
    };
  }
  return { acq, pub };
}

/** One completeness ring: a thick track, the filled arc in the band colour, "COMPLETENESS" and
 *  the percentage (in the same colour) in the middle, and a two-line legend underneath. */
function Ring({
  title,
  side,
  onLabel,
}: {
  title: string;
  side: CardSide;
  onLabel: string;
}) {
  const R = 27;
  const C = 2 * Math.PI * R;
  const v = side.pct ?? 0;
  const len = (v / 100) * C;
  return (
    <div className={s.ring}>
      <span className={s.ringTitle}>{title}</span>
      <div className={s.ringWrap}>
        <svg
          viewBox="0 0 70 70"
          role="img"
          aria-label={`${title} completeness ${side.pct ?? "—"}%`}
        >
          <circle
            cx="35"
            cy="35"
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="9"
          />
          {v > 0 && (
            <circle
              cx="35"
              cy="35"
              r={R}
              fill="none"
              stroke={side.color}
              strokeWidth="9"
              strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
              transform="rotate(-90 35 35)"
              className={s.ringArc}
            />
          )}
        </svg>
        <b className={s.ringMid}>
          <em>Completeness</em>
          <span style={{ color: side.color }}>
            {side.pct === null ? "—" : `${side.pct.toFixed(2)}%`}
          </span>
        </b>
      </div>
      <span className={s.ringLegend}>
        <i style={{ background: side.color }} />
        {onLabel}
      </span>
      <span className={s.ringLegend}>
        <i style={{ background: "rgba(255,255,255,0.3)" }} />
        Missing
      </span>
    </div>
  );
}

/** The card that opens under a strip when one of its bars is picked. */
function DatatakeCard({ d, onClose }: { d: Datatake; onClose: () => void }) {
  const { acq, pub } = cardSides(d);
  // The mock has no sensing length; six minutes stands in for it, as before.
  const stop = new Date(d.start.getTime() + 6 * 60000);
  const hhmm = (t: Date) => `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  return (
    <div className={s.dtkCard}>
      <div className={s.dtkHead}>
        <b>{d.id}</b>
        <button
          type="button"
          className={s.dtkClose}
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className={s.dtkWhen}>{fmtDateTime(d.start)}</div>
      <div className={s.dtkBody}>
        <div className={s.dtkRings}>
          <Ring title="Acquisition" side={acq} onLabel="Acquired" />
          <Ring
            title="Publication"
            side={pub}
            onLabel={pub.label === "PROCESSING" ? "Processing" : "Published"}
          />
        </div>
        <dl className={s.dtkMeta}>
          <dt>Data take ID</dt>
          <dd>{d.id}</dd>
          <dt>Platform</dt>
          <dd>{d.satellite}</dd>
          <dt>Sensor mode</dt>
          <dd>{d.sensorMode}</dd>
          <dt>Start date</dt>
          <dd>{`${fmtDate(d.start)} ${hhmm(d.start)}`}</dd>
          <dt>Stop date</dt>
          <dd>{`${fmtDate(stop)} ${hhmm(stop)}`}</dd>
          <dt>Acquisition</dt>
          <dd>
            <span className={s.dtkBadge} style={{ background: acq.color }}>
              {acq.label}
            </span>
          </dd>
          <dt>Publication</dt>
          <dd>
            <span className={s.dtkBadge} style={{ background: pub.color }}>
              {pub.label}
            </span>
          </dd>
        </dl>
      </div>
    </div>
  );
}

export default function CoverageTimeline() {
  const motion = useAmbientMotion();

  const [rangeId, setRangeId] = useState<1 | 7 | 30 | null>(30);
  const [offset, setOffset] = useState(0);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // Incremented on range/Custom/Reset changes; strip entrance animation trigger for Session 4.
  const [animKey, setAnimKey] = useState(0);
  const [mission, setMission] = useState("All");
  const [status, setStatus] = useState<Status | "All">("All");
  const [openDrop, setOpenDrop] = useState<"mission" | "status" | null>(null);
  const [search, setSearch] = useState("");
  const fromInputRef = useRef<HTMLInputElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  // Set to true before switching to Custom via pager label click; cleared after picker is opened.
  const pendingPickerRef = useRef(false);
  const [focus, setFocus] = useState<{
    mission: string;
    key: string;
    date: Date;
    item: Datatake;
  } | null>(null);
  // Where each row's strip pivots when it zooms (px from the strip's left edge). Kept per row and
  // never cleared, so a strip that is zooming back out keeps its pivot until it is flat again.
  const [origins, setOrigins] = useState<Record<string, number>>({});

  // Every window change goes through changeWindow so the card/zoom always closes.
  // Pass animate:true for range/Custom/Reset changes that should replay the bar entrance.
  const changeWindow = useCallback(
    (ch: {
      rangeId?: 1 | 7 | 30 | null;
      offset?: number;
      customFrom?: string;
      customTo?: string;
      animate?: boolean;
    }) => {
      if (ch.rangeId !== undefined) setRangeId(ch.rangeId);
      if (ch.offset !== undefined) setOffset(ch.offset);
      if (ch.customFrom !== undefined) setCustomFrom(ch.customFrom);
      if (ch.customTo !== undefined) setCustomTo(ch.customTo);
      if (ch.animate) setAnimKey((k) => k + 1);
      setFocus(null);
    },
    [],
  );

  const reset = useCallback(() => {
    changeWindow({ rangeId: 30, offset: 0, customFrom: "", customTo: "", animate: true });
    setMission("All");
    setStatus("All");
    setSearch("");
    setOpenDrop(null);
  }, [changeWindow]);

  // winEnd / winStart: always UTC midnight of the respective day.
  // For presets: LAST (tomorrow) minus offset days. For Custom: the selected dates.
  const winEnd = useMemo(
    () =>
      rangeId !== null
        ? new Date(LAST.getTime() - offset * DAY_MS)
        : customTo
          ? new Date(`${customTo}T00:00:00Z`)
          : LAST,
    [rangeId, offset, customTo],
  );
  const winStart = useMemo(
    () =>
      rangeId !== null
        ? new Date(winEnd.getTime() - rangeId * DAY_MS)
        : customFrom
          ? new Date(`${customFrom}T00:00:00Z`)
          : new Date(winEnd.getTime() - 30 * DAY_MS),
    [rangeId, winEnd, customFrom],
  );

  // ‹ disabled at the data boundary (or in Custom); › disabled at offset 0 (or in Custom).
  const atDataStart = rangeId === null || winStart.getTime() <= WINDOW.start.getTime();
  const atLatest = rangeId === null || offset === 0;

  const shiftOffset = useCallback(
    (dir: 1 | -1) => {
      if (rangeId === null) return;
      setOffset((o) => o + dir);
      setFocus(null);
    },
    [rangeId],
  );

  const days = useMemo(() => daysOf(winStart, winEnd), [winStart, winEnd]);

  const inRange = useMemo(
    () =>
      DATA.filter(
        (r) =>
          r.start.getTime() >= winStart.getTime() &&
          r.start.getTime() < winEnd.getTime() + DAY_MS,
      ),
    [winStart, winEnd],
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

  const active =
    rangeId !== 30 ||
    offset !== 0 ||
    customFrom !== "" ||
    customTo !== "" ||
    mission !== "All" ||
    status !== "All" ||
    search !== "" ||
    focus !== null;

  const finalized = matching.filter(
    (r) => r.status !== "Planned" && r.status !== "Processing",
  );
  const gaps = matching.filter(isGap).length;
  const lost = matching.filter((r) => r.status === "Unavailable").length;
  const mean = finalized.length
    ? Math.round(
        finalized.reduce((n, r) => n + r.completeness, 0) / finalized.length,
      )
    : null;

  // Open the From picker on the frame after Custom state is applied (the input renders on that frame).
  useEffect(() => {
    if (rangeId === null && pendingPickerRef.current) {
      pendingPickerRef.current = false;
      fromInputRef.current?.showPicker();
    }
  }, [rangeId]);

  // ← / → keys move the window one day; disabled while a datatake card is open or an input has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (focus !== null) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") shiftOffset(1);
      if (e.key === "ArrowRight") shiftOffset(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, shiftOffset]);

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
            <span className={s.counterV}>{pad(matching.length)}</span>
            <span className={s.counterK}>Datatakes in range</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterV}>{mean !== null ? `${mean}%` : "—"}</span>
            <span className={s.counterK}>Mean completeness</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterV}>{pad(gaps)}</span>
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
            <div className={s.fhead}>
              <h2>{rangeId !== null ? RANGE_HEADING[rangeId] : "Custom range"}</h2>
            </div>
            <div className={s.frange} role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={String(r.id)}
                  type="button"
                  aria-pressed={rangeId === r.id}
                  onClick={() => {
                    if (r.id === null) {
                      changeWindow({ rangeId: null, offset: 0, customFrom: fmtDate(winStart), customTo: fmtDate(winEnd), animate: true });
                    } else {
                      changeWindow({ rangeId: r.id, offset: 0, animate: true });
                    }
                  }}
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
                disabled={atDataStart}
                onClick={() => shiftOffset(1)}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
              <button
                type="button"
                className={s.plabel}
                title="Pick the days on a calendar"
                onClick={() => {
                  changeWindow({ rangeId: null, offset: 0, customFrom: fmtDate(winStart), customTo: fmtDate(winEnd), animate: true });
                  pendingPickerRef.current = true;
                }}
              >
                {fmtDate(winStart)} <span aria-hidden>→</span> {fmtDate(winEnd)}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  aria-hidden
                  style={{ opacity: 0.8 }}
                >
                  <rect x="2" y="3.2" width="12" height="11" rx="1.2" />
                  <path d="M2 6.6h12M5.4 1.8v2.6M10.6 1.8v2.6" />
                </svg>
              </button>
              <button
                type="button"
                className={s.pagerBtn}
                aria-label="Later days"
                disabled={atLatest}
                onClick={() => shiftOffset(-1)}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>

            {rangeId === null && (
              <div className={s.fdates}>
                <label>
                  <span className={s.fdatesMicro}>From</span>
                  <span className={s.fdate}>
                    <input
                      ref={fromInputRef}
                      type="date"
                      min={fmtDate(WINDOW.start)}
                      max={fmtDate(LAST)}
                      value={customFrom}
                      onChange={(e) => {
                        let from = e.target.value, to = customTo;
                        if (from && to && from > to) [from, to] = [to, from];
                        changeWindow({ customFrom: from, customTo: to });
                      }}
                    />
                    <button
                      type="button"
                      className={s.fcal}
                      aria-label="Open calendar"
                      onClick={() => fromInputRef.current?.showPicker()}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                        <rect x="2" y="3.2" width="12" height="11" rx="1.2" />
                        <path d="M2 6.6h12M5.4 1.8v2.6M10.6 1.8v2.6" />
                      </svg>
                    </button>
                  </span>
                </label>
                <label>
                  <span className={s.fdatesMicro}>To</span>
                  <span className={s.fdate}>
                    <input
                      ref={toInputRef}
                      type="date"
                      min={fmtDate(WINDOW.start)}
                      max={fmtDate(LAST)}
                      value={customTo}
                      onChange={(e) => {
                        let from = customFrom, to = e.target.value;
                        if (from && to && from > to) [from, to] = [to, from];
                        changeWindow({ customFrom: from, customTo: to });
                      }}
                    />
                    <button
                      type="button"
                      className={s.fcal}
                      aria-label="Open calendar"
                      onClick={() => toInputRef.current?.showPicker()}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
                        <rect x="2" y="3.2" width="12" height="11" rx="1.2" />
                        <path d="M2 6.6h12M5.4 1.8v2.6M10.6 1.8v2.6" />
                      </svg>
                    </button>
                  </span>
                </label>
              </div>
            )}
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

                    {/* the picked datatake's card opens right under its own strip */}
                    {isRowFocused && activeItem && (
                      <DatatakeCard
                        key={activeItem.id}
                        d={activeItem}
                        onClose={() => setFocus(null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

    </>
  );
}
