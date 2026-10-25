import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import SpaceBackdrop from "@/components/SpaceBackdrop";

import { Search } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
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

const STATUS_DOT: Record<Status, string> = {
  Planned: "#7A8696",
  Processing: "#5B9BE8",
  Acquired: "#3FCF7F",
  Partial: "#F0A63A",
  Unavailable: "#E8514B",
};

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
  const acqPct =
    d.status === "Planned" || d.status === "Processing" ? null : d.completeness;
  const acqLabel =
    d.status === "Planned"
      ? "PLANNED"
      : d.status === "Processing"
        ? "ACQUIRED"
        : d.status.toUpperCase();
  const acq: CardSide = {
    pct: acqPct,
    label: acqLabel,
    color: acqPct === null ? "#7A8696" : band(d.completeness),
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
            stroke="rgba(255,255,255,0.14)"
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
        <i style={{ background: "rgba(255,255,255,0.24)" }} />
        Missing
      </span>
    </div>
  );
}

type CardPhase = "open" | "swap" | "close";

/** The card that opens under a strip when one of its bars is picked.
 *  Height animation is driven imperatively so bands below slide smoothly. */
function DatatakeCard({
  d,
  phase,
  onClose,
  onClosed,
}: {
  d: Datatake;
  phase: CardPhase;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { acq, pub } = cardSides(d);
  const stop = new Date(d.start.getTime() + 6 * 60000);
  const hhmm = (t: Date) => `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;

  const ref = useRef<HTMLDivElement>(null);
  // rAF ids and timer for cleanup so a stale close never fires after a new open.
  const raf1 = useRef(0);
  const raf2 = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Cancel any in-flight animation from a previous phase.
    cancelAnimationFrame(raf1.current);
    cancelAnimationFrame(raf2.current);
    clearTimeout(timer.current);

    if (phase === "open") {
      if (reduced) {
        el.style.cssText = "height:auto;opacity:1;overflow:hidden;transition:none";
        return;
      }
      el.style.cssText = "height:0px;opacity:0;overflow:hidden;transition:none";
      raf1.current = requestAnimationFrame(() => {
        raf2.current = requestAnimationFrame(() => {
          const h = el.scrollHeight;
          el.style.transition =
            "height 560ms cubic-bezier(.2,.7,.2,1), opacity 400ms ease 120ms";
          el.style.height = `${h}px`;
          el.style.opacity = "1";
          timer.current = setTimeout(() => {
            el.style.height = "auto";
            el.style.transition = "";
          }, 600);
        });
      });
    } else if (phase === "close") {
      if (reduced) {
        onClosed();
        return;
      }
      const h = el.scrollHeight;
      el.style.cssText = `height:${h}px;opacity:1;overflow:hidden;transition:none`;
      raf1.current = requestAnimationFrame(() => {
        raf2.current = requestAnimationFrame(() => {
          el.style.transition =
            "height 560ms cubic-bezier(.8,0,.8,.3), opacity 300ms ease";
          el.style.height = "0px";
          el.style.opacity = "0";
          timer.current = setTimeout(onClosed, 620);
        });
      });
    } else {
      // swap: no animation, ensure visible
      el.style.cssText = "height:auto;opacity:1;overflow:hidden;transition:none";
    }

    return () => {
      cancelAnimationFrame(raf1.current);
      cancelAnimationFrame(raf2.current);
      clearTimeout(timer.current);
    };
  }, [phase, onClosed]);

  return (
    <div ref={ref} className={s.dtkCard}>
      <div className={s.dtkHead}>
        <b>{d.id}</b>
        <button
          type="button"
          className={s.dtkClose}
          onClick={onClose}
          aria-label="Close details"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
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

/** Tooltip content rendered inside the single fixed tip element. */
function Tip({ item }: { item: Datatake }): ReactNode {
  const { acq, pub } = cardSides(item);
  const stop = new Date(item.start.getTime() + 6 * 60000);
  const hhmm = (t: Date) => `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
  return (
    <>
      <b className={s.tipH}>{item.id}</b>
      <div className={s.tipTwo}>
        <div>
          <em>Acquisition</em>
          <b style={{ color: acq.color }}>{acq.pct !== null ? `${acq.pct.toFixed(2)}%` : "—"}</b>
        </div>
        <div>
          <em>Publication</em>
          <b style={{ color: pub.color }}>{pub.pct !== null ? `${pub.pct.toFixed(2)}%` : "—"}</b>
        </div>
      </div>
      <div className={s.tipWhen}>
        <span>Start</span>
        <b>{fmtDate(item.start)} {hhmm(item.start)}</b>
        <span>Stop</span>
        <b>{fmtDate(stop)} {hhmm(stop)}</b>
      </div>
    </>
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
  const [offMissions, setOffMissions] = useState<Set<string>>(new Set());
  const [offStatuses, setOffStatuses] = useState<Set<Status>>(new Set());
  const [openDrop, setOpenDrop] = useState<"mission" | "status" | null>(null);
  const [search, setSearch] = useState("");
  const missionDropRef = useRef<HTMLDivElement>(null);
  const statusDropRef = useRef<HTMLDivElement>(null);
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
  // Card shown (and its animation phase) — separate from focus so the card stays mounted during
  // the close animation after focus is cleared (zoom starts back immediately).
  const [cardShown, setCardShown] = useState<{
    mission: string;
    item: Datatake;
  } | null>(null);
  const [cardPhase, setCardPhase] = useState<CardPhase>("open");
  // Where each row's strip pivots when it zooms (px from the strip's left edge). Kept per row and
  // never cleared, so a strip that is zooming back out keeps its pivot until it is flat again.
  const [origins, setOrigins] = useState<Record<string, number>>({});

  // Kick off the close animation. Ignored if card is already closing or not shown.
  const startClose = useCallback(() => {
    setCardPhase((prev) => {
      if (prev === "close") return prev;
      return "close";
    });
    // setCardShown is cleared by handleCardClosed (called by DatatakeCard after 620ms).
  }, []);

  // Called by DatatakeCard when its close animation finishes — unmounts the card.
  const handleCardClosed = useCallback(() => {
    setCardShown(null);
  }, []);

  // True on mount and for ~900 ms after each animated window change; tiles play the stagger entrance.
  // All other renders (filter toggles, search, pager, pick) have animation: none on the tiles.
  const [animating, setAnimating] = useState(true);
  useEffect(() => {
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 900);
    return () => clearTimeout(t);
  }, [animKey]);

  // Tooltip: one fixed element, populated on bar mouseenter, hidden on leave and scroll.
  const [tipItem, setTipItem] = useState<Datatake | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const positionTip = useCallback((clientX: number, clientY: number) => {
    const el = tipRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    const w = el.offsetWidth;
    let x = clientX + 18;
    let y = clientY - h - 14;
    if (x + w + 12 > window.innerWidth) x = clientX - w - 18;
    if (y < 12) y = clientY + 20;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, []);

  useEffect(() => {
    const hide = () => setTipItem(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

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
      startClose();
    },
    [startClose],
  );

  const reset = useCallback(() => {
    changeWindow({ rangeId: 30, offset: 0, customFrom: "", customTo: "", animate: true });
    setOffMissions(new Set());
    setOffStatuses(new Set());
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
    if (offMissions.size > 0) out = out.filter((r) => !offMissions.has(r.mission));
    if (offStatuses.size > 0) out = out.filter((r) => !offStatuses.has(r.status));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter((r) => r.id.toLowerCase().includes(q));
    }
    return out;
  }, [inRange, offMissions, offStatuses, search]);

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

  // Escape: close open dropdown first; if none open, close the datatake card.
  // ← / → keys move the window one day; disabled while a datatake card is open or an input has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openDrop !== null) { setOpenDrop(null); return; }
        if (focus !== null || cardShown !== null) {
          setFocus(null);
          startClose();
          return;
        }
        return;
      }
      if (focus !== null) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") shiftOffset(1);
      if (e.key === "ArrowRight") shiftOffset(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, cardShown, openDrop, shiftOffset, startClose]);

  // Click outside either open dropdown closes it.
  useEffect(() => {
    if (openDrop === null) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!missionDropRef.current?.contains(t) && !statusDropRef.current?.contains(t)) {
        setOpenDrop(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [openDrop]);

  // If a filter change removes the focused datatake from matching, close the card and zoom out.
  // The row itself disappears so there is nothing to animate — reset card state immediately.
  useEffect(() => {
    if (focus !== null && !matching.some((r) => r.id === focus.item.id)) {
      setFocus(null);
      setCardShown(null);
    }
  }, [matching, focus]);

  // One row per mission: its datatakes folded into at most FRAMES evenly spaced bars, and one shared
  // set of date labels under every row — the layout of SentiBoard.html#data-availability.
  const ticks = useMemo(() => axisTicks(days), [days]);
  const lanes = useMemo(
    () =>
      MISSION_NAMES.filter((m) => !offMissions.has(m)).map((m) => {
        const own = matching.filter((r) => r.mission === m);
        const frames = framesOf(own);
        // Bar width: 76% of the strip shared by the bars, so ~24% is the gaps between them.
        const tw = frames.length ? 76 / frames.length : 2;
        return { mission: m, frames, tw };
      }),
    [matching, offMissions],
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
            <div className={s.fdrop} ref={missionDropRef}>
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openDrop === "mission"}
                aria-controls="avail-mission"
                onClick={() => setOpenDrop(openDrop === "mission" ? null : "mission")}
              >
                <span className={s.fdropLabel}>Mission</span>
                {offMissions.size > 0 && (
                  <span className={s.fdropVal}>{MISSION_NAMES.length - offMissions.size}/{MISSION_NAMES.length}</span>
                )}
                <ChevronDown />
              </button>
              <div
                id="avail-mission"
                className={s.fdropBody}
                style={{ gridTemplateRows: openDrop === "mission" ? "1fr" : "0fr" }}
                aria-hidden={openDrop !== "mission" ? true : undefined}
                ref={(el) => { if (el) el.inert = openDrop !== "mission"; }}
              >
                <div className={s.fdropInner}>
                  <div className={s.fdropPad}>
                    {MISSION_NAMES.map((m) => {
                      const isOff = offMissions.has(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          className={`${s.fitem} ${s.fitemMission}${isOff ? ` ${s.fitemOff}` : ""}`}
                          aria-pressed={!isOff}
                          onClick={() => {
                            setOffMissions((prev) => {
                              const next = new Set(prev);
                              if (next.has(m)) next.delete(m); else next.add(m);
                              return next;
                            });
                          }}
                        >
                          <u>{m}</u>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className={s.fdrop} ref={statusDropRef}>
              <button
                type="button"
                className={s.fdropHead}
                aria-expanded={openDrop === "status"}
                aria-controls="avail-status"
                onClick={() => setOpenDrop(openDrop === "status" ? null : "status")}
              >
                <span className={s.fdropLabel}>Status</span>
                {offStatuses.size > 0 && (
                  <span className={s.fdropVal}>{STATUSES.length - offStatuses.size}/{STATUSES.length}</span>
                )}
                <ChevronDown />
              </button>
              <div
                id="avail-status"
                className={s.fdropBody}
                style={{ gridTemplateRows: openDrop === "status" ? "1fr" : "0fr" }}
                aria-hidden={openDrop !== "status" ? true : undefined}
                ref={(el) => { if (el) el.inert = openDrop !== "status"; }}
              >
                <div className={s.fdropInner}>
                  <div className={s.fdropPad}>
                    {STATUSES.map((st) => {
                      const isOff = offStatuses.has(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          className={`${s.fitem}${isOff ? ` ${s.fitemOff}` : ""}`}
                          aria-pressed={!isOff}
                          onClick={() => {
                            setOffStatuses((prev) => {
                              const next = new Set(prev);
                              if (next.has(st)) next.delete(st); else next.add(st);
                              return next;
                            });
                          }}
                        >
                          <i style={{ background: STATUS_DOT[st] }} />
                          <u>{st}</u>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
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
              {lanes.map(({ mission: m, frames, tw }, rowIndex) => {
                const isRowFocused = focus?.mission === m;
                const zoomed = isRowFocused && focus?.item != null;
                return (
                  <div className={s.mapRowContainer} key={m}>
                    <div className={s.mapRow}>
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
                          {frames.map(({ item, leftPct }, barIndex) => {
                            const on =
                              focus?.mission === m &&
                              focus?.item?.id === item.id;
                            const faded = focus !== null && !on;
                            const cls = [
                              s.tile,
                              on ? s.tileSelected : "",
                              faded ? s.tileFaded : "",
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
                                  animationDelay: animating
                                    ? `${Math.min(420, rowIndex * 45 + barIndex * 2.4)}ms`
                                    : undefined,
                                  animation: animating ? undefined : "none",
                                }}
                                aria-label={item.id}
                                onMouseEnter={(e) => {
                                  const x = e.clientX, y = e.clientY;
                                  setTipItem(item);
                                  requestAnimationFrame(() => positionTip(x, y));
                                }}
                                onMouseMove={(e) => positionTip(e.clientX, e.clientY)}
                                onMouseLeave={() => setTipItem(null)}
                                onClick={(e) => {
                                  if (on) {
                                    // Same bar: zoom out and close with animation.
                                    setFocus(null);
                                    startClose();
                                    return;
                                  }
                                  const centre = e.currentTarget.offsetLeft;
                                  setOrigins((o) => ({ ...o, [m]: centre }));
                                  setFocus({
                                    mission: m,
                                    key: fmtDate(item.start),
                                    date: item.start,
                                    item,
                                  });
                                  // If a card is already shown (open or closing), swap content;
                                  // otherwise this is the first pick and we animate open.
                                  setCardShown({ mission: m, item });
                                  setCardPhase(cardShown !== null ? "swap" : "open");
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* axis is a sibling of .lane, absolutely positioned at 90% of the band */}
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

                    {/* the picked datatake's card opens right under its own strip */}
                    {cardShown?.mission === m && (
                      <DatatakeCard
                        d={cardShown.item}
                        phase={cardPhase}
                        onClose={() => { setFocus(null); startClose(); }}
                        onClosed={handleCardClosed}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>

      {createPortal(
        <div
          ref={tipRef}
          className={`${s.tip}${tipItem ? ` ${s.tipOn}` : ""}`}
          aria-hidden="true"
        >
          {tipItem && <Tip item={tipItem} />}
        </div>,
        document.body,
      )}
    </>
  );
}
