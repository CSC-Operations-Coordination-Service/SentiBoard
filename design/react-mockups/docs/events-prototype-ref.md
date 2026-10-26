# Events page — prototype reference (extracted from SentiBoard.html, src-events)

Extracted 2026-10-23 from the bundled prototype `SentiBoard.html` (the events page is base64-encoded
inside it). These are the exact values to reproduce. Do not decode the bundle again; use this file.

## Types, colours, icons (16×16 viewBox, stroke-width 1.3, round caps, no fill)

```js
var TYPES = {
  acq: { label: "Acquisition", color: "#A7B1BE" },
  cal: { label: "Calibration", color: "#4FC9CB" },
  man: { label: "Manoeuvre", color: "#EFA73C" },
  pro: { label: "Production", color: "#B45CF2" },
  sat: { label: "Satellite", color: "#F2772B" },
};
var ICONS = {
  acq: '<ellipse cx="6.6" cy="6.8" rx="4.5" ry="2.5" transform="rotate(-40 6.6 6.8)"/><path d="M6.6 6.8 10.1 3.3"/><circle cx="10.6" cy="2.8" r="0.9"/><path d="M8.4 8.8 10.7 13.1"/><path d="M8.5 13.3h4.4"/>',
  cal: '<circle cx="8" cy="8" r="5.3"/><path d="M6.1 9.9 9.9 6.1"/>',
  man: '<circle cx="8" cy="5.3" r="2.3"/><path d="M8 7.6v4.3M5.2 13.3h5.6"/>',
  pro: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.6v2.2M8 12.2v2.2M1.6 8h2.2M12.2 8h2.2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5 11 5M5 11l-1.5 1.5"/>',
  sat: '<path d="M8 4.1 11.9 8 8 11.9 4.1 8z"/><path d="M11.6 4.4 13.7 2.3M2.3 13.7l2.1-2.1"/><path d="M13.4 2.9 3 13.3"/>',
};
function icon(type, color) {
  return (
    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="' +
    color +
    '" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' +
    ICONS[type] +
    "</svg>"
  );
}
```

## Calendar dot ("star") — one per event, three concentric circles in the type colour

Closed calendar: no icon. Zoomed view: same dot + the type icon drawn to its right (`withIcon`).
Dots sit at 60% of the cell height, centred horizontally; several events on one day are spread
side by side, 27% of the cell width apart. The transparent r=17 circle is the hit area.

```js
  function starPos(e, g) {
    var c = cellBox(e.day, g);
    var o = ORDER[e.id] || { i: 0, n: 1 };
    var gap = CW * 0.27;
    return {
      x: c.x + CW / 2 + (o.i - (o.n - 1) / 2) * gap,
      y: c.y + CH * 0.6
    };
  }
    var cx = p.x.toFixed(1), cy = p.y.toFixed(1);
    var glyph = '';
    if (withIcon) {
      var gx = (p.x + rr * 2.4).toFixed(1), gy = (p.y - 7.5).toFixed(1);
      glyph = '<g class="zicon" transform="translate(' + gx + ' ' + gy + ')" fill="none" stroke="' + tc +
        '" stroke-width="1.3" stroke-linecap="round" vector-effect="non-scaling-stroke">' + ICONS[e.type] + '</g>';
    }
    return '<g class="star' + (lit ? ' on' : '') + '" data-day="' + e.day + '" data-event="' + e.id + '" data-sat="' + e.sat +
      '" role="img" aria-label="' + esc(TYPES[e.type].label + ' ' + e.sat + ' ' + e.name) + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rr * 3.8).toFixed(1) + '" fill="' + tc + '" opacity="0.1"></circle>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rr * 2).toFixed(1) + '" fill="' + tc + '" opacity="0.2"></circle>' +
      '<circle class="core" cx="' + cx + '" cy="' + cy + '" r="' + rr.toFixed(1) + '" fill="' + tc + '"></circle>' +
      glyph +
      '<circle cx="' + cx + '" cy="' + cy + '" r="17" fill="#000" fill-opacity="0"></circle></g>';
  }
```

```css
.msat-b {
  animation: msatB 67s linear infinite 12s;
}
.star {
  cursor: pointer;
  transform-box: fill-box;
  transform-origin: center;
  transition: transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1);
  animation: starIn 300ms ease backwards;
}
.star .core {
  transition: opacity 160ms ease;
}
.star:hover .core {
  opacity: 0.7;
}
.zicon {
  animation: iconIn 460ms ease 1140ms backwards;
}
@keyframes iconIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

## Hover tooltip (final style; the orbiting-satellite SVG is hidden by the last override, skip it)

```css
.startip {
  position: fixed; z-index: 45; display: none; align-items: center; gap: 13px;
  padding: 30px 56px; border-radius: 50%; pointer-events: none; white-space: nowrap;
  background: rgba(0,0,0,0.84); border: 1px solid rgba(255,255,255,0.16);
  backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
}
.startip svg { flex: 0 0 auto; }
.st-txt { display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
.st-type { font-family: 'Noto Sans', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.st-name { font-family: 'Noto Sans', sans-serif; font-size: 14px; font-weight: 500; color: #EAF0F6; }
.startip.on { display: flex; }
@keyframes sbTipFade { from { opacity: 0; } to { opacity: 1; } }
.startip { gap: 12px; padding: 15px 17px; border-radius: 14px; min-width: 226px; box-sizing: border-box;
  background: rgba(9,13,18,0.96); border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 20px 44px rgba(0,0,0,0.65);
  backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px); }
.startip.on { animation: sbTipFade 160ms ease backwards; }
.startip > svg:not(:first-child) { display: none; }          /* no orbiting satellite around a rectangle */
.startip.flip { transform: translateX(calc(-100% - 28px)); }
.st-txt { gap: 4px; }
.st-type { font-size: 10px; font-weight: 600; letter-spacing: 0.18em; }
.st-name { font-size: 13.5px; font-weight: 700; letter-spacing: 0.04em; color: #FFFFFF; }
</style>
```

```js
// content: icon(type) + "<TYPE LABEL> · <SAT>" in the type colour, then the event title
      '</g></svg>';
  }
  $('#skyView').addEventListener('mousemove', function (e) {
    var g = e.target.closest('.star');
    if (!g) { hideTip(); return; }
    if (tip.dataset.ev !== g.dataset.event) {
      var ev = EVENTS.filter(function (x) { return x.id === g.dataset.event; })[0];
      if (!ev) { hideTip(); return; }
      tip.dataset.ev = ev.id;
      tip.innerHTML = icon(ev.type, TYPES[ev.type].color) +
        '<span class="st-txt"><span class="st-type" style="color: ' + TYPES[ev.type].color + ';">' +
        TYPES[ev.type].label + ' · ' + ev.sat + '</span>' +
        '<span class="st-name">' + esc(ev.name) + '</span></span>';
      tip.classList.add('on');
      tip.insertAdjacentHTML('beforeend', tipOrbit(tip.offsetWidth, tip.offsetHeight, TYPES[ev.type].color));
    }
    var flip = e.clientX > window.innerWidth - 230;
    tip.classList.toggle('flip', flip);
    tip.style.left = (e.clientX + (flip ? -18 : 18)) + 'px';
    tip.style.top = (e.clientY - 16) + 'px';
    tip.classList.add('on');
```

## Filters (event toolbar): month + three dropdowns + search on one 49px line

Filters are multi-select toggles: every item starts on; clicking turns it off (dimmed). The
header value is "All" or "<on>/<total>" (e.g. Event type 4/5). The satellite list shows only
satellites of missions that are on.

```css
.fdrop { width: 100%; border-bottom: 1px solid rgba(255,255,255,0.08); }
.fdrop:first-of-type { border-top: 1px solid rgba(255,255,255,0.08); margin-top: 14px; }
.fdrop-head { width: 100%; min-height: 48px; display: flex; align-items: center; gap: 10px; text-align: left; }
.fdrop-head > span:first-child { flex: 1; font-size: 10px; font-weight: 500; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(234,240,246,0.55); transition: color 200ms ease; }
.fdrop-head:hover > span:first-child { color: #FFF; }
.fdrop-val { font-family: 'Noto Sans', sans-serif; font-size: 12px; font-weight: 500; color: rgba(234,240,246,0.36); font-variant-numeric: tabular-nums; }
.fdrop-head svg { color: rgba(234,240,246,0.4); transition: transform 460ms cubic-bezier(.2,.7,.2,1); }
.fdrop.open .fdrop-head > span:first-child { color: #FFF; }
.fdrop.open .fdrop-head svg { transform: rotate(180deg); }
.fdrop-body { height: 0; overflow: hidden; transition: height 480ms cubic-bezier(.2,.7,.2,1); }
.fdrop-inner { padding-bottom: 14px; }
.fgroup { width: 100%; display: flex; flex-direction: column; align-items: flex-start; }
.fmis {
  width: 100%; text-align: left; min-height: 34px; padding: 0; font-family: 'Noto Sans', sans-serif; font-size: 11.5px;
  font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(234,240,246,0.66);
  transition: opacity 200ms ease, color 200ms ease;
}
.fmis:hover { color: #FFF; }
.fmis.off { opacity: 0.28; }
.frow { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; }
.ftype {
  width: 100%; min-height: 38px; padding: 0; display: flex; align-items: center; gap: 10px;
  font-family: 'Noto Sans', sans-serif; font-size: 11.5px; font-weight: 500; letter-spacing: 0.11em; text-transform: uppercase;
  transition: opacity 220ms ease, color 220ms ease;
}
.ftype.off { opacity: 0.3; }
.ftype:hover { opacity: 1; }
.fsats { width: 100%; display: flex; flex-wrap: wrap; gap: 2px 2px; }
.fsat {
  min-height: 36px; padding: 0 8px 0 0; font-family: 'Noto Sans', sans-serif; font-size: 11.5px; font-weight: 500;
  letter-spacing: 0.08em; color: rgba(234,240,246,0.6); transition: opacity 200ms ease, color 200ms ease;
}
.fsat:hover { color: #FFF; }
.fsat.off { opacity: 0.28; }
}

/* ---------- filters: a caption on a hairline, items as plain names ---------- */
html body .fdrop { border-top: 0; border-bottom: 1px solid var(--sb-hair); }
html body .fdrop-head { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; min-height: 48px; border: 0; background: none; }
html body .fdrop-head > span:first-child { flex: 1 1 auto; text-align: left; }
html body .fdrop-val { flex: 0 0 auto; font-size: 12px; font-weight: 500; letter-spacing: 0.02em; text-transform: none; color: rgba(234,240,246,0.45); }
html body .fdrop-head:hover, html body .fdrop.open .fdrop-head { background: none; }
html body .fdrop-head > span:first-child, html body .tl-cap {
  font-family: var(--sb-font); font-size: 10px; font-weight: 500; letter-spacing: 0.24em; text-transform: uppercase; color: var(--sb-ink-55);
}
html body .fdrop-head:hover > span:first-child, html body .fdrop.open .fdrop-head > span:first-child { color: #FFFFFF; }
html body .fdrop-head svg { color: rgba(234,240,246,0.4); }
html body .fmis, html body .fitem {
  font-family: var(--sb-font); font-size: 11.5px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sb-ink-66); min-height: 34px;
}
html body .fmis:hover, html body .fitem:hover, html body .fmis[aria-pressed="true"] { color: #FFFFFF; }

html body .fdrop, html body .filters > .fsearch, html body .pr-toolbar .fsearch { border-bottom-color: rgba(255,255,255,0.30) !important; }
html body .fdrop-head > span:first-child, html body .tl-cap, html body .filters .fdrop-head > span:first-child {
  font-size: 11px !important; font-weight: 600 !important; letter-spacing: 0.2em !important; color: #FFFFFF !important; }
html body .fdrop-val, html body .acq-toolbar .fdrop-val { font-size: 13px !important; font-weight: 600 !important; color: rgba(255,255,255,0.92) !important; }
html body .fdrop-head svg { color: rgba(255,255,255,0.85) !important; }
html body .fdrop.open .fdrop-head > span:first-child, html body .fdrop-head:hover > span:first-child { color: #2FC6DC !important; }
html body .fmis, html body .fitem, html body .filters .fitem { font-size: 12.5px !important; font-weight: 500 !important; color: rgba(255,255,255,0.9) !important; }
html body .fitem.off, html body .fmis.off, html body .pr-toolbar .fitem.off { color: rgba(255,255,255,0.5) !important; }
html body .frange button, html body .tl-range button, html body .pr-toolbar .frange button { font-size: 11px !important; font-weight: 600 !important; color: rgba(255,255,255,0.72) !important; }
html body .frange button.on, html body .tl-range button[aria-pressed="true"], html body .pr-toolbar .frange button.on { color: #FFFFFF !important; border-bottom-color: #2FC6DC !important; }
html body .fsearch, html body .pr-toolbar .fsearch { color: rgba(255,255,255,0.8) !important; }
html body .fsearch input, html body .pr-toolbar .fsearch input { font-size: 14px !important; color: #FFFFFF !important; }
.ev-toolbar .filters { flex-direction: row; flex-wrap: wrap; align-items: flex-start; justify-content: center; gap: 2px 26px; }
.ev-toolbar .fmonth { height: 49px; margin-left: 0; }
.ev-toolbar .fmonth h2 { min-width: 8.2em; text-align: center; }
.ev-toolbar .fdrop, .ev-toolbar .fdrop:first-of-type { width: 200px; margin-top: 0; border-top: 0; }
.ev-toolbar .fsearch { width: 200px; height: 49px !important; margin: 0 !important; align-self: flex-start; box-sizing: border-box; border-bottom: 1px solid rgba(255,255,255,0.08) !important; }
.stage { display: block; }
/* the whole month and its filters fit under the menu (a month of six weeks is the tallest: 2040 x 1148) */
#skyView { max-width: calc((100vh - 64px - 49px - 90px) * 1580 / 1148); margin-left: auto; margin-right: auto; }
.stage { position: relative; }
#sbCon { position: absolute; pointer-events: none; overflow: visible; }
```

```js
  function renderFilters() {
    if (!$('#fTypes')) return;
    $('#fTypes').innerHTML = Object.keys(TYPES).map(function (k) {
      var on = !state.off[k], c = on ? TYPES[k].color : '#8A96A6';
      return '<button class="ftype' + (on ? '' : ' off') + '" data-type="' + k + '" aria-pressed="' + on +
        '" style="color: ' + c + ';">' + icon(k, c) + TYPES[k].label + '</button>';
    }).join('');
    $('#fMissions').innerHTML = MISSIONS.map(function (m) {
      var on = !state.offMis[m[0]];
      return '<button class="fmis' + (on ? '' : ' off') + '" data-mis="' + m[0] + '" aria-pressed="' + on + '">' + m[1] + '</button>';
    }).join('');
    $('#fSats').innerHTML = SATS.filter(function (t) {
      return !state.offMis[missionOf(t[0])];
    }).map(function (t) {
      var on = !state.offSat[t[0]];
      return '<button class="fsat' + (on ? '' : ' off') + '" data-sat="' + t[0] + '" aria-pressed="' + on + '">' + t[0] + '</button>';
    }).join('');
    $('#vTypes').textContent = dropVal('types');
    $('#vMissions').textContent = dropVal('missions');
    $('#vSats').textContent = dropVal('sats');
    syncDrops();
  }

  function dropVal(kind) {
    if (kind === 'types') {
      var o = Object.keys(state.off).length;
      return o ? (5 - o) + '/5' : 'All';
    }
    if (kind === 'missions') {
      var m = Object.keys(state.offMis).length;
      return m ? (4 - m) + '/4' : 'All';
    }
    var vis = SATS.filter(function (t) { return !state.offMis[missionOf(t[0])]; });
```

## Zoom: day panel ("zoom-info")

All events of the day fully expanded; the selected one at full opacity, the others dimmed (0.42).
The dot on the right of each occurrence is the IMPACT colour (spared/partial/lost), not the type colour.

```js
var IMPACT = {
  spared: { label: "Spared", color: "#3FCF7F" },
  medium: { label: "Partial", color: "#F0A63A" },
  lost: { label: "Lost", color: "#E8514B" },
};
function renderZoomInfo(day) {
  var evs = dayEvents(day);
  var total = evs.reduce(function (a, e) {
    return a + e.dtk.length;
  }, 0);
  var unav = evs.reduce(function (a, e) {
    return (
      a +
      e.dtk.filter(function (d) {
        return d.st === "lost";
      }).length
    );
  }, 0);

  var head =
    '<span class="micro" style="color: var(--accent);">Selected day</span>' +
    '<span class="zi-date">' +
    pad(day) +
    " " +
    MONTHS[state.m] +
    " " +
    state.y +
    "</span>" +
    '<span class="zi-sum">' +
    evs.length +
    (evs.length === 1 ? " occurrence · " : " occurrences · ") +
    total +
    " datatakes · " +
    unav +
    " unavailable</span>";

  var body = evs
    .map(function (e, i) {
      var on = e.id === state.eventId;
      var nUn = e.dtk.filter(function (d) {
        return d.st === "lost";
      }).length;
      return (
        '<div class="zi-occ' +
        (on ? "" : " dim") +
        '" data-occ="' +
        e.id +
        '" style="animation-delay: ' +
        (280 + i * 130) +
        'ms;">' +
        '<button class="zi-top">' +
        '<span class="zi-time">' +
        e.start +
        "</span>" +
        '<span><span class="zi-title">' +
        esc(e.name) +
        "</span>" +
        '<span class="zi-sub">' +
        icon(e.type, TYPES[e.type].color) +
        TYPES[e.type].label +
        " · " +
        satFull(e.sat) +
        "</span></span>" +
        '<span class="zi-dot" style="background: ' +
        IMPACT[e.impact].color +
        ';"></span></button>' +
        '<div class="zi-dtkhead">Impacted datatakes · ' +
        e.dtk.length +
        (nUn ? " · " + nUn + " unavailable" : "") +
        "</div>" +
        dtkRows(e) +
        "</div>"
      );
    })
    .join("");

  $("#zoomInfo").innerHTML = head + body;
}
```

```css
.zoom-info {
  position: absolute; z-index: 2; right: 0; top: 0; bottom: 0;
  width: min(46%, 540px); padding: clamp(56px, 10vh, 108px) clamp(22px, 4vw, 60px) 56px 0;
  overflow-y: auto; scrollbar-width: thin;
}
.zi-date { display: block; font-family: 'Noto Sans', sans-serif; font-size: clamp(25px, 2.9vw, 38px); font-weight: 700; letter-spacing: 0.01em; text-transform: uppercase; line-height: 0.95; color: #FFF; }
.zi-sum { display: block; margin-top: 12px; font-family: 'Noto Sans', sans-serif; font-size: 13px; letter-spacing: 0.04em; color: rgba(234,240,246,0.55); }
.zi-occ { padding: 30px 0 4px; animation: infoRise 620ms cubic-bezier(.2,.7,.2,1) backwards; }
.zi-occ.dim { opacity: 0.42; transition: opacity 240ms ease; }
.zi-occ.dim:hover { opacity: 0.8; }
.zi-top { width: 100%; display: grid; grid-template-columns: 74px 1fr 12px; gap: 14px; align-items: start; text-align: left; }
.zi-time { font-family: 'Noto Sans', sans-serif; font-size: 14px; font-weight: 500; color: rgba(234,240,246,0.5); padding-top: 4px; }
.zi-title { display: block; font-size: clamp(18px, 2vw, 22px); font-weight: 600; line-height: 1.2; color: #FFF; }
.zi-sub { display: flex; align-items: center; gap: 9px; margin-top: 7px; font-family: 'Noto Sans', sans-serif; font-size: 13px; font-weight: 500; color: rgba(234,240,246,0.55); }
.zi-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 8px; }
.zi-dtkhead { margin-top: 20px; padding-bottom: 10px; font-family: 'Noto Sans', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(234,240,246,0.34); }
.dtk-row { display: grid; grid-template-columns: 1fr auto; gap: 12px; padding: 13px 0; border-top: 1px solid rgba(255,255,255,0.07); }
.dtk-row .l { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dtk-row .idr { display: flex; align-items: center; gap: 11px; font-family: 'Noto Sans', sans-serif; font-size: 15px; font-weight: 600; letter-spacing: 0.01em; color: #EAF0F6; font-variant-numeric: tabular-nums; }
.dtk-row .idr i { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 auto; }
.dtk-row .prod { padding-left: 20px; font-family: 'Noto Sans', sans-serif; font-size: 13px; font-weight: 500; letter-spacing: 0.02em; color: var(--accent); }
.dtk-row .when { padding-left: 20px; font-family: 'Noto Sans', sans-serif; font-size: 12.5px; color: rgba(234,240,246,0.38); font-variant-numeric: tabular-nums; }
.dtk-row .r { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; font-family: 'Noto Sans', sans-serif; font-variant-numeric: tabular-nums; }
.dtk-row .r b { font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; }
.dtk-row .r span { font-size: 16px; font-weight: 700; }
@media (max-width: 900px) {
  .zoom-info { width: 100%; top: auto; height: 64%; padding: 26px clamp(18px, 5vw, 28px) 40px; }
```

## Constellation of the month (replaces the current ZODIAC / ZODIAC_STARS shapes)

One entry per month, index 0 = January. Points p are fractions of a 380×300 box; e lists the
edges between point indexes. Straight lines only (no curves).

```js
var CONSTELLATIONS = [
  {
    n: "Capricornus",
    p: [
      [0.1, 0.22],
      [0.31, 0.09],
      [0.56, 0.16],
      [0.78, 0.34],
      [0.88, 0.62],
      [0.6, 0.82],
      [0.34, 0.74],
      [0.17, 0.5],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
    ],
  },
  {
    n: "Aquarius",
    p: [
      [0.12, 0.26],
      [0.33, 0.14],
      [0.54, 0.29],
      [0.76, 0.17],
      [0.88, 0.44],
      [0.66, 0.56],
      [0.49, 0.74],
      [0.28, 0.88],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
  },
  {
    n: "Pisces",
    p: [
      [0.08, 0.16],
      [0.26, 0.34],
      [0.44, 0.52],
      [0.63, 0.63],
      [0.82, 0.7],
      [0.9, 0.48],
      [0.8, 0.28],
      [0.3, 0.78],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [2, 7],
    ],
  },
  {
    n: "Aries",
    p: [
      [0.16, 0.62],
      [0.4, 0.46],
      [0.64, 0.37],
      [0.86, 0.42],
      [0.52, 0.22],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [2, 4],
    ],
  },
  {
    n: "Taurus",
    p: [
      [0.12, 0.3],
      [0.34, 0.46],
      [0.52, 0.56],
      [0.72, 0.42],
      [0.9, 0.26],
      [0.5, 0.78],
      [0.3, 0.7],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [2, 5],
      [5, 6],
    ],
  },
  {
    n: "Gemini",
    p: [
      [0.24, 0.12],
      [0.29, 0.36],
      [0.34, 0.6],
      [0.3, 0.84],
      [0.62, 0.14],
      [0.67, 0.38],
      [0.72, 0.62],
      [0.68, 0.86],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 5],
      [5, 6],
      [6, 7],
      [1, 5],
    ],
  },
  {
    n: "Cancer",
    p: [
      [0.18, 0.2],
      [0.46, 0.42],
      [0.46, 0.66],
      [0.74, 0.22],
      [0.56, 0.88],
    ],
    e: [
      [0, 1],
      [1, 3],
      [1, 2],
      [2, 4],
    ],
  },
  {
    n: "Leo",
    p: [
      [0.16, 0.32],
      [0.29, 0.15],
      [0.47, 0.19],
      [0.54, 0.38],
      [0.41, 0.51],
      [0.64, 0.63],
      [0.88, 0.55],
      [0.8, 0.82],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 5],
    ],
  },
  {
    n: "Virgo",
    p: [
      [0.12, 0.24],
      [0.34, 0.36],
      [0.56, 0.29],
      [0.74, 0.46],
      [0.59, 0.62],
      [0.4, 0.74],
      [0.86, 0.74],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [3, 6],
    ],
  },
  {
    n: "Libra",
    p: [
      [0.24, 0.3],
      [0.51, 0.16],
      [0.76, 0.32],
      [0.64, 0.58],
      [0.34, 0.62],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 4],
    ],
  },
  {
    n: "Scorpius",
    p: [
      [0.1, 0.22],
      [0.28, 0.3],
      [0.45, 0.3],
      [0.56, 0.46],
      [0.64, 0.64],
      [0.75, 0.78],
      [0.88, 0.8],
      [0.92, 0.62],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
  },
  {
    n: "Sagittarius",
    p: [
      [0.18, 0.46],
      [0.34, 0.3],
      [0.53, 0.35],
      [0.64, 0.53],
      [0.48, 0.64],
      [0.28, 0.61],
      [0.8, 0.42],
      [0.74, 0.72],
    ],
    e: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [2, 6],
      [3, 7],
    ],
  },
];
```

Placement and markup (the final version, `sbPlaceCon`): drawn beside the calendar, centred
halfway between the left edge of the window and the calendar, level with the middle of the
month grid. Width = clamp(120px, 0.72 × space left of the grid, 380px); viewBox "0 -44 380 344".
Stars: halo r=9 #BFE6F2 at 0.16 + core r=3.2 #F2F8FF. Name above at (190, -20), centred.

```js
    var d = window.__sbCon, stage = document.querySelector('.stage'), svg = document.querySelector('#skyView .sky');
    if (!d || !stage || !svg) return;
    var el = document.getElementById('sbCon');
    if (!el) { el = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); el.id = 'sbCon'; el.setAttribute('aria-hidden', 'true'); stage.appendChild(el); }
    var r = svg.getBoundingClientRect(), sr = stage.getBoundingClientRect(), s = r.width / d.SKYW;
    var gridL = r.left + d.OX * s;                       /* the calendar's left edge, on screen */
    var w = Math.max(120, Math.min(380, gridL * 0.72)), h = w * 300 / 380;
    var cx = gridL / 2, cy = r.top + (d.OY + d.rows * d.CH / 2) * s;
    el.setAttribute('viewBox', '0 -44 380 344');
    el.style.width = w + 'px'; el.style.height = (h * 344 / 300) + 'px';
    el.style.left = (cx - sr.left - w / 2) + 'px'; el.style.top = (cy - sr.top - h / 2 - h * 44 / 300) + 'px';
    if (!fresh && el.getAttribute('data-name') === d.C.n) return;
    el.setAttribute('data-name', d.C.n);
    var pt = d.C.p.map(function (q) { return [q[0] * 380, q[1] * 300]; });
    el.innerHTML = '<g class="con">' + d.C.e.map(function (e, i) {
      var a = pt[e[0]], b = pt[e[1]];
      return '<path class="con-line" d="M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + ' L' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) +
        '" pathLength="1" vector-effect="non-scaling-stroke" style="animation-delay: ' + (1400 + i * 110) + 'ms;"></path>';
    }).join('') + pt.map(function (q, i) {
      return '<g class="con-star" style="animation-delay: ' + (i * 120) + 'ms;"><circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="9" fill="#BFE6F2" opacity="0.16"></circle>' +
        '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.2" fill="#F2F8FF"></circle></g>';
    }).join('') + '<text class="con-label" x="190" y="-20" text-anchor="middle">' + d.C.n.toUpperCase() + '</text></g>';
  }
```

Animation: stars pop in one after another (120 ms apart). Lines start at 1400 ms (+110 ms each)
and then loop every 5 s: draw, hold, fade, redraw. The name fades in and out on its own 5 s loop.

```css
.con-line {
  fill: none; stroke: #8FD4E4; stroke-opacity: 0.45; stroke-width: 1; vector-effect: non-scaling-stroke;
  stroke-dasharray: 1; stroke-dashoffset: 1; animation: conCycle 5s cubic-bezier(.4,0,.2,1) infinite;
}
.con-star { transform-box: fill-box; transform-origin: center; animation: conPop 620ms cubic-bezier(.2,.7,.2,1) backwards; }
.con-label {
  font-family: 'Noto Sans', sans-serif; font-size: 14px; font-weight: 600; letter-spacing: 0.28em;
  fill: rgba(234,240,246,0.42); opacity: 0; animation: conName 5s ease 5s infinite;
}
@keyframes iconIn { from { opacity: 0; } to { opacity: 1; } }
  74%  { stroke-dashoffset: 0; opacity: 1; }
  88%  { stroke-dashoffset: 0; opacity: 0; }
  100% { stroke-dashoffset: 1; opacity: 0; }
}
@keyframes conPop { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: none; } }
@keyframes conName {
  0%, 44%   { opacity: 0; }
  52%, 78%  { opacity: 1; }
  88%, 100% { opacity: 0; }
}
```

## Space between the calendar and the Earth / footer

The Earth is drawn absolutely at the bottom of the board section (height ≈ clamp(100px, 15vh,
190px) at the centre of the window, plus its glow). The calendar keeps clear of it with its own
bottom padding plus a fixed spacer after it, before the section ends and the footer starts:

```html
<div class="stage"> … calendar … </div>          <!-- .stage { padding-bottom: clamp(20px, 2.6vw, 38px); } -->
<div style="height: clamp(150px, 20vh, 300px);"></div>
</section>
<footer class="sb-footer"> … </footer>
```

---

## Applied — 2026-10-26 (DEVOCS-219)

Filter dropdowns converted from absolute overlay to in-flow height animation
(`events.tsx`, `events.module.css`):

- `.fdrop` — no fixed height; `display:flex; flex-direction:column`; hairline
  `color-mix(in srgb, var(--mf-text) 30%, transparent)` does not change on open.
- `.fdropBody` — `position:static`; `display:grid; grid-template-rows:0fr→1fr`;
  480 ms `cubic-bezier(.2,.7,.2,1)`. No background, border, or shadow.
- `.fdropInner` — `min-height:0; overflow:hidden; padding:6px 0 14px`.
- `.fdropOverlay` removed; replaced with a `document` `pointerdown` listener
  (stops inside the `.fdrop` via `onPointerDown` propagation stop).
- Escape closes the open list and returns focus to its trigger head.
- Closed body carries `inert` so its contents are not focusable.
- `@media (prefers-reduced-motion:reduce)` suppresses the height transition.
- `.monthBar` `align-items:flex-start` unchanged — row grows down naturally.
