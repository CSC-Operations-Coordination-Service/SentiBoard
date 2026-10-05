import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  Station,
  AcqDatatake,
  AcqLevel,
  AcqProductType,
  ProductLevel,
} from "@/data/mock";
import {
  sensingMs,
  levelMean,
  missingSeconds,
  expectedTypes,
  LEVEL_LABEL,
} from "@/data/mock";
import { passesFor } from "@/data/downlink";
import { LAND } from "@/data/land";
import KmlLinkDisplay from "@/components/KmlLinkDisplay";

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
const SPIN_RATE = 0.132; // rad/s of idle auto-rotation
const ORBIT_RATE = 0.24; // rad/s of orbital phase, before each orbit's sp factor
const PULSE_RATE = 0.0036; // rad/ms of marker pulse
const DASH_RATE = 0.036; // px/ms of reticle dash travel
const FLY_DECAY = 0.004; // fraction of the remaining angle left after one second
const IDLE_RESUME_MS = 9000; // idle time before the globe picks its own rotation back up
const MAX_FRAME_MS = 48; // clamp so a stalled tab does not jump the simulation
const LABEL_GAP_PX = 52; // minimum spacing before a timeline mark shows its id

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
  const la = lat * D,
    lo = lon * D,
    c = Math.cos(la);
  return [c * Math.sin(lo), Math.sin(la), c * Math.cos(lo)];
};

// Great-circle distance in degrees, clamped against float drift at the antipodes.
function arcDeg(aLat: number, aLon: number, bLat: number, bLon: number) {
  const p = aLat * D,
    q = bLat * D;
  return (
    Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          Math.sin(p) * Math.sin(q) +
            Math.cos(p) * Math.cos(q) * Math.cos((bLon - aLon) * D),
        ),
      ),
    ) * DEG
  );
}

// Draw ground station icon with parabola dish, receiver, and antenna tower
function drawGroundStationIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = color;

  // Reception waves (arcs) - semi-transparent
  ctx.globalAlpha = 0.55;
  for (let r = 5; r <= 9; r += 2) {
    ctx.beginPath();
    ctx.arc(1.5, -4.5, r, -2.5, -0.9);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Parabola/dish
  ctx.beginPath();
  ctx.ellipse(0, -2.5, 4.6, 2.3, -0.5, 0, Math.PI * 2);
  ctx.fillStyle = hexA(color, 0.25);
  ctx.fill();
  ctx.stroke();

  // Receiver arm
  ctx.beginPath();
  ctx.moveTo(0, -2.5);
  ctx.lineTo(2.6, -5.2);
  ctx.stroke();

  // Receiver element
  ctx.beginPath();
  ctx.arc(2.9, -5.6, 1, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Antenna tower/mast
  ctx.beginPath();
  ctx.moveTo(0, -1.5);
  ctx.lineTo(0, 3.2);
  ctx.stroke();

  // Base structure
  ctx.beginPath();
  ctx.moveTo(-3.4, 3.4);
  ctx.lineTo(3.4, 3.4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-2, 3.4);
  ctx.lineTo(0, 1);
  ctx.lineTo(2, 3.4);
  ctx.stroke();

  ctx.restore();
}

// Draw satellite icon with solar panels, body, and antenna
function drawSatelliteIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
  scale: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Solar panels (wings)
  ctx.fillStyle = hexA(color, 0.18);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  [-1, 1].forEach((d) => {
    ctx.beginPath();
    ctx.rect(d > 0 ? 5 : -13, -3.4, 8, 6.8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(d > 0 ? 9 : -9, -3.4);
    ctx.lineTo(d > 0 ? 9 : -9, 3.4);
    ctx.globalAlpha = 0.55;
    ctx.stroke();
    ctx.globalAlpha = 1;
  });

  // Cross beam
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(5, 0);
  ctx.stroke();

  // Body
  ctx.fillStyle = "#0b141b";
  ctx.beginPath();
  ctx.rect(-4, -4.4, 8, 8.8);
  ctx.fill();
  ctx.stroke();

  // Color panel on body
  ctx.fillStyle = color;
  ctx.fillRect(-2.4, -2.6, 4.8, 2.4);

  // Antenna
  ctx.beginPath();
  ctx.moveTo(0, -4.4);
  ctx.lineTo(0, -8);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, -8.8, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = hexA(color, 0.33);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

// Ray-casting point-in-polygon in lon/lat, with longitudes unwrapped relative to the
// probe so a ring that straddles the antimeridian still tests correctly.
function inRing(ring: [number, number][], lon: number, lat: number) {
  const un = (l: number) => {
    let d = l - lon;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return d;
  };
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = un(ring[i][0]),
      yi = ring[i][1],
      xj = un(ring[j][0]),
      yj = ring[j][1];
    if (yi > lat !== yj > lat && xi + ((lat - yi) / (yj - yi)) * (xj - xi) < 0)
      inside = !inside;
  }
  return inside;
}

// Small circle of given angular radius around a point — the station coverage ring.
function smallCircle(
  lat0: number,
  lon0: number,
  radiusDeg: number,
  steps = 60,
): [number, number][] {
  const p = lat0 * D,
    r = radiusDeg * D,
    sp = Math.sin(p),
    cp = Math.cos(p),
    sr = Math.sin(r),
    cr = Math.cos(r);
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * 2 * Math.PI;
    const lat = Math.asin(
      Math.max(-1, Math.min(1, sp * cr + cp * sr * Math.cos(th))),
    );
    const lon =
      lon0 * D + Math.atan2(Math.sin(th) * sr * cp, cr - sp * Math.sin(lat));
    ring.push([((lon * DEG + 540) % 360) - 180, lat * DEG]);
  }
  return ring;
}
const coverageCache = new Map<string, [number, number][]>();
function coverageRing(stn: Station) {
  const key = `${stn.lat},${stn.lon}`;
  let ring = coverageCache.get(key);
  if (!ring) {
    ring = smallCircle(stn.lat, stn.lon, CONTACT_DEG);
    coverageCache.set(key, ring);
  }
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
  const push = (lon: number, lat: number) => {
    const v = unitVec(lat, lon);
    xs.push(v[0], v[1], v[2]);
  };
  for (const ring of LAND) {
    if (ring.length < 4) continue;
    starts.push(xs.length / 3);
    for (let i = 0; i < ring.length; i += decim) push(ring[i][0], ring[i][1]);
    push(ring[0][0], ring[0][1]); // decimation can drop the closing vertex — put it back
  }
  starts.push(xs.length / 3);
  const out: LandVectors = {
    count: xs.length / 3,
    xyz: new Float32Array(xs),
    ringStart: new Int32Array(starts),
  };
  landCache.set(decim, out);
  return out;
}

// One cached render target per canvas resolution. OffscreenCanvas where available,
// a detached <canvas> otherwise — the two are API-compatible for our 2D use, so the
// cast keeps the call sites free of union types.
type Layer = {
  cv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  key: string;
};
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
const PW = 20; // prism half-width
const PD = 11.55; // isometric half-depth — PW / sqrt(3), a 30° ground plane
const MARCH = 1.45; // prism spacing, in units of the isometric axis
const E1X = PW * MARCH,
  E1Y = PD * MARCH;
const FULL = 58; // prism height representing 100% of the expected sensing
const CX0 = 44; // first prism centre, leaving room for the plinth overhang
const Y0 = FULL + PD + 10; // first prism base, leaving room for the tallest cage
const LABEL_W = 112;
const LABEL_GAP = 17;
const ALARM_BELOW = 95; // a cage this incomplete is drawn as an alarm
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
const OPT_DOT: Record<AcqDatatake["cls"], string> = {
  ok: "🟢",
  warn: "🟠",
  crit: "🔴",
};

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
    if (p.pct !== null) {
      e.sum += p.pct;
      e.n++;
    }
    acc.set(key, e);
  }
  return [...acc.entries()]
    .map(([name, e]) => ({
      name,
      total: e.total,
      mean: e.n ? e.sum / e.n : null,
    }))
    .sort((x, y) => x.name.localeCompare(y.name));
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const poly = (...p: [number, number][]) =>
  p.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" ");
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
    <figure
      className="plate"
      style={{ ["--tone" as string]: TONE[level.level] }}
    >
      <div className="plate-head">
        <i aria-hidden="true" />
        <span className="name">
          {LEVEL_LABEL[level.level]}
          <em>
            {level.products.length} type{level.products.length === 1 ? "" : "s"}
          </em>
        </span>
        <span className="pct num">
          {mean === null ? "not expected" : `${mean.toFixed(1)}%`}
        </span>
      </div>

      {/* A level spanning several instruments (only Sentinel-3 does) is unreadable as
          fourteen bare prisms, so it gets a per-instrument roll-up above the plate. */}
      {instruments.length > 1 && (
        <p className="plate-instr">
          {instruments.map((ins) => (
            <span key={ins.name}>
              {ins.name}{" "}
              <b>{ins.mean === null ? "n/a" : `${ins.mean.toFixed(1)}%`}</b>
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
          (mean === null
            ? ", not expected for this datatake."
            : `, ${mean.toFixed(1)}% overall.`) +
          (hidden.length
            ? ` Lowest ${n} drawn, all ${level.products.length} listed.`
            : "") +
          " " +
          ordered.map((p) => `${p.type}: ${pctText(p.pct)}`).join(". ") +
          "."
        }
      >
        <g aria-hidden="true">
          <polygon className="plinth-edge" points={plinthEdge} />
          <polygon className="plinth" points={plinth} />
          {products.slice(0, -1).map((p, i) => {
            const b = base(i);
            const mx = b[0] + 0.725 * E1X,
              my = b[1] + 0.725 * E1Y;
            return (
              <line
                key={"r" + p.type}
                className="plinth-rule"
                x1={r2(mx + PW)}
                y1={r2(my - PD)}
                x2={r2(mx - PW)}
                y2={r2(my + PD)}
              />
            );
          })}

          {products.map((p, i) => {
            const [cx, yb] = base(i);
            const labelY = 14 + i * LABEL_GAP;
            const leader = (
              <>
                <line
                  className="leader"
                  x1={r2(cx + PW)}
                  y1={r2(labelY)}
                  x2={r2(gutterX - 6)}
                  y2={r2(labelY)}
                />
                <text
                  className="plate-label"
                  x={r2(gutterX)}
                  y={r2(labelY + 3.4)}
                >
                  {p.type} {pctText(p.pct)}
                </text>
              </>
            );

            // Not expected for this datatake: no volume at all, just its footprint
            // on the plinth — visibly different from 0% of something expected.
            if (p.pct === null) {
              return (
                <g className="prism-group void" key={p.type}>
                  <polygon
                    className="void-pad"
                    points={poly(
                      [cx, yb - PD],
                      [cx + PW, yb],
                      [cx, yb + PD],
                      [cx - PW, yb],
                    )}
                  />
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
                    <polygon
                      className="prism-left"
                      points={poly(
                        [cx - PW, yb],
                        [cx, yb + PD],
                        [cx, yTop + PD],
                        [cx - PW, yTop],
                      )}
                    />
                    <polygon
                      className="prism-right"
                      points={poly(
                        [cx, yb + PD],
                        [cx + PW, yb],
                        [cx + PW, yTop],
                        [cx, yTop + PD],
                      )}
                    />
                    <polygon
                      className="prism-top"
                      points={poly(
                        [cx, yTop - PD],
                        [cx + PW, yTop],
                        [cx, yTop + PD],
                        [cx - PW, yTop],
                      )}
                    />
                  </>
                )}
                {solid < FULL - 0.4 && (
                  <>
                    <line
                      className={"cage" + alarm}
                      x1={r2(cx + PW)}
                      y1={r2(yTop)}
                      x2={r2(cx + PW)}
                      y2={r2(yCage)}
                    />
                    <line
                      className={"cage" + alarm}
                      x1={r2(cx)}
                      y1={r2(yTop + PD)}
                      x2={r2(cx)}
                      y2={r2(yCage + PD)}
                    />
                    <line
                      className={"cage" + alarm}
                      x1={r2(cx - PW)}
                      y1={r2(yTop)}
                      x2={r2(cx - PW)}
                      y2={r2(yCage)}
                    />
                    <polygon
                      className={"cage-cap" + alarm}
                      points={poly(
                        [cx, yCage - PD],
                        [cx + PW, yCage],
                        [cx, yCage + PD],
                        [cx - PW, yCage],
                      )}
                    />
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
          <span>
            {hidden.map((p) => `${p.type} ${pctText(p.pct)}`).join(" · ")}
          </span>
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
const DatatakeRail = memo(function DatatakeRail({ dt, onClose }: { dt: AcqDatatake; onClose: () => void }) {
  const m = useMemo(() => {
    const startMs = sensingMs(dt);
    const passes = passesFor(dt.id);
    const all = dt.levels.flatMap((l) => l.products);
    return {
      startMs,
      passes,
      levels: dt.levels.filter((l) => l.products.length > 0),
      types: expectedTypes(dt.levels).length,
      allTypes: all.length,
      instruments: [
        ...new Set(all.map((p) => p.instrument).filter(Boolean)),
      ] as string[],
      missingS: missingSeconds(dt),
      totalMb: passes.reduce((n, p) => n + p.volumeMb, 0),
    };
  }, [dt]);

  const pill =
    dt.status === "Published"
      ? "nominal"
      : dt.status === "Processing"
        ? "degraded"
        : "critical";

  return (
    <aside className="dtk-rail" aria-label={`Datatake ${dt.id}`}>
      <div className="dtk-block">
        {/* Header */}
        <div className="dtk-header">
          <div className="dtk-header-left">
            <span className="eyebrow">DATATAKE</span>
          </div>
          <div className="dtk-header-right">
            <span className={"pill-badge " + pill}>
              <span className="dot"></span>
              {dt.status}
            </span>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Datatake Title */}
        <div className="dtk-title">
          <h2>{dt.id}</h2>
          <div className="unit">{dt.unit}</div>
        </div>

        {/* KPI Section */}
        <div className="dtk-kpi">
          <div className="kpi-left">
            <div className="big-percentage">
              {dt.comp.toFixed(1)}<span className="percent">%</span>
            </div>
          </div>
          <div className="kpi-right">
            <div className="kpi-item">
              <div className="kpi-label">SENSING</div>
              <div className="kpi-value">{dur(dt.sensingS)}</div>
            </div>
            <div className="kpi-item">
              <div className="kpi-label">MISSING</div>
              <div className="kpi-value">{m.missingS > 0.5 ? dur(m.missingS) : "none"}</div>
            </div>
          </div>
        </div>
        <p className="dtk-kpi-note">
          Mean across {m.types} expected product type{m.types === 1 ? "" : "s"} · missing time summed across types
        </p>

        {/* Metadata List - Single Column */}
        <dl className="meta-list">
          <div className="meta-row">
            <dt>SATELLITE ID</dt>
            <dd>{dt.sat}</dd>
          </div>
          <div className="meta-row">
            <dt>DATATAKE ID</dt>
            <dd>{dt.id}</dd>
          </div>
          <div className="meta-row">
            <dt>MODE</dt>
            <dd>{dt.mode || "NA"}</dd>
          </div>
          <div className="meta-row">
            <dt>SWATH</dt>
            <dd>NA</dd>
          </div>
          <div className="meta-row">
            <dt>POLARISATION</dt>
            <dd>NA</dd>
          </div>
          <div className="meta-row">
            <dt>OBSERVATION TIME START</dt>
            <dd>
              {m.startMs === null ? "—" : clockText(m.startMs)}
            </dd>
          </div>
          <div className="meta-row">
            <dt>OBSERVATION TIME STOP</dt>
            <dd>
              {m.startMs === null ? "—" : clockText(m.startMs + dt.sensingS * 1000)}
            </dd>
          </div>
          <div className="meta-row">
            <dt>OBSERVATION DURATION</dt>
            <dd>{dur(dt.sensingS)}</dd>
          </div>
          <div className="meta-row">
            <dt>ORBIT ABSOLUTE</dt>
            <dd>{dt.absOrbit}</dd>
          </div>
          <div className="meta-row">
            <dt>ORBIT RELATIVE</dt>
            <dd>{(dt as any).relOrbit || "80"}</dd>
          </div>
          <div className="meta-row">
            <dt>ACQUISITION STATUS</dt>
            <dd>Acquired (100.00%)</dd>
          </div>
          <div className="meta-row">
            <dt>PUBLICATION STATUS</dt>
            <dd>{dt.status} ({(dt.comp * 100).toFixed(2)}%)</dd>
          </div>
          <div className="meta-row">
            <dt>DOWNLINK STATION</dt>
            <dd>{dt.station}</dd>
          </div>
          <div className="meta-row">
            <dt>DOWNLINK TIME</dt>
            <dd>
              {m.passes && m.passes.length > 0
                ? clockText(
                    (m.startMs ?? 0) + 24 * 60 * 60 * 1000
                  )
                : "—"}
            </dd>
          </div>
          <div className="meta-row">
            <dt>DOWNLINK VOLUME</dt>
            <dd>{(m.totalMb).toFixed(0)} Mb</dd>
          </div>
          <div className="meta-row last">
            <dt>DOWNLINK DURATION</dt>
            <dd>{dur(m.totalMb / 50)}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
});

function getDayFromIso(startIso: string): string {
  return startIso.split("T")[0];
}

export default function AcquisitionGlobeEarth({
  stations,
  datatakes,
  rail = "detail",
}: {
  stations: Station[];
  datatakes: AcqDatatake[];
  rail?: "detail" | "plates";
}) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const [sel, setSel] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(60);
  const [rove, setRove] = useState(0); // roving tabindex across the timeline controls
  const [tickRove, setTickRove] = useState(0); // roving tabindex across the sensing marks
  const [contact, setContact] = useState<string[]>([]);
  const [trackW, setTrackW] = useState(0);
  const [satFilter, setSatFilter] = useState("*");
  const [dayFilter, setDayFilter] = useState("*");
  const [calendarMonth, setCalendarMonth] = useState(6); // 0-11
  const [calendarYear, setCalendarYear] = useState(2026);
  const [isDark, setIsDark] = useState(() => {
    const theme = document.documentElement.getAttribute("data-theme");
    if (theme) return theme === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
  });
  const [zen, setZen] = useState(false);

  const selRef = useRef(0);
  const hoverRef = useRef(-1);
  const playingRef = useRef(true);
  const speedRef = useRef(60);
  const invalidateRef = useRef<() => void>(() => {});
  const scrubbingRef = useRef(false);
  const isDarkRef = useRef(isDark);
  const orbits = useRef(ORBITS.map((o) => ({ ...o })));
  const st = useRef({
    W: 0,
    H: 0,
    dpr: 1,
    R: 0,
    baseR: 0,
    cx: 0,
    cy: 0,
    yaw: 0,
    tilt: -0.42,
    animMs: 0,
    zoom: 1,
    dragging: false,
    lastX: 0,
    lastY: 0,
    moved: 0,
    simMs: Date.UTC(2026, 6, 16, 11, 4, 22),
    pinch: 0,
    targetYaw: 0,
    targetTilt: -0.42,
    flying: false,
    reduce: false,
    idleFrom: 0,
  });

  const uid = useId();
  const helpId = `${uid}-help`;
  const trackHelpId = `${uid}-track-help`;
  const selectId = `${uid}-datatake-select`;

  const invalidate = useCallback(() => invalidateRef.current(), []);

  const filteredDatatakes = useMemo(() => {
    return datatakes.filter((dt) => {
      if (satFilter !== "*" && dt.sat !== satFilter) return false;
      if (dayFilter !== "*" && getDayFromIso(dt.startIso) !== dayFilter)
        return false;
      return true;
    });
  }, [datatakes, satFilter, dayFilter]);

  const uniqueSatellites = useMemo(() => {
    const sats = new Set(datatakes.map((dt) => dt.sat));
    return Array.from(sats).sort();
  }, [datatakes]);

  useEffect(() => {
    setSel(0);
    selRef.current = 0;
    setTickRove(0);
    invalidate();
  }, [datatakes, invalidate]);

  // Keep ref in sync with state so drawBase reads current value
  useEffect(() => {
    isDarkRef.current = isDark;
    invalidate();
  }, [isDark, invalidate]);

  // Selecting a datatake (from the list, a footprint, a sensing mark or the
  // screen-reader mirror) rotates the globe so that datatake faces the viewer, so a
  // far-side selection still reveals itself instead of staying hidden behind the globe.
  const select = useCallback(
    (i: number) => {
      const a = filteredDatatakes[i];
      if (!a) return;
      setSel(i);
      setShowDetails(true);
      selRef.current = i;
      const s = st.current;
      s.targetYaw = a.lon * D;
      s.targetTilt = clampTilt(a.lat * D);
      s.flying = true;
      s.idleFrom = performance.now();
      invalidate();
    },
    [filteredDatatakes, invalidate],
  );

  const setZoom = useCallback(
    (z: number) => {
      const s = st.current;
      const next = Math.max(0.6, Math.min(6, z));
      if (next === s.zoom) return false; // at a limit — let the caller leave the gesture alone
      s.zoom = next;
      s.R = s.baseR * next;
      s.idleFrom = performance.now();
      invalidate();
      return true;
    },
    [invalidate],
  );

  useEffect(() => {
    const cv = cvRef.current;
    const stage = stageRef.current;
    if (!cv || !stage) return;
    const ctx = cv.getContext("2d")!;
    const s = st.current;

    // ---- gating: motion preference, viewport intersection, tab visibility ------
    const motionQ = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    s.reduce = !!motionQ?.matches;

    // Listen to system preference (fallback when no data-theme attribute)
    const themeQ = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onThemeChange = (e: MediaQueryListEvent) => {
      const theme = document.documentElement.getAttribute("data-theme");
      if (!theme) {
        // Only update if app theme isn't overriding
        setIsDark(e.matches); // useEffect will handle the invalidation
      }
    };
    themeQ?.addEventListener?.("change", onThemeChange);

    const themeObserver = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute("data-theme");
      const newIsDark =
        theme === "dark" ||
        (!theme &&
          (window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ??
            true));
      setIsDark(newIsDark);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    let inView = true;
    let pageVisible = !document.hidden;
    let raf = 0;
    let dirty = true;
    let lastTs = 0;

    const animating = () =>
      !s.reduce && playingRef.current && inView && pageVisible;
    const needsFrame = () => animating() || s.flying;

    // The only entry point that draws anything. Coalesces every caller in a frame
    // into a single render, and starts the loop again if an animation is due.
    function invalidateLocal() {
      dirty = true;
      if (!raf) {
        lastTs = 0;
        raf = requestAnimationFrame(tick);
      }
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
      if (animating()) {
        advance(dt);
        changed = true;
      }
      if (s.flying) {
        flyStep(dt);
        changed = true;
      }
      if (changed) draw();
      if (needsFrame()) raf = requestAnimationFrame(tick);
    }

    function advance(dt: number) {
      s.animMs += dt;
      // The globe picks its own rotation back up a few seconds after the last
      // interaction, rather than staying frozen forever once the user has dragged it.
      if (
        !s.flying &&
        !s.dragging &&
        performance.now() - s.idleFrom > IDLE_RESUME_MS
      ) {
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
      if (s.reduce) {
        s.yaw = s.targetYaw;
        s.tilt = s.targetTilt;
        s.flying = false;
        return;
      }
      let dyaw = s.targetYaw - s.yaw;
      dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw)); // shortest angular path
      const k = 1 - Math.pow(FLY_DECAY, dt / 1000);
      s.yaw += dyaw * k;
      s.tilt += (s.targetTilt - s.tilt) * k;
      if (Math.abs(dyaw) < 0.005 && Math.abs(s.targetTilt - s.tilt) < 0.005) {
        s.tilt = s.targetTilt;
        s.flying = false;
      }
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
        .filter((stn) =>
          sats.some(
            (p) => arcDeg(p.lat, p.lon, stn.lat, stn.lon) < CONTACT_DEG,
          ),
        )
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
      s.W = w;
      s.H = h;
      s.dpr = dpr;
      cv!.width = Math.round(w * dpr);
      cv!.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.baseR = Math.min(w, h) * 0.4;
      s.R = s.baseR * s.zoom;
      s.cx = w * 0.5;
      s.cy = h * 0.48;
      invalidateLocal();
    }
    const landDecim = () => (s.W < 420 ? 3 : s.W < 780 ? 2 : 1);

    // ---- projection & primitives ---------------------------------------------
    // View rotation cached per draw: the four trig values are computed once, then
    // every vertex is six multiplies.
    let cyw = 1,
      syw = 0,
      ctl = 1,
      stl = 0;
    function refreshView() {
      cyw = Math.cos(s.yaw);
      syw = Math.sin(s.yaw);
      ctl = Math.cos(s.tilt);
      stl = Math.sin(s.tilt);
    }
    function projVec(vx: number, vy: number, vz: number): P {
      const x1 = vx * cyw - vz * syw,
        z1 = vx * syw + vz * cyw;
      const y2 = vy * ctl - z1 * stl,
        z2 = vy * stl + z1 * ctl;
      return { x: s.cx + x1 * s.R, y: s.cy - y2 * s.R, z: z2 };
    }
    function proj(lat: number, lon: number): P {
      const v = unitVec(lat, lon);
      return projVec(v[0], v[1], v[2]);
    }
    // Screen point back to geographic coordinates — used for footprint picking.
    function unproject(
      sx: number,
      sy: number,
    ): { lat: number; lon: number } | null {
      const u = (sx - s.cx) / s.R,
        v = -(sy - s.cy) / s.R;
      const q = u * u + v * v;
      if (q > 1) return null; // off the disc entirely
      const w = Math.sqrt(1 - q);
      const vy = v * ctl + w * stl,
        z1 = -v * stl + w * ctl;
      const vx = u * cyw + z1 * syw,
        vz = -u * syw + z1 * cyw;
      return {
        lat: Math.asin(Math.max(-1, Math.min(1, vy))) * DEG,
        lon: Math.atan2(vx, vz) * DEG,
      };
    }
    function groundPoint(o: (typeof ORBITS)[number], u: number) {
      const inc = o.inc * D,
        om = o.omega * D;
      const lat = Math.asin(Math.sin(inc) * Math.sin(u)) / D;
      const lon =
        (om + Math.atan2(Math.cos(inc) * Math.sin(u), Math.cos(u))) / D;
      return { lat, lon };
    }
    function strokePath(
      c: CanvasRenderingContext2D,
      pts: P[],
      style: string,
      width: number,
    ) {
      c.lineWidth = width;
      c.strokeStyle = style;
      c.beginPath();
      let started = false;
      for (const p of pts) {
        if (p.z > 0) {
          started ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y);
          started = true;
        } else started = false;
      }
      c.stroke();
    }

    // ---- cached base layer ----------------------------------------------------
    // Sphere shading, graticule and coastlines depend only on the view (yaw / tilt /
    // radius / centre), never on the clock, so they go into an OffscreenCanvas keyed
    // by resolution and are redrawn only when the view key changes. A hover-only or
    // pulse-only frame is then a single blit.
    const layers = new Map<string, Layer>();

    function makeLayer(pw: number, ph: number): Layer {
      const off: HTMLCanvasElement =
        typeof OffscreenCanvas !== "undefined"
          ? (new OffscreenCanvas(pw, ph) as unknown as HTMLCanvasElement)
          : document.createElement("canvas");
      off.width = pw;
      off.height = ph;
      const c = off.getContext("2d") as CanvasRenderingContext2D;
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
      return { cv: off, ctx: c, key: "" };
    }

    function drawBase(c: CanvasRenderingContext2D) {
      const { cx, cy, R } = s;
      c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);

      // 1. Outer canvas background
      c.fillStyle = "#020409";
      c.fillRect(0, 0, s.W, s.H);

      // 2. Background stars
      c.fillStyle = "rgba(255, 255, 255, 0.08)";
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * s.W;
        const y = Math.random() * s.H;
        const size = Math.random() * 0.8;
        c.beginPath();
        c.arc(x, y, size, 0, 6.2832);
        c.fill();
      }

      // 3. Soft atmospheric outer glow
      const atmHalo = c.createRadialGradient(
        cx,
        cy,
        R * 0.96,
        cx,
        cy,
        R * 1.35,
      );
      atmHalo.addColorStop(0, "rgba(20, 75, 140, 0.35)");
      atmHalo.addColorStop(0.5, "rgba(12, 45, 90, 0.15)");
      atmHalo.addColorStop(1, "rgba(2, 4, 9, 0)");
      c.fillStyle = atmHalo;
      c.beginPath();
      c.arc(cx, cy, R * 1.35, 0, 6.2832);
      c.fill();

      // 4. Base ocean sphere fill - Deep Dark Navy
      c.fillStyle = "#0d1f33";
      c.beginPath();
      c.arc(cx, cy, R, 0, 6.2832);
      c.fill();

      // 4B. Subtle Graticule Grid Lines (Latitude / Longitude)
      c.strokeStyle = "rgba(45, 95, 145, 0.18)";
      c.lineWidth = 0.7;

      // 5. Landmass rendering
      const land = landVectors(landDecim());

      // --- A. Landmass Fill (Steel Blue-Gray) ---
      c.fillStyle = "#1f364d";
      c.beginPath();
      for (let r = 0; r < land.ringStart.length - 1; r++) {
        let started = false;
        for (let i = land.ringStart[r]; i < land.ringStart[r + 1]; i++) {
          const p = projVec(
            land.xyz[3 * i],
            land.xyz[3 * i + 1],
            land.xyz[3 * i + 2],
          );
          if (p.z > 0) {
            if (!started) {
              c.moveTo(p.x, p.y);
              started = true;
            } else {
              c.lineTo(p.x, p.y);
            }
          } else if (started) {
            c.closePath();
            started = false;
          }
        }
        if (started) c.closePath();
      }
      c.fill();

      // --- B. Globe Lighting Overlay (Darkens edges & creates depth) ---
      const globeShading = c.createRadialGradient(
        cx - R * 0.3,
        cy - R * 0.3,
        R * 0.2,
        cx,
        cy,
        R,
      );
      globeShading.addColorStop(0, "rgba(255, 255, 255, 0.07)");
      globeShading.addColorStop(0.6, "rgba(0, 0, 0, 0)");
      globeShading.addColorStop(1, "rgba(0, 5, 15, 0.55)");

      c.fillStyle = globeShading;
      c.beginPath();
      c.arc(cx, cy, R, 0, 6.2832);
      c.fill();

      // --- C. Crisp Coastline Outlines ---
      c.strokeStyle = "#3872a3";
      c.lineWidth = 0.8;
      c.beginPath();
      for (let r = 0; r < land.ringStart.length - 1; r++) {
        let prevP: { x: number; y: number; z: number } | null = null;
        for (let i = land.ringStart[r]; i < land.ringStart[r + 1]; i++) {
          const p = projVec(
            land.xyz[3 * i],
            land.xyz[3 * i + 1],
            land.xyz[3 * i + 2],
          );
          if (p.z > 0 && prevP && prevP.z > 0) {
            c.moveTo(prevP.x, prevP.y);
            c.lineTo(p.x, p.y);
          }
          prevP = p;
        }
      }
      c.stroke();

      // 6. Globe Rim Outline
      c.strokeStyle = "rgba(45, 120, 190, 0.65)";
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(cx, cy, R, 0, 6.2832);
      c.stroke();
    }

    function baseLayer(): Layer {
      const resKey = `${cv!.width}x${cv!.height}@${s.dpr}`;
      let layer = layers.get(resKey);
      if (!layer) {
        if (layers.size >= 4) layers.clear(); // bounded memo — resizes shouldn't leak buffers
        layer = makeLayer(cv!.width, cv!.height);
        layers.set(resKey, layer);
      }
      const viewKey = `${s.yaw.toFixed(4)}|${s.tilt.toFixed(4)}|${s.R.toFixed(2)}|${s.cx.toFixed(1)}|${s.cy.toFixed(1)}|${isDarkRef.current}`;
      if (layer.key !== viewKey) {
        drawBase(layer.ctx);
        layer.key = viewKey;
      }
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
        const a = vs[i],
          b = vs[j],
          za = ps[i].z,
          zb = ps[j].z;
        const t = za / (za - zb);
        let x = a[0] + (b[0] - a[0]) * t,
          y = a[1] + (b[1] - a[1]) * t,
          z = a[2] + (b[2] - a[2]) * t;
        const len = Math.hypot(x, y, z) || 1;
        x /= len;
        y /= len;
        z /= len;
        return projVec(x, y, z);
      };
      let any = false;
      for (let i = 0; i < ps.length; i++) {
        const j = (i + 1) % ps.length;
        const vi = ps[i].z > 0,
          vj = ps[j].z > 0;
        if (vi) {
          path.push(ps[i]);
          any = true;
        }
        if (vi !== vj) path.push(crossing(i, j));
      }
      return any ? path : null;
    }

    function drawFootprint(
      a: AcqDatatake,
      col: string,
      selected: boolean,
      hovered: boolean,
    ) {
      if (!a.footprint || a.footprint.length < 4) return;
      const path = footprintPath(a.footprint);
      if (!path) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.R, 0, 6.2832);
      ctx.clip();

      // Multi-layer footprint fill with enhanced depth
      if (selected || hovered) {
        // Shadow layer
        ctx.beginPath();
        path.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        ctx.fillStyle = hexA(col, 0.12);
        ctx.fill();
      }

      // Main translucent fill layer - larger and more prominent
      ctx.beginPath();
      path.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = hexA(col, selected ? 0.35 : hovered ? 0.28 : 0.15);
      ctx.fill();

      // Solid outline with enhanced visibility
      ctx.strokeStyle = hexA(
        selected ? "#ffffff" : col,
        selected ? 0.95 : hovered ? 0.8 : 0.6,
      );
      ctx.lineWidth = selected ? 2.2 : hovered ? 1.5 : 1.3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.restore();
    }

    const colOf = (a: AcqDatatake) => {
      if (isDarkRef.current) {
        return a.cls === "ok"
          ? "#3DD68C"
          : a.cls === "warn"
            ? "#F5B544"
            : "#FF5C6C";
      } else {
        // Light mode: darken orange/red for better contrast
        return a.cls === "ok"
          ? "#3DD68C"
          : a.cls === "warn"
            ? "#c2410c"
            : "#b91c1c";
      }
    };

    function draw() {
      refreshView();
      const { cx, cy, R } = s;
      // Deep dark background matching atmosphere
      ctx.fillStyle = "#05070b";
      ctx.fillRect(0, 0, s.W, s.H);
      ctx.drawImage(baseLayer().cv, 0, 0, s.W, s.H);

      const limbColor = isDark
        ? "rgba(0,210,255,0.5)"
        : "rgba(59,130,246,0.25)";
      const stationLiveColor = isDark
        ? "rgba(0,240,255,1)"
        : "rgba(59,130,246,0.85)";
      const stationIdleColor = isDark
        ? "rgba(0,180,216,0.8)"
        : "rgba(100,116,139,0.5)";
      const stationLiveLabel = isDark
        ? "rgba(255,255,255,1)"
        : "rgba(59,130,246,0.8)";
      const stationIdleLabel = isDark
        ? "rgba(255,255,255,0.8)"
        : "rgba(100,116,139,0.45)";
      const datatakeLabelDetail = isDark
        ? "rgba(205,217,236,0.8)"
        : "rgba(71,85,105,0.7)";
      const labelShadow = isDark ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";

      // Selected last, so its outline is never buried under a neighbour's fill.
      const order = filteredDatatakes
        .map((_, i) => i)
        .sort(
          (a, b) => Number(a === selRef.current) - Number(b === selRef.current),
        );
      for (const i of order)
        drawFootprint(
          filteredDatatakes[i],
          colOf(filteredDatatakes[i]),
          selRef.current === i,
          hoverRef.current === i,
        );

      // The limb goes on top of the footprints with enhanced glow and definition
      ctx.strokeStyle = limbColor;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, 6.2832);
      ctx.stroke();

      // Inner limb shadow for depth
      ctx.strokeStyle = isDarkRef.current
        ? "rgba(0,0,0,0.4)"
        : "rgba(0,0,0,0.1)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 0.5, 0, 6.2832);
      ctx.stroke();

      // Calculate current satellite positions for contact detection
      const sats = orbits.current.map((o) => groundPoint(o, o.u));

      orbits.current.forEach((o, idx) => {
        // Orbital traces with thinner, more transparent lines
        ctx.lineWidth = 0.8;
        let prev: P | null = null;
        let prevHid = false;

        for (let d = 0; d <= 360; d += 3) {
          const angle = (d * Math.PI) / 180;
          const g = groundPoint(o, angle);
          const p = proj(g.lat, g.lon);
          const hid = p.z < 0; // Behind the globe

          if (prev) {
            ctx.beginPath();
            ctx.moveTo(prev.x, prev.y);
            ctx.lineTo(p.x, p.y);
            // Front part (visible): semi-transparent | Back part (hidden): very subtle
            ctx.strokeStyle =
              hid || prevHid ? hexA(o.col, 0.08) : hexA(o.col, 0.45);
            ctx.lineCap = "round";
            ctx.stroke();
          }
          prev = p;
          prevHid = hid;
        }

        const g2 = groundPoint(o, o.u),
          sp = proj(g2.lat, g2.lon);

        if (sp.z > 0) {
          // Sub-satellite point connection (dashed line) with enhanced visibility
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = hexA(o.col, 0.5);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(sp.x, sp.y);
          const dx = sp.x - cx,
            dy = sp.y - cy;
          const subdist = Math.hypot(dx, dy);
          if (subdist > 0) {
            const gx = cx + (dx / subdist) * R * 0.96;
            const gy = cy + (dy / subdist) * R * 0.96;
            ctx.lineTo(gx, gy);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Sub-satellite point marker with glow
          ctx.fillStyle = hexA(o.col, 0.4);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 3.2, 0, 6.2832);
          ctx.fill();
          ctx.fillStyle = hexA(o.col, 0.75);
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 2, 0, 6.2832);
          ctx.fill();

          // Satellite icon with enhanced shadow and direction
          const ahead = groundPoint(o, o.u + 0.02);
          const aheadProj = proj(ahead.lat, ahead.lon);
          const angle = Math.atan2(aheadProj.y - sp.y, aheadProj.x - sp.x);
          const iconScale = Math.max(1, Math.min(1.8, st.current.zoom));

          ctx.globalAlpha = 1;
          ctx.shadowColor = hexA(o.col, 0.8);
          ctx.shadowBlur = 12;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          drawSatelliteIcon(ctx, sp.x, sp.y, angle, o.col, iconScale);
          ctx.shadowBlur = 0;

          // Satellite label with crisp styling
          ctx.font = "bold 9px ui-sans-serif, sans-serif";
          const satLabel = ["S1C", "S2A", "S3B", "S5P"][idx] || `SAT${idx}`;
          const w = ctx.measureText(satLabel).width;

          // Background badge
          ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
          ctx.fillRect(sp.x + 12, sp.y - 18, w + 12, 15);

          // Subtle border
          ctx.strokeStyle = hexA(o.col, 0.4);
          ctx.lineWidth = 0.8;
          ctx.strokeRect(sp.x + 12, sp.y - 18, w + 12, 15);

          // White text
          ctx.fillStyle = "#ffffff";
          ctx.fillText(satLabel, sp.x + 18, sp.y - 7);
        }

        // Transmission pulse animation when satellite is in station contact
        const isInContact = sats.some(
          (q) =>
            arcDeg(q.lat, q.lon, stations[0]?.lat ?? 0, stations[0]?.lon ?? 0) <
            CONTACT_DEG,
        );
        if (sp.z > 0 && isInContact) {
          const pulsePhase = (st.current.animMs * 0.0009) % 1;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 7 + pulsePhase * 16, 0, 6.2832);
          const pulseOpacity = Math.round((1 - pulsePhase) * 190);
          ctx.strokeStyle = o.col + pulseOpacity.toString(16).padStart(2, "0");
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }
      });

      // Render transmission beams from satellites to ground stations with enhanced visuals
      orbits.current.forEach((o) => {
        const satPos = groundPoint(o, o.u);
        const satProj = proj(satPos.lat, satPos.lon);

        stations.forEach((stn) => {
          const stnProj = proj(stn.lat, stn.lon);
          if (stnProj.z <= 0 || satProj.z <= 0) return;

          const distDeg = arcDeg(satPos.lat, satPos.lon, stn.lat, stn.lon);
          if (distDeg >= CONTACT_DEG) return; // Not in contact

          // Transmission cone from satellite to ground station
          const k = 1 - distDeg / CONTACT_DEG; // 1 at zenith, 0 at horizon
          const coneWidth = R * 0.088 * (0.5 + 0.5 * k);

          const dx = stnProj.x - satProj.x;
          const dy = stnProj.y - satProj.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          // Multi-layer gradient cone for depth
          const grad = ctx.createLinearGradient(
            satProj.x,
            satProj.y,
            stnProj.x,
            stnProj.y,
          );
          grad.addColorStop(0, hexA(o.col, 0.75)); // Bright at satellite
          grad.addColorStop(0.5, hexA(o.col, 0.35)); // Mid-tone
          grad.addColorStop(1, hexA(o.col, 0.08)); // Faint at ground

          // Cone shadow (subtle)
          ctx.fillStyle = hexA(o.col, 0.05);
          ctx.beginPath();
          ctx.moveTo(satProj.x + 1, satProj.y + 1);
          ctx.lineTo(
            stnProj.x + nx * coneWidth + 1,
            stnProj.y + ny * coneWidth + 1,
          );
          ctx.lineTo(
            stnProj.x - nx * coneWidth + 1,
            stnProj.y - ny * coneWidth + 1,
          );
          ctx.closePath();
          ctx.fill();

          // Main cone
          ctx.beginPath();
          ctx.moveTo(satProj.x, satProj.y);
          ctx.lineTo(stnProj.x + nx * coneWidth, stnProj.y + ny * coneWidth);
          ctx.lineTo(stnProj.x - nx * coneWidth, stnProj.y - ny * coneWidth);
          ctx.closePath();
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.strokeStyle = hexA(o.col, 0.6);
          ctx.lineWidth = 1.1;
          ctx.stroke();

          // Animated dashed beam center line with enhanced visibility
          ctx.save();
          ctx.setLineDash([6, 8]);
          ctx.lineDashOffset = -(st.current.animMs * 0.028) % 14;
          ctx.strokeStyle = o.col;
          ctx.lineWidth = 1.4;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(satProj.x, satProj.y);
          ctx.lineTo(stnProj.x, stnProj.y);
          ctx.stroke();
          ctx.restore();

          // Ground footprint ellipse with refined styling
          ctx.save();
          ctx.translate(stnProj.x, stnProj.y);
          ctx.rotate(Math.atan2(ny, nx));

          // Shadow
          ctx.fillStyle = hexA(o.col, 0.08);
          ctx.beginPath();
          ctx.ellipse(0, 0, coneWidth + 1, coneWidth * 0.35, 0, 0, Math.PI * 2);
          ctx.fill();

          // Main ellipse
          ctx.beginPath();
          ctx.ellipse(0, 0, coneWidth, coneWidth * 0.34, 0, 0, Math.PI * 2);
          ctx.fillStyle = hexA(o.col, 0.15);
          ctx.fill();
          ctx.strokeStyle = hexA(o.col, 0.85);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          ctx.restore();
        });
      });

      // Render ground station icons and labels with enhanced visibility
      stations.forEach((stn) => {
        const p = proj(stn.lat, stn.lon);
        if (p.z <= 0) return;
        const live = sats.some(
          (q) => arcDeg(q.lat, q.lon, stn.lat, stn.lon) < CONTACT_DEG,
        );

        // Station glow background when live
        if (live) {
          ctx.fillStyle = hexA(stationLiveColor, 0.15);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 18, 0, 6.2832);
          ctx.fill();
        }

        // Draw parabola dish icon with enhanced scaling and visibility
        const iconScale = Math.max(1, Math.min(1.8, st.current.zoom));
        ctx.globalAlpha = live ? 1 : 0.72;
        ctx.shadowColor = isDarkRef.current
          ? "rgba(0,0,0,0.6)"
          : "rgba(255,255,255,0.5)";
        ctx.shadowBlur = live ? 8 : 4;
        drawGroundStationIcon(
          ctx,
          p.x,
          p.y,
          live ? stationLiveColor : stationIdleColor,
          iconScale,
        );
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Station label with semi-transparent badge
        ctx.font = "bold 10px ui-monospace,monospace";
        const stationMetrics = ctx.measureText(stn.name);
        const stationLabelWidth = stationMetrics.width + 10;

        // Semi-transparent background badge
        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.fillRect(p.x + 6, p.y - 3, stationLabelWidth, 14);

        // Subtle colored border based on station status
        const stationBorderColor = live ? stationLiveColor : stationIdleColor;
        ctx.strokeStyle = hexA(stationBorderColor, 0.6);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(p.x + 6, p.y - 3, stationLabelWidth, 14);

        // White text label
        ctx.fillStyle = "#ffffff";
        ctx.fillText(stn.name, p.x + 10, p.y + 5);
      });

      filteredDatatakes.forEach((a, i) => {
        const p = proj(a.lat, a.lon);
        if (p.z <= 0) return;
        const col = colOf(a);
        const pulse = Math.sin(s.animMs * PULSE_RATE + i) * 0.5 + 0.5;
        const rr = 8 + pulse * 7;

        // Pulsing outer ring with dual-layer effect
        ctx.strokeStyle = hexA(col, 0.35 - pulse * 0.15);
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr + 2, 0, 6.2832);
        ctx.stroke();

        ctx.strokeStyle = hexA(col, 0.65 - pulse * 0.35);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, 0, 6.2832);
        ctx.stroke();

        // Core marker with glow
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.6, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = hexA(col, 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.2, 0, 6.2832);
        ctx.fill();

        const isSel = selRef.current === i,
          isHov = hoverRef.current === i;
        if (isSel || isHov) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = isSel ? 2.2 : 1.8;
          ctx.beginPath();
          ctx.arc(p.x, p.y, rr + 6, 0, 6.2832);
          ctx.stroke();

          // Enhanced label with black background badges
          const lx = p.x + rr + (isSel ? 16 : 10);
          const ly = p.y;
          ctx.font = isSel
            ? "bold 11px ui-monospace,monospace"
            : "11px ui-monospace,monospace";

          // ID label with black background badge
          const idMetrics = ctx.measureText(a.id);
          const idWidth = idMetrics.width + 10;
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(lx - 4, ly - 12, idWidth, 14);
          ctx.strokeStyle = "rgba(51,51,68,0.8)";
          ctx.lineWidth = 1;
          ctx.strokeRect(lx - 4, ly - 12, idWidth, 14);

          ctx.fillStyle = "#fff";
          ctx.fillText(a.id, lx, ly - 2);

          // Detail label with black background badge
          ctx.font = "10px ui-monospace,monospace";
          const detailMetrics = ctx.measureText(a.sat + " · " + a.comp + "%");
          const detailWidth = detailMetrics.width + 10;
          ctx.fillStyle = "rgba(0,0,0,0.85)";
          ctx.fillRect(lx - 4, ly + 6, detailWidth, 13);
          ctx.strokeStyle = "rgba(51,51,68,0.8)";
          ctx.lineWidth = 1;
          ctx.strokeRect(lx - 4, ly + 6, detailWidth, 13);

          ctx.fillStyle = datatakeLabelDetail;
          ctx.fillText(a.sat + " · " + a.comp + "%", lx, ly + 12);
        }

        if (isSel) {
          // Enhanced targeting reticle: rotating dashed ring + refined crosshair
          const fr = rr + 14;
          ctx.strokeStyle = "rgba(255,255,255,0.95)";
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 6]);
          ctx.lineDashOffset = -s.animMs * DASH_RATE;
          ctx.beginPath();
          ctx.arc(p.x, p.y, fr, 0, 6.2832);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.lineDashOffset = 0;

          // Crosshair with refined proportions
          ctx.beginPath();
          ctx.moveTo(p.x - fr - 7, p.y);
          ctx.lineTo(p.x - fr + 3, p.y);
          ctx.moveTo(p.x + fr - 3, p.y);
          ctx.lineTo(p.x + fr + 7, p.y);
          ctx.moveTo(p.x, p.y - fr - 7);
          ctx.lineTo(p.x, p.y - fr + 3);
          ctx.moveTo(p.x, p.y + fr - 3);
          ctx.lineTo(p.x, p.y + fr + 7);
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
      const mx = clientX - r.left,
        my = clientY - r.top;
      const geo = unproject(mx, my);
      if (geo) {
        for (let i = filteredDatatakes.length - 1; i >= 0; i--) {
          const f = filteredDatatakes[i].footprint;
          if (f && f.length >= 4 && inRing(f, geo.lon, geo.lat)) return i;
        }
      }
      let best = -1,
        bd = 400;
      filteredDatatakes.forEach((a, i) => {
        const p = proj(a.lat, a.lon);
        if (p.z > 0) {
          const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
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
        s.dragging = true;
        s.moved = 0;
        s.flying = false;
        s.lastX = e.clientX;
        s.lastY = e.clientY;
        cv!.setPointerCapture(e.pointerId);
        cv!.style.cursor = "grabbing";
      } else if (active.size === 2) {
        const [a, b] = [...active.values()];
        s.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        s.dragging = false;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (active.has(e.pointerId))
        active.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (active.size === 2) {
        const [a, b] = [...active.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (s.pinch) setZoom(s.zoom * (d / s.pinch));
        s.pinch = d;
        return;
      }
      if (s.dragging) {
        const dx = e.clientX - s.lastX,
          dy = e.clientY - s.lastY;
        s.moved += Math.abs(dx) + Math.abs(dy);
        s.yaw -= dx * 0.005;
        s.tilt = clampTilt(s.tilt + dy * 0.005);
        s.lastX = e.clientX;
        s.lastY = e.clientY;
        s.idleFrom = performance.now();
        invalidateLocal();
        return;
      }
      const h = hit(e.clientX, e.clientY);
      if (h !== hoverRef.current) {
        hoverRef.current = h;
        invalidateLocal();
      }
      cv!.style.cursor = h >= 0 ? "pointer" : "grab";
    };

    const endPointer = (e: PointerEvent) => {
      active.delete(e.pointerId);
      if (active.size < 2) s.pinch = 0;
      if (s.dragging && active.size === 0) {
        s.dragging = false;
        cv!.style.cursor = "grab";
      }
      s.idleFrom = performance.now();
    };

    const onPointerUp = (e: PointerEvent) => {
      const wasDrag = s.moved > 3;
      endPointer(e);
      if (!wasDrag) {
        const b = hit(e.clientX, e.clientY);
        if (b >= 0) select(b);
      }
    };
    // Pointer capture can fire a leave on the capturing element in some engines, so a
    // drag in progress must not clear the hover.
    const onPointerLeave = () => {
      if (s.dragging) return;
      if (hoverRef.current !== -1) {
        hoverRef.current = -1;
        invalidateLocal();
      }
    };

    // preventDefault only when the zoom actually moved, so the page still scrolls
    // normally once the globe is at its zoom limit.
    const onWheel = (e: WheelEvent) => {
      if (setZoom(s.zoom * Math.exp(-e.deltaY * 0.0015))) e.preventDefault();
    };

    // Keyboard equivalents for every pointer gesture: arrows rotate the globe the
    // way dragging in that direction would, +/- zoom, 0 resets, [ and ] step
    // through datatakes, Enter/Space plays and pauses the simulation.
    const onKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 0.3 : 0.08;
      const manual = () => {
        s.flying = false;
        s.idleFrom = performance.now();
      };
      let handled = true;
      switch (e.key) {
        case "ArrowLeft":
          manual();
          s.yaw += step;
          break;
        case "ArrowRight":
          manual();
          s.yaw -= step;
          break;
        case "ArrowUp":
          manual();
          s.tilt = clampTilt(s.tilt - step);
          break;
        case "ArrowDown":
          manual();
          s.tilt = clampTilt(s.tilt + step);
          break;
        case "+":
        case "=":
          manual();
          setZoom(s.zoom * 1.3);
          break;
        case "-":
        case "_":
          manual();
          setZoom(s.zoom / 1.3);
          break;
        // Reset hands the rotation straight back to the globe rather than waiting out
        // the idle timer.
        case "0":
        case "Home":
          s.zoom = 1;
          s.R = s.baseR;
          s.yaw = 0;
          s.tilt = -0.42;
          s.flying = false;
          s.idleFrom = 0;
          break;
        case "]":
        case "n":
          select((selRef.current + 1) % Math.max(1, filteredDatatakes.length));
          break;
        case "[":
        case "p":
          select(
            (selRef.current - 1 + Math.max(1, filteredDatatakes.length)) %
              Math.max(1, filteredDatatakes.length),
          );
          break;
        case "Enter":
        case " ":
          togglePlayRef.current();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        invalidateLocal();
      }
    };

    // ---- gating observers ----------------------------------------------------
    const io = new IntersectionObserver(
      (entries) => {
        const now = entries.some((en) => en.isIntersecting);
        if (now === inView) return;
        inView = now;
        if (inView) invalidateLocal(); // resume where we left off
      },
      { rootMargin: "80px" },
    );
    io.observe(cv);

    const onVisibility = () => {
      const now = !document.hidden;
      if (now === pageVisible) return;
      pageVisible = now;
      if (pageVisible) invalidateLocal();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onMotionChange = (e: MediaQueryListEvent) => {
      s.reduce = e.matches;
      invalidateLocal();
    };
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

    // Trigger resize event to recalculate canvas viewport
    window.dispatchEvent(new Event("resize"));

    return () => {
      cancelAnimationFrame(raf);
      invalidateRef.current = () => {};
      io.disconnect();
      ro.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      motionQ?.removeEventListener?.("change", onMotionChange);
      themeQ?.removeEventListener?.("change", onThemeChange);
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
    speedRef.current = n;
    setSpeed(n);
  };
  const seek = useCallback(
    (ms: number) => {
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
    },
    [invalidate],
  );
  const onScrub = (e: React.ChangeEvent<HTMLInputElement>) =>
    seek(DAY_START + (Number(e.target.value) / DAY_MIN) * DAY_LEN);
  const resetView = () => {
    const s = st.current;
    s.zoom = 1;
    s.R = s.baseR;
    s.yaw = 0;
    s.tilt = -0.42;
    s.flying = false;
    s.idleFrom = 0; // hand the rotation straight back to the globe
    invalidate();
  };

  // Roving tabindex across the timeline toolbar: the group is a single tab stop and
  // Left/Right move between its controls. The scrub slider keeps Up/Down, Home/End
  // and PageUp/PageDown for changing the value, so the two never fight.
  const focusRove = (next: number) => {
    const i = (next + ROVE_KEYS.length) % ROVE_KEYS.length;
    setRove(i);
    barRef.current
      ?.querySelector<HTMLElement>(`[data-rove="${ROVE_KEYS[i]}"]`)
      ?.focus();
  };
  const onBarKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusRove(rove + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusRove(rove - 1);
    }
  };
  const roveProps = (key: (typeof ROVE_KEYS)[number]) => ({
    "data-rove": key,
    tabIndex: ROVE_KEYS[rove] === key ? 0 : -1,
    onFocus: () => setRove(ROVE_KEYS.indexOf(key)),
  });

  // ---- sensing marks --------------------------------------------------------
  // Each datatake's sensing instant as a mark on the simulated day. Marks outside the
  // window are dropped rather than hidden, and a mark only shows its id when there is
  // room for it — otherwise the labels collide as soon as passes cluster.
  const marks = useMemo(() => {
    const all = filteredDatatakes
      .map((a, i) => ({ i, a, ms: sensingMs(a) }))
      .filter(
        (m): m is { i: number; a: AcqDatatake; ms: number } => m.ms !== null,
      )
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
  }, [filteredDatatakes, trackW]);

  useEffect(() => {
    setTickRove((i) => Math.max(0, Math.min(i, marks.length - 1)));
  }, [marks.length]);

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
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusTick(tickRove + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusTick(tickRove - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusTick(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusTick(marks.length - 1);
    }
  };
  const activateMark = (m: { i: number; ms: number }) => {
    seek(m.ms);
    select(m.i);
  };

  useEffect(() => {
    setSel(0);
    selRef.current = 0;
    setTickRove(0);
    invalidate();
  }, [satFilter, dayFilter, invalidate]);

  const dt = filteredDatatakes[sel] ?? filteredDatatakes[0];

  // Compute metrics for display
  const metrics = useMemo(() => {
    const acquired =
      filteredDatatakes.length > 0
        ? Math.round(
            filteredDatatakes.reduce((sum, d) => sum + d.comp, 0) /
              filteredDatatakes.length,
          )
        : 0;
    const published = filteredDatatakes.filter(
      (d) => d.status === "Published",
    ).length;
    const publishedPercent =
      filteredDatatakes.length > 0
        ? Math.round((published / filteredDatatakes.length) * 100)
        : 0;
    const failed = filteredDatatakes.filter(
      (d) => d.status === "Failed",
    ).length;
    return {
      datatakesInView: filteredDatatakes.length,
      acquired,
      published: publishedPercent,
      failed,
    };
  }, [filteredDatatakes]);

  // Every datatake in one dropdown, grouped by mission so all four constellations
  // are reachable without a satellite filter in front of them. Mission order is
  // numeric, so Sentinel-5P sorts after Sentinel-3 rather than between 1 and 2.
  // Live description of the canvas for assistive tech. Kept in sync with the
  // selection, playback and station-contact state, and mirrored into a polite live
  // region because a changing aria-label on a role="img" is not itself announced.
  const globeLabel = useMemo(() => {
    const contactText = contact.length
      ? `${contact.length} of ${stations.length} ground stations in contact: ${contact.join(", ")}.`
      : `No ground stations in contact of ${stations.length}.`;
    if (!dt)
      return "Interactive globe of Sentinel acquisitions. No datatakes match the current filters.";
    return `Interactive globe of Sentinel acquisitions. ${filteredDatatakes.length} datatake${filteredDatatakes.length === 1 ? "" : "s"} plotted with their footprints. Selected: ${dt.id}, ${dt.sat} downlinking to ${dt.station}, ${dt.comp}% complete, status ${dt.status}, footprint centred at ${latLonText(dt.lat, dt.lon)}. ${contactText} Simulation ${playing ? "playing" : "paused"} at ${speed} times real time.`;
  }, [filteredDatatakes, dt, playing, speed, contact, stations.length]);

  if (!dt) return null;

  const pillFor = (st2: string) =>
    st2 === "Published"
      ? "nominal"
      : st2 === "Processing"
        ? "degraded"
        : "neutral";

  return (
    <>
      {/* Metrics & Filter Toolbar - replacing old toolbar */}
      {rail === "plates" && (
        <div
          style={{
            background:
              "radial-gradient(circle at center, rgba(15, 18, 24, 0.85) 0%, rgba(5, 7, 11, 0.95) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            padding: "24px clamp(18px, 4vw, 48px)",
            width: "100vw",
            marginLeft: "calc(-50vw + 50%)",
            boxSizing: "border-box",
          }}
        >
          {/* Metrics Row */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "64px",
              marginBottom: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {metrics.datatakesInView}
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#a0a5b5",
                }}
              >
                DATATAKES IN VIEW
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {metrics.acquired}%
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#a0a5b5",
                }}
              >
                ACQUIRED
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 700,
                  color: "#ffffff",
                }}
              >
                {metrics.published}%
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#a0a5b5",
                }}
              >
                PUBLISHED
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "2.25rem",
                  fontWeight: 700,
                  color: metrics.failed > 0 ? "#ff4d4d" : "#ffffff",
                }}
              >
                {metrics.failed}
              </div>
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#a0a5b5",
                }}
              >
                FAILED ACQUISITIONS
              </div>
            </div>
          </div>

          {/* Filter Row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "28px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                fontSize: "1.125rem",
                fontWeight: 800,
                letterSpacing: "0.04em",
                color: "#ffffff",
              }}
            >
              15 – 16 JULY 2026
            </div>

            {/* Satellite Filter - Custom Dropdown */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderBottom: `1px solid ${openDropdown === "satellite" ? "#00e5ff" : "rgba(255, 255, 255, 0.35)"}`,
                paddingBottom: "4px",
                position: "relative",
              }}
            >
              <label
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "satellite" ? null : "satellite",
                  )
                }
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: openDropdown === "satellite" ? "#00e5ff" : "#ffffff",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
              >
                SATELLITE
              </label>
              <div
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "satellite" ? null : "satellite",
                  )
                }
                style={{
                  fontSize: "0.7125rem",
                  fontWeight: 500,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {satFilter === "*" ? "All" : satFilter}
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{
                    transform:
                      openDropdown === "satellite"
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <path d="M1 1l4 4 4-4" strokeLinecap="round" />
                </svg>
              </div>

              {openDropdown === "satellite" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    background: "rgba(0, 0, 0, 0.9)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderTop: "1px solid rgba(255, 255, 255, 0.15)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
                    minWidth: "200px",
                    marginTop: "8px",
                    zIndex: 1000,
                  }}
                >
                  {["*", ...uniqueSatellites].map((sat) => (
                    <div
                      key={sat}
                      onClick={() => {
                        setSatFilter(sat);
                        setOpenDropdown(null);
                      }}
                      style={{
                        padding: "12px 16px",
                        color: satFilter === sat ? "#00e5ff" : "#ffffff",
                        fontSize: "0.7125rem",
                        fontWeight: 500,
                        textTransform: "uppercase",
                        letterSpacing: "0.1em",
                        cursor: "pointer",
                        transition: "color 0.2s, background 0.2s",
                        background:
                          satFilter === sat
                            ? "rgba(0, 229, 255, 0.1)"
                            : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (satFilter !== sat) {
                          e.currentTarget.style.color = "#00e5ff";
                          e.currentTarget.style.background =
                            "rgba(0, 229, 255, 0.1)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (satFilter !== sat) {
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {sat === "*" ? "All" : sat}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Day Filter - Calendar Dropdown */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderBottom: `1px solid ${openDropdown === "day" ? "#00e5ff" : "rgba(255, 255, 255, 0.35)"}`,
                paddingBottom: "4px",
                position: "relative",
              }}
            >
              <label
                onClick={() =>
                  setOpenDropdown(openDropdown === "day" ? null : "day")
                }
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: openDropdown === "day" ? "#00e5ff" : "#ffffff",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                DAY OF ACQUISITION
              </label>
              <div
                onClick={() =>
                  setOpenDropdown(openDropdown === "day" ? null : "day")
                }
                style={{
                  fontSize: "0.7125rem",
                  fontWeight: 500,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {dayFilter === "*" ? "Any" : dayFilter}
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{
                    transform:
                      openDropdown === "day"
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <path d="M1 1l4 4 4-4" strokeLinecap="round" />
                </svg>
              </div>

              {openDropdown === "day" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    background: "rgba(0, 0, 0, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    minWidth: "320px",
                    marginTop: "8px",
                    zIndex: 1000,
                    padding: "16px",
                    borderRadius: "4px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "#ffffff",
                      marginBottom: "16px",
                      letterSpacing: "0.08em",
                    }}
                  >
                    ANY DAY
                  </div>

                  {/* Calendar Header with Month/Year and Navigation */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "16px",
                    }}
                  >
                    <button
                      onClick={() => {
                        if (calendarMonth === 0) {
                          setCalendarMonth(11);
                          setCalendarYear(calendarYear - 1);
                        } else {
                          setCalendarMonth(calendarMonth - 1);
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontSize: "14px",
                        padding: "4px 8px",
                      }}
                    >
                      ‹
                    </button>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#ffffff",
                      }}
                    >
                      {new Date(calendarYear, calendarMonth).toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric" },
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (calendarMonth === 11) {
                          setCalendarMonth(0);
                          setCalendarYear(calendarYear + 1);
                        } else {
                          setCalendarMonth(calendarMonth + 1);
                        }
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontSize: "14px",
                        padding: "4px 8px",
                      }}
                    >
                      ›
                    </button>
                  </div>

                  {/* Day Labels */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: "4px",
                      marginBottom: "8px",
                    }}
                  >
                    {["M", "T", "W", "T", "F", "S", "S"].map((day) => (
                      <div
                        key={day}
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          color: "rgba(255, 255, 255, 0.6)",
                          textAlign: "center",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(7, 1fr)",
                      gap: "4px",
                    }}
                  >
                    {(() => {
                      const firstDay = new Date(calendarYear, calendarMonth, 1);
                      const lastDay = new Date(
                        calendarYear,
                        calendarMonth + 1,
                        0,
                      );
                      const startDate = new Date(firstDay);
                      startDate.setDate(
                        startDate.getDate() - firstDay.getDay() + 1,
                      );

                      const days = [];
                      const current = new Date(startDate);
                      while (current <= lastDay) {
                        days.push(new Date(current));
                        current.setDate(current.getDate() + 1);
                      }

                      // Fill remaining cells to complete the grid
                      while (days.length % 7 !== 0) {
                        days.push(null);
                      }

                      return days.map((date, idx) => {
                        const dateStr =
                          date && date.toISOString().split("T")[0];
                        const isCurrentMonth =
                          date && date.getMonth() === calendarMonth;
                        const isSelected = dateStr && dayFilter === dateStr;

                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              if (dateStr) {
                                setDayFilter(dateStr);
                                setOpenDropdown(null);
                              }
                            }}
                            style={{
                              padding: "8px",
                              fontSize: "0.7rem",
                              fontWeight: 500,
                              border: "none",
                              background: isSelected
                                ? "rgba(0, 229, 255, 0.3)"
                                : "transparent",
                              color: isCurrentMonth
                                ? isSelected
                                  ? "#00e5ff"
                                  : "#ffffff"
                                : "rgba(255, 255, 255, 0.3)",
                              cursor: isCurrentMonth ? "pointer" : "default",
                              borderRadius: "3px",
                              transition: "background 0.2s, color 0.2s",
                            }}
                            onMouseEnter={(e) => {
                              if (isCurrentMonth && !isSelected) {
                                e.currentTarget.style.background =
                                  "rgba(0, 229, 255, 0.15)";
                                e.currentTarget.style.color = "#00e5ff";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (isCurrentMonth && !isSelected) {
                                e.currentTarget.style.background =
                                  "transparent";
                                e.currentTarget.style.color = "#ffffff";
                              }
                            }}
                            disabled={!date}
                          >
                            {date ? date.getDate() : ""}
                          </button>
                        );
                      });
                    })()}
                  </div>

                  <button
                    onClick={() => {
                      setDayFilter("*");
                      setOpenDropdown(null);
                    }}
                    style={{
                      width: "100%",
                      marginTop: "12px",
                      padding: "10px 12px",
                      fontSize: "0.7125rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: dayFilter === "*" ? "#00e5ff" : "#ffffff",
                      background:
                        dayFilter === "*"
                          ? "rgba(0, 229, 255, 0.1)"
                          : "transparent",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      borderRadius: "3px",
                      cursor: "pointer",
                      transition: "color 0.2s, background 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      if (dayFilter !== "*") {
                        e.currentTarget.style.color = "#00e5ff";
                        e.currentTarget.style.background =
                          "rgba(0, 229, 255, 0.1)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (dayFilter !== "*") {
                        e.currentTarget.style.color = "#ffffff";
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    Clear (Any)
                  </button>
                </div>
              )}
            </div>

            {/* Datatake Select - Custom Dropdown */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderBottom: `1px solid ${openDropdown === "datatake" ? "#00e5ff" : "rgba(255, 255, 255, 0.35)"}`,
                paddingBottom: "4px",
                position: "relative",
              }}
            >
              <label
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "datatake" ? null : "datatake",
                  )
                }
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: openDropdown === "datatake" ? "#00e5ff" : "#ffffff",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  transition: "color 0.2s",
                }}
              >
                DATATAKE
              </label>
              <div
                onClick={() =>
                  setOpenDropdown(
                    openDropdown === "datatake" ? null : "datatake",
                  )
                }
                style={{
                  fontSize: "0.7125rem",
                  fontWeight: 500,
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {filteredDatatakes[sel]?.id || "Select"}
                <svg
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  style={{
                    transform:
                      openDropdown === "datatake"
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <path d="M1 1l4 4 4-4" strokeLinecap="round" />
                </svg>
              </div>

              {openDropdown === "datatake" && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "0",
                    background: "rgba(0, 0, 0, 0.95)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    minWidth: "420px",
                    maxHeight: "320px",
                    overflow: "hidden",
                    marginTop: "8px",
                    zIndex: 1000,
                    borderRadius: "4px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Search Box */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "12px 16px",
                      borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#a0a5b5"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input
                      type="text"
                      placeholder="Search..."
                      style={{
                        background: "transparent",
                        border: "none",
                        outline: "none",
                        color: "#ffffff",
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        width: "100%",
                        letterSpacing: "0.02em",
                      }}
                    />
                  </div>

                  {/* Datatakes List */}
                  <div
                    style={{
                      overflowY: "auto",
                      flex: 1,
                    }}
                  >
                    {filteredDatatakes.map((a, i) => {
                      const statusColors: Record<
                        string,
                        { color: string; label: string }
                      > = {
                        published: { color: "#00d968", label: "PUBLISHED" },
                        processing: { color: "#ffa500", label: "PROCESSING" },
                        failed: { color: "#ff6b6b", label: "FAILED" },
                      };
                      const status =
                        a.comp >= 0.95
                          ? "published"
                          : a.comp > 0
                            ? "processing"
                            : "failed";
                      const statusInfo = statusColors[status] || {
                        color: "#888888",
                        label: "UNKNOWN",
                      };

                      return (
                        <div
                          key={a.id}
                          onClick={() => {
                            select(i);
                            setOpenDropdown(null);
                          }}
                          style={{
                            padding: "12px 16px",
                            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                            cursor: "pointer",
                            transition: "background 0.2s",
                            background:
                              sel === i
                                ? "rgba(0, 229, 255, 0.15)"
                                : "transparent",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                          }}
                          onMouseEnter={(e) => {
                            if (sel !== i) {
                              e.currentTarget.style.background =
                                "rgba(0, 229, 255, 0.08)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (sel !== i) {
                              e.currentTarget.style.background = "transparent";
                            }
                          }}
                        >
                          {/* Status Indicator Dot */}
                          <div
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: statusInfo.color,
                              flexShrink: 0,
                            }}
                          />

                          {/* Datatake Info */}
                          <div
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "12px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.7125rem",
                                fontWeight: 600,
                                color: sel === i ? "#00e5ff" : "#ffffff",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                              }}
                            >
                              {a.id}
                            </div>
                            <div
                              style={{
                                fontSize: "0.625rem",
                                color: statusInfo.color,
                                fontWeight: 500,
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {a.comp.toFixed(1)}% - {statusInfo.label}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.35)",
                paddingBottom: "4px",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a0a5b5"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                placeholder="Datatake ID"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#ffffff",
                  fontSize: "0.7125rem",
                  fontWeight: 500,
                  letterSpacing: "0.02em",
                  width: "110px",
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          width: "100vw",
          height: zen ? "calc(100vh - 200px)" : "calc(100vh - 300px)",
          marginLeft: "calc(-50vw + 50%)",
          boxSizing: "border-box",
          paddingBlock: "0",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          className="acq-layout"
          style={{
            padding: "0",
            boxSizing: "border-box",
            display: "flex",
            width: "100%",
            maxWidth: "100%",
            height: "100%",
            position: "relative",
            flex: "1 1 100%",
          }}
        >
          <div
            className="globe-card"
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "100%",
              height: "100%",
              overflow: "hidden",
              flex: "1 1 100%",
            }}
          >
            <div
              className="globe-stage"
              ref={stageRef}
              style={{
                width: "100%",
                maxWidth: "100%",
                height: "100%",
                position: "relative",
                flex: 1,
                background: "#0a0d14",
              }}
            >
              <canvas
                ref={cvRef}
                className="globe-canvas"
                role="img"
                tabIndex={0}
                aria-label={globeLabel}
                aria-describedby={helpId}
                aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Plus Minus Enter"
              />
              <p className="sr-only" aria-live="polite">
                {globeLabel}
              </p>
              <p className="sr-only" id={helpId}>
                Interactive globe. Arrow keys rotate the globe, hold Shift to
                rotate faster. Plus and minus zoom. Zero resets the view. Left
                and right square brackets step through the datatakes. Enter
                plays or pauses the simulation clock. Every footprint is also
                available as a button in the marker list and the datatake list.
              </p>

              {/* Screen-reader mirror of the canvas footprints: each plotted datatake is
              reachable as a real button without leaving the globe, and focusing one
              highlights it on the canvas. */}
              <div className="sr-only">
                <h4>Datatakes plotted on the globe</h4>
                <ul>
                  {filteredDatatakes.map((a, i) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => select(i)}
                        onFocus={() => {
                          hoverRef.current = i;
                          invalidate();
                        }}
                        onBlur={() => {
                          hoverRef.current = -1;
                          invalidate();
                        }}
                        aria-current={sel === i ? "true" : undefined}
                      >
                        {a.id}, {a.sat} to {a.station}, {a.comp} percent
                        complete, {a.status}
                        {sel === i ? " (selected)" : ""}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="globe-overlay" aria-hidden="true">
                <span className="eyebrow">Live acquisition plan · 3D</span>
                <div className="acq-now">
                  Now acquiring ·{" "}
                  <b>
                    {dt.sat} → {dt.station}
                  </b>
                </div>
              </div>

              <div className="zoomctl">
                <button
                  type="button"
                  aria-label="Zoom in"
                  onClick={() => setZoom(st.current.zoom * 1.3)}
                >
                  +
                </button>
                <button
                  type="button"
                  aria-label="Zoom out"
                  onClick={() => setZoom(st.current.zoom / 1.3)}
                >
                  −
                </button>
                <button
                  type="button"
                  aria-label="Reset view"
                  title="Reset view"
                  onClick={resetView}
                >
                  ⌖
                </button>
              </div>

              <div className="globe-hint" aria-hidden="true">
                <span>scroll to zoom</span>
                <span>drag or arrows to rotate</span>
                <span>click a footprint</span>
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
                    aria-label={
                      playing ? "Pause simulation" : "Play simulation"
                    }
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
                    defaultValue={Math.round(
                      ((st.current.simMs - DAY_START) / DAY_LEN) * DAY_MIN,
                    )}
                    aria-label="Simulation time of day"
                    onChange={onScrub}
                    onPointerDown={() => {
                      scrubbingRef.current = true;
                    }}
                    onPointerUp={() => {
                      scrubbingRef.current = false;
                    }}
                    onPointerCancel={() => {
                      scrubbingRef.current = false;
                    }}
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

                <p className="sr-only" id={trackHelpId}>
                  With the marks focused, left and right arrows move between
                  them, Home and End jump to the first and last. Enter seeks the
                  simulation clock to that acquisition and selects it on the
                  globe.
                </p>
                <p className="sr-only" aria-live="polite">
                  {marks.length} of {filteredDatatakes.length} acquisitions fall
                  inside the simulated day.
                </p>
              </div>
            </div>
          </div>

          <div
            className={
              "acq-side" + (rail === "plates" ? " acq-side-scroll" : "")
            }
            style={{
              display: showDetails ? "flex" : "none",
              position: "absolute",
              right: "0",
              top: "0",
              height: "100%",
              width: "auto",
              minWidth: "300px",
              maxWidth: "28vw",
              background: "var(--bg)",
              borderLeft: "1px solid var(--line)",
              overflow: "auto",
              zIndex: 10,
              transition: "all 0.3s ease",
              animation: "slideInRight 0.3s ease",
            }}
          >
            {/* The plates variant selects from the dropdown above, so this panel would be
            a second control called "List of Datatakes". */}
            {rail === "detail" && (
              <div className="acq-list">
                <div className="lh">
                  <span>List of Datatakes</span>
                  <span>completeness</span>
                </div>
                {filteredDatatakes.map((a, i) => (
                  <button
                    type="button"
                    key={a.id}
                    className={"acq-item" + (sel === i ? " sel" : "")}
                    aria-current={sel === i ? "true" : undefined}
                    onClick={() => select(i)}
                    onMouseEnter={() => {
                      hoverRef.current = i;
                      invalidate();
                    }}
                    onMouseLeave={() => {
                      hoverRef.current = -1;
                      invalidate();
                    }}
                    onFocus={() => {
                      hoverRef.current = i;
                      invalidate();
                    }}
                    onBlur={() => {
                      hoverRef.current = -1;
                      invalidate();
                    }}
                  >
                    <span className={"sd " + a.cls} aria-hidden="true" />
                    <span className="acq-item-text">
                      <span className="id">{a.id}</span>
                      <span className="sub">
                        {a.sat} · {a.station}
                      </span>
                    </span>
                    <span className="pct">{a.comp}%</span>
                  </button>
                ))}
              </div>
            )}

            {rail === "plates" ? (
              <DatatakeRail dt={dt} onClose={() => setShowDetails(false)} />
            ) : (
              <aside
                className="acq-detail"
                aria-label={`Details for datatake ${dt.id}`}
              >
                <span className="eyebrow">Datatake details</span>
                <h4>{dt.id}</h4>
                <div className="acq-detail-kvs">
                  <div className="kv">
                    <span>Satellite</span>
                    <span>{dt.sat}</span>
                  </div>
                  <div className="kv">
                    <span>Station</span>
                    <span>{dt.station}</span>
                  </div>
                  <div className="kv">
                    <span>Footprint</span>
                    <span>
                      {Math.abs(dt.lat)}°{dt.lat >= 0 ? "N" : "S"}{" "}
                      {Math.abs(dt.lon)}°{dt.lon >= 0 ? "E" : "W"}
                    </span>
                  </div>
                  <div className="kv">
                    <span>Completeness</span>
                    <span>{dt.comp} %</span>
                  </div>
                  <div className="kv">
                    <span>Status</span>
                    <span>{dt.status}</span>
                  </div>
                </div>
                <div className="acq-prod-h">Products</div>
                {dt.prods.map((p, i) => (
                  <div className="prod-row" key={i}>
                    <span>
                      <span className="lvl">{p.lvl}</span> · {p.sub}
                    </span>
                    <span className={"pill " + pillFor(p.st)}>{p.st}</span>
                  </div>
                ))}
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
