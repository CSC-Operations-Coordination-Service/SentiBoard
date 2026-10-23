# Events page — prototype reference (extracted from SentiBoard.html, src-events)

Extracted 2026-10-23 from the bundled prototype `SentiBoard.html` (the events page is base64-encoded
inside it). These are the exact values to reproduce. Do not decode the bundle again; use this file.

## Types, colours, icons (16×16 viewBox, stroke-width 1.3, round caps, no fill)
```js
  var TYPES = {
    acq: { label: 'Acquisition', color: '#A7B1BE' },
    cal: { label: 'Calibration', color: '#4FC9CB' },
    man: { label: 'Manoeuvre', color: '#EFA73C' },
    pro: { label: 'Production', color: '#B45CF2' },
    sat: { label: 'Satellite', color: '#F2772B' }
  };
  var ICONS = {
    acq: '<ellipse cx="6.6" cy="6.8" rx="4.5" ry="2.5" transform="rotate(-40 6.6 6.8)"/><path d="M6.6 6.8 10.1 3.3"/><circle cx="10.6" cy="2.8" r="0.9"/><path d="M8.4 8.8 10.7 13.1"/><path d="M8.5 13.3h4.4"/>',
    cal: '<circle cx="8" cy="8" r="5.3"/><path d="M6.1 9.9 9.9 6.1"/>',
    man: '<circle cx="8" cy="5.3" r="2.3"/><path d="M8 7.6v4.3M5.2 13.3h5.6"/>',
    pro: '<circle cx="8" cy="8" r="2.4"/><path d="M8 1.6v2.2M8 12.2v2.2M1.6 8h2.2M12.2 8h2.2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5 11 5M5 11l-1.5 1.5"/>',
    sat: '<path d="M8 4.1 11.9 8 8 11.9 4.1 8z"/><path d="M11.6 4.4 13.7 2.3M2.3 13.7l2.1-2.1"/><path d="M13.4 2.9 3 13.3"/>'
  };
  function icon(type, color) {
    return '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="' + color +
      '" stroke-width="1.3" stroke-linecap="round" aria-hidden="true">' + ICONS[type] + '</svg>';
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
.msat-b { animation: msatB 67s linear infinite 12s; }
.star { cursor: pointer; transform-box: fill-box; transform-origin: center; transition: transform 300ms cubic-bezier(.2,.7,.2,1); animation: starIn 300ms ease backwards; }
.star .core { transition: opacity 160ms ease; }
.star:hover .core { opacity: 0.7; }
.zicon { animation: iconIn 460ms ease 1140ms backwards; }
@keyframes iconIn { from { opacity: 0; } to { opacity: 1; } }
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
    spared: { label: 'Spared', color: '#3FCF7F' },
    medium: { label: 'Partial', color: '#F0A63A' },
    lost: { label: 'Lost', color: '#E8514B' }
  };
  function renderZoomInfo(day) {
    var evs = dayEvents(day);
    var total = evs.reduce(function (a, e) { return a + e.dtk.length; }, 0);
    var unav = evs.reduce(function (a, e) {
      return a + e.dtk.filter(function (d) { return d.st === 'lost'; }).length;
    }, 0);

    var head = '<span class="micro" style="color: var(--accent);">Selected day</span>' +
      '<span class="zi-date">' + pad(day) + ' ' + MONTHS[state.m] + ' ' + state.y + '</span>' +
      '<span class="zi-sum">' + evs.length + (evs.length === 1 ? ' occurrence · ' : ' occurrences · ') +
      total + ' datatakes · ' + unav + ' unavailable</span>';

    var body = evs.map(function (e, i) {
      var on = e.id === state.eventId;
      var nUn = e.dtk.filter(function (d) { return d.st === 'lost'; }).length;
      return '<div class="zi-occ' + (on ? '' : ' dim') + '" data-occ="' + e.id + '" style="animation-delay: ' + (280 + i * 130) + 'ms;">' +
        '<button class="zi-top">' +
        '<span class="zi-time">' + e.start + '</span>' +
        '<span><span class="zi-title">' + esc(e.name) + '</span>' +
        '<span class="zi-sub">' + icon(e.type, TYPES[e.type].color) + TYPES[e.type].label + ' · ' + satFull(e.sat) + '</span></span>' +
        '<span class="zi-dot" style="background: ' + IMPACT[e.impact].color + ';"></span></button>' +
        '<div class="zi-dtkhead">Impacted datatakes · ' + e.dtk.length + (nUn ? ' · ' + nUn + ' unavailable' : '') + '</div>' +
        dtkRows(e) + '</div>';
    }).join('');

    $('#zoomInfo').innerHTML = head + body;
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
