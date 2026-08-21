import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Reveal } from "@/components/ui";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { passesFor } from "@/data/downlink";
import {
  ACQ_DATATAKES, COMPLETENESS_COLOR, LEVEL_LABEL,
  expectedTypes, levelMean, meanCompleteness, missingSeconds, sensingMs,
  type AcqDatatake, type AcqLevel, type AcqProductType, type Completeness, type ProductLevel,
} from "@/data/mock";
import s from "./ladder.module.css";

/* Acquisitions PROPOSAL 2 — "Acquisition Ladder". An ALTERNATIVE to /acquisitions, which is
   untouched, and a second reading alongside /examples/acquisitions-globe.

   The globe answers "where is the fleet acquiring?". This answers "where in the processing chain
   is the data being lost?" — geography is dropped entirely and the PRODUCT-LEVEL CHAIN becomes the
   primary axis, with time demoted to a selector. That inversion is the whole concept.

   Three bands:
     · Band 1 — fleet strip: one lane per satellite unit over a time window, with a scrubbable
       scenario clock splitting flown / in-sensing / scheduled;
     · Band 2 — the ladder: the selected datatake's levels stacked bottom-to-top, L0 at the base
       feeding upward, with a YIELD-DROP CONNECTOR between rungs. Two plates side by side leave
       the subtraction to the reader; a connector states it;
     · Band 3 — fleet roll-up: the ladder collapsed to one bar per level, per mission, so the four
       missions' differing level structures read as four ragged silhouettes.

   Deliberately NO canvas, NO 3D scene, NO coastline geometry and NO render loop — the only moving
   thing is the wall-clock text node in Band 1's header. Data is entirely the existing mock set
   (data/mock.ts + data/downlink.ts); nothing was added for this route.

   Colour comes only from the shared tokens, so this follows the app's global dark/light switch
   with no palette of its own — see ladder.module.css. */

// ---------------------------------------------------------------------------
// Scenario clock
// ---------------------------------------------------------------------------

/* ACQ_DATATAKES is a fixed scenario dated 15–16 Jul 2026, exactly as the globe concept treats it
   (DAY_START in components/AcquisitionGlobe.tsx is the same 16 Jul). So "now" here is a SCENARIO
   instant, not the wall clock, and it is scrubbable rather than playing: a play loop would
   reintroduce the per-frame cost this concept exists to avoid.

   The default sits at 09:35:00Z because that one instant puts all three phases on screen at once —
   four datatakes flown, S1A-57622 mid-sensing (09:33:10 + 205 s), S2A-48201-1 still scheduled. */
const SCENARIO_NOW_DEFAULT = Date.UTC(2026, 6, 16, 9, 35, 0);
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

/** Window presets — the span drawn around the scenario clock. `null` = the whole data extent. */
const WINDOWS: { id: string; label: string; span: number | null }[] = [
  { id: "2h", label: "2 h", span: 2 * HOUR_MS },
  { id: "6h", label: "6 h", span: 6 * HOUR_MS },
  { id: "12h", label: "12 h", span: 12 * HOUR_MS },
  { id: "all", label: "Full scenario", span: null },
];

type Phase = "flown" | "sensing" | "scheduled";

const PHASE_LABEL: Record<Phase, string> = {
  flown: "Flown",
  sensing: "Sensing now",
  scheduled: "Scheduled",
};

const startOf = (dt: AcqDatatake) => sensingMs(dt) ?? 0;
const endOf = (dt: AcqDatatake) => startOf(dt) + dt.sensingS * 1000;

function phaseOf(dt: AcqDatatake, nowMs: number): Phase {
  if (nowMs < startOf(dt)) return "scheduled";
  if (nowMs < endOf(dt)) return "sensing";
  return "flown";
}

/** The bar's colour, as one of the five production completeness states.
 *
 *  For a flown datatake it reads `cls`, which mock.ts derives from `comp` — so this can never
 *  disagree with the ladder, the KPI or the globe. A datatake that has not flown yet has no
 *  completeness to report, whatever its eventual percentages say. */
function stateOf(dt: AcqDatatake, phase: Phase): Completeness {
  if (phase === "scheduled") return "planned";
  if (phase === "sensing") return "processing";
  return dt.cls === "ok" ? "acquired" : dt.cls === "warn" ? "partial" : "unavailable";
}

// ---------------------------------------------------------------------------
// Missions
// ---------------------------------------------------------------------------

/* Mission from the satellite unit. S5P is the one that does not follow "S" + digit, and it is also
   the mission whose level structure differs most — so it gets named explicitly rather than sliced. */
function missionOf(unit: string): string {
  return unit.startsWith("S5") ? "S5P" : unit.slice(0, 2);
}

const MISSIONS = ["S1", "S2", "S3", "S5P"] as const;

const MISSION_NAME: Record<string, string> = {
  S1: "Sentinel-1", S2: "Sentinel-2", S3: "Sentinel-3", S5P: "Sentinel-5P",
};

/** Muted accent per mission, matching the Processors timeline's lane-group treatment. */
const MISSION_HUE: Record<string, string> = {
  S1: "#7aa2f7", S2: "#7fd4a2", S3: "#e0b177", S5P: "#c79bd8",
};

/* Level labels are MISSION-AWARE, which is the point of the concept. Sentinel-5P's L1 bucket
   carries L1B_RA_BD* types — the backend classifies them by an L1B token, not L1 — so calling that
   rung "Level 1" on an S5P ladder would misname the only level the mission has at that stage. */
function levelLabel(level: ProductLevel, mission: string): string {
  if (mission === "S5P" && level === "L1") return "Level 1B";
  return LEVEL_LABEL[level];
}

/* What a mission's chain actually starts from. Sentinel-5P has no Level 0 product at all, and
   saying so is the honest rendering of a two-rung ladder — an empty Level 0 plate would read as a
   hole in the data rather than as a property of the mission. */
function baseNote(mission: string, levels: AcqLevel[]): string | null {
  const first = levels[0]?.level;
  if (mission === "S5P") return "TROPOMI downlink → Level 1B · this mission publishes no Level 0 product";
  if (first === "L0") return "Instrument downlink → Level 0 · chain starts at the raw product";
  return null;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const pad2 = (n: number) => String(n).padStart(2, "0");

function utcHms(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
}

function utcDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** m ss, the form the globe's rail uses for sensing and missing time. */
function dur(sec: number): string {
  const m = Math.floor(sec / 60);
  const rest = Math.round(sec % 60);
  return m > 0 ? `${m}m ${pad2(rest)}s` : `${rest}s`;
}

const pct1 = (n: number) => `${n.toFixed(1)}%`;

/** Severity class off the same 95% threshold the plates and `cls` use. */
function sev(mean: number | null): string {
  if (mean === null) return "none";
  if (mean === 0) return "crit";
  return mean < 95 ? "warn" : "";
}

// ---------------------------------------------------------------------------
// Wall clock — the only moving thing on the page
// ---------------------------------------------------------------------------

/* Isolated in its own component so its one-second tick re-renders a single text node and never the
   strip, the ladder or the roll-up. */
function UtcClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <>{utcHms(now)}</>;
}

// ---------------------------------------------------------------------------
// Band 2 — one rung
// ---------------------------------------------------------------------------

/** Product types of a level, grouped by instrument. One group when the level has a single
 *  instrument, which is every mission but Sentinel-3. */
function groupByInstrument(products: AcqProductType[]) {
  const order: string[] = [];
  const byInst = new Map<string, AcqProductType[]>();
  for (const p of products) {
    const key = p.instrument ?? "—";
    if (!byInst.has(key)) { byInst.set(key, []); order.push(key); }
    byInst.get(key)!.push(p);
  }
  return order.map((inst) => ({
    inst,
    products: byInst.get(inst)!,
    mean: levelMean({ level: "L0", products: byInst.get(inst)! }),
  }));
}

function Rung({ level, mission, phase, sensingS, open, onToggle }: {
  level: AcqLevel; mission: string; phase: Phase; sensingS: number;
  open: boolean; onToggle: () => void;
}) {
  const mean = levelMean(level);
  const notExpected = mean === null;
  // A scheduled datatake has a known PLAN but no completeness yet, so the percentages are withheld
  // rather than shown as achieved. Withholding is what "not yet sensed" means.
  const pending = phase === "scheduled";
  const groups = useMemo(() => groupByInstrument(level.products), [level]);
  const multiInstrument = groups.length > 1;

  const headId = `rung-${mission}-${level.level}`;

  return (
    <div className={`${s.rung} ${notExpected ? s.rungNE : ""} ${!pending && !notExpected && (mean as number) < 95 ? s.rungAlarm : ""}`}>
      <button type="button" className={s.rungHead} onClick={onToggle} aria-expanded={open} aria-controls={`${headId}-tbl`}>
        <span className={s.rungLab}>
          {levelLabel(level.level, mission)}
          {mission === "S2" && level.level === "L1" && <span className={s.rungTag}>collapsed L1A/B/C</span>}
          {multiInstrument && <span className={s.rungTag}>{groups.length} instruments</span>}
          {notExpected && <span className={s.rungTag}>not expected</span>}
        </span>
        <span className={`${s.rungPct} ${pending ? s.none : s[sev(mean)] ?? ""}`}>
          {pending ? "pending" : notExpected ? "not expected" : pct1(mean as number)}
        </span>
      </button>

      <div className={s.groups}>
        {groups.map((g) => (
          <div className={s.group} key={g.inst}>
            {multiInstrument && (
              <div className={s.groupHead}>
                <span>{g.inst}</span>
                <span>{pending ? "—" : g.mean === null ? "n/e" : pct1(g.mean)}</span>
              </div>
            )}
            <div className={s.segs}>
              {g.products.map((p) => {
                const ne = p.pct === null;
                const cls = pending ? s.segPending : ne ? s.segNE : "";
                const title = pending
                  ? `${p.type} — scheduled, not yet sensed`
                  : ne
                    ? `${p.type} — not expected for this datatake`
                    : `${p.type} — ${pct1(p.pct as number)}, ${dur(sensingS * (1 - (p.pct as number) / 100))} missing`;
                return (
                  <span
                    key={p.type}
                    className={`${s.seg} ${cls}`}
                    style={ne || pending ? undefined : { ["--segLine" as string]: segHue(p.pct as number) }}
                    title={title}
                    role="img"
                    aria-label={title}
                  >
                    {!ne && !pending && <span className={s.segFill} style={{ height: `${p.pct}%` }} />}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <table className={s.tbl} id={`${headId}-tbl`}>
          <caption>{levelLabel(level.level, mission)} · {level.products.length} product types</caption>
          <thead>
            <tr>
              <th scope="col">Product type</th>
              {multiInstrument && <th scope="col">Instrument</th>}
              <th scope="col">Completeness</th>
              <th scope="col">Missing</th>
            </tr>
          </thead>
          <tbody>
            {level.products.map((p) => (
              <tr key={p.type}>
                <td>{p.type}</td>
                {multiInstrument && <td>{p.instrument ?? "—"}</td>}
                <td className={p.pct === null ? s.ne : pending ? s.ne : s[sev(p.pct)] ?? ""}>
                  {pending ? "pending" : p.pct === null ? "not expected" : pct1(p.pct)}
                </td>
                <td className={s.ne}>
                  {pending || p.pct === null ? "—" : dur(sensingS * (1 - p.pct / 100))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Per-segment hue off the same thresholds as everything else, mixed live so each theme
 *  re-weights it rather than carrying a second set of values. */
function segHue(pct: number): string {
  if (pct === 0) return "var(--cmp-unavailable)";
  if (pct >= 95) return "var(--cmp-acquired)";
  if (pct >= 70) return "var(--cmp-partial)";
  return "color-mix(in srgb, var(--cmp-unavailable) 55%, var(--cmp-partial))";
}

/** The connector between two rungs — the yield drop. */
function Yield({ from, to, pending }: { from: number | null; to: number | null; pending: boolean }) {
  let hue = "var(--line-strong)";
  let txt = "—";
  let note = "no comparable level";

  if (pending) {
    note = "pending";
  } else if (from !== null && to !== null) {
    const d = to - from;
    const mag = Math.abs(d);
    hue = mag < 2 ? "var(--cmp-acquired)"
      : mag < 15 ? "var(--cmp-partial)"
        : "var(--cmp-unavailable)";
    txt = `${d < 0 ? "−" : d > 0 ? "+" : "±"}${mag.toFixed(1)} pts`;
    note = d < -2 ? "loss enters here" : d < 0 ? "slight loss" : d > 0 ? "recovered" : "carried through";
  }

  return (
    <div className={s.link} style={{ ["--linkHue" as string]: hue }}>
      <span className={s.linkRail} aria-hidden />
      <span className={s.linkTxt}>{txt}<em>{note}</em></span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Band 3 — mission mini-ladder
// ---------------------------------------------------------------------------

/** A mission's levels rolled up across every datatake it has in the scenario: one bar per level,
 *  the mean over all that level's expected product types on all those datatakes. */
function missionLadder(dts: AcqDatatake[]) {
  const byLevel = new Map<ProductLevel, AcqProductType[]>();
  const order: ProductLevel[] = [];
  for (const dt of dts) {
    for (const lv of dt.levels) {
      if (!byLevel.has(lv.level)) { byLevel.set(lv.level, []); order.push(lv.level); }
      byLevel.get(lv.level)!.push(...lv.products);
    }
  }
  return order.map((level) => ({
    level,
    mean: levelMean({ level, products: byLevel.get(level)! }),
    types: byLevel.get(level)!.length,
  }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AcquisitionsLadder() {
  const [nowMs, setNowMs] = useState(SCENARIO_NOW_DEFAULT);
  // Defaults to the full extent so every datatake is on screen on arrival; the presets narrow.
  const [windowId, setWindowId] = useState("all");
  const [mission, setMission] = useState<string | null>(null);
  // S1A-57622 is the default because it is the flagship case: Level 0 at 99.0% feeding Level 1 at
  // 59.6%, so the yield connector reads −39.4 pts on arrival rather than after a click.
  const [selId, setSelId] = useState("S1A-57622");
  const [openRung, setOpenRung] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Set only by the arrow-key handler: a click already leaves focus where the user put it, but a
  // keyboard walk moves the roving tabindex off the focused bar and the ring has to follow.
  const wantFocus = useRef(false);

  // The full data extent, padded, so "Full scenario" has bounds and the scrub has a range.
  const extent = useMemo(() => {
    const starts = ACQ_DATATAKES.map(startOf);
    const ends = ACQ_DATATAKES.map(endOf);
    return {
      from: Math.min(...starts) - 30 * MINUTE_MS,
      to: Math.max(...ends) + 30 * MINUTE_MS,
    };
  }, []);

  const span = WINDOWS.find((w) => w.id === windowId)?.span ?? null;

  // The drawn window. A preset centres on the clock and is then clamped inside the extent, so
  // scrubbing to an end cannot leave half the plot empty.
  const view = useMemo(() => {
    if (span === null) return extent;
    const total = extent.to - extent.from;
    if (span >= total) return extent;
    let from = nowMs - span / 2;
    if (from < extent.from) from = extent.from;
    if (from + span > extent.to) from = extent.to - span;
    return { from, to: from + span };
  }, [span, nowMs, extent]);

  const viewSpan = view.to - view.from;
  const posOf = useCallback((ms: number) => ((ms - view.from) / viewSpan) * 100, [view.from, viewSpan]);

  const lanes = useMemo(() => {
    const units = Array.from(new Set(ACQ_DATATAKES.map((d) => d.unit)));
    return units.sort((a, b) => {
      const ma = MISSIONS.indexOf(missionOf(a) as typeof MISSIONS[number]);
      const mb = MISSIONS.indexOf(missionOf(b) as typeof MISSIONS[number]);
      return ma - mb || a.localeCompare(b);
    });
  }, []);

  // Datatakes inside the drawn window, in time order — this is also the ←/→ walk order.
  const visible = useMemo(
    () => ACQ_DATATAKES
      .filter((d) => endOf(d) >= view.from && startOf(d) <= view.to)
      .slice()
      .sort((a, b) => startOf(a) - startOf(b)),
    [view.from, view.to]
  );

  const outside = ACQ_DATATAKES.length - visible.length;

  useEffect(() => {
    if (!wantFocus.current) return;
    wantFocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }, [selId]);

  const selected = useMemo(
    () => ACQ_DATATAKES.find((d) => d.id === selId) ?? ACQ_DATATAKES[0],
    [selId]
  );

  const selMission = missionOf(selected.unit);
  const selPhase = phaseOf(selected, nowMs);
  const selPending = selPhase === "scheduled";
  const comp = meanCompleteness(selected.levels);
  const missing = missingSeconds(selected);
  const passes = passesFor(selected.id);
  // Levels bottom-to-top in the DOM order L0 → L2; the CSS reverses the paint direction so the
  // base sits at the bottom without reordering the markup a screen reader walks.
  const rungs = selected.levels;

  /* Hour ticks across the window. Step chosen so a 2-hour window does not draw one rule per
     minute and the full scenario does not draw one per hour. */
  const ticks = useMemo(() => {
    const stepH = viewSpan <= 3 * HOUR_MS ? 0.5 : viewSpan <= 8 * HOUR_MS ? 1 : viewSpan <= 26 * HOUR_MS ? 3 : 6;
    const step = stepH * HOUR_MS;
    const first = Math.ceil(view.from / step) * step;
    const out: { ms: number; label: string }[] = [];
    for (let t = first; t <= view.to; t += step) {
      out.push({ ms: t, label: utcHms(t).slice(0, 5) });
    }
    return out;
  }, [view.from, view.to, viewSpan]);

  /* Keyboard: ←/→ walk the window in time order, ↑/↓ jump to the nearest datatake in the adjacent
     lane. One tab stop over the strip with a roving tabindex, so the strip behaves like a single
     widget rather than N separate stops. */
  const onStripKey = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(k)) return;
    e.preventDefault();

    let next: AcqDatatake | undefined;
    if (k === "Home") next = visible[0];
    else if (k === "End") next = visible[visible.length - 1];
    else if (k === "ArrowLeft" || k === "ArrowRight") {
      const i = visible.findIndex((d) => d.id === selId);
      const j = k === "ArrowLeft" ? Math.max(0, i - 1) : Math.min(visible.length - 1, i + 1);
      next = visible[i === -1 ? 0 : j];
    } else {
      const laneIdx = lanes.indexOf(selected.unit);
      const dir = k === "ArrowUp" ? -1 : 1;
      // Walk outward until a lane with something in the window turns up.
      for (let step = 1; step <= lanes.length; step++) {
        const li = laneIdx + dir * step;
        if (li < 0 || li >= lanes.length) break;
        const inLane = visible.filter((d) => d.unit === lanes[li]);
        if (inLane.length) {
          const t = startOf(selected);
          next = inLane.reduce((best, d) =>
            Math.abs(startOf(d) - t) < Math.abs(startOf(best) - t) ? d : best);
          break;
        }
      }
    }
    if (next) { wantFocus.current = true; setSelId(next.id); setOpenRung(null); }
  };

  const pickMission = (m: string) => {
    const nextMission = mission === m ? null : m;
    setMission(nextMission);
    if (nextMission) {
      // Jump to that mission's most recent datatake so the ladder follows the card.
      const own = ACQ_DATATAKES.filter((d) => missionOf(d.unit) === nextMission)
        .slice().sort((a, b) => startOf(b) - startOf(a));
      if (own.length) { setSelId(own[0].id); setOpenRung(null); }
    }
  };

  return (
    <>
      <PageHeader crumb="Acquisitions · Ladder" title="Acquisitions Status"
        sub="Proposal for the acquisitions page as a processing chain rather than a map: the fleet on a time strip, the selected datatake's product levels stacked bottom-to-top, and the yield drop between levels named — so where the data is being lost is a reading, not an inference."
        desc={ACQUISITIONS_DESCRIPTION} />

      <section className="wrap pad">

        {/* ---------------- BAND 1 · fleet strip ---------------- */}
        <Reveal>
          <div className={s.band}>
            <div className={s.bandHead}>
              <div className={s.bandTitle}>
                <span className={s.bandK}>Band 1</span>
                <h2 className={s.bandN}>Fleet strip</h2>
              </div>
              <div className={s.ctrls}>
                <span className={s.ctrlK}>window</span>
                {WINDOWS.map((w) => (
                  <button key={w.id} type="button" className={s.btn}
                    aria-pressed={windowId === w.id} onClick={() => setWindowId(w.id)}>
                    {w.label}
                  </button>
                ))}
                <span className={s.ctrlK} style={{ marginLeft: 8 }}>mission</span>
                {MISSIONS.map((m) => (
                  <button key={m} type="button" className={s.btn}
                    aria-pressed={mission === m} onClick={() => pickMission(m)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className={s.strip}>
              <div className={s.clockRow}>
                <span className={s.clockVal}>
                  {utcDate(nowMs)} {utcHms(nowMs)}
                  <small>SCENARIO T</small>
                </span>
                <input
                  className={s.scrub}
                  type="range"
                  min={extent.from}
                  max={extent.to}
                  step={MINUTE_MS}
                  value={nowMs}
                  onChange={(e) => setNowMs(Number(e.target.value))}
                  aria-label="Scenario clock"
                  aria-valuetext={`${utcDate(nowMs)} ${utcHms(nowMs)} UTC`}
                />
                <span className={s.clockVal} style={{ fontSize: 12 }}>
                  <UtcClock /><small>WALL UTC</small>
                </span>
              </div>

              <div
                className={s.grid}
                ref={gridRef}
                style={{ ["--laneLabelW" as string]: "68px" }}
                role="group"
                aria-label="Datatakes by satellite unit. Left and right arrows step through datatakes in time order, up and down move between satellite lanes."
                onKeyDown={onStripKey}
              >
                <div className={s.ticks}>
                  {ticks.map((t) => (
                    <span key={t.ms} className={s.tick} style={{ left: `${posOf(t.ms)}%` }}>{t.label}</span>
                  ))}
                </div>

                {/* One rule for the whole plot rather than one per lane. */}
                {nowMs >= view.from && nowMs <= view.to && (
                  <div className={s.nowLine}
                    style={{ left: `calc(var(--laneLabelW) + (100% - var(--laneLabelW)) * ${(posOf(nowMs) / 100).toFixed(5)})` }}>
                    <span className={s.nowFlag}>T</span>
                  </div>
                )}

                {lanes.map((unit) => {
                  const m = missionOf(unit);
                  const dim = mission !== null && mission !== m;
                  const own = visible.filter((d) => d.unit === unit);
                  return (
                    <div key={unit} className={`${s.lane} ${dim ? s.laneDim : ""}`}
                      style={{ ["--laneHue" as string]: MISSION_HUE[m] }}>
                      <div className={s.laneLab}>
                        <span className={s.laneHue} aria-hidden />
                        {unit}
                      </div>
                      <div className={s.track}>
                        {own.map((d) => {
                          const phase = phaseOf(d, nowMs);
                          const state = stateOf(d, phase);
                          const hue = COMPLETENESS_COLOR[state];
                          const left = Math.max(0, posOf(startOf(d)));
                          const width = Math.min(((endOf(d) - startOf(d)) / viewSpan) * 100, 100 - left);
                          const sel = d.id === selId;
                          const stations = passesFor(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              className={`${s.bar} ${phase === "scheduled" ? s.barScheduled : ""} ${phase === "sensing" ? s.barSensing : ""}`}
                              style={{
                                left: `${left}%`,
                                width: `${width}%`,
                                ["--barLine" as string]: hue,
                                ["--barFill" as string]: `color-mix(in srgb, ${hue} 26%, transparent)`,
                                ["--barInk" as string]: "var(--text)",
                              }}
                              aria-pressed={sel}
                              tabIndex={sel ? 0 : -1}
                              onClick={() => { setSelId(d.id); setOpenRung(null); }}
                              title={`${d.id} · ${d.sat} · ${PHASE_LABEL[phase]} · sensing ${utcHms(startOf(d))}Z for ${dur(d.sensingS)}`}
                            >
                              {/* Past ~70% of the window the label would run off the plot and be
                                  clipped by the band, so it anchors to the bar's right edge and
                                  extends leftwards instead. Every lane holds one datatake, so a
                                  flipped label has no neighbour to collide with. */}
                              <span className={`${s.barLab} ${left > 70 ? s.barLabEnd : ""}`}>
                                <b>{d.id}</b>
                                {stations.map((p) => <span key={p.station}>{p.station}</span>)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={s.stripFoot}>
                <div className={s.legend}>
                  <span style={{ color: COMPLETENESS_COLOR.acquired }}><i style={{ background: "currentColor" }} />acquired</span>
                  <span style={{ color: COMPLETENESS_COLOR.partial }}><i style={{ background: "currentColor" }} />partial</span>
                  <span style={{ color: COMPLETENESS_COLOR.unavailable }}><i style={{ background: "currentColor" }} />unavailable</span>
                  <span style={{ color: COMPLETENESS_COLOR.processing }}><i className={s.barSensing} style={{ ["--barLine" as string]: "currentColor" }} />sensing at T</span>
                  <span style={{ color: COMPLETENESS_COLOR.planned }}><i style={{ borderStyle: "dashed" }} />scheduled</span>
                </div>
              </div>
              <div className={s.stripFoot}>
                <span>{visible.length} of {ACQ_DATATAKES.length} datatakes in window{outside > 0 ? ` · ${outside} outside` : ""}</span>
                <span>bars shorter than the minimum are drawn at 14 px so a 3-minute datatake stays clickable next to a 20-minute one</span>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ---------------- BAND 2 · the ladder ---------------- */}
        <Reveal>
          <div className={s.band}>
            <div className={s.bandHead}>
              <div className={s.bandTitle}>
                <span className={s.bandK}>Band 2</span>
                <h2 className={s.bandN}>Level ladder — {selected.id}</h2>
              </div>
              <span className={s.bandK}>{rungs.length} rungs · {expectedTypes(selected.levels).length} expected product types</span>
            </div>

            <div className={s.ladderWrap}>
              <div className={s.ladder}>
                <div className={s.dtHead}>
                  <span className={s.dtId}>{selected.id}</span>
                  <span className={s.dtPhase}
                    style={{ ["--barLine" as string]: COMPLETENESS_COLOR[stateOf(selected, selPhase)] }}>
                    {PHASE_LABEL[selPhase]}
                  </span>
                </div>
                <p className={s.dtMeta}>
                  {selected.sat} · {selected.mode} · orbit {selected.absOrbit} ·
                  sensing {utcDate(startOf(selected))} {utcHms(startOf(selected))}Z for {dur(selected.sensingS)} ·
                  status {selected.status}
                </p>

                <div className={s.rungs}>
                  {rungs.map((lv, i) => (
                    <div key={lv.level} className={s.rungGroup}>
                      {i > 0 && (
                        <Yield
                          from={levelMean(rungs[i - 1])}
                          to={levelMean(lv)}
                          pending={selPending}
                        />
                      )}
                      <Rung
                        level={lv}
                        mission={selMission}
                        phase={selPhase}
                        sensingS={selected.sensingS}
                        open={openRung === lv.level}
                        onToggle={() => setOpenRung(openRung === lv.level ? null : lv.level)}
                      />
                    </div>
                  ))}
                </div>

                {baseNote(selMission, rungs) && (
                  <div className={s.base}>{baseNote(selMission, rungs)}</div>
                )}
              </div>

              <div className={s.side}>
                <div className={s.kpi}>
                  <span className={s.kpiK}>datatake completeness</span>
                  <span className={`${s.kpiV} ${selPending ? s.mute : s[sev(comp)] ?? ""}`}>
                    {selPending ? "not yet sensed" : <>{comp.toFixed(1)}<small>%</small></>}
                  </span>
                  <p className={s.kpiNote}>
                    Unweighted mean across the {expectedTypes(selected.levels).length} expected product
                    types — <code>meanCompleteness()</code>, the same function the globe's header KPI uses.
                  </p>
                </div>

                <div className={s.kpi}>
                  <span className={s.kpiK}>missing sensing time</span>
                  <span className={`${s.kpiV} ${selPending ? s.mute : ""}`}>
                    {selPending ? "—" : dur(missing)}
                  </span>
                  <p className={s.kpiNote}>
                    Summed across product types, so it can exceed the {dur(selected.sensingS)} sensing
                    window. It is a backlog figure, not an interval.
                  </p>
                </div>

                <div className={s.dl}>
                  <span className={s.kpiK}>downlink passes</span>
                  {passes.length === 0
                    ? <p className={s.dlNone}>no passes recorded</p>
                    : passes.map((p) => (
                      <div className={s.dlRow} key={p.station + p.atIso}>
                        <b>{p.station}</b>
                        <span>{utcHms(Date.parse(p.atIso))}Z</span>
                        <span>{(p.volumeMb / 1000).toFixed(1)} Gb</span>
                        <span>{p.durationS}s</span>
                      </div>
                    ))}
                  <p className={s.kpiNote}>
                    Mock — the backend has no datatake-to-pass join, no per-pass volume and no per-pass
                    duration yet. Isolated in <code>data/downlink.ts</code>, same as the globe.
                  </p>
                </div>

                <div className={s.geo}>
                  <span className={s.kpiK}>geography</span>
                  {selected.lat.toFixed(1)}° {selected.lat >= 0 ? "N" : "S"},{" "}
                  {Math.abs(selected.lon).toFixed(1)}° {selected.lon >= 0 ? "E" : "W"}<br />
                  station {selected.station}
                  <p className={s.kpiNote}>
                    A coordinate, not a picture — see the note at the top of the page.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* ---------------- BAND 3 · fleet roll-up ---------------- */}
        <Reveal>
          <div className={s.band}>
            <div className={s.bandHead}>
              <div className={s.bandTitle}>
                <span className={s.bandK}>Band 3</span>
                <h2 className={s.bandN}>Fleet roll-up</h2>
              </div>
              <span className={s.bandK}>four missions, four ladder shapes</span>
            </div>
            <p className={s.bandSub}>
              The same rungs collapsed to one bar per level, rolled up over every datatake that mission
              has in the scenario. The point is the silhouette: Sentinel-5P is two rungs because it
              publishes no Level 0, Sentinel-2's Level 1 is one rung carrying three collapsed
              sub-levels, Sentinel-3's rungs are the widest because it flies four science instruments.
              A three-plate layout has to treat each of those as a special case; a ragged ladder does not.
            </p>
            <div className={s.fleet} style={{ marginTop: 16 }}>
              {MISSIONS.map((m) => {
                const own = ACQ_DATATAKES.filter((d) => missionOf(d.unit) === m);
                const ladder = missionLadder(own);
                const overall = levelMean({
                  level: "L0",
                  products: own.flatMap((d) => d.levels.flatMap((l) => l.products)),
                });
                return (
                  <button key={m} type="button" className={s.mcard}
                    style={{ ["--laneHue" as string]: MISSION_HUE[m] }}
                    aria-pressed={mission === m}
                    onClick={() => pickMission(m)}>
                    <div className={s.mcardTop}>
                      <span className={s.mcardName}>{MISSION_NAME[m]}</span>
                      <span className={`${s.mcardMean} ${s[sev(overall)] ?? ""}`}>
                        {overall === null ? "n/e" : pct1(overall)}
                      </span>
                    </div>
                    <div className={s.mini}>
                      {ladder.map((r) => (
                        <div className={s.miniRow} key={r.level}>
                          <span className={s.miniLab}>{levelLabel(r.level, m).replace("Level ", "L").replace("Unclassified", "n/c")}</span>
                          <span className={s.miniBar}>
                            {r.mean !== null && (
                              <span className={s.miniFill}
                                style={{ width: `${r.mean}%`, ["--segLine" as string]: segHue(r.mean) }} />
                            )}
                          </span>
                          <span className={s.miniVal}>{r.mean === null ? "n/e" : `${r.mean.toFixed(0)}%`}</span>
                        </div>
                      ))}
                    </div>
                    <span className={s.mcardFoot}>
                      {ladder.length} rungs · {own.length} datatake{own.length === 1 ? "" : "s"} ·{" "}
                      {ladder.reduce((n, r) => n + r.types, 0)} product types
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
