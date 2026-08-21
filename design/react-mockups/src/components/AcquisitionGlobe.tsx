import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Station, AcqDatatake, AcqLevel, AcqProductType, ProductLevel } from "@/data/mock";
import { sensingMs, levelMean, missingSeconds, expectedTypes, LEVEL_LABEL } from "@/data/mock";
import { passesFor } from "@/data/downlink";
import { LAND } from "@/data/land";

// Self-contained interactive 3D globe (Canvas 2D — no external libraries):
// shaded Earth + graticule, coastlines, acquisition footprints, station coverage
// circles, three orbit tracks with moving satellites and pulsing datatake markers.
// Drag to rotate, wheel/pinch to zoom, click a footprint to inspect it; a sim-clock
// plays/pauses/scrubs along a track of datatake sensing marks.
//
// Rendering is DEMAND-DRIVEN: nothing is drawn unless invalidate() is called or an
// animation is genuinely running. Animation is gated on four conditions — the sim
// clock playing, the canvas intersecting the viewport, the tab being visible, and
// prefers-reduced-motion being off — so a globe that has scrolled away or sits in a
// background tab costs nothing.
//
// Every animation rate is per-second and scaled by the frame delta, so the globe
// runs at the same speed on a 60 Hz and a 144 Hz display and does not lurch when a
// frame is dropped. Coastline vertices are pre-resolved to unit vectors once per
// decimation level, so a frame costs six multiplies per vertex and no trigonometry.
const D = Math.PI / 180;
const DEG = 180 / Math.PI;
const ORBITS = [
  { inc: 98, omega: 30, col: "#36D0E0", u: 0, sp: 0.9 },
  { inc: 98.6, omega: 150, col: "#2E7DF6", u: 2, sp: 0.78 },
  { inc: 98.2, omega: 255, col: "#9aa7bd", u: 4, sp: 0.84 },
];
const DAY_START = Date.UTC(2026, 6, 16, 0, 0, 0);
const DAY_LEN = 86400000;
const DAY_MIN = 1440; // scrub resolution: one step per simulated minute
const SPEEDS = [10, 60, 300, 1000];
const TILT_LIMIT = 1.45;
const ROVE_KEYS = ["play", "scrub", "speed"] as const; // timeline controls, in tab order

// Rates are per second, not per frame.
const SPIN_RATE = 0.132;      // rad/s of idle auto-rotation
const ORBIT_RATE = 0.24;      // rad/s of orbital phase, before each orbit's sp factor
const PULSE_RATE = 0.0036;    // rad/ms of marker pulse
const DASH_RATE = 0.036;      // px/ms of reticle dash travel
const FLY_DECAY = 0.004;      // fraction of the remaining angle left after one second
const IDLE_RESUME_MS = 9000;  // idle time before the globe picks its own rotation back up
const MAX_FRAME_MS = 48;      // clamp so a stalled tab does not jump the simulation
const LABEL_GAP_PX = 52;      // minimum spacing before a timeline mark shows its id

// Station contact radius, in degrees of great-circle distance. Taken from Anthony's
// globe proposal (18.5°); it is not derived from a link budget here.
const CONTACT_DEG = 18.5;

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}
const clampTilt = (t: number) => Math.max(-TILT_LIMIT, Math.min(TILT_LIMIT, t));
const pad2 = (n: number) => (n < 10 ? "0" : "") + n;
function clockText(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`;
}
const hhmmss = (ms: number) => clockText(ms).slice(11);
const latLonText = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "north" : "south"}, ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "east" : "west"}`;

const unitVec = (lat: number, lon: number): [number, number, number] => {
  const la = lat * D, lo = lon * D, c = Math.cos(la);
  return [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)];
};

// Great-circle distance in degrees, clamped against float drift at the antipodes.
function arcDeg(aLat: number, aLon: number, bLat: number, bLon: number) {
  const p = aLat * D, q = bLat * D;
  return Math.acos(Math.max(-1, Math.min(1, Math.sin(p) * Math.sin(q) + Math.cos(p) * Math.cos(q) * Math.cos((bLon - aLon) * D)))) * DEG;
}

// Ray-casting point-in-polygon in lon/lat, with longitudes unwrapped relative to the
// probe so a ring that straddles the antimeridian still tests correctly.
function inRing(ring: [number, number][], lon: number, lat: number) {
  const un = (l: number) => { let d = l - lon; while (d > 180) d -= 360; while (d < -180) d += 360; return d; };
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = un(ring[i][0]), yi = ring[i][1], xj = un(ring[j][0]), yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && xi + ((lat - yi) / (yj - yi)) * (xj - xi) < 0) inside = !inside;
  }
  return inside;
}

// Small circle of given angular radius around a point — the station coverage ring.
function smallCircle(lat0: number, lon0: number, radiusDeg: number, steps = 60): [number, number][] {
  const p = lat0 * D, r = radiusDeg * D, sp = Math.sin(p), cp = Math.cos(p), sr = Math.sin(r), cr = Math.cos(r);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(Math.max(-1, Math.min(1, sp * cr + cp * sr * Math.cos(th))));
    const lon = lon0 * D + Math.atan2(Math.sin(th) * sr * cp, cr - sp * Math.sin(lat));
    ring.push([((lon * DEG + 540) % 360) - 180, lat * DEG]);
  }
  return ring;
}
const coverageCache = new Map<string, [number, number][]>();
function coverageRing(stn: Station) {
  const key = `${stn.lat},${stn.lon}`;
  let ring = coverageCache.get(key);
  if (!ring) { ring = smallCircle(stn.lat, stn.lon, CONTACT_DEG); coverageCache.set(key, ring); }
  return ring;
}

// Coastline vertices resolved to unit vectors once and memoised per decimation level,
// so a frame never re-runs cos/sin over the coordinate list — it applies the view
// rotation with four trig values computed once and six multiplies per vertex. The
// decimation level is picked from the canvas width, so a narrow canvas carries a
// coarser outline instead of the full 110m detail.
type LandVectors = { count: number; xyz: Float32Array; ringStart: Int32Array };
const landCache = new Map<number, LandVectors>();
function landVectors(decim: number): LandVectors {
  const hit = landCache.get(decim);
  if (hit) return hit;
  const xs: number[] = [];
  const starts: number[] = [];
  const push = (lon: number, lat: number) => { const v = unitVec(lat, lon); xs.push(v[0], v[1], v[2]); };
  for (const ring of LAND) {
    if (ring.length < 4) continue;
    starts.push(xs.length / 3);
    for (let i = 0; i < ring.length; i += decim) push(ring[i][0], ring[i][1]);
    push(ring[0][0], ring[0][1]); // decimation can drop the closing vertex — put it back
  }
  starts.push(xs.length / 3);
  const out: LandVectors = { count: xs.length / 3, xyz: new Float32Array(xs), ringStart: new Int32Array(starts) };
  landCache.set(decim, out);
  return out;
}

// One cached render target per canvas resolution. OffscreenCanvas where available,
// a detached <canvas> otherwise — the two are API-compatible for our 2D use, so the
// cast keeps the call sites free of union types.
type Layer = { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; key: string };
type P = { x: number; y: number; z: number };

/* ==========================================================================
   Datatake rail — completeness plates + downlink passes
   ==========================================================================
   Isometric prisms: the SOLID volume is published sensing, the dashed CAGE above
   it is what is still missing. Each product type of a level gets one prism,
   marching along the plinth. Every prism is drawn to the same full height, because
   each expected product type should cover the whole datatake — which is the same
   assumption behind missingSeconds() in data/mock.ts.

   This is SVG, redrawn only when the selected datatake changes, so it never
   touches the canvas's demand-driven render loop.
   ========================================================================== */
const PW = 20;                 // prism half-width
const PD = 11.55;              // isometric half-depth — PW / sqrt(3), a 30° ground plane
const MARCH = 1.45;            // prism spacing, in units of the isometric axis
const E1X = PW * MARCH, E1Y = PD * MARCH;
const FULL = 58;               // prism height representing 100% of the expected sensing
const CX0 = 44;                // first prism centre, leaving room for the plinth overhang
const Y0 = FULL + PD + 10;     // first prism base, leaving room for the tallest cage
const LABEL_W = 112;
const LABEL_GAP = 17;
const ALARM_BELOW = 95;        // a cage this incomplete is drawn as an alarm
/* Prisms per plate. Missions vary enormously in product-type count — S1 has four
   types at L1, S5P eight, and S3's L2 fourteen across four instruments — so a plate
   has to cap or it marches off the panel. The tail is never dropped silently: it is
   listed underneath with its percentages, and the level mean above is computed over
   ALL types regardless of how many are drawn. */
const MAX_PRISMS = 8;

/* Status glyph for the native datatake dropdown. A native <option> cannot carry a
   styled element, so the colour has to come from the character itself — which is
   how the legacy Acquisitions page does it too. The percentage and status words
   follow in the same label, so the glyph is redundant rather than load-bearing. */
const OPT_DOT: Record<AcqDatatake["cls"], string> = { ok: "🟢", warn: "🟠", crit: "🔴" };

/** "Sentinel-1A" -> "Sentinel-1"; Sentinel-5P flies alone and keeps its name. */
const missionOf = (sat: string) => sat.replace(/[A-C]$/, "");

const TONE: Record<ProductLevel, string> = {
  L0: "#4E6BE8",
  L1: "#8B5CF6",
  L2: "#0FA98C",
  UNKNOWN: "#7E8899",
};

/** Lowest completeness first, "not expected" last — so a cap can only ever hide
    healthy types, never a problem. */
function worstFirst(a: AcqProductType, b: AcqProductType) {
  if (a.pct === null) return b.pct === null ? a.type.localeCompare(b.type) : 1;
  if (b.pct === null) return -1;
  return a.pct - b.pct || a.type.localeCompare(b.type);
}

/** Per-instrument roll-up, for levels spanning more than one instrument (S3 only). */
function byInstrument(products: AcqProductType[]) {
  const acc = new Map<string, { sum: number; n: number; total: number }>();
  for (const p of products) {
    const key = p.instrument ?? "Unattributed";
    const e = acc.get(key) ?? { sum: 0, n: 0, total: 0 };
    e.total++;
    if (p.pct !== null) { e.sum += p.pct; e.n++; }
    acc.set(key, e);
  }
  return [...acc.entries()]
    .map(([name, e]) => ({ name, total: e.total, mean: e.n ? e.sum / e.n : null }))
    .sort((x, y) => x.name.localeCompare(y.name));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const poly = (...p: [number, number][]) => p.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ");
const pctText = (p: number | null) => (p === null ? "n/a" : `${p.toFixed(1)}%`);

/** "3m 25s", "49m 00s", "1h 12m" — durations as operators read them. */
function dur(totalS: number) {
  const s = Math.round(totalS);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${pad2(s % 60)}s`;
  return `${Math.floor(s / 3600)}h ${pad2(Math.floor((s % 3600) / 60))}m`;
}
const groupMb = (n: number) => n.toLocaleString("en-GB");

function Plate({ level }: { level: AcqLevel }) {
  const mean = levelMean(level);
  const ordered = useMemo(() => [...level.products].sort(worstFirst), [level]);
  const products = ordered.slice(0, MAX_PRISMS);
  const hidden = ordered.slice(MAX_PRISMS);
  const instruments = useMemo(() => byInstrument(level.products), [level]);
  const n = products.length;

  const base = (i: number): [number, number] => [CX0 + i * E1X, Y0 + i * E1Y];
  const last = base(n - 1);
  const gutterX = last[0] + 2.1 * PW + 16;
  const width = gutterX + LABEL_W;
  const height = Math.max(last[1] + 2.1 * PD + 8, 14 + n * LABEL_GAP + 8);

  // Plinth: a parallelogram spanned by the two isometric ground axes.
  const p0 = base(0);
  const plinth = poly(
    [p0[0] - 2.1 * PW, p0[1] - 0.1 * PD],
    [p0[0] - 0.1 * PW, p0[1] - 2.1 * PD],
    [last[0] + 2.1 * PW, last[1] + 0.1 * PD],
    [last[0] + 0.1 * PW, last[1] + 2.1 * PD],
  );
  const plinthEdge = poly(
    [p0[0] - 2.1 * PW, p0[1] - 0.1 * PD],
    [last[0] + 0.1 * PW, last[1] + 2.1 * PD],
    [last[0] + 0.1 * PW, last[1] + 2.1 * PD + 5],
    [p0[0] - 2.1 * PW, p0[1] - 0.1 * PD + 5],
  );

  return (
    <figure className="plate" style={{ ["--tone" as string]: TONE[level.level] }}>
      <div className="plate-head">
        <i aria-hidden="true" />
        <span className="name">
          {LEVEL_LABEL[level.level]}
          <em>{level.products.length} type{level.products.length === 1 ? "" : "s"}</em>
        </span>
        <span className="pct num">{mean === null ? "not expected" : `${mean.toFixed(1)}%`}</span>
      </div>

      {/* A level spanning several instruments (only Sentinel-3 does) is unreadable as
          fourteen bare prisms, so it gets a per-instrument roll-up above the plate. */}
      {instruments.length > 1 && (
        <p className="plate-instr">
          {instruments.map((ins) => (
            <span key={ins.name}>
              {ins.name} <b>{ins.mean === null ? "n/a" : `${ins.mean.toFixed(1)}%`}</b>
              <em>{ins.total}</em>
            </span>
          ))}
        </p>
      )}

      <svg
        className="plate-svg"
        viewBox={`0 0 ${r2(width)} ${r2(height)}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={
          `${LEVEL_LABEL[level.level]} production completeness, ${level.products.length} product type${level.products.length === 1 ? "" : "s"}` +
          (mean === null ? ", not expected for this datatake." : `, ${mean.toFixed(1)}% overall.`) +
          (hidden.length ? ` Lowest ${n} drawn, all ${level.products.length} listed.` : "") +
          " " + ordered.map((p) => `${p.type}: ${pctText(p.pct)}`).join(". ") + "."
        }
      >
        <g aria-hidden="true">
          <polygon className="plinth-edge" points={plinthEdge} />
          <polygon className="plinth" points={plinth} />
          {products.slice(0, -1).map((p, i) => {
            const b = base(i);
            const mx = b[0] + 0.725 * E1X, my = b[1] + 0.725 * E1Y;
            return <line key={"r" + p.type} className="plinth-rule" x1={r2(mx + PW)} y1={r2(my - PD)} x2={r2(mx - PW)} y2={r2(my + PD)} />;
          })}

          {products.map((p, i) => {
            const [cx, yb] = base(i);
            const labelY = 14 + i * LABEL_GAP;
            const leader = (
              <>
                <line className="leader" x1={r2(cx + PW)} y1={r2(labelY)} x2={r2(gutterX - 6)} y2={r2(labelY)} />
                <text className="plate-label" x={r2(gutterX)} y={r2(labelY + 3.4)}>{p.type} {pctText(p.pct)}</text>
              </>
            );

            // Not expected for this datatake: no volume at all, just its footprint
            // on the plinth — visibly different from 0% of something expected.
            if (p.pct === null) {
              return (
                <g className="prism-group void" key={p.type}>
                  <polygon className="void-pad" points={poly([cx, yb - PD], [cx + PW, yb], [cx, yb + PD], [cx - PW, yb])} />
                  {leader}
                </g>
              );
            }

            const solid = (p.pct / 100) * FULL;
            const yTop = yb - solid;
            const yCage = yb - FULL;
            const alarm = p.pct < ALARM_BELOW ? " alarm" : "";
            return (
              <g className="prism-group" key={p.type}>
                {solid > 0.4 && (
                  <>
                    <polygon className="prism-left" points={poly([cx - PW, yb], [cx, yb + PD], [cx, yTop + PD], [cx - PW, yTop])} />
                    <polygon className="prism-right" points={poly([cx, yb + PD], [cx + PW, yb], [cx + PW, yTop], [cx, yTop + PD])} />
                    <polygon className="prism-top" points={poly([cx, yTop - PD], [cx + PW, yTop], [cx, yTop + PD], [cx - PW, yTop])} />
                  </>
                )}
                {solid < FULL - 0.4 && (
                  <>
                    <line className={"cage" + alarm} x1={r2(cx + PW)} y1={r2(yTop)} x2={r2(cx + PW)} y2={r2(yCage)} />
                    <line className={"cage" + alarm} x1={r2(cx)} y1={r2(yTop + PD)} x2={r2(cx)} y2={r2(yCage + PD)} />
                    <line className={"cage" + alarm} x1={r2(cx - PW)} y1={r2(yTop)} x2={r2(cx - PW)} y2={r2(yCage)} />
                    <polygon className={"cage-cap" + alarm} points={poly([cx, yCage - PD], [cx + PW, yCage], [cx, yCage + PD], [cx - PW, yCage])} />
                  </>
                )}
                {leader}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Never a silent truncation: the capped tail is the healthiest types, and they
          are named with their percentages so nothing disappears from the record. */}
      {hidden.length > 0 && (
        <p className="plate-more">
          <b>+{hidden.length} not drawn</b>
          <span>{hidden.map((p) => `${p.type} ${pctText(p.pct)}`).join(" · ")}</span>
        </p>
      )}
    </figure>
  );
}

/**
 * Memoised on the selected datatake alone. The globe's own state — station contact
 * flipping during the animation, play/pause, the roving tabindex, the measured
 * track width — re-renders the parent many times over the life of the page; none of
 * it changes `dt`, so none of it reaches the plates.
 */
const DatatakeRail = memo(function DatatakeRail({ dt }: { dt: AcqDatatake }) {
  const m = useMemo(() => {
    const startMs = sensingMs(dt);
    const passes = passesFor(dt.id);
    const all = dt.levels.flatMap((l) => l.products);
    return {
      startMs,
      passes,
      // Levels are whatever this mission actually produces — S5P has no L0 entry at
      // all, S3A carries an UNKNOWN bucket — so an empty level renders nothing rather
      // than an empty plate.
      levels: dt.levels.filter((l) => l.products.length > 0),
      types: expectedTypes(dt.levels).length,
      allTypes: all.length,
      instruments: [...new Set(all.map((p) => p.instrument).filter(Boolean))] as string[],
      missingS: missingSeconds(dt),
      totalMb: passes.reduce((n, p) => n + p.volumeMb, 0),
    };
  }, [dt]);

  const pill = dt.status === "Published" ? "nominal" : dt.status === "Processing" ? "degraded" : "critical";

  return (
    <aside className="dtk-rail" aria-label={`Datatake ${dt.id}`}>
      <div className="dtk-block">
        <div className="dtk-head">
          <span className="sel-id">
            <span className="eyebrow">Datatake</span>
            <span className="dtk-id num">{dt.id}</span>
            <span className="mission">{dt.unit}</span>
          </span>
          <span className={"pill " + pill}>{dt.status}</span>
        </div>

        <div className="dtk-kpi">
          <div className="big num">{dt.comp.toFixed(1)}<sup>%</sup></div>
          <dl className="dtk-aside">
            <div>
              <dt>Sensing</dt>
              <dd className="num">{dur(dt.sensingS)}</dd>
            </div>
            <div>
              {/* Summed across product types, so it can exceed the sensing window —
                  spelled out rather than left to be misread as an interval. */}
              <dt title={`Missing sensing summed across ${m.types} expected product types`}>Missing</dt>
              <dd className={"num" + (m.missingS > 0.5 ? " gap" : "")}>{m.missingS > 0.5 ? dur(m.missingS) : "none"}</dd>
            </div>
          </dl>
        </div>
        <p className="dtk-kpi-note">
          Mean across {m.types} expected product type{m.types === 1 ? "" : "s"}
          {m.allTypes > m.types ? ` (${m.allTypes - m.types} not expected)` : ""} · missing time summed across types
        </p>

        <dl className="meta-grid">
          <div><dt>Sensing start</dt><dd className="num">{m.startMs === null ? "—" : hhmmss(m.startMs) + "Z"}</dd></div>
          <div><dt>Date</dt><dd className="num">{m.startMs === null ? "—" : clockText(m.startMs).slice(0, 10)}</dd></div>
          <div><dt>Mode</dt><dd>{dt.mode}</dd></div>
          <div><dt>Abs. orbit</dt><dd className="num">{dt.absOrbit}</dd></div>
          <div><dt>Station</dt><dd>{dt.station}</dd></div>
          <div><dt>Satellite</dt><dd>{dt.sat}</dd></div>
        </dl>
      </div>

      <div className="dtk-block">
        <div className="block-head">
          <span className="lbl">Production completeness by level</span>
          <span className="eyebrow">Volume = published / expected sensing</span>
        </div>
        <p className="dtk-kpi-note">
          {m.allTypes} product type{m.allTypes === 1 ? "" : "s"} across {m.levels.length} level{m.levels.length === 1 ? "" : "s"}
          {m.instruments.length > 1 ? ` · ${m.instruments.join(", ")}` : m.instruments.length === 1 ? ` · ${m.instruments[0]}` : ""}
        </p>
        <div className="levels-legend">
          {m.levels.map((l) => {
            const v = levelMean(l);
            return (
              <span className="lvl-chip" key={l.level} style={{ ["--tone" as string]: TONE[l.level] }}>
                <i aria-hidden="true" />{LEVEL_LABEL[l.level]} <b>{v === null ? "n/a" : `${v.toFixed(1)}%`}</b>
              </span>
            );
          })}
        </div>
        {m.levels.map((l) => <Plate key={l.level} level={l} />)}
        <p className="plate-key" aria-hidden="true">
          <span className="k-solid" />Published volume
          <span className="k-void" />Missing volume
        </p>
      </div>

      <div className="dtk-block">
        <div className="block-head">
          <span className="lbl">Downlink passes</span>
          <span className="eyebrow">
            {m.passes.length} pass{m.passes.length === 1 ? "" : "es"}
            {m.passes.length > 0 ? ` · ${groupMb(m.totalMb)} Mb` : ""}
          </span>
        </div>
        {m.passes.length === 0 ? (
          <p className="dtk-empty">No downlink passes recorded for this datatake.</p>
        ) : (
          <div className="passes">
            {m.passes.map((p, i) => (
              <div className="pass" key={p.station + i} style={{ ["--c" as string]: TONE[(["L0", "L1", "L2"] as const)[i % 3]] }}>
                <i aria-hidden="true" />
                <span className="who">
                  <b>{p.stationName}</b>
                  <em>{p.station} · acquired {hhmmss(Date.parse(p.atIso))}Z</em>
                </span>
                <span className="fig">
                  {groupMb(p.volumeMb)} Mb
                  <em>{p.durationS}s downlink</em>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="dtk-note">Mock data — the backend has no datatake-to-pass join yet (see data/downlink.ts).</p>
      </div>
    </aside>
  );
});

export default function AcquisitionGlobe({ stations, datatakes, rail = "detail" }: { stations: Station[]; datatakes: AcqDatatake[]; rail?: "detail" | "plates" }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(60);
  const [rove, setRove] = useState(0);          // roving tabindex across the timeline controls
  const [tickRove, setTickRove] = useState(0);  // roving tabindex across the sensing marks
  const [contact, setContact] = useState<string[]>([]);
  const [trackW, setTrackW] = useState(0);

  const selRef = useRef(0);
  const hoverRef = useRef(-1);
  const playingRef = useRef(true);
  const speedRef = useRef(60);
  const invalidateRef = useRef<() => void>(() => {});
  const scrubbingRef = useRef(false);
  const orbits = useRef(ORBITS.map((o) => ({ ...o })));
  const st = useRef({ W: 0, H: 0, dpr: 1, R: 0, baseR: 0, cx: 0, cy: 0, yaw: 0, tilt: -0.42, animMs: 0, zoom: 1, dragging: false, lastX: 0, lastY: 0, moved: 0, simMs: Date.UTC(2026, 6, 16, 11, 4, 22), pinch: 0, targetYaw: 0, targetTilt: -0.42, flying: false, reduce: false, idleFrom: 0 });

  const uid = useId();
  const helpId = `${uid}-help`;
  const trackHelpId = `${uid}-track-help`;
  const selectId = `${uid}-datatake-select`;

  const invalidate = useCallback(() => invalidateRef.current(), []);

  useEffect(() => { setSel(0); selRef.current = 0; setTickRove(0); invalidate(); }, [datatakes, invalidate]);

  // Selecting a datatake (from the list, a footprint, a sensing mark or the
  // screen-reader mirror) rotates the globe so that datatake faces the viewer, so a
  // far-side selection still reveals itself instead of staying hidden behind the globe.
  const select = useCallback((i: number) => {
    const a = datatakes[i];
    if (!a) return;
    setSel(i); selRef.current = i;
    const s = st.current;
    s.targetYaw = a.lon * D;
    s.targetTilt = clampTilt(a.lat * D);
    s.flying = true;
    s.idleFrom = performance.now();
    invalidate();
  }, [datatakes, invalidate]);

  const setZoom = useCallback((z: number) => {
    const s = st.current;
    const next = Math.max(0.6, Math.min(6, z));
    if (next === s.zoom) return false; // at a limit — let the caller leave the gesture alone
    s.zoom = next;
    s.R = s.baseR * next;
    s.idleFrom = performance.now();
    invalidate();
    return true;
  }, [invalidate]);

  useEffect(() => {
    const cv = cvRef.current;
    const stage = stageRef.current;
    if (!cv || !stage) return;
    const ctx = cv.getContext("2d")!;
    const s = st.current;

    // ---- gating: motion preference, viewport intersection, tab visibility ------
    const motionQ = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    s.reduce = !!motionQ?.matches;
    let inView = true;
    let pageVisible = !document.hidden;
    let raf = 0;
    let dirty = true;
    let lastTs = 0;

    const animating = () => !s.reduce && playingRef.current && inView && pageVisible;
    const needsFrame = () => animating() || s.flying;

    // The only entry point that draws anything. Coalesces every caller in a frame
    // into a single render, and starts the loop again if an animation is due.
    function invalidateLocal() {
      dirty = true;
      if (!raf) { lastTs = 0; raf = requestAnimationFrame(tick); }
    }
    invalidateRef.current = invalidateLocal;

    function tick(ts: number) {
      raf = 0;
      // Clamped frame delta: a tab that stalled for two seconds resumes smoothly
      // instead of teleporting the simulation forward.
      const dt = lastTs ? Math.min(MAX_FRAME_MS, ts - lastTs) : 16;
      lastTs = ts;
      let changed = dirty;
      dirty = false;
      if (animating()) { advance(dt); changed = true; }
      if (s.flying) { flyStep(dt); changed = true; }
      if (changed) draw();
      if (needsFrame()) raf = requestAnimationFrame(tick);
    }

    function advance(dt: number) {
      s.animMs += dt;
      // The globe picks its own rotation back up a few seconds after the last
      // interaction, rather than staying frozen forever once the user has dragged it.
      if (!s.flying && !s.dragging && performance.now() - s.idleFrom > IDLE_RESUME_MS) {
        s.yaw += SPIN_RATE * (dt / 1000);
      }
      orbits.current.forEach((o) => (o.u += ORBIT_RATE * o.sp * (dt / 1000)));
      s.simMs += dt * speedRef.current;
      if (s.simMs > DAY_START + DAY_LEN) s.simMs = DAY_START;
      syncClock();
      syncContact();
    }

    // Fly-to easing as exponential decay per unit time, so the approach looks the
    // same regardless of refresh rate. Reduced motion jumps straight to the target.
    function flyStep(dt: number) {
      if (s.reduce) { s.yaw = s.targetYaw; s.tilt = s.targetTilt; s.flying = false; return; }
      let dyaw = s.targetYaw - s.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); // shortest angular path
      const k = 1 - Math.pow(FLY_DECAY, dt / 1000);
      s.yaw += dyaw * k;
      s.tilt += (s.targetTilt - s.tilt) * k;
      if (Math.abs(dyaw) < 0.005 && Math.abs(s.targetTilt - s.tilt) < 0.005) { s.tilt = s.targetTilt; s.flying = false; }
    }

    // Clock + scrub are written imperatively: routing 60 fps of simulated time
    // through React state would re-render the whole panel every frame. While the
    // user is dragging the scrub we leave its value alone so the clock doesn't
    // fight the thumb.
    function syncClock() {
      const txt = clockText(s.simMs);
      const frac = (s.simMs - DAY_START) / DAY_LEN;
      if (clockRef.current) clockRef.current.textContent = txt;
      const sc = scrubbingRef.current ? null : scrubRef.current;
      if (sc) {
        sc.value = String(Math.round(frac * DAY_MIN));
        sc.style.setProperty("--fill", (frac * 100).toFixed(1) + "%");
        sc.setAttribute("aria-valuetext", txt);
      }
    }

    // Station contact does go through React state, because it is announced. Guarded
    // so state only changes when the set of stations in contact actually changes —
    // otherwise every frame would re-render the panel.
    let contactKey = "";
    function syncContact() {
      const sats = orbits.current.map((o) => groundPoint(o, o.u));
      const inContact = stations
        .filter((stn) => sats.some((p) => arcDeg(p.lat, p.lon, stn.lat, stn.lon) < CONTACT_DEG))
        .map((stn) => stn.name);
      const key = inContact.join("|");
      if (key === contactKey) return;
      contactKey = key;
      setContact(inContact);
    }

    // ---- sizing ---------------------------------------------------------------
    function size() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(stage!.clientWidth));
      const h = Math.max(1, Math.round(stage!.clientHeight));
      if (w === s.W && h === s.H && dpr === s.dpr) return;
      s.W = w; s.H = h; s.dpr = dpr;
      cv!.width = Math.round(w * dpr); cv!.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.baseR = Math.min(w, h) * 0.4; s.R = s.baseR * s.zoom;
      s.cx = w * 0.5; s.cy = h * 0.48;
      invalidateLocal();
    }
    const landDecim = () => (s.W < 420 ? 3 : s.W < 780 ? 2 : 1);

    // ---- projection & primitives ---------------------------------------------
    // View rotation cached per draw: the four trig values are computed once, then
    // every vertex is six multiplies.
    let cyw = 1, syw = 0, ctl = 1, stl = 0;
    function refreshView() {
      cyw = Math.cos(s.yaw); syw = Math.sin(s.yaw);
      ctl = Math.cos(s.tilt); stl = Math.sin(s.tilt);
    }
    function projVec(vx: number, vy: number, vz: number): P {
      const x1 = vx * cyw - vz * syw, z1 = vx * syw + vz * cyw;
      const y2 = vy * ctl - z1 * stl, z2 = vy * stl + z1 * ctl;
      return { x: s.cx + x1 * s.R, y: s.cy - y2 * s.R, z: z2 };
    }
    function proj(lat: number, lon: number): P {
      const v = unitVec(lat, lon);
      return projVec(v[0], v[1], v[2]);
    }
    // Screen point back to geographic coordinates — used for footprint picking.
    function unproject(sx: number, sy: number): { lat: number; lon: number } | null {
      const u = (sx - s.cx) / s.R, v = -(sy - s.cy) / s.R;
      const q = u * u + v * v;
      if (q > 1) return null; // off the disc entirely
      const w = Math.sqrt(1 - q);
      const vy = v * ctl + w * stl, z1 = -v * stl + w * ctl;
      const vx = u * cyw + z1 * syw, vz = -u * syw + z1 * cyw;
      return { lat: Math.asin(Math.max(-1, Math.min(1, vy))) * DEG, lon: Math.atan2(vx, vz) * DEG };
    }
    function groundPoint(o: typeof ORBITS[number], u: number) {
      const inc = o.inc * D, om = o.omega * D;
      const lat = Math.asin(Math.sin(inc) * Math.sin(u)) / D;
      const lon = (om + Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u))) / D;
      return { lat, lon };
    }
    function strokePath(c: CanvasRenderingContext2D, pts: P[], style: string, width: number) {
      c.lineWidth = width; c.strokeStyle = style; c.beginPath(); let started = false;
      for (const p of pts) { if (p.z > 0) { started ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); started = true; } else started = false; }
      c.stroke();
    }

    // ---- cached base layer ----------------------------------------------------
    // Sphere shading, graticule and coastlines depend only on the view (yaw / tilt /
    // radius / centre), never on the clock, so they go into an OffscreenCanvas keyed
    // by resolution and are redrawn only when the view key changes. A hover-only or
    // pulse-only frame is then a single blit.
    const layers = new Map<string, Layer>();

    function makeLayer(pw: number, ph: number): Layer {
      const off: HTMLCanvasElement = typeof OffscreenCanvas !== "undefined"
        ? (new OffscreenCanvas(pw, ph) as unknown as HTMLCanvasElement)
        : document.createElement("canvas");
      off.width = pw; off.height = ph;
      const c = off.getContext("2d") as CanvasRenderingContext2D;
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      return { cv: off, ctx: c, key: "" };
    }

    function drawBase(c: CanvasRenderingContext2D) {
      const { cx, cy, R } = s;
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      c.clearRect(0, 0, s.W, s.H);
      const ag = c.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.35);
      ag.addColorStop(0, "rgba(54,140,224,0.18)"); ag.addColorStop(1, "rgba(54,140,224,0)");
      c.fillStyle = ag; c.beginPath(); c.arc(cx, cy, R * 1.35, 0, 6.2832); c.fill();
      const sg = c.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      sg.addColorStop(0, "#14233d"); sg.addColorStop(0.6, "#0c1729"); sg.addColorStop(1, "#070d18");
      c.fillStyle = sg; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fill();
      for (let la = -60; la <= 60; la += 30) {
        const ring: P[] = []; for (let lo = 0; lo <= 360; lo += 5) ring.push(proj(la, lo));
        strokePath(c, ring, la === 0 ? "rgba(54,208,224,0.22)" : "rgba(120,150,190,0.12)", la === 0 ? 1.2 : 1);
      }
      for (let lo2 = 0; lo2 < 360; lo2 += 30) {
        const mer: P[] = []; for (let la2 = -90; la2 <= 90; la2 += 5) mer.push(proj(la2, lo2));
        strokePath(c, mer, "rgba(120,150,190,0.10)", 1);
      }
      // Coastlines from the pre-resolved unit vectors: a soft wide pass reads as
      // landmass, a crisp thin pass draws the coastline on top. Vertices on the far
      // hemisphere are rejected by their depth before anything is stroked.
      const land = landVectors(landDecim());
      const wide = "rgba(88,120,150,0.22)", thin = "rgba(150,182,168,0.62)";
      for (let pass = 0; pass < 2; pass++) {
        c.lineWidth = pass === 0 ? 3.2 : 1;
        c.strokeStyle = pass === 0 ? wide : thin;
        c.beginPath();
        for (let r = 0; r < land.ringStart.length - 1; r++) {
          let started = false;
          for (let i = land.ringStart[r]; i < land.ringStart[r + 1]; i++) {
            const p = projVec(land.xyz[3 * i], land.xyz[3 * i + 1], land.xyz[3 * i + 2]);
            if (p.z > 0) { started ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); started = true; } else started = false;
          }
        }
        c.stroke();
      }
      // Station coverage circles, dashed until a satellite is actually inside them.
      for (const stn of stations) {
        const pts = coverageRing(stn).map(([lon, lat]) => proj(lat, lon));
        c.setLineDash([2, 4]);
        strokePath(c, pts, "rgba(205,217,236,0.22)", 1);
        c.setLineDash([]);
      }
    }

    function baseLayer(): Layer {
      const resKey = `${cv!.width}x${cv!.height}@${s.dpr}`;
      let layer = layers.get(resKey);
      if (!layer) {
        if (layers.size >= 4) layers.clear(); // bounded memo — resizes shouldn't leak buffers
        layer = makeLayer(cv!.width, cv!.height);
        layers.set(resKey, layer);
      }
      const viewKey = `${s.yaw.toFixed(4)}|${s.tilt.toFixed(4)}|${s.R.toFixed(2)}|${s.cx.toFixed(1)}|${s.cy.toFixed(1)}`;
      if (layer.key !== viewKey) { drawBase(layer.ctx); layer.key = viewKey; }
      return layer;
    }

    // ---- footprints ----------------------------------------------------------
    // The acquired swath, not just its centre point. Rings that cross the limb are
    // clipped there: the crossing is interpolated between the two 3D vertices and
    // renormalised onto the sphere, so the fill stops at the horizon instead of
    // wrapping round the wrong side. The canvas is clipped to the globe disc as a
    // safety net for the chord that closes the clipped ring.
    function footprintPath(ring: [number, number][]) {
      const vs = ring.map(([lon, lat]) => unitVec(lat, lon));
      const ps = vs.map((v) => projVec(v[0], v[1], v[2]));
      const path: P[] = [];
      const crossing = (i: number, j: number): P => {
        const a = vs[i], b = vs[j], za = ps[i].z, zb = ps[j].z;
        const t = za / (za - zb);
        let x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t;
        const len = Math.hypot(x, y, z) || 1;
        x /= len; y /= len; z /= len;
        return projVec(x, y, z);
      };
      let any = false;
      for (let i = 0; i < ps.length; i++) {
        const j = (i + 1) % ps.length;
        const vi = ps[i].z > 0, vj = ps[j].z > 0;
        if (vi) { path.push(ps[i]); any = true; }
        if (vi !== vj) path.push(crossing(i, j));
      }
      return any ? path : null;
    }

    function drawFootprint(a: AcqDatatake, col: string, selected: boolean, hovered: boolean) {
      if (!a.footprint || a.footprint.length < 4) return;
      const path = footprintPath(a.footprint);
      if (!path) return;
      ctx.save();
      ctx.beginPath(); ctx.arc(s.cx, s.cy, s.R, 0, 6.2832); ctx.clip();
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = hexA(col, selected ? 0.26 : hovered ? 0.2 : 0.11);
      ctx.fill();
      ctx.strokeStyle = hexA(selected ? "#ffffff" : col, selected ? 0.95 : hovered ? 0.7 : 0.45);
      ctx.lineWidth = selected ? 1.8 : 1.1;
      ctx.stroke();
      ctx.restore();
    }

    const colOf = (a: AcqDatatake) => (a.cls === "ok" ? "#3DD68C" : a.cls === "warn" ? "#F5B544" : "#FF5C6C");

    function draw() {
      refreshView();
      const { cx, cy, R } = s;
      ctx.clearRect(0, 0, s.W, s.H);
      ctx.drawImage(baseLayer().cv, 0, 0, s.W, s.H);

      // Selected last, so its outline is never buried under a neighbour's fill.
      const order = datatakes.map((_, i) => i).sort((a, b) => Number(a === selRef.current) - Number(b === selRef.current));
      for (const i of order) drawFootprint(datatakes[i], colOf(datatakes[i]), selRef.current === i, hoverRef.current === i);

      // The limb goes on top of the footprints so nothing bleeds over the edge.
      ctx.strokeStyle = "rgba(54,208,224,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();

      orbits.current.forEach((o) => {
        const trk: P[] = []; for (let u = 0; u < 6.2832; u += 0.05) { const g = groundPoint(o, u); trk.push(proj(g.lat, g.lon)); }
        strokePath(ctx, trk, hexA(o.col, 0.32), 1.4);
        const g2 = groundPoint(o, o.u), sp = proj(g2.lat, g2.lon);
        if (sp.z > 0) {
          const dx = sp.x - cx, dy = sp.y - cy, ax = cx + dx * 1.07, ay = cy + dy * 1.07;
          ctx.strokeStyle = hexA(o.col, 0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sp.x, sp.y); ctx.lineTo(ax, ay); ctx.stroke();
          ctx.fillStyle = o.col; ctx.shadowColor = o.col; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(ax, ay, 3.2, 0, 6.2832); ctx.fill(); ctx.shadowBlur = 0;
        }
      });

      const sats = orbits.current.map((o) => groundPoint(o, o.u));
      stations.forEach((stn) => {
        const p = proj(stn.lat, stn.lon);
        if (p.z <= 0) return;
        const live = sats.some((q) => arcDeg(q.lat, q.lon, stn.lat, stn.lon) < CONTACT_DEG);
        ctx.strokeStyle = live ? "rgba(54,208,224,0.95)" : "rgba(205,217,236,0.7)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - 4); ctx.lineTo(p.x + 4, p.y); ctx.lineTo(p.x, p.y + 4); ctx.lineTo(p.x - 4, p.y); ctx.closePath();
        ctx.stroke();
        if (live) { ctx.fillStyle = "rgba(54,208,224,0.9)"; ctx.fill(); }
        ctx.font = "10px ui-monospace,monospace";
        ctx.fillStyle = live ? "rgba(54,208,224,0.9)" : "rgba(205,217,236,0.6)";
        ctx.fillText(stn.name, p.x + 8, p.y + 3);
      });

      datatakes.forEach((a, i) => {
        const p = proj(a.lat, a.lon);
        if (p.z <= 0) return;
        const col = colOf(a);
        const pulse = Math.sin(s.animMs * PULSE_RATE + i) * 0.5 + 0.5, rr = 8 + pulse * 7;
        ctx.strokeStyle = hexA(col, 0.6 - pulse * 0.4); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, 6.2832); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(p.x, p.y, 3.4, 0, 6.2832); ctx.fill();
        const isSel = selRef.current === i, isHov = hoverRef.current === i;
        if (isSel || isHov) {
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, rr + 5, 0, 6.2832); ctx.stroke();
          const lx = p.x + rr + (isSel ? 15 : 9);
          ctx.font = "11px ui-monospace,monospace"; ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 4;
          ctx.fillStyle = "#fff"; ctx.fillText(a.id, lx, p.y - 2);
          ctx.fillStyle = "rgba(205,217,236,0.8)"; ctx.fillText(a.sat + " · " + a.comp + "%", lx, p.y + 12);
          ctx.shadowBlur = 0;
        }
        if (isSel) {
          // Locked-on targeting reticle: rotating dashed ring + crosshair ticks.
          const fr = rr + 13;
          ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 5]); ctx.lineDashOffset = -s.animMs * DASH_RATE;
          ctx.beginPath(); ctx.arc(p.x, p.y, fr, 0, 6.2832); ctx.stroke();
          ctx.setLineDash([]); ctx.lineDashOffset = 0;
          ctx.beginPath();
          ctx.moveTo(p.x - fr - 6, p.y); ctx.lineTo(p.x - fr + 4, p.y);
          ctx.moveTo(p.x + fr - 4, p.y); ctx.lineTo(p.x + fr + 6, p.y);
          ctx.moveTo(p.x, p.y - fr - 6); ctx.lineTo(p.x, p.y - fr + 4);
          ctx.moveTo(p.x, p.y + fr - 4); ctx.lineTo(p.x, p.y + fr + 6);
          ctx.stroke();
        }
      });
    }

    // ---- picking --------------------------------------------------------------
    // A footprint is picked when the cursor is genuinely inside its polygon, so the
    // whole swath is the target rather than a radius around its centre. Iterated
    // back-to-front so the topmost overlapping footprint wins; falls back to marker
    // proximity for the small gap between a marker glyph and its swath edge.
    function hit(clientX: number, clientY: number) {
      const r = cv!.getBoundingClientRect();
      const mx = clientX - r.left, my = clientY - r.top;
      const geo = unproject(mx, my);
      if (geo) {
        for (let i = datatakes.length - 1; i >= 0; i--) {
          const f = datatakes[i].footprint;
          if (f && f.length >= 4 && inRing(f, geo.lon, geo.lat)) return i;
        }
      }
      let best = -1, bd = 400;
      datatakes.forEach((a, i) => {
        const p = proj(a.lat, a.lon);
        if (p.z > 0) { const d = (p.x - mx) ** 2 + (p.y - my) ** 2; if (d < bd) { bd = d; best = i; } }
      });
      return best;
    }

    // ---- pointer input --------------------------------------------------------
    // Pointer Events cover mouse, touch and pen in one path, and pointer capture
    // keeps a drag tracking after it leaves the canvas.
    const active = new Map<number, { x: number; y: number }>();

    const onPointerDown = (e: PointerEvent) => {
      active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      s.idleFrom = performance.now();
      if (active.size === 1) {
        s.dragging = true; s.moved = 0; s.flying = false;
        s.lastX = e.clientX; s.lastY = e.clientY;
        cv!.setPointerCapture(e.pointerId);
        cv!.style.cursor = "grabbing";
      } else if (active.size === 2) {
        const [a, b] = [...active.values()];
        s.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        s.dragging = false;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (active.has(e.pointerId)) active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (active.size === 2) {
        const [a, b] = [...active.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (s.pinch) setZoom(s.zoom * (d / s.pinch));
        s.pinch = d;
        return;
      }
      if (s.dragging) {
        const dx = e.clientX - s.lastX, dy = e.clientY - s.lastY;
        s.moved += Math.abs(dx) + Math.abs(dy);
        s.yaw -= dx * 0.005; s.tilt = clampTilt(s.tilt + dy * 0.005);
        s.lastX = e.clientX; s.lastY = e.clientY;
        s.idleFrom = performance.now();
        invalidateLocal();
        return;
      }
      const h = hit(e.clientX, e.clientY);
      if (h !== hoverRef.current) { hoverRef.current = h; invalidateLocal(); }
      cv!.style.cursor = h >= 0 ? "pointer" : "grab";
    };

    const endPointer = (e: PointerEvent) => {
      active.delete(e.pointerId);
      if (active.size < 2) s.pinch = 0;
      if (s.dragging && active.size === 0) { s.dragging = false; cv!.style.cursor = "grab"; }
      s.idleFrom = performance.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasDrag = s.moved > 3;
      endPointer(e);
      if (!wasDrag) { const b = hit(e.clientX, e.clientY); if (b >= 0) select(b); }
    };
    // Pointer capture can fire a leave on the capturing element in some engines, so a
    // drag in progress must not clear the hover.
    const onPointerLeave = () => {
      if (s.dragging) return;
      if (hoverRef.current !== -1) { hoverRef.current = -1; invalidateLocal(); }
    };

    // preventDefault only when the zoom actually moved, so the page still scrolls
    // normally once the globe is at its zoom limit.
    const onWheel = (e: WheelEvent) => { if (setZoom(s.zoom * Math.exp(-e.deltaY * 0.0015))) e.preventDefault(); };

    // Keyboard equivalents for every pointer gesture: arrows rotate the globe the
    // way dragging in that direction would, +/- zoom, 0 resets, [ and ] step
    // through datatakes, Enter/Space plays and pauses the simulation.
    const onKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 0.3 : 0.08;
      const manual = () => { s.flying = false; s.idleFrom = performance.now(); };
      let handled = true;
      switch (e.key) {
        case "ArrowLeft": manual(); s.yaw += step; break;
        case "ArrowRight": manual(); s.yaw -= step; break;
        case "ArrowUp": manual(); s.tilt = clampTilt(s.tilt - step); break;
        case "ArrowDown": manual(); s.tilt = clampTilt(s.tilt + step); break;
        case "+": case "=": manual(); setZoom(s.zoom * 1.3); break;
        case "-": case "_": manual(); setZoom(s.zoom / 1.3); break;
        // Reset hands the rotation straight back to the globe rather than waiting out
        // the idle timer.
        case "0": case "Home": s.zoom = 1; s.R = s.baseR; s.yaw = 0; s.tilt = -0.42; s.flying = false; s.idleFrom = 0; break;
        case "]": case "n": select((selRef.current + 1) % Math.max(1, datatakes.length)); break;
        case "[": case "p": select((selRef.current - 1 + Math.max(1, datatakes.length)) % Math.max(1, datatakes.length)); break;
        case "Enter": case " ": togglePlayRef.current(); break;
        default: handled = false;
      }
      if (handled) { e.preventDefault(); invalidateLocal(); }
    };

    // ---- gating observers ----------------------------------------------------
    const io = new IntersectionObserver((entries) => {
      const now = entries.some((en) => en.isIntersecting);
      if (now === inView) return;
      inView = now;
      if (inView) invalidateLocal(); // resume where we left off
    }, { rootMargin: "80px" });
    io.observe(cv);

    const onVisibility = () => {
      const now = !document.hidden;
      if (now === pageVisible) return;
      pageVisible = now;
      if (pageVisible) invalidateLocal();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onMotionChange = (e: MediaQueryListEvent) => { s.reduce = e.matches; invalidateLocal(); };
    motionQ?.addEventListener?.("change", onMotionChange);

    const ro = new ResizeObserver(size);
    ro.observe(stage);

    cv.addEventListener("pointerdown", onPointerDown);
    cv.addEventListener("pointermove", onPointerMove);
    cv.addEventListener("pointerup", onPointerUp);
    cv.addEventListener("pointercancel", endPointer);
    cv.addEventListener("lostpointercapture", endPointer);
    cv.addEventListener("pointerleave", onPointerLeave);
    cv.addEventListener("wheel", onWheel, { passive: false });
    cv.addEventListener("keydown", onKeyDown);

    size();
    refreshView();
    syncClock();
    syncContact();
    invalidateLocal();

    return () => {
      cancelAnimationFrame(raf);
      invalidateRef.current = () => {};
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQ?.removeEventListener?.("change", onMotionChange);
      cv.removeEventListener("pointerdown", onPointerDown);
      cv.removeEventListener("pointermove", onPointerMove);
      cv.removeEventListener("pointerup", onPointerUp);
      cv.removeEventListener("pointercancel", endPointer);
      cv.removeEventListener("lostpointercapture", endPointer);
      cv.removeEventListener("pointerleave", onPointerLeave);
      cv.removeEventListener("wheel", onWheel);
      cv.removeEventListener("keydown", onKeyDown);
      layers.clear();
    };
    // INVARIANT — keep this dependency list free of anything that changes on
    // selection, hover, playback or contact. `select` depends on [datatakes,
    // invalidate] and `setZoom` on [invalidate], and `invalidate` is stable, so
    // choosing a datatake never re-runs this effect: the canvas, its layer cache and
    // all four observers survive untouched while the rail re-renders beside it.
    // Adding rail state here would tear the canvas down on every click.
  }, [stations, datatakes, select, setZoom]);

  // ---- controls -------------------------------------------------------------
  const togglePlay = useCallback(() => {
    const np = !playingRef.current;
    playingRef.current = np;
    setPlaying(np);
    invalidate(); // resumes the loop when un-pausing, settles on one last frame when pausing
  }, [invalidate]);
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;

  const cycleSpeed = () => {
    const n = SPEEDS[(SPEEDS.indexOf(speedRef.current) + 1) % SPEEDS.length];
    speedRef.current = n; setSpeed(n);
  };
  const seek = useCallback((ms: number) => {
    const s = st.current;
    s.simMs = Math.max(DAY_START, Math.min(DAY_START + DAY_LEN, ms));
    const frac = (s.simMs - DAY_START) / DAY_LEN;
    if (clockRef.current) clockRef.current.textContent = clockText(s.simMs);
    const sc = scrubRef.current;
    if (sc) {
      sc.value = String(Math.round(frac * DAY_MIN));
      sc.style.setProperty("--fill", (frac * 100).toFixed(1) + "%");
      sc.setAttribute("aria-valuetext", clockText(s.simMs));
    }
    invalidate();
  }, [invalidate]);
  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) => seek(DAY_START + (Number(e.target.value) / DAY_MIN) * DAY_LEN);
  const resetView = () => {
    const s = st.current;
    s.zoom = 1; s.R = s.baseR; s.yaw = 0; s.tilt = -0.42; s.flying = false;
    s.idleFrom = 0; // hand the rotation straight back to the globe
    invalidate();
  };

  // Roving tabindex across the timeline toolbar: the group is a single tab stop and
  // Left/Right move between its controls. The scrub slider keeps Up/Down, Home/End
  // and PageUp/PageDown for changing the value, so the two never fight.
  const focusRove = (next: number) => {
    const i = (next + ROVE_KEYS.length) % ROVE_KEYS.length;
    setRove(i);
    barRef.current?.querySelector<HTMLElement>(`[data-rove="${ROVE_KEYS[i]}"]`)?.focus();
  };
  const onBarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); focusRove(rove + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusRove(rove - 1); }
  };
  const roveProps = (key: typeof ROVE_KEYS[number]) => ({
    "data-rove": key,
    tabIndex: ROVE_KEYS[rove] === key ? 0 : -1,
    onFocus: () => setRove(ROVE_KEYS.indexOf(key)),
  });

  // ---- sensing marks --------------------------------------------------------
  // Each datatake's sensing instant as a mark on the simulated day. Marks outside the
  // window are dropped rather than hidden, and a mark only shows its id when there is
  // room for it — otherwise the labels collide as soon as passes cluster.
  const marks = useMemo(() => {
    const all = datatakes
      .map((a, i) => ({ i, a, ms: sensingMs(a) }))
      .filter((m): m is { i: number; a: AcqDatatake; ms: number } => m.ms !== null)
      .map((m) => ({ ...m, pct: ((m.ms - DAY_START) / DAY_LEN) * 100 }))
      .filter((m) => m.pct >= 0 && m.pct <= 100)
      .sort((x, y) => x.ms - y.ms);
    let lastPx = -Infinity;
    return all.map((m) => {
      const px = (m.pct / 100) * trackW;
      const room = px - lastPx >= LABEL_GAP_PX;
      if (room) lastPx = px;
      return { ...m, showLabel: room };
    });
  }, [datatakes, trackW]);

  useEffect(() => { setTickRove((i) => Math.max(0, Math.min(i, marks.length - 1))); }, [marks.length]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackW(el.clientWidth));
    ro.observe(el);
    setTrackW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const focusTick = (next: number) => {
    if (!marks.length) return;
    const i = (next + marks.length) % marks.length;
    setTickRove(i);
    trackRef.current?.querySelector<HTMLElement>(`[data-tick="${i}"]`)?.focus();
  };
  const onTrackKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); focusTick(tickRove + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusTick(tickRove - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusTick(0); }
    else if (e.key === "End") { e.preventDefault(); focusTick(marks.length - 1); }
  };
  const activateMark = (m: { i: number; ms: number }) => { seek(m.ms); select(m.i); };

  const dt = datatakes[sel] ?? datatakes[0];

  // Every datatake in one dropdown, grouped by mission so all four constellations
  // are reachable without a satellite filter in front of them. Mission order is
  // numeric, so Sentinel-5P sorts after Sentinel-3 rather than between 1 and 2.
  const missionGroups = useMemo(() => {
    const byMission = new Map<string, { i: number; a: AcqDatatake }[]>();
    datatakes.forEach((a, i) => {
      const mission = missionOf(a.sat);
      const bucket = byMission.get(mission);
      if (bucket) bucket.push({ i, a }); else byMission.set(mission, [{ i, a }]);
    });
    return [...byMission.entries()]
      .sort((x, y) => x[0].localeCompare(y[0], undefined, { numeric: true }))
      .map(([mission, items]) => ({ mission, items: [...items].sort((p, q) => p.a.id.localeCompare(q.a.id)) }));
  }, [datatakes]);

  // Live description of the canvas for assistive tech. Kept in sync with the
  // selection, playback and station-contact state, and mirrored into a polite live
  // region because a changing aria-label on a role="img" is not itself announced.
  const globeLabel = useMemo(() => {
    const contactText = contact.length
      ? `${contact.length} of ${stations.length} ground stations in contact: ${contact.join(", ")}.`
      : `No ground stations in contact of ${stations.length}.`;
    if (!dt) return "Interactive globe of Sentinel acquisitions. No datatakes match the current filters.";
    return `Interactive globe of Sentinel acquisitions. ${datatakes.length} datatake${datatakes.length === 1 ? "" : "s"} plotted with their footprints. Selected: ${dt.id}, ${dt.sat} downlinking to ${dt.station}, ${dt.comp}% complete, status ${dt.status}, footprint centred at ${latLonText(dt.lat, dt.lon)}. ${contactText} Simulation ${playing ? "playing" : "paused"} at ${speed} times real time.`;
  }, [datatakes, dt, playing, speed, contact, stations.length]);

  if (!dt) return null;

  const pillFor = (st2: string) => (st2 === "Published" ? "nominal" : st2 === "Processing" ? "degraded" : "neutral");

  return (
    <>
      {/* Datatake selector for the proposal variant — replaces the satellite/day
          filter bar and the right column's list panel with one dropdown over every
          mission, the way the legacy Acquisitions page selects a datatake. */}
      {rail === "plates" && (
        <div className="dtk-select">
          <label htmlFor={selectId}>List of Datatakes:</label>
          <span className="dtk-select-field">
            <span className={"dd-dot " + dt.cls} aria-hidden="true" />
            <select
              id={selectId}
              value={sel}
              onChange={(e) => select(Number(e.target.value))}
            >
              {missionGroups.map((g) => (
                <optgroup label={g.mission} key={g.mission}>
                  {g.items.map(({ i, a }) => (
                    <option value={i} key={a.id}>
                      {OPT_DOT[a.cls]}  {a.id} · {a.sat} · {a.comp.toFixed(1)}% · {a.status}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </span>
          <span className="dtk-select-meta">
            {datatakes.length} datatake{datatakes.length === 1 ? "" : "s"} · {missionGroups.length} mission{missionGroups.length === 1 ? "" : "s"}
          </span>
        </div>
      )}

    <div className="acq-layout">
      <div className="globe-card">
        <div className="globe-stage" ref={stageRef}>
          <canvas
            ref={cvRef}
            className="globe-canvas"
            role="img"
            tabIndex={0}
            aria-label={globeLabel}
            aria-describedby={helpId}
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Plus Minus Enter"
          />
          <p className="sr-only" aria-live="polite">{globeLabel}</p>
          <p className="sr-only" id={helpId}>
            Interactive globe. Arrow keys rotate the globe, hold Shift to rotate faster.
            Plus and minus zoom. Zero resets the view. Left and right square brackets step
            through the datatakes. Enter plays or pauses the simulation clock. Every
            footprint is also available as a button in the marker list and the datatake list.
          </p>

          {/* Screen-reader mirror of the canvas footprints: each plotted datatake is
              reachable as a real button without leaving the globe, and focusing one
              highlights it on the canvas. */}
          <div className="sr-only">
            <h4>Datatakes plotted on the globe</h4>
            <ul>
              {datatakes.map((a, i) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => select(i)}
                    onFocus={() => { hoverRef.current = i; invalidate(); }}
                    onBlur={() => { hoverRef.current = -1; invalidate(); }}
                    aria-current={sel === i ? "true" : undefined}
                  >
                    {a.id}, {a.sat} to {a.station}, {a.comp} percent complete, {a.status}
                    {sel === i ? " (selected)" : ""}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="globe-overlay" aria-hidden="true">
            <span className="eyebrow">Live acquisition plan · 3D</span>
            <div className="acq-now">Now acquiring · <b>{dt.sat} → {dt.station}</b></div>
          </div>

          <div className="zoomctl">
            <button type="button" aria-label="Zoom in" onClick={() => setZoom(st.current.zoom * 1.3)}>+</button>
            <button type="button" aria-label="Zoom out" onClick={() => setZoom(st.current.zoom / 1.3)}>−</button>
            <button type="button" aria-label="Reset view" title="Reset view" onClick={resetView}>⌖</button>
          </div>

          <div className="globe-hint" aria-hidden="true">
            <span>scroll to zoom</span><span>drag or arrows to rotate</span><span>click a footprint</span>
          </div>

          <div className="simbar">
            <div
              className="simctl"
              role="toolbar"
              aria-label="Simulation clock"
              aria-orientation="horizontal"
              ref={barRef}
              onKeyDown={onBarKeyDown}
            >
              <button
                type="button"
                className="play"
                aria-label={playing ? "Pause simulation" : "Play simulation"}
                aria-pressed={playing}
                onClick={togglePlay}
                {...roveProps("play")}
              >
                <span aria-hidden="true">{playing ? "❚❚" : "►"}</span>
              </button>
              <div className="simtime">
                <span ref={clockRef}>{clockText(st.current.simMs)}</span>
                <small>SIMULATION TIME</small>
              </div>
              <input
                ref={scrubRef}
                className="scrub"
                type="range"
                min={0}
                max={DAY_MIN}
                step={1}
                defaultValue={Math.round(((st.current.simMs - DAY_START) / DAY_LEN) * DAY_MIN)}
                aria-label="Simulation time of day"
                onChange={onScrub}
                onPointerDown={() => { scrubbingRef.current = true; }}
                onPointerUp={() => { scrubbingRef.current = false; }}
                onPointerCancel={() => { scrubbingRef.current = false; }}
                {...roveProps("scrub")}
              />
              <button
                type="button"
                className="speed"
                aria-label={`Simulation speed ${speed} times real time. Activate to change.`}
                onClick={cycleSpeed}
                {...roveProps("speed")}
              >
                <span aria-hidden="true">×{speed}</span>
              </button>
            </div>

            {/* Sensing marks: one button per datatake at its acquisition time. A
                single tab stop; arrow keys move between marks, Home and End jump to
                the ends. Activating a mark seeks the clock to it and selects it. */}
            <div
              className="simtrack"
              ref={trackRef}
              role="group"
              aria-label="Datatake sensing marks"
              aria-describedby={trackHelpId}
              onKeyDown={onTrackKeyDown}
            >
              <div className="simtrack-axis" aria-hidden="true" />
              {marks.map((m, n) => (
                <button
                  key={m.a.id}
                  type="button"
                  data-tick={n}
                  className={"simtick " + m.a.cls + (sel === m.i ? " sel" : "")}
                  style={{ left: `${m.pct}%` }}
                  tabIndex={n === tickRove ? 0 : -1}
                  aria-current={sel === m.i ? "true" : undefined}
                  aria-label={`${m.a.id}, ${m.a.sat}, sensed ${hhmmss(m.ms)}, ${m.a.comp} percent complete`}
                  onFocus={() => { setTickRove(n); hoverRef.current = m.i; invalidate(); }}
                  onBlur={() => { hoverRef.current = -1; invalidate(); }}
                  onMouseEnter={() => { hoverRef.current = m.i; invalidate(); }}
                  onMouseLeave={() => { hoverRef.current = -1; invalidate(); }}
                  onClick={() => activateMark(m)}
                >
                  <span className="tickid" aria-hidden="true">{m.showLabel ? m.a.id.split("-")[0] : ""}</span>
                  <span className="tickmark" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="sr-only" id={trackHelpId}>
              With the marks focused, left and right arrows move between them, Home and End
              jump to the first and last. Enter seeks the simulation clock to that
              acquisition and selects it on the globe.
            </p>
            <p className="sr-only" aria-live="polite">
              {marks.length} of {datatakes.length} acquisitions fall inside the simulated day.
            </p>
          </div>
        </div>
      </div>

      <div className={"acq-side" + (rail === "plates" ? " acq-side-scroll" : "")}>
        {/* The plates variant selects from the dropdown above, so this panel would be
            a second control called "List of Datatakes". */}
        {rail === "detail" && (
          <div className="acq-list">
            <div className="lh"><span>List of Datatakes</span><span>completeness</span></div>
            {datatakes.map((a, i) => (
              <button
                type="button"
                key={a.id}
                className={"acq-item" + (sel === i ? " sel" : "")}
                aria-current={sel === i ? "true" : undefined}
                onClick={() => select(i)}
                onMouseEnter={() => { hoverRef.current = i; invalidate(); }}
                onMouseLeave={() => { hoverRef.current = -1; invalidate(); }}
                onFocus={() => { hoverRef.current = i; invalidate(); }}
                onBlur={() => { hoverRef.current = -1; invalidate(); }}
              >
                <span className={"sd " + a.cls} aria-hidden="true" />
                <span className="acq-item-text"><span className="id">{a.id}</span><span className="sub">{a.sat} · {a.station}</span></span>
                <span className="pct">{a.comp}%</span>
              </button>
            ))}
          </div>
        )}

        {rail === "plates" ? (
          <DatatakeRail dt={dt} />
        ) : (
          <aside className="acq-detail" aria-label={`Details for datatake ${dt.id}`}>
            <span className="eyebrow">Datatake details</span>
            <h4>{dt.id}</h4>
            <div className="acq-detail-kvs">
              <div className="kv"><span>Satellite</span><span>{dt.sat}</span></div>
              <div className="kv"><span>Station</span><span>{dt.station}</span></div>
              <div className="kv"><span>Footprint</span><span>{Math.abs(dt.lat)}°{dt.lat >= 0 ? "N" : "S"} {Math.abs(dt.lon)}°{dt.lon >= 0 ? "E" : "W"}</span></div>
              <div className="kv"><span>Completeness</span><span>{dt.comp} %</span></div>
              <div className="kv"><span>Status</span><span>{dt.status}</span></div>
            </div>
            <div className="acq-prod-h">Products</div>
            {dt.prods.map((p, i) => (
              <div className="prod-row" key={i}><span><span className="lvl">{p.lvl}</span> · {p.sub}</span><span className={"pill " + pillFor(p.st)}>{p.st}</span></div>
            ))}
          </aside>
        )}
      </div>
    </div>
    </>
  );
}
