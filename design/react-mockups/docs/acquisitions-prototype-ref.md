# Acquisitions page — prototype reference (extracted from SentiBoard.html, src-acquisitions)

Extracted 2026-10-24 from the bundled prototype `SentiBoard.html` (the acquisitions page is
base64-encoded inside it as `<script type="text/plain" id="src-acquisitions">`). These are the exact
values to reproduce. Do not decode the bundle again; use this file.

How to read it:
- The prototype's CSS is a pile of overrides (`!important`, `html body …`). The values below are the
  **resolved winners**, not the first rule you would find.
- The prototype draws the globe with **d3 `geoOrthographic` on a 2D canvas + a WebGL shader for the
  imagery**. Our page uses **three.js (`ThreeEarth`)**. §6 gives the conversion formulas.
- The saved HTML contains a static snapshot with S2A-48201-1 selected and with "plates" and "downlink
  passes" blocks. **The live script replaces it**: it starts with nothing selected, and the panel shows
  only the head, the headline and the record (no plates, no passes block).

Things the final prototype **hides or does not use** (do not build them):
- `.simtrack` (the sensing tick marks under the clock) — `display: none !important`.
- `.globe-overlay` ("Live acquisition plan · 3D", "Now acquiring …") and `.globe-hint`
  ("scroll to zoom · drag …") — `display: none !important`.
- `.acq-style` (an imagery/stylized switch) — styled but never created by the script.
- Fullscreen button `#acqFull` — not in the markup.
- Production plates (prism SVGs) and the "Downlink passes" block — not rendered by `paintRail()`.
- Ambient auto-rotation — the globe **never turns on its own**. Only the satellites move (sim clock).

---

## 1. Page layout and spacing (top to bottom)

| Block | Value |
|---|---|
| KPIs row | `padding-top: clamp(10px, 1.4vw, 22px)`, `padding-bottom: clamp(8px, 1vw, 16px)` (plus the shared hero overlap — keep whatever the Events page does) |
| Toolbar | `margin-top: clamp(16px, 2.6vh, 28px)`, `padding-bottom: clamp(10px, 1.6vw, 20px)` |
| Globe row | `padding-top: clamp(22px, 3vh, 36px)`, no side padding beyond the page margins (`--pad: clamp(18px, 4.4vw, 64px)`) |
| Globe stage height | `max(520px, min(84vh, 880px))` (≤980px: `min(62vh, 560px)`; ≤780px: `min(56vh, 440px)`; ≤560px: `min(52vh, 340px)`) |
| After the row | spacer `height: clamp(40px, 6vh, 72px)`, then the footer |

The globe has **no card**: no border, no background, no radius, `overflow: visible`; the page starfield
shows around it.

## 2. KPIs

Markup: value over caption, four of them. Value `#EAF0F6`, Failed value `#E8514B`.

```css
.kpis { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 0; }
.kpi  { width: clamp(140px, 16vw, 220px); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5px; }
.kpi b { font-family: 'Noto Sans'; font-size: clamp(26px, 2.9vw, 37px); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.kpi .micro { font-size: 10.5px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; line-height: 1.5; color: rgba(255,255,255,0.72); }
@media (max-width: 900px) { .kpi { width: clamp(130px, 44vw, 200px); } }
```

The KPIs follow the **Satellite and Day filters only** (not the datatake selection, not the search):

```js
var all = DTK.filter(visible);            // visible = sat filter && day filter
kv('aqDtk', all.length);
/* acquired: the share of datatakes whose acquisition succeeded; published: the mean publication percentage */
kv('aqAcq', all.length ? Math.round(100 * all.filter(function (d) { return d.status !== 'Failed'; }).length / all.length) + '%' : '—');
kv('aqMean', all.length ? Math.round(all.reduce(function (s, d) { return s + d.pct; }, 0) / all.length) + '%' : '—');
kv('aqFail', all.filter(function (d) { return d.pct === 0; }).length);
```

Labels: `Datatakes in view` · `Acquired` · `Published` · `Failed acquisitions`.

## 3. Filter toolbar

One centred row: date heading, three dropdowns, search. Every control is 49px tall (48px head + 1px
hairline) so all hairlines share one bottom edge.

```css
.filters { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 2px 26px; }

/* date heading, vertically centred in a 49px box */
.fhead    { height: 49px; display: flex; align-items: center; align-self: flex-start; margin: 0; }
.fhead h2 { margin: 0; font-family: 'Noto Sans'; font-size: clamp(17px, 1.7vw, 22px); font-weight: 700;
            letter-spacing: 0.02em; text-transform: uppercase; line-height: 1; white-space: nowrap; }

/* dropdown: the hairline is on the whole .fdrop, so when open it sits UNDER the list */
.fdrop { position: relative; display: flex; flex-direction: column; border-bottom: 1px solid rgba(255,255,255,0.30); }
.fdrop[data-drop="sat"] { min-width: 190px; }
.fdrop[data-drop="day"] { min-width: 230px; width: 230px; }
.fdrop[data-drop="dtk"] { min-width: 260px; width: 260px; }
.fdrop-head { display: flex; align-items: center; justify-content: flex-start; gap: 12px; width: 100%;
              min-height: 48px; padding: 0 2px; border: 0; background: none; text-align: left; }
.fdrop-head > span:first-child { flex: 1 1 auto; text-align: left; font-family: 'Noto Sans';
              font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #FFFFFF; }
.fdrop-head:hover > span:first-child,
.fdrop.open .fdrop-head > span:first-child { color: #2FC6DC; }      /* the CAPTION turns cyan; the hairline does not */
.fdrop-val  { flex: 0 0 auto; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; text-transform: none; color: rgba(255,255,255,0.92); }
.fdrop-head svg { color: rgba(255,255,255,0.85); }                 /* 12×12, path "M3 6l5 5 5-5", stroke-width 1.4 */

/* the list opens IN FLOW below the head (it pushes the page down), animating its height */
.fdrop-body  { position: static; height: 0; overflow: hidden; background: none; border: 0; box-shadow: none;
               transition: height 420ms cubic-bezier(.2,.7,.2,1); }
.fdrop-inner { padding: 12px 0 16px; }
.fgroup      { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 0; }

/* list items */
.fitem   { width: 100%; min-height: 34px; display: flex; align-items: center; gap: 11px; padding: 0; border: 0; background: none;
           text-align: left; font-family: 'Noto Sans'; font-size: 12.5px; font-weight: 500; letter-spacing: 0.12em;
           text-transform: uppercase; color: rgba(255,255,255,0.9); transition: color 180ms ease, opacity 180ms ease; }
.fitem.off { color: rgba(255,255,255,0.5); opacity: 0.3; }          /* both apply */
.fitem i { display: block; width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }   /* status dot */
.fitem u { flex: 1; text-decoration: none; }                        /* the name */
.fitem s { display: block; margin-left: auto; padding-left: 14px; white-space: nowrap; text-decoration: none;
           font-size: 10px; letter-spacing: 0.1em; color: #4E5866; font-variant-numeric: tabular-nums; }  /* secondary text */
.acq-empty { margin: 4px 0; font-size: 12px; color: rgba(234,240,246,0.45); }

/* search: same 49px line */
.fsearch { min-width: 190px; height: 49px; box-sizing: border-box; align-self: flex-start; display: flex; align-items: center; gap: 9px;
           color: #FFFFFF; border-bottom: 1px solid rgba(255,255,255,0.30); }           /* no colour change on focus */
.fsearch input { width: 100%; height: 100%; min-width: 0; background: none; border: 0; outline: none;
                 font-family: 'Noto Sans'; font-size: 14px; letter-spacing: 0.02em; color: #FFFFFF; }
.fsearch input::placeholder { color: #FFFFFF; opacity: 1; }
```

Search icon (13×13): `<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.3"/><path d="M10.4 10.4L14 14" stroke="currentColor" stroke-width="1.3"/></svg>`
Placeholder: `Datatake ID`. The chevron does **not** rotate on open in this prototype (it does on Events).

### Selection semantics (important)

- A list never highlights its choice in colour. When a value other than "all/any" is chosen, **every
  other item gets `.off`** (dimmed). With "all/any" chosen nothing is dimmed.
- Only one dropdown open at a time; `Escape` closes it. Picking an item closes its dropdown.
- **Satellite** and **Day** are the only filters: they hide footprints/satellites and drive the KPIs.
- **Datatake** is a *selector*, not a filter: picking one selects it (panel + flight); the other
  footprints stay on the globe, dimmed (§7). There is **no "All datatakes" item**.
- **Search** only narrows the Datatake list. Typing opens the Datatake dropdown. `Enter` selects the
  first visible datatake whose ID contains the term. It never hides anything on the globe or changes KPIs.

```js
/* Satellite: "All satellites" + the distinct full names, sorted (Sentinel-1C, Sentinel-2A, …) */
items(sat, [{ v: '*', t: 'All satellites' }].concat(SATS.map(function (x) { return { v: x, t: x }; })), S.sat, …);
satVal = S.sat === '*' ? 'All' : S.sat.replace('Sentinel-', 'S');              // "S2A"

/* Day: value "Any" or "16 Jul"; the heading follows it */
dayVal  = S.day === '*' ? 'Any' : S.day.slice(8) + ' ' + MON[+S.day.slice(5, 7) - 1].slice(0, 3);
heading = S.day === '*' ? '15 – 16 July 2026' : '16 July 2026';                 // the chosen day alone

/* Datatake list: visible datatakes (sat+day) narrowed by the search, grouped by mission group then ID */
var shown = DTK.filter(visible).filter(function (d) { return !term || d.id.indexOf(term) >= 0 || d.sat.toUpperCase().indexOf(term) >= 0; })
  .sort(function (a, b) { return a.group < b.group ? -1 : a.group > b.group ? 1 : a.id < b.id ? -1 : 1; });
items(grp, shown.map(function (d) { return { v: String(d.i), t: d.id, s: d.pct.toFixed(1) + '% · ' + d.status, dot: DOT[d.tone] }; }), String(S.sel), …);
if (!shown.length) grp.innerHTML = '<p class="acq-empty">No datatake matches</p>';
dtkVal = S.sel >= 0 ? DTK[S.sel].id : 'None';                                    // "None" when nothing is selected
```

Item markup: `<button class="fitem[ off]"><i style="background:DOT"></i><u>NAME</u><s>SECONDARY</s></button>`.

### Day of acquisition = a month calendar

First item `Any day` (an `.fitem`, `min-height: 30px`). Then the month header and a Monday-first grid.
**Only days that have datatakes (for the current Satellite filter) are buttons**; the others are inert
`<span>`s shown for context. Opens on the month that holds the datatakes.

```html
<button class="fitem acq-anyday[ off]" data-v="*"><u>Any day</u></button>
<div class="acq-cal">
  <div class="acq-cal-head">
    <button class="acq-cal-nav" aria-label="Previous month"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6"/></svg></button>
    <b>July 2026</b>
    <button class="acq-cal-nav" aria-label="Next month"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.6"/></svg></button>
  </div>
  <div class="acq-cal-grid">
    <span class="dow">M</span> … <span class="dow">S</span>
    <span></span>…                                         <!-- lead blanks: (getUTCDay()+6)%7 -->
    <span class="acq-day">1</span>                         <!-- no datatakes -->
    <button class="acq-day has[ on]" data-v="2026-07-15" title="1 datatake">15<i></i></button>
  </div>
</div>
```

```css
.acq-cal { margin-top: 10px; }
.acq-cal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.acq-cal-head b { font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #EAF0F6; }
.acq-cal-nav { width: 26px; height: 26px; display: inline-flex; align-items: center; justify-content: center; background: none; border: 0; color: rgba(234,240,246,0.5); cursor: pointer; }
.acq-cal-nav:hover { color: #FFFFFF; }
.acq-cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
.acq-cal-grid .dow { text-align: center; font-size: 9px; font-weight: 600; letter-spacing: 0.12em; color: rgba(255,255,255,0.6); padding-bottom: 4px; }
.acq-day { position: relative; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 11.5px;
           font-variant-numeric: tabular-nums; color: rgba(255,255,255,0.34); background: none; border: 1px solid transparent; }
button.acq-day { cursor: pointer; color: #EAF0F6; font-weight: 600; transition: border-color .2s, background .2s; }
button.acq-day:hover { border-color: rgba(255,255,255,0.24); }
button.acq-day i { position: absolute; bottom: 3px; left: 50%; width: 4px; height: 4px; margin-left: -2px; border-radius: 50%; background: #2FC6DC; }
button.acq-day.on { border-color: #2FC6DC; background: rgba(47,198,220,0.12); }
```

Changing month while open re-measures the dropdown's height (`body.style.height = inner.scrollHeight`).

## 4. Data (sample) and colours

```js
var STATIONS = [
  { name: 'Svalbard',    code: 'SGS', lat: 78.23, lon: 15.41 },
  { name: 'Matera',      code: 'MTI', lat: 40.65, lon: 16.70 },
  { name: 'Maspalomas',  code: 'MPS', lat: 27.76, lon: -15.63 },
  { name: 'Inuvik',      code: 'INU', lat: 68.36, lon: -133.72 },
  { name: 'Neustrelitz', code: 'NSG', lat: 53.33, lon: 13.07 }
];
/* t: sensing start in minutes from 2026-07-16 00:00Z (the sim day); dur in seconds; swath in km;
   T: orbital period in minutes; lat/lon: footprint centre */
var DTK = [
  { id: 'S2A-48201-1', mission: 'S2A', sat: 'Sentinel-2A', group: 'Sentinel-2', pct: 100.0, status: 'Published', station: 'Svalbard',
    date: '2026-07-16', t: 10*60 + 42 + 1/60, dur: 205, lat: 48.2, lon: 11.6, swath: 290, T: 100.6, mode: 'MSI · NOBS', orbit: '048201', instr: 'MSI', mcode: 'NOBS', swathId: 'NA', pol: 'NA', rel: 22,
    pass: { at: '11:02:14Z', mb: 18400, s: 41 } },
  { id: 'S1C-57622', mission: 'S1C', sat: 'Sentinel-1C', group: 'Sentinel-1', pct: 79.3, status: 'Processing', station: 'Matera',
    date: '2026-07-16', t: 9*60 + 33 + 10/60, dur: 130, lat: 44.1, lon: 8.9, swath: 250, T: 98.6, mode: 'SAR · IW', orbit: '057622', instr: 'SAR', mcode: 'IW', swathId: 'NA', pol: 'DV', rel: 33,
    pass: { at: '09:48:37Z', mb: 11250, s: 29 } },
  { id: 'S3B-080-345', mission: 'S3B', sat: 'Sentinel-3B', group: 'Sentinel-3', pct: 92.5, status: 'Processing', station: 'Maspalomas',
    date: '2026-07-16', t: 8*60 + 11 + 45/60, dur: 183, lat: 30.4, lon: -13.2, swath: 1270, T: 100.99, mode: 'OLCI · EO', orbit: '040812', instr: 'OLCI', mcode: 'EO', swathId: 'NA', pol: 'NA', rel: 80,
    pass: { at: '08:26:05Z', mb: 9600, s: 36 } },
  { id: 'S2B-42050-1', mission: 'S2B', sat: 'Sentinel-2B', group: 'Sentinel-2', pct: 99.9, status: 'Published', station: 'Inuvik',
    date: '2026-07-16', t: 7*60 + 20 + 50/60, dur: 252, lat: 63.1, lon: -126.4, swath: 290, T: 100.6, mode: 'MSI · NOBS', orbit: '042050', instr: 'MSI', mcode: 'NOBS', swathId: 'NA', pol: 'NA', rel: 109,
    pass: { at: '07:39:12Z', mb: 22600, s: 50 } },
  { id: 'S5P-60012', mission: 'S5P', sat: 'Sentinel-5P', group: 'Sentinel-5P', pct: 97.0, status: 'Published', station: 'Neustrelitz',
    date: '2026-07-16', t: 6*60 + 12/60, dur: 400, lat: 51.4, lon: 19.8, swath: 2600, T: 101.3, mode: 'TROPOMI · NOM', orbit: '060012', instr: 'TROPOMI', mcode: 'NOM', swathId: 'NA', pol: 'NA', rel: 11,
    pass: { at: '06:21:40Z', mb: 14100, s: 33 } },
  { id: 'S3A-055-358', mission: 'S3A', sat: 'Sentinel-3A', group: 'Sentinel-3', pct: 0.0, status: 'Failed', station: 'Svalbard',
    date: '2026-07-15', t: -(24*60) + 22*60 + 14 + 30/60, dur: 108, lat: 71.6, lon: 24.3, swath: 1400, T: 100.99, mode: 'SLSTR · NOM', orbit: '033358', instr: 'SLSTR', mcode: 'NOM', swathId: 'NA', pol: 'NA', rel: 55,
    pass: null }
];
DTK.forEach(function (d, i) { d.i = i; d.tone = d.pct >= 95 ? 'ok' : d.pct > 0 ? 'warn' : 'crit'; });
```

Our mock (`ACQ_DATATAKES`) has 11 datatakes placed 1–23 h before "now". Map: `t` = minutes from
today 00:00Z (negative for yesterday) from `startIso`; `dur` = `sensingS`; tone = `cls`.
Fields our mock lacks (`lat`, `lon`, `swath` km, `T` min) must be added per datatake: use the values
above for the six shared IDs; for the others use the mission's typical swath (S1 IW 250, S1 EW 400,
S2 290, S3 OLCI 1270 / SLSTR 1400, S5P 2600) and period (S1 98.6, S2 100.6, S3 100.99, S5P 101.3) and a
plausible footprint centre.

Colours (one set everywhere: footprints, satellite dots, list dots):

```js
var COL = { ok: '#34d399', warn: '#f5b544', crit: '#ff5c5c' };   // footprints + satellites
var DOT = { ok: '#34d399', warn: '#f5b544', crit: '#ff5c5c' };   // Datatake list dots (same values)
/* status pill in the panel: by STATUS, not by tone */
var PILL = { Published: '#00e676', Processing: '#9d4edd', Failed: '#ff3366' };   // other → #737373
```

## 5. Orbits and footprints (geometry — port verbatim)

Every datatake carries its own satellite: a descending pass at 98.6° inclination that crosses the
footprint centre at mid-sensing. The footprint is the swath swept during sensing. The Earth rotates
under the track (`WE`). Time `t` is in minutes.

```js
var D2R = Math.PI / 180, R2D = 180 / Math.PI;
var DAYMIN = 1440, INC = 98.6 * D2R, WE = 360 / 1436.07; /* degrees of Earth rotation per minute */
DTK.forEach(function (d) {
  /* a descending pass that crosses the footprint centre at mid-sensing */
  var tc = d.t + d.dur / 120, su = Math.sin(d.lat * D2R) / Math.sin(INC);
  var uc = Math.PI - Math.asin(Math.max(-1, Math.min(1, su)));
  d.tc = tc; d.uc = uc;
  d.lon0 = d.lon - Math.atan2(Math.cos(INC) * Math.sin(uc), Math.cos(uc)) * R2D + WE * tc;
});
function subPoint(d, t) {                     /* [lon, lat] of the satellite's ground point at time t */
  var u = d.uc + 2 * Math.PI * (t - d.tc) / d.T;
  var lat = Math.asin(Math.sin(INC) * Math.sin(u)) * R2D;
  var lon = d.lon0 + Math.atan2(Math.cos(INC) * Math.sin(u), Math.cos(u)) * R2D - WE * t;
  lon = ((lon + 540) % 360) - 180;
  return [lon, lat];
}
function dest(p, brng, km) {  /* point at a distance along a bearing, on the sphere */
  var d = km / 6371, la1 = p[1] * D2R, lo1 = p[0] * D2R, b = brng * D2R;
  var la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  var lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [((lo2 * R2D + 540) % 360) - 180, la2 * R2D];
}
function bearing(a, b) {
  var la1 = a[1] * D2R, la2 = b[1] * D2R, dl = (b[0] - a[0]) * D2R;
  return Math.atan2(Math.sin(dl) * Math.cos(la2), Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dl)) * R2D;
}
/* footprint: the swath swept during sensing, as a closed ring */
DTK.forEach(function (d) {
  var n = 24, left = [], right = [], t0 = d.t, t1 = d.t + d.dur / 60;
  for (var k = 0; k <= n; k++) {
    var t = t0 + (t1 - t0) * k / n, p = subPoint(d, t), q = subPoint(d, t + 0.05), b = bearing(p, q);
    left.push(dest(p, b - 90, d.swath / 2)); right.push(dest(p, b + 90, d.swath / 2));
  }
  var ring = left.concat(right.reverse()); ring.push(ring[0]);
  d.poly = { type: 'Polygon', coordinates: [ring] };   // (d3 winding fix omitted — not needed in three.js)
});
```

three.js notes: keep `left[]`/`right[]` (25 points each) and build the fill as a **strip** of quads
`left[k], left[k+1], right[k+1], right[k]`. For wide swaths (S3, S5P) subdivide across-track (slerp
4–8 steps between `left[k]` and `right[k]`) so the surface hugs the sphere. The outline is the ring.
Hit-testing = raycast against the fill mesh (the prototype uses `d3.geoContains`).

## 6. The globe view

Prototype: orthographic projection, transparent canvas, centre shifted **up by 4% of the stage
height**, radius `0.39 × min(W, H) × zoom`.

```js
baseR = Math.min(W, H) * 0.39;
proj.scale(baseR * S.zoom).translate([W / 2, H / 2 - H * 0.04]).rotate(S.rot);
var HOME_VIEW = [-4, -34];        // d3 rotation = view centred on lon 4°E, lat 34°N
S.zoom = 1;                       // limits: 0.7 … 8
cvs.classList.toggle('zoomed', S.zoom > 1.3);   // the soft oval mask (already in acq-globe.module.css .globeZoomed)
```

Atmosphere (already ported): radial gradient from 0.98 to 1.15 planet radii, `rgba(110,170,255)` 0.34 → 0.

Imagery: day texture by day, city lights in the Earth's shadow, terminator from the sim time (our
`dayNightEarth` already does this). While textures load: navy sphere, graticule `rgba(255,255,255,0.06)`,
land `#3a6284→#1d3a57`, coastline `rgba(110,220,240,0.55)` 0.7px.

### Conversion to three.js (perspective camera, unit sphere)

Keep **one view state** `{ lon, lat, zoom }` (centre of view in degrees + zoom) and derive the camera
from it every frame. Never accumulate rotations on `camera.position` (that is what lets it flip).

```ts
// apparent globe radius the prototype wants, in CSS px
const radiusPx = 0.39 * Math.min(W, H) * zoom;
// camera distance that shows a unit sphere with that radius (fov = vertical fov)
const tanHalf = Math.tan((camera.fov * Math.PI / 180) / 2);
const dist = Math.sqrt(1 + (H / (2 * radiusPx * tanHalf)) ** 2);
// position: on the view direction (lat, lon) in the EarthGroup frame, at dist; lookAt(0,0,0)
// centre 4% above the stage middle:
camera.setViewOffset(W, H, 0, 0.04 * H, W, H);   // positive y offset moves the picture up
```

At zoom 8 the distance is ≈1.07, so `camera.near` must be ≤ 0.01. `EarthGroup` must not rotate on its
own (`autoRotate` off at all times): the prototype's Earth is fixed in the frame.

## 7. What is drawn, in order, and how

Only datatakes that pass the Satellite + Day filters (`visible(d)`) are drawn.

```js
/* 1. footprints */
var sel = d.i === S.sel, c = COL[d.tone];
var pulse = sel ? 0.5 + 0.5 * Math.sin(performance.now() / 420) : 0;
fill:   c, alpha = sel ? 0.34 + 0.18 * pulse : (S.sel >= 0 ? 0.14 : 0.24);
stroke: sel ? '#ffffff' : c, alpha 1, width = sel ? 1.4 + 0.8 * pulse : 0.9;

/* 2. stations and their contacts — a station is in contact while ANY visible datatake's satellite
      is within 22° of it; one dashed link PER satellite in range */
link:   great-circle line subPoint → station, dash [3, 3], 'rgba(0,229,255,0.75)', width 1;
circle: 22° around the station, fill 'rgba(0,229,255,0.06)', stroke 'rgba(0,229,255,0.28)' 0.8px  (drawn even if the station is behind the globe; clipped by it)
marker: only if the station is on the near side (angular distance from view centre < 90°)
        antenna + name tag (already ported in StationMarker; offsets left 7 / top -10, tag 17px high)

/* 3. satellites (one per visible datatake): trail, track ahead, dot, label */
trail:  31 points, subPoint(d, S.time - k * 0.8) for k = 30 … 0 (the last 24 minutes)
        stroke sel ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)', width sel ? 1.4 : 1
ahead:  selected only — subPoint(d, S.time + f * 0.8), f = 0 … 30, dash [2, 4], 'rgba(255,255,255,0.45)'
dot:    hidden if the ground point is on the far side; r = sel ? 4.5 : 3.2, fill sel ? '#ffffff' : COL[d.tone],
        stroke 1.5px 'rgba(4,6,11,0.9)'
label:  d.mission at (x + 7, baseline y - 6); font sel ? "600 10px 'Noto Sans'" : "10px 'Noto Sans'"
        (the prototype's --font-mono is Noto Sans here); fill sel ? '#ffffff' : 'rgba(230,236,245,0.8)'
```

Our mock has several datatakes per satellite (S1C, S3A, S5P twice). The prototype has one satellite
per datatake. Draw **one marker per satellite**: use the selected datatake's orbit for the selected
satellite, otherwise the datatake whose sensing time is closest to the sim time.

## 8. Interaction

```js
/* camera flight: shortest way round in longitude, easeInOutCubic, 1300 ms, zoom eased too */
function rotateTo(target, zoom) {
  var from = S.rot.slice(), z0 = S.zoom, z1 = zoom || S.zoom, t0 = performance.now(), dur = 1300;
  var dl = ((target[0] - from[0] + 540) % 360) - 180;
  (function step(now) {
    var k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    S.rot = [from[0] + dl * e, from[1] + (target[1] - from[1]) * e]; S.zoom = z0 + (z1 - z0) * e; draw();
    if (k < 1) S.anim = requestAnimationFrame(step);
  })(t0);
}

/* drag: 0.25° per px, divided by the zoom; latitude clamped to ±90 (never flips); pointer capture */
var dx = e.clientX - drag.x, dy = e.clientY - drag.y, k = 0.25 / S.zoom;
if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
S.rot = [drag.r[0] + dx * k, Math.max(-90, Math.min(90, drag.r[1] - dy * k))];
// in view-centre terms: centreLon -= dx*k; centreLat = clamp(centreLat + dy*k, -90, 90)
cursor: 'grab', 'grabbing' while dragging

/* click (no drag): on a footprint → select it; on the SELECTED footprint → deselect (= the ×);
   anywhere else on the globe while something is selected → deselect */

/* wheel: the page scrolls. Ctrl/Cmd + wheel (and trackpad pinch, which sends ctrlKey) zooms */
if (!(e.ctrlKey || e.metaKey)) { show hint for 1300 ms; return; }        // no preventDefault
e.preventDefault(); S.zoom = Math.max(0.7, Math.min(8, S.zoom * Math.exp(-e.deltaY * 0.004)));
hint text: (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl') + ' + scroll to zoom the globe'

/* keyboard on the focused globe (tabindex 0) */
ArrowLeft/Right: centre lon ∓ 4 (Shift: 12)    ArrowUp/Down: centre lat ± 4 (Shift: 12), clamped
'+' or '=': zoom × 1.2 (max 8)     '-': zoom ÷ 1.2 (min 0.7)     '0': reset
']' / '[': next / previous visible datatake (wraps)     Enter: play / pause
Escape (document): close the open dropdown, else deselect

/* zoom buttons */
+ : rotateTo(S.rot, Math.min(8, S.zoom * 1.35))      − : rotateTo(S.rot, Math.max(0.7, S.zoom / 1.35))
⌖ : resetView()  =  selected ? select(-1, fly) : rotateTo(HOME_VIEW, 1)

/* how close to come: the footprint fills about a third of the globe's window */
function fitZoom(d) {
  var c = [d.lon, d.lat], far = 0;
  d.poly.coordinates[0].forEach(function (p) { far = Math.max(far, d3.geoDistance(c, p)); });
  var want = Math.min(W, H) * 0.3, z = want / (baseR * Math.max(0.02, Math.sin(far)));
  return Math.max(1.4, Math.min(5, z));
}

function select(i, fly) {
  var was = S.sel; S.sel = i;
  layout.classList.toggle('has-sel', i >= 0);  paintRail(); paintList();
  if (i < 0) { if (fly) rotateTo(HOME_VIEW, 1); else draw(); return; }     // deselect = back HOME, zoom 1
  var d = DTK[i];
  /* fly to the footprint: out a little first when jumping from one datatake to another, then in */
  if (fly) {
    if (was >= 0 && was !== i && S.zoom > 1.6) {
      rotateTo(S.rot, 1.2);
      setTimeout(function () { if (S.sel === i) rotateTo([-d.lon, -d.lat], fitZoom(d)); }, 520);
    } else rotateTo([-d.lon, -d.lat], fitZoom(d));
  }
}
```

Any user drag/wheel cancels a running flight. If a filter hides the selected datatake, it is deselected.
Start state: nothing selected, view `HOME_VIEW`, zoom 1, clock playing ×60.

Wheel hint style:

```css
.acq-wheel-hint { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%) scale(0.96); z-index: 4;
  padding: 12px 18px; pointer-events: none; white-space: nowrap;
  background: rgba(0,0,0,0.62); border: 1px solid rgba(255,255,255,0.12);
  color: #EAF0F6; font-size: 12px; font-weight: 500; letter-spacing: 0.08em;
  opacity: 0; transition: opacity 260ms ease, transform 260ms ease; }
.acq-wheel-hint.on { opacity: 1; transform: translate(-50%, -50%) scale(1); }
```

Zoom controls (already ported, matches): top/right 16px, 32px squares, radius 8px, gap 6px,
`rgba(8,11,18,0.6)` + blur 8px, border `rgba(255,255,255,0.14)` → hover `0.4` / bg `rgba(20,28,42,0.75)`.

## 9. Simulation bar (bottom of the globe stage)

```html
<div class="simbar">
  <div class="simctl" role="toolbar" aria-label="Simulation clock">
    <button class="play" aria-label="Pause simulation" aria-pressed="true"><span aria-hidden="true">❚❚</span></button>  <!-- paused: ▶ -->
    <div class="simtime"><span>2026-07-16 01:23:38Z</span><small>SIMULATION TIME</small></div>
    <input class="scrub" type="range" min="0" max="1440" step="1" aria-label="Simulation time of day" style="--fill: 5.8%">
    <button class="speed" aria-label="Simulation speed 60 times real time. Activate to change."><span aria-hidden="true">×60</span></button>
  </div>
</div>
```

```css
.simbar { position: absolute; left: 0; right: 0; bottom: 0; z-index: 3; display: flex; flex-direction: column; gap: 10px;
          padding: 12px 16px; background: none; }
.simctl { display: flex; align-items: center; gap: 14px; }
.play   { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; border: none; cursor: pointer;
          background: #007c93; color: #000000; font-size: 12px; display: grid; place-items: center; }   /* no glow */
.simbar :focus-visible { outline: 2px solid #00e5ff; outline-offset: 2px; }
.simtime { display: flex; flex-direction: column; line-height: 1.15; flex-shrink: 0; }
.simtime span  { font-family: 'Noto Sans'; font-size: 13px; color: rgb(234,240,248); }                 /* weight 400 */
.simtime small { font-family: 'Noto Sans'; font-size: 8.5px; letter-spacing: 0.14em; color: rgba(205,217,236,0.5); }
.scrub { --fill: 0%; flex: 1 1 0%; min-width: 60px; height: 14px; margin: 0; padding: 0; background: transparent; cursor: pointer; appearance: none; }
.scrub::-webkit-slider-runnable-track { height: 5px; border-radius: 3px;
          background: linear-gradient(90deg, #00e5ff 0 var(--fill), rgba(255,255,255,.14) var(--fill) 100%); }
.scrub::-webkit-slider-thumb { appearance: none; width: 11px; height: 11px; margin-top: -3px; border: none; border-radius: 50%;
          background: #ffffff; box-shadow: 0 0 0 1px rgba(4,6,11,0.6); }
/* (add the matching ::-moz-range-track / ::-moz-range-progress / ::-moz-range-thumb for Firefox) */
.speed  { font-family: 'Noto Sans'; font-size: 12px; color: rgb(205,217,236); cursor: pointer; padding: 4px 10px;
          background: transparent; border: 1px solid rgba(255,255,255,0.16); border-radius: 999px; user-select: none; flex-shrink: 0; }
@media (max-width: 780px) { .simbar { gap: 8px; padding: 10px 12px; } .simctl { gap: 10px; } }
@media (max-width: 560px) { .simctl { flex-wrap: wrap; row-gap: 8px; } .simtime small { display: none; } .simtime span { font-size: 12px; }
                            .scrub { flex-basis: 100%; order: 3; } .simctl .speed { margin-left: auto; } }
```

```js
var SPEEDS = [1, 10, 60, 600];                       // the speed pill cycles through these
S.time += dt * S.speed / 60;                          // minutes; dt in s, capped at 0.25 s
if (S.time >= DAYMIN) S.time -= DAYMIN;
scrub.value = Math.round(minuteOfDay); scrub.style.setProperty('--fill', (minuteOfDay / 1440 * 100).toFixed(1) + '%');
time text: 'YYYY-MM-DD HH:MM:SSZ'
/* perf: the globe repaints at most every 32 ms, not while the page scrolls, not while off-screen */
```

## 10. Datatake panel (side column)

Layout: the globe takes the whole row; selecting opens a side column and the globe narrows.

```css
.acq-layout { display: flex; align-items: flex-start; gap: 0; }
.acq-layout > .globe-card { flex: 1 1 auto; min-width: 0; transition: flex-basis 820ms cubic-bezier(.65,0,.25,1); }
.acq-layout > .acq-side { flex: 0 0 0; width: 0; min-width: 0; margin-left: 0; opacity: 0; transform: translateX(28px); pointer-events: none;
  overflow-x: clip; overflow-y: visible; height: auto;
  transition: flex-basis 820ms cubic-bezier(.65,0,.25,1), margin-left 820ms cubic-bezier(.65,0,.25,1), opacity 460ms ease, transform 820ms cubic-bezier(.2,.7,.2,1); }
.acq-layout.has-sel > .acq-side { flex-basis: max(320px, 25vw); margin-left: 12px; opacity: 1; transform: none; pointer-events: auto;
  transition: flex-basis 820ms cubic-bezier(.65,0,.25,1), margin-left 820ms cubic-bezier(.65,0,.25,1), opacity 560ms ease 260ms, transform 820ms cubic-bezier(.2,.7,.2,1) 200ms; }
.acq-side .dtk-rail { width: max(320px, 25vw); }                      /* laid out at final width from the start */
.dtk-rail { display: flex; flex-direction: column; gap: 0; text-shadow: 0 1px 6px rgba(0,0,0,0.9), 0 0 18px rgba(0,0,0,0.6); }
.dtk-block { background: none; border: 0; padding: 0 0 22px; }       /* no top padding: aligned with the globe's top */
@keyframes acqIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.has-sel .dtk-block { animation: acqIn 640ms cubic-bezier(.2,.7,.2,1) 380ms backwards; }
@media (max-width: 980px) { .acq-layout { flex-direction: column; } /* panel full width under the globe */ }
@media (prefers-reduced-motion: reduce) { .acq-layout > *, .dtk-block { transition: none !important; animation: none !important; } }
```

On close the column shrinks and the panel fades (460 ms) — the content must stay rendered while it
does (keep the last datatake mounted until the transition ends).

Markup (live `paintRail`):

```html
<aside class="dtk-rail" aria-label="Datatake S2A-48201-1">
  <div class="dtk-block">
    <div class="dtk-head">
      <span class="sel-id"><span class="eyebrow">Datatake</span><span class="dtk-id">S2A-48201-1</span><span class="mission">S2A</span></span>
      <span class="acq-head-r"><span class="pill" style="color: PILL[status]">Published</span>
        <button class="acq-close" aria-label="Close the datatake"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.5"/></svg></button></span>
    </div>
    <div class="dtk-kpi"><div class="big">100.0<sup>%</sup></div>
      <dl class="dtk-aside"><div><dt>Sensing</dt><dd>3m 25s</dd></div>
        <div><dt title="Missing sensing summed across 5 expected product types">Missing</dt><dd>none</dd></div></dl></div>
    <p class="dtk-kpi-note">Mean across 5 expected product types · missing time summed across types</p>
    <dl class="acq-record"> <div><dt>Satellite ID</dt><dd>S2A</dd></div> … </dl>
  </div>
</aside>
```

Record rows (already ported in `DatatakePanel`, matches): Satellite ID · Datatake ID · Mode · Swath ·
Polarisation · Observation time start · Observation time stop · Observation duration · Orbit absolute ·
Orbit relative · Acquisition status `Acquired (100.00%)`/`Failed (0.00%)` · Publication status
`Published (100.00%)`/`Not published (0.00%)` · then Downlink station `Svalbard (SGS)` · Downlink time ·
Downlink volume `18,400 Mb` · Downlink duration `41 s` — or Downlink station + `Downlink: No pass`.
Missing = Σ over expected types of `(1 − pct/100) × dur`; shown `none` below 0.5 s.

Resolved typography (prototype values):

```css
.dtk-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.sel-id   { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.eyebrow  { font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(234,240,246,0.34); }
.dtk-id   { display: block; margin-top: 8px; font-size: clamp(25px, 2.6vw, 36px); font-weight: 700; letter-spacing: 0.01em;
            line-height: 0.95; text-transform: uppercase; color: #FFFFFF; overflow-wrap: anywhere; }
.mission  { display: block; margin-top: 10px; font-size: 13px; letter-spacing: 0.04em; color: rgba(234,240,246,0.55); }
.acq-head-r { display: inline-flex; align-items: center; gap: 10px; }
.pill     { display: inline-flex; align-items: center; gap: 8px; padding: 0; border: 0; background: none;
            font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
.pill::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: currentColor; box-shadow: 0 0 10px currentColor; }
.acq-close { width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; border: 0; background: none;
             color: rgba(234,240,246,0.6); cursor: pointer; transition: color .2s; }
.acq-close:hover { color: #FFFFFF; }
.dtk-kpi  { display: flex; align-items: baseline; gap: 22px; margin-top: 14px; }
.dtk-kpi .big     { font-size: 44px; font-weight: 700; line-height: 1; letter-spacing: -0.03em; color: #FFFFFF; }
.dtk-kpi .big sup { font-size: 17px; margin-left: 2px; color: #737373; }
.dtk-aside        { display: flex; flex-direction: column; gap: 4px; margin: 0; font-size: 12px; }
.dtk-aside > div  { display: flex; gap: 8px; }
.dtk-aside dt     { min-width: 58px; align-self: center; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #737373; }
.dtk-aside dd     { margin: 0; font-size: 12px; }
.dtk-aside dd.gap { color: #ffb700; }                                   /* missing time ≠ 0 */
.dtk-kpi-note     { margin: 10px 0 0; font-size: 11px; line-height: 1.45; color: rgba(234,240,246,0.45); }
.acq-record       { display: grid; grid-template-columns: 1fr; margin: 18px 0 0; }
.acq-record > div { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 12px; padding: 7px 0;
                    border-top: 1px solid rgba(255,255,255,0.07); }
.acq-record > div:last-child { border-bottom: 1px solid rgba(255,255,255,0.07); }
.acq-record dt    { align-self: center; font-size: 10px; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(234,240,246,0.42); }
.acq-record dd    { margin: 0; font-size: 13px; font-weight: 500; color: #EAF0F6; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
@media (max-width: 560px) { .dtk-kpi { gap: 16px; } .dtk-kpi .big { font-size: 36px; } }
```

## 11. Current code vs. reference (as of 2026-10-24) and open decisions

| Area | Current `AcquisitionsGlobeEarth.tsx` | Reference |
|---|---|---|
| Globe motion | `autoRotate={!isModalOpen}` | never turns on its own |
| Home view | camera (0,0,3), whatever ThreeEarth faces | centre lon 4°E, lat 34°N, zoom 1, centre 4% above middle, radius 0.39·min(W,H) |
| Footprints | `SAMPLE_SWATHS`: 6 hand-made quads, unrelated to the datatakes' positions | swept swath computed from each datatake (§5) |
| Satellites | `SAMPLE_SATELLITES`: 3 (S1C, S2A, S3B), own orbits, `progress` counter | one per datatake/satellite, position = `subPoint(d, simTime)` |
| Colours | ok `#3dd68c`, crit `#ef4444`, satellites by mission colour | ok `#34d399`, warn `#f5b544`, crit `#ff5c5c` for footprints, dots and satellites |
| Footprint outline | opacity 0.9 | opacity 1 (selected: white, 1.4–2.2 px pulse — WebGL lines are 1 px unless Line2 is used) |
| Drag | rotates `camera.position` about world X/Y, 0.008 rad/px, can flip | lon/lat view state, 0.25°/px ÷ zoom, lat clamped |
| Wheel | always zooms, `preventDefault` | Ctrl/Cmd only; plain wheel scrolls the page + hint |
| Keyboard | none | arrows, +/−, 0, [ ], Enter, Escape |
| Deselect | backs out keeping direction | flies back to HOME_VIEW, zoom 1 |
| Click on empty globe | nothing | deselects |
| Datatake dropdown | acts as a **filter** (hides other footprints, changes KPIs), has "All datatakes", value "All" | a **selector**; no "All" item; value "None"; others stay, dimmed |
| Search | filters the globe and KPIs | narrows the Datatake list only; typing opens it |
| KPI formulas | acquired = share ≥95 %; published = share "Published"; failed = `cls === 'crit'` | acquired = share not Failed; published = mean pct; failed = pct 0 |
| Day value | `10-24` | `24 Oct`; heading becomes the single date |
| Calendar | every day clickable, `‹ ›` glyphs, 3px dot | only days with data are buttons, SVG chevrons, 28px cells, 4px dot, cyan frame when chosen |
| List items | chosen = cyan; 12px/600/.14em/.66 | others dimmed (`.off`); 12.5px/500/.12em/.9; secondary `100.0% · Published` |
| Dropdown hover/open | hairline turns cyan | caption turns cyan; hairline stays .30 |
| Simulation bar | inline styles, system-ui, 42px glowing button, speeds 1/10/60/100/300/1000 | §9: 34px `#007c93`, Noto Sans, custom track, speeds 1/10/60/600 |
| Side column | `max(340px, 26vw)`, panel top padding `clamp(24px,6vh,56px)`, slide-in X 14px | `max(320px, 25vw)` + 12px margin, no top padding, block rises Y 16px; fades out on close |
| Status pill | coloured by tone | Published `#00e676`, Processing `#9d4edd`, Failed `#ff3366` |

Decisions (confirmed 2026-10-24 — these override the prototype where they differ):
1. Dropdown list: **in flow, pushes the globe down, as in the prototype and on Events** (the floating
   overlay is dropped).
2. Panel caption contrast: **keep the current brighter values** (keys 0.52–0.62 via --dp-ink-2/-3)
   instead of the prototype's 0.34/0.42/0.45/0.55. Every other panel value follows §10.
3. Sim clock start: **open at the current UTC time of day** (not the prototype's fixed 01:23:38).
4. Satellites with several datatakes: **one marker per satellite** (§7), not one per datatake.
5. Datatake filter (stakeholder requirement, overrides §3 "Selection semantics"): **the Datatake
   dropdown stays a real filter**. Picking a datatake — from the list, the search (Enter) or by
   clicking its footprint — selects it AND hides every other footprint and satellite; the panel opens
   and the globe flies to it. The list keeps an **"All datatakes"** first item; the value reads "All"
   when none is chosen. Clearing (All datatakes, ×, ⌖, Escape, a click on the empty globe or on the
   footprint itself) shows everything again and flies home. KPIs follow all three filters
   ("Datatakes in view: 1" while one is chosen). The search still only narrows the list.
