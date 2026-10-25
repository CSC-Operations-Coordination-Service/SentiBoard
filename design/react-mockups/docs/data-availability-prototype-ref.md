# Data Availability page — prototype reference (extracted from SentiBoard.html, src-data-availability)

Extracted 2026-10-25 from the bundled prototype `SentiBoard.html` (the page is base64-encoded inside it
as `<script type="text/plain" id="src-data-availability">`). The shell around the pages injects no CSS
into this page, so everything below comes from the page itself. These are the exact values to
reproduce. Do not decode the bundle again; use this file.

How to read it:
- The prototype's CSS is a pile of overrides (the same selectors re-declared four or five times, then a
  shared `#sb-unified` block with `html body …` and `!important`). The values below are the **resolved
  winners**, not the first rule you would find. Where a later rule kills an effect (e.g. a hover
  colour), that is stated.
- Tokens after the last `:root` override: `--bg #0B0E13`, `--ink #EAF0F6`, `--ink2 #93A0B0`,
  `--ink3 #6B7686`, `--ink4 #4E5866`, `--line rgba(255,255,255,0.08)`, `--line2 rgba(255,255,255,0.14)`,
  `--accent #2FC6DC`, `--pad clamp(18px, 4.4vw, 64px)`, `--bandh clamp(74px, 16.5vh, 190px)`.
  Font everywhere: Noto Sans (the prototype's "mono" class is Noto Sans with tabular numbers).
- Scope: only the page body under the hero (KPIs, toolbar, strips, datatake card). The hero and the
  Description panel come from the shared `PageHeader`; only the Description **copy** is recorded (§9).

Things the final prototype **hides or does not use** (do not build them):
- The coverage-map frame: `.cov-head` (title "Datatakes · … → … · N days", hint "Select a cell to focus
  the tables", the **By mission / By satellite** switch), `.cov-foot` (completeness ramp legend, "Focus ·
  … · Clear" button) and `.cov-months` — all `display: none`. Rows are therefore **always by mission**.
- The old floating `.dtkcard` (with `.dtk-big`, `.dtk-bar`, `.dtk-foot`, `.dtk-look`) — replaced by the
  inline panel (§7).
- The per-day cell tooltip (`cellTip`, `.t-date/.t-sat/.t-big/.t-bar/.t-rows`) — never called; only the
  datatake tooltip (§6.5) is used.
- Donut charts, the focus panel and datatake list (`.focus`, `.pane`, `.dtlist`, `.dtrow`), and any
  table — CSS remnants only, no markup.
- Satellite chips (`.fsats`, `.fsat`, `.fhint`) — CSS only; there is **no satellite filter** (even
  though the Description text mentions one, §9).
- The zooming star scene `#cam` — `#boardSky > .cam { display: none }`. Only the strip zooms on pick.
- `.fdates > .micro` ("Applies to the datatake start date") — `display: none`.
- The page footer legend `.foot/.legend` — not in the markup.

---

## 1. Page layout and spacing (top to bottom)

| Block | Value |
|---|---|
| Board (page body) | side padding: **`clamp(18px, 4vw, 48px)`, the codebase value shared with the navbar and Events** (the prototype's `--pad` is `clamp(18px, 4.4vw, 64px)` — Decision 12); rises over the hero: `margin-top: clamp(-230px, -17vh, -140px)`, `padding-top: clamp(66px, 8vh, 112px)`, transparent — **same as Events/Acquisitions, reuse their implementation** |
| KPIs row | `padding-top: clamp(10px, 1.4vw, 22px)`, `padding-bottom: clamp(8px, 1vw, 16px)` (+ the shared `--sb-lede-comp` pull — identical to Acquisitions §1) |
| Toolbar | `margin-top: clamp(16px, 2.6vh, 28px)`, `padding-bottom: clamp(22px, 3vw, 38px)` (Acquisitions: `clamp(10px, 1.6vw, 20px)` — see Decision 1) |
| Strips (one band per mission) | no padding of their own; band geometry §6.1 |
| After the strips | `.stage` `padding-bottom: clamp(20px, 2.6vw, 38px)`, then a spacer `height: clamp(150px, 20vh, 300px)` (room for the shared planet), then the footer |

Nothing on the page has a card or box: KPIs, filters, strips and the datatake panel all sit on the
starfield.

## 2. KPIs

Markup: value over caption, four of them. Value `#EAF0F6`; **only "Datatakes lost" is coloured**,
`#E8514B` (Coverage gaps is white).

```css
.kpis { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 0; }
.kpi  { width: clamp(140px, 16vw, 220px); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 5px; }
.kpi b { font-size: clamp(26px, 2.9vw, 37px); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.kpi .micro { font-size: 10.5px; font-weight: 500; letter-spacing: 0.2em; text-transform: uppercase; line-height: 1.5; color: rgba(255,255,255,0.72); }
@media (max-width: 900px) { .kpi { width: clamp(130px, 44vw, 200px); } }
```

Labels, in order: `Datatakes in range` · `Mean completeness` · `Coverage gaps` · `Datatakes lost`.

The KPIs follow the **time window + Mission + Status + search**. They do **not** follow the picked
datatake (picking a bar never changes them).

```js
for each day d in [winStart, winEnd], for each active satellite s (mission not switched off):
  c = datatakes of (s, d) that pass the filters
  n    += c.length
  if (c.length === 0) gaps++            // a satellite-day with no datatake = one "coverage gap"
  lost += c.filter(st === 'unavailable').length
  sum/cnt over c where pct !== null      // planned AND processing have pct null → not in the mean
mean = cnt ? sum / cnt : 0
format: n, gaps, lost → two digits below 100 ('07'); mean → Math.round(mean) + '%'
```

Each value counts up from its previous value: 620 ms, ease-out cubic (`1 − (1 − p)³`), starting at 0 on
load (Decision 4).

## 3. Filter toolbar

One centred, wrapping row. Order: range heading · 1D 7D 30D CUSTOM · pager · (From/To, only in Custom) ·
Mission · Status · search · Reset filters. Every control sits on one **49 px line** (48 px + 1 px
hairline) so all hairlines share one bottom edge.

```css
.filters { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start; gap: 2px 34px; text-shadow: none; }

/* range heading */
.fhead    { height: 49px; display: flex; align-items: center; align-self: flex-start; margin: 0 6px 0 0; }
.fhead h2 { margin: 0; font-size: clamp(17px, 1.7vw, 22px); font-weight: 700; letter-spacing: 0.02em;
            text-transform: uppercase; line-height: 1; white-space: nowrap; color: #EAF0F6; }
/* text: 'Last 24 hours' (1d) · 'Last 7 days' · 'Last 30 days' · 'Custom range' */

/* 1d 7d 30d custom (uppercased by CSS) */
.frange        { height: 49px; display: flex; align-items: center; gap: 18px; border: 0; }
.frange button { height: 49px; min-height: 49px; padding: 0 1px; border: 0; border-bottom: 2px solid transparent; border-radius: 0; background: none;
                 font-size: 11px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; font-variant-numeric: tabular-nums;
                 color: rgba(255,255,255,0.72); transition: color 180ms ease, background 180ms ease; }
.frange button.on { color: #FFFFFF; border-bottom-color: #2FC6DC; }
/* hover: NO change — the !important .72 beats every hover rule */
```

### 3.1 Pager `‹ 2026-08-19 → 2026-09-19 📅 ›`

```css
.fpager { height: 49px; display: flex; align-items: center; align-self: flex-start; gap: 10px; }
.fpager button { width: 30px; height: 34px; display: inline-flex; align-items: center; justify-content: center;
                 border: 0; border-radius: 2px; background: none; color: #FFFFFF; }       /* hover: unchanged, no background */
.fpager button[disabled] { opacity: 0.3; pointer-events: none; }
/* chevrons 11×11: <svg viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6"/></svg>, next: "M6 3l5 5-5 5" */

.fpager .plabel { width: auto; min-width: 190px; height: 34px; padding: 0; border: 0; border-radius: 2px; background: none;
                  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
                  font-size: 13px; font-weight: 700; letter-spacing: 0.06em; font-variant-numeric: tabular-nums; color: #EAF0F6; }
.fpager .plabel:hover { color: #FFFFFF; }                                               /* no border, no background */
.fpager .plabel::after { /* 12×12 calendar icon AFTER the text, currentColor, opacity 0.8 */ }
/* calendar: <svg viewBox="0 0 16 16" fill="none" stroke-width="1.4"><rect x="2" y="3.2" width="12" height="11" rx="1.2"/><path d="M2 6.6h12M5.4 1.8v2.6M10.6 1.8v2.6"/></svg> */
```

Label text: `YYYY-MM-DD → YYYY-MM-DD` (winStart → winEnd). Title: `Pick the days on a calendar`.

### 3.2 Time window semantics (prototype)

```js
DAYS   = 92 days of history ending today, plus TOMORROW (scheduled datatakes)   // LAST = tomorrow
winEnd   = custom ? custom.to   : max(range, LAST - offset)
winStart = custom ? custom.from : max(0, winEnd - range)
// so 30d = 31 days ending TOMORROW, 7d = 8 days, 1d = today + tomorrow (2 days, axis shows hours)
```

- **1d / 7d / 30d**: `custom = null`, `offset = 0`, From/To hidden; close the card, reset the zoom,
  re-render with the bar entrance animation.
- **Custom** button: `custom = current window`, show From/To filled with it (no picker opens).
- **Clicking the pager label**: same as Custom, then opens the From picker (`showPicker()`).
- **‹ / ›**: move the window by **one day** (`offset ± 1`), staying on the preset (heading still reads
  "Last 30 days"). ‹ is disabled at the start of the data (`winStart <= 0`) or in Custom; › is disabled
  at `offset 0` or in Custom. Closes the card and resets the zoom; no entrance animation.
- **← / →** keys (document): the same one-day move, only when no datatake is picked.
- Default: 30d, offset 0.

(See Decisions 2 and 3: window end and pager step.)

### 3.3 From / To (Custom only)

```html
<div class="fdates">  <!-- hidden unless Custom -->
  <label><span class="micro">From</span><span class="fdate"><input type="date" id="dFrom"><button class="fcal" aria-label="Open calendar">[calendar 13×13, stroke 1.3]</button></span></label>
  <label><span class="micro">To</span>  <span class="fdate"><input type="date" id="dTo">  <button class="fcal" aria-label="Open calendar">…</button></span></label>
</div>
```

```css
.fdates { display: flex; flex-direction: row; align-items: center; gap: 8px; }
.fdates label { display: flex; flex-direction: row; align-items: center; gap: 6px; }
.fdates label .micro { font-size: 10px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #FFFFFF; }
.fdate  { position: relative; display: inline-flex; align-items: center; }
.fdates input { min-height: 38px; width: 150px; padding: 0 2px; border: 0; border-bottom: 1px solid rgba(255,255,255,0.14); border-radius: 0;
                background: none; color-scheme: dark; cursor: text; font-size: 11.5px; font-weight: 500; letter-spacing: 0.08em; color: #EAF0F6; }
.fdates input:hover, .fdates input:focus { border-bottom-color: rgba(255,255,255,0.34); }
.fdates input::-webkit-calendar-picker-indicator { display: none; }
.fcal { position: absolute; right: 4px; width: 28px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
        border-radius: 2px; color: #FFFFFF; background: none; }
```

`min`/`max` = first day of the data / tomorrow. On change: if From > To, swap them; apply; close the
card. Note: in the prototype this block is 38 px tall and top-aligned, so its hairline does **not** sit
on the shared 49 px line (Decision 7).

### 3.4 Mission and Status dropdowns

```css
.fdrop { position: relative; display: flex; flex-direction: column; min-width: 176px; width: auto;
         border-top: 0; border-bottom: 1px solid rgba(255,255,255,0.30); }                /* hairline never changes colour */
.fdrop-head { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 0 2px;
              border: 0; background: none; text-align: left; }
.fdrop-head > span:first-child { flex: 1 1 auto; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.2em;
              text-transform: uppercase; color: #FFFFFF; }
.fdrop-head:hover > span:first-child,
.fdrop.open .fdrop-head > span:first-child { color: #2FC6DC; }                               /* the CAPTION turns cyan */
.fdrop-val { flex: 0 0 auto; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; text-transform: none; color: rgba(255,255,255,0.92); }
.fdrop-head svg { color: rgba(255,255,255,0.85); }   /* 12×12, path "M3 6l5 5 5-5", stroke-width 1.4 — does NOT rotate on open */

/* the list opens IN FLOW under the head and pushes the page down */
.fdrop-body  { position: static; height: 0; overflow: hidden; background: none; border: 0; box-shadow: none;
               transition: height 420ms cubic-bezier(.2,.7,.2,1); }      /* JS sets height = inner.offsetHeight */
.fdrop-inner { padding: 12px 0 16px; }
.fgroup      { width: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 0; }

.fitem { width: 100%; min-height: 34px; display: flex; align-items: center; gap: 11px; padding: 0; border: 0; background: none; text-align: left;
         font-size: 12.5px; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.9);
         transition: color 180ms ease, opacity 180ms ease; }                  /* hover: no change */
.fitem.off { color: rgba(255,255,255,0.5); opacity: 0.3; }                   /* both apply */
.fitem i { display: block; width: 8px; height: 8px; border-radius: 50%; flex: 0 0 auto; }
.fitem u { flex: 1; text-decoration: none; }
#fMissions .fitem { gap: 0; }  #fMissions .fitem i { display: none; }        /* missions: plain names, no dot */
```

Items:
- Mission: `Sentinel-1`, `Sentinel-2`, `Sentinel-3`, `Sentinel-5P` (no "All" item).
- Status, each with its dot: Planned `#7A8696` · Processing `#5B9BE8` · Acquired `#3FCF7F` ·
  Partial `#F0A63A` · Unavailable `#E8514B` (no "All" item).

Prototype semantics (Decision 5):
- Each item is a **toggle** (multi-select): click switches it off (`.off`) or back on. The list stays
  open. Nothing is off by default.
- Value next to the caption: **empty** when everything is on; otherwise `on/total`, e.g. `3/4`.
- Switching a mission off **removes its band** from the strips and removes it from the KPIs.
- Switching a status off, or typing a search, **removes** the non-matching datatakes from the strips
  before they are folded into bars (the strip re-spaces); nothing is dimmed.
- Several dropdowns can be open at once; a click elsewhere does not close them; Escape does not close
  them (Escape only closes the datatake card). (Acquisitions/Events: one at a time, Escape closes.)

### 3.5 Search and Reset

```css
.fsearch { min-width: 210px; width: auto; height: 49px; box-sizing: border-box; align-self: flex-start; display: flex; align-items: center; gap: 9px;
           padding-bottom: 2px; color: #FFFFFF; border-bottom: 1px solid rgba(255,255,255,0.30); }     /* no change on focus */
.fsearch input { width: 100%; height: 100%; min-width: 0; background: none; border: 0; outline: none;
                 font-size: 14px; font-weight: 500; letter-spacing: 0; color: #FFFFFF; }
.fsearch input::placeholder { color: #FFFFFF; opacity: 1; }

.freset { height: 49px; min-height: 44px; display: flex; align-items: center; margin: 0; padding: 1px 6px; border: 0; background: none;
          font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: #FFFFFF; transition: color 160ms ease; }
/* hover: no change (the !important #FFF wins); never disabled */

@media (max-width: 760px) { .fhead { width: 100%; } .fsearch { min-width: 140px; } }   /* row stays centred */
```

Search icon (13×13): `<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.3"/><path d="M10.4 10.4L14 14" stroke="currentColor" stroke-width="1.3"/></svg>`.
Placeholder `Datatake ID`, sr-only label `Search datatakes`. Live, case-insensitive substring of the ID;
filters strips and KPIs.

Reset filters: all missions and statuses on, search cleared, 30d, offset 0, From/To hidden, card closed
(the prototype forgets to clear the picked datatake — close it), bars re-enter with the animation.

## 4. Data and colours

Completeness bands (bars, rings, badges, tooltip values) — already in `mock.ts` as `BANDS`/`barColor`,
and they match:

```js
BANDS = [ {min: 90, '#12E874'}, {min: 80, '#46B96A'}, {min: 50, '#FFD01E'}, {min: 30, '#F0736B'}, {min: 1, '#E8200F'} ];
MISSING = '#8B98A6';                      // pct 0 (an Unavailable datatake is GREY, not red)
pct === null → state colour: Planned '#7A8696', Processing '#5B9BE8'
```

State colours (Status dropdown dots, Description legend): Planned `#7A8696`, Processing `#5B9BE8`,
Acquired `#3FCF7F`, Partial `#F0A63A`, Unavailable `#E8514B`.

Prototype data model: `pct` (acquisition completeness) is **null for Planned and Processing**; `pub`
(publication) is null for Planned, part-way for Processing, 0 for Unavailable, a bit under `pct` for
Partial, `pct` (sometimes just under) for Acquired. Our `cardSides()` already reproduces `pub`; the
difference is Processing's acquisition (Decision 6).

## 5. Rows by mission

Always one band per mission, in order S1, S2, S3, S5P (labels exactly `S1`, `S2`, `S3`, `S5P`; no
sub-label). A mission switched off has no band.

## 6. Strips

### 6.1 Band geometry (port exactly: absolute positioning inside a fixed-height band)

```css
.row-band { position: relative; height: var(--bandh); margin-bottom: 10px; }      /* --bandh: clamp(74px, 16.5vh, 190px) */
.row-band:last-child { margin-bottom: 0; }

.rlbl   { position: absolute; z-index: 3; left: 0; top: 66%; transform: translateY(-50%); width: 56px; display: flex; align-items: center; pointer-events: none; }
.rlbl b { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #FFFFFF; text-shadow: 0 1px 6px rgba(0,0,0,0.95); }

.cov-cells { position: absolute; left: 60px; right: 4px; top: 66%; height: 46%; transform: translateY(-50%); z-index: 2;
             transition: transform 700ms cubic-bezier(.2,.7,.2,1); }               /* the strip: 34–87 px tall */
.frames    { position: absolute; inset: 0; }

.timeaxis  { position: absolute; left: 60px; right: 4px; top: 90%; height: 18px; border-top: 1px solid rgba(255,255,255,0.22);
             transition: opacity 320ms ease; }
.row-band.zoomed .timeaxis { opacity: 0; }
```

So the strip spans 43 %–89 % of the band, the axis line is at 90 %, and 43 % of the band is empty
headroom above each strip (which is where a zoomed strip grows). The axis may overflow the band into
the 10 px margin on short screens; that is how the prototype looks.

### 6.2 Bars

```css
.cov-cell { position: absolute; top: 0; height: 100%; padding: 0;
            width: clamp(3px, var(--tw), 30px);                     /* --tw = (76 / bars) % on the strip */
            border: 1px solid #EAF0F6; border-radius: 1px; background-color: var(--tint); box-shadow: 0 1px 3px rgba(0,0,0,0.5);
            transform: translateX(-50%); cursor: pointer;
            transition: transform 160ms cubic-bezier(.2,.7,.2,1), opacity 200ms ease;
            animation: eoCell 420ms cubic-bezier(.2,.7,.2,1) backwards; }
.cov-cell:hover { transform: translateX(-50%) scaleY(1.16) scaleX(1.12); z-index: 3; }
.cov-cell.sel   { transform: translateX(-50%) scaleY(1.2) scaleX(1.16); box-shadow: 0 0 0 1.5px #FFF, 0 2px 8px rgba(0,0,0,0.6); z-index: 4; }
.cov-cell.faded { opacity: 0.45; }                                     /* every other bar, in every row, while one is picked */
.cov-none { position: absolute; left: 4px; top: 6px; font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.7); }
```

- `left` of bar k = `((k + 0.5) / bars) × 100 %`. Folding into at most 96 bars, worst of each group,
  null pct ranks 101 — identical to our `framesOf`, but fed with the **filtered** list (§3.4).
- Entrance: only on animated renders (load, range change, Custom apply, Reset), each bar delayed
  `min(420, rowIndex × 45 + barIndex × 2.4)` ms; other renders have `animation: none`. (The prototype's
  keyframe ends at `transform: none`, which makes bars jump by half their width; keep our keyframe that
  includes `translateX(-50%)`.)
- Empty strip: `No datatakes in range`.

### 6.3 Axis labels

```css
.timeaxis .tk { position: absolute; top: 5px; transform: translateX(-50%); white-space: nowrap; font-variant-numeric: tabular-nums;
                font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: rgba(234,240,246,0.6);
                text-shadow: 0 1px 4px rgba(6,9,13,0.95), 0 0 10px rgba(6,9,13,0.7); }
.timeaxis .tk::before { content: ''; position: absolute; left: 50%; top: -5px; width: 1px; height: 4px; background: rgba(255,255,255,0.4); }
.tk.first { transform: none; }            .tk.first::before { left: 0; }
.tk.last  { transform: translateX(-100%); } .tk.last::before { left: auto; right: 0; }
```

Ticks: windows of ≤3 days → 4 intervals with ` HH:00`; otherwise 5 intervals; `DD/MM`; from the start
of the first day to the end of the last day. Our `axisTicks` already matches.

### 6.4 Picking a bar (zoom)

```js
PICK_Z = 1.9
ZOOM_IN  = 'transform 700ms cubic-bezier(.2,.7,.2,1)'
ZOOM_OUT = 'transform 700ms cubic-bezier(.8,0,.8,.3)'      // the exact mirror
click bar:   strip.transformOrigin = '<bar centre x>px <bar centre y>px' (in the strip's own box);
             strip.transform = 'translateY(-50%) scale(1.9)'; band gets .zoomed (axis fades out);
             every other bar in every row → .faded; the card opens under the band (§7)
click the same bar again, ×, Escape: ZOOM_OUT back to 'translateY(-50%)', .zoomed removed, card closes
click another bar: card content swaps (no re-open animation), zoom moves to the new bar
```

The band gets **no extra padding** when zoomed (the 43 % headroom absorbs the growth). The prototype
does **not** clip the zoomed strip at the page edges (Decision 8).

### 6.5 Hover tooltip on a bar (replaces the native `title`)

```css
.tip { position: fixed; z-index: 55; display: none; pointer-events: none; min-width: 226px; padding: 15px 17px; border-radius: 14px;
       background: rgba(9,13,18,0.96); border: 1px solid rgba(255,255,255,0.18); box-shadow: 0 20px 44px rgba(0,0,0,0.65);
       backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px); }
.tip.on { display: block; animation: eoFade 160ms ease backwards; }     /* eoFade: from opacity 0, translateY(8px) */
.tip b.h { display: block; font-size: 13.5px; font-weight: 700; letter-spacing: 0.04em; color: #FFFFFF; font-variant-numeric: tabular-nums; }
.tip .t-two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 13px; }
.tip .t-two em { display: block; font-style: normal; font-size: 8.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.45); }
.tip .t-two b  { display: block; margin-top: 4px; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; }
.tip .t-when { display: grid; grid-template-columns: auto 1fr; gap: 5px 14px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.12); }
.tip .t-when span { align-self: center; font-size: 8.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.45); }
.tip .t-when b    { font-size: 11.5px; font-weight: 500; color: rgba(255,255,255,0.88); font-variant-numeric: tabular-nums; }
```

```html
<b class="h">S2A-48201</b>
<div class="t-two"><div><em>Acquisition</em><b style="color: ACQ_COLOUR">93.12%</b></div>
                   <div><em>Publication</em><b style="color: PUB_COLOUR">90.40%</b></div></div>   <!-- '—' when null -->
<div class="t-when"><span>Start</span><b>2026-09-12 08:14</b><span>Stop</span><b>2026-09-12 08:20</b></div>
```

Colours as in the card (§7). It shows the bar's representative datatake. Position from the mouse:
`x = clientX + 18`, `y = clientY − height − 14`; if it would overflow the right edge (12 px margin)
`x = clientX − width − 18`; if `y < 12` then `y = clientY + 20`. Hidden when the pointer leaves a bar
and on scroll.

## 7. Datatake panel (inline, under the picked bar's band)

```css
.dtk-inline { position: relative; overflow: hidden; margin: 4px 0 14px 60px; padding: 0;
              border-top: 1px solid rgba(255,255,255,0.16); border-bottom: 1px solid rgba(255,255,255,0.16); }
.dtk-h   { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 2px 0; }
.dtk-h b { font-size: 16px; font-weight: 700; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: #EAF0F6; }
.dtk-x   { width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; background: none; color: rgba(234,240,246,0.5); }
.dtk-x:hover { color: #FFFFFF; }
/* × icon 12×12: path "M3 3l10 10M13 3L3 13", stroke-width 1.6 */
.dtk-when { padding: 6px 2px 0; font-size: 11.5px; color: #6B7686; font-variant-numeric: tabular-nums; }      /* 'YYYY-MM-DD HH:MM:SS' */
.dtk-body { display: flex; flex-wrap: wrap; align-items: center; gap: clamp(22px, 5vw, 70px); padding: 18px 2px 22px; }  /* no border of its own */
.dtk-rings { display: flex; gap: clamp(20px, 4vw, 54px); padding: 0; }

.ring       { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.ring .rt   { font-size: 9.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(234,240,246,0.6); }
.ring .rwrap { position: relative; width: 118px; height: 118px; }
.ring .rwrap b { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; }
.ring .rwrap b em   { font-style: normal; font-size: 6.5px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.62);
                      max-width: 74px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ring .rwrap b span { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }   /* in the side's colour */
.ring .rl   { display: flex; align-items: center; gap: 6px; font-size: 9px; font-weight: 400; letter-spacing: 0.1em; text-transform: uppercase; color: #6B7686; }
.ring .rl i { width: 7px; height: 7px; border-radius: 50%; }

.dtk-body dl { margin: 0; display: grid; grid-template-columns: auto auto; gap: 10px 22px; font-size: 12px; }
.dtk-body dt { align-self: center; font-size: 9px; font-weight: 400; letter-spacing: 0.2em; text-transform: uppercase; color: #4E5866; }
.dtk-body dd { margin: 0; font-weight: 400; font-variant-numeric: tabular-nums; color: #EAF0F6; }
.badge { display: inline-block; padding: 3px 8px; border-radius: 2px; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; color: #070B0F; }
```

Ring SVG: `viewBox 0 0 70 70`, `r 27`, track `stroke rgba(255,255,255,0.14)` width 9, arc in the side's
colour, width 9, `rotate(-90 35 35)`, drawn only when > 0. Centre: `COMPLETENESS` + `93.12%` (or `—`).
Legends: `● Acquired` / `● Published` (or `● Processing`) in the side's colour, then `● Missing` with dot
`rgba(255,255,255,0.24)`. **No draw-in animation** on the arc.

Key/value rows, in order: `Data take ID` · `Platform` (satellite, e.g. S2A) · `Start date`
(`YYYY-MM-DD HH:MM`) · `Stop date` (start + sensing duration, same format) · `Acquisition` (badge) ·
`Publication` (badge). **No "Sensor mode" row** (Decision 9).

Badges and colours:
- Acquisition label: Planned → `PLANNED`, Processing → `ACQUIRED`, Acquired → `ACQUIRED`, Partial →
  `PARTIAL`, Unavailable → `UNAVAILABLE`. Colour: pct null → `#7A8696`, else band(pct).
- Publication label: `PLANNED` / `PROCESSING` / `MISSING` / `PARTIAL` / `PUBLISHED`. Colour: pub null →
  `#7A8696`; PROCESSING → `#5B9BE8`; else band(pub).

Open / close (the panel grows in place; the bands below slide, they never jump):

```js
open (first pick only):  h = scrollHeight; height 0, opacity 0 → next frame:
                         transition 'height 560ms cubic-bezier(.2,.7,.2,1), opacity 400ms ease 120ms'; height h, opacity 1;
                         after 600 ms: height auto, transition cleared
switch to another bar:   swap content, no animation
close (×, same bar, Escape, range/pager/Custom change, Reset):
                         height = scrollHeight → next frame: transition 'height 560ms cubic-bezier(.8,0,.8,.3), opacity 300ms ease';
                         height 0, opacity 0; unmount after 620 ms (keep the last datatake rendered until then)
```

## 8. Keyboard

- Escape: close the card (and zoom out).
- ←/→: move the window one day, only when no card is open (not while typing in an input — add that
  guard; the prototype lacks it).

## 9. Description copy (shared PageHeader `desc` prop)

> This page displays all datatakes from the past three months, including those scheduled up to 23:59:59
> of the following day. For each datatake, key information is shown—such as the acquisition platform,
> sensor mode, acquisition status, and total publication completeness (expressed as a percentage)—with
> updates refreshed hourly.
>
> You can filter the records by mission and, optionally, by satellite. Alternatively, filtering by
> satellite alone is also possible. For Sentinel-5P, the satellite selector is disabled, as only one
> satellite is available. Additional filters include a custom date range (aligned with the time filter
> selected at the top of the page), as well as direct searches by datatake ID.
>
> *(note style: 2px cyan left rule)* Please note: the selected "from"–"to" time range applies to the start
> date of the datatakes.
>
> COMPLETENESS *(label)* — legend: ● Planned ● Processing ● Acquired ● Partial ● Unavailable (state colours, §4)

(This is the existing SentiBoard copy; it describes a satellite filter that neither the prototype nor
our page has, and its legend uses state colours although the bars use completeness bands — Decision 10.)

---

## 10. Current code vs. reference (as of 2026-10-25)

Files: `data-availability.tsx`, `availability.module.css`, `mock.ts` (plus the global
`@/styles/data-availability.css`, not reviewed — check it for overrides before changing anything).

| Area | Current code | Reference |
|---|---|---|
| Dead code | table, sort, trend chips, donuts, focused view, `DatatakeModal`/`selected`, unused icons and helpers (`trendSeries`, `daysSinceGap`, `TrendWindow`, `SortKey`…) and ~60 % of the CSS module for them | none of it exists |
| Page side padding | `clamp(18px, 4vw, 48px)` | prototype `clamp(18px, 4.4vw, 64px)` — **kept at the codebase value** (Decision 12) |
| KPI block | `padding: 22px 0 16px; margin-bottom: 24px`; figures `flex: 0 0 220px`, gap 6px | §1/§2: padding-top `clamp(10px,1.4vw,22px)`, bottom `clamp(8px,1vw,16px)`; width `clamp(140px,16vw,220px)`, gap 5px |
| KPI colours | Coverage gaps yellow (`--cmp-partial`) | only Lost is coloured (`#E8514B`) |
| KPI source | `rows` — changes when a bar is picked | filters only; picking never changes them |
| Mean completeness | includes Planned (0) and Processing | only datatakes with a final pct |
| Coverage gaps | count of Partial + Unavailable datatakes | count of satellite-days with no datatake (Decision 4) |
| KPI count-up | none | 620 ms ease-out from the previous value (Decision 4) |
| Toolbar spacing | `.filters margin-bottom: 38px` | toolbar `margin-top clamp(16px,2.6vh,28px)`, `padding-bottom clamp(22px,3vw,38px)` (Decision 1) |
| Range heading | `PERIOD_LABEL[period]`, `22px`, `line-height 22px` | `Last 24 hours / Last 7 days / Last 30 days / Custom range`, `clamp(17px,1.7vw,22px)`, lh 1, 6px right margin |
| Range buttons | hover → white | hover: no change |
| Window | ends today | ends tomorrow (scheduled); 30d = 31 days (Decision 2) |
| Pager ‹ › | lucide 13px, hover background; ‹ never disabled; step = whole window, switches to Custom | 11px SVG, no hover; ‹ disabled at data start; step = 1 day, stays on preset; ←/→ keys (Decision 3) |
| Pager label | `padding 0 12px`, transparent border → cyan border + tint on hover; click opens a hidden date input | `padding 0`, no border; hover white; click = switch to Custom, show From/To, open From picker |
| From / To | hidden inputs only | visible `.fdates` in Custom (§3.3) |
| Dropdown list | absolute overlay with blurred background | in flow, pushes the page down (as Acquisitions decision 1) |
| Dropdown semantics | single choice with "All", closes on pick, value shows the choice | multi-toggle, no "All", stays open, value empty or `3/4` (Decision 5) |
| Dropdown head | hairline turns cyan on hover/open; chevron rotates | caption turns cyan; hairline stays `.30`; chevron static (Decision 5) |
| List items | 12px/600/.14em/.66; chosen = cyan | 12.5px/500/.12em/.9; switched-off items `.off`; Status items have state dots |
| Search | focus → cyan hairline | no change on focus |
| Reset | hover cyan; disabled when nothing to reset | hover: no change; always enabled; also closes the card |
| Filter effect on strips | non-matching bars stay, dimmed to 0.18; bars folded from the unfiltered list; mission rows stay | non-matching datatakes removed before folding; switched-off missions lose their band (Decision 5) |
| Narrow toolbar | ≤700px: left-aligned, gap 6/22, search full width | ≤760px: still centred; heading full width; search min-width 140px |
| Row layout | grid `60px 1fr`, label nudged with `margin-bottom: 26px`, rows `margin-top clamp(40px,7vh,72px)` | fixed-height bands (§6.1): label and strip centred at 66 %, strip 46 % tall, axis at 90 %, 10px between bands |
| Strip right edge | flush (0) | 4px inset (strip and axis) |
| Zoomed row | `padding-block: clamp(18px,4vh,40px)` | no padding |
| Zoom clipping | `overflow-x: clip` on the lane | not clipped (Decision 8) |
| Faded bars | 0.5 | 0.45 |
| Bar entrance | same 420ms keyframe, no stagger | stagger `min(420, row×45 + bar×2.4)` ms, only on animated renders |
| Axis | `margin-top: 12px` under the track; one text-shadow | positioned at 90 % of the band; two text-shadows |
| Hover info | native `title` | custom tooltip (§6.5) |
| Card frame | `margin 4px 0 8px 60px`; border only under the body (`.14`); `margin-left 0` ≤900px | `margin 4px 0 14px 60px`; top + bottom borders `.16` on the panel; no narrow-screen change |
| Card motion | slide-down 480ms keyframe; no close animation (unmounts) | height grow 560ms + fade; mirrored close 560ms, unmount after 620ms |
| Card type | ID 17px; time 12.5px .78; ring title 10.5/700/.78; legends 10/600/.12em/.78; dt 10/600 .62; dd 600 white 13px; badge 4px 9px 10px | §7: 16px; 11.5px `#6B7686`; 9.5/600/.6; 9/400/.1em `#6B7686`; dt 9/400 `#4E5866`; dd 400 `#EAF0F6` 12px; badge 3px 8px 9px (Decision 11) |
| Card details | ring track `.16`; arc draw-in 900ms; "Missing" dot `.3`; ring gap 6px; close icon lucide 14 `.78` | track `.14`; no draw-in; dot `.24`; gap 5px; 12px SVG `.5` |
| Card rows | includes `Sensor mode` | no Sensor mode (Decision 9) |
| Processing in the card | acquisition ring shows the mock's 20–80 % in a band colour | acquisition `—`, grey `#7A8696`, badge `ACQUIRED` (Decision 6) |

## 11. Decisions (to confirm — edit this list before running the prompts; the prompts follow it)

Recommended choice first. Strike the ones you reject and write what you want instead.

1. **Toolbar → strips spacing.** The prototype's toolbar bottom padding here is `clamp(22px, 3vw,
   38px)`; on Acquisitions it is `clamp(10px, 1.6vw, 20px)`.
   **Done in Session 1 (2026-10-25) — do not change:** `.filters` keeps the shared
   `padding-bottom: clamp(10px, 1.6vw, 20px)`; the difference is `.panel { padding-top: clamp(12px, 1.4vw, 18px) }`
   with `.mapInner { padding: 0 }`, totalling the prototype's `clamp(22px, 3vw, 38px)`. If Session 4
   restructures the strips wrapper, it must carry that padding-top over.
2. **Window end.** **Confirmed 2026-10-25.** → follow the prototype and the Description copy: the window ends at
   the end of **tomorrow** (scheduled datatakes visible), 30d = 31 days, 7d = 8, 1d = today + tomorrow.
3. **Pager step.** (a) prototype: one day per click, stays on the preset, ←/→ keys do the same;
   (b) current: one window per click, switches to Custom.
   **Confirmed 2026-10-25: (a), exactly as the prototype** — one day per click, stays on the preset,
   ←/→ keys do the same, and the heading keeps reading "Last N days" after shifting (the pager label
   shows the actual dates).
4. **KPI formulas.** Mean: *recommended* prototype (final pct only). Coverage gaps: the prototype counts
   satellite-days with no datatake; with our mock (random datatakes, ~1.2 per satellite-day) that number
   would be large and meaningless, while `isGap` (Partial + Unavailable) is documented in `mock.ts` as
   deliberate. → *Recommended:* keep `isGap` for Coverage gaps, adopt the prototype for the other three,
   KPIs ignore the pick. Count-up animation: add it only if Events/Acquisitions KPIs have it (keep the
   KPI block identical across pages).
5. **Mission / Status semantics.** (a) prototype: multi-toggle, no "All", list stays open, value empty
   or `3/4`, non-matching datatakes removed (switched-off missions lose their band), several lists can
   be open; (b) current: single choice + "All", dims non-matching bars.
   **Confirmed 2026-10-25:** (a) for the toggles, value text and removal (non-matching datatakes are
   removed before folding, switched-off missions lose their band, no dimming — delete `.tileDim`), but
   **one list open at a time, Escape and a click outside close it**, and the **chevron behaves as on
   Acquisitions** — the shared dropdown behaviour wins. The list opens **in flow** (pushes the strips
   down): the current absolute overlay renders *behind* the strips, which the in-flow list removes.
6. **Processing in the card.** → *Recommended:* follow the prototype: Planned and Processing have no
   final acquisition completeness — ring `—`, grey, and they are excluded from the Mean KPI (one rule
   for both). The strips already colour them by state.
7. **From/To alignment.** **Confirmed 2026-10-25.** → put the From/To block on the shared 49 px line (inputs'
   hairline on the same bottom edge as the others); every other value as §3.3.
8. **Zoomed strip clipping.** → *Recommended:* keep the current clip at the strip's left/right edges
   (no sideways overflow or scrollbar); the vertical growth stays unclipped.
9. **Sensor mode row.** The prototype card has none; the real data has it and the Description mentions
   it. → *Recommended:* keep `Sensor mode` (after Platform) — say if the stakeholders want it out.
10. **Description.** → *Recommended:* replace the page's `AVAILABILITY_DESCRIPTION` with the §9 copy
    as-is (it is the stakeholders' text), but make the legend show what the bars use: the five
    completeness bands + `0 %` + Planned + Processing. Or keep the state-colour legend exactly as the
    prototype.
11. **Card contrast.** Same question as Acquisitions decision 2. → *Recommended:* keep the current
    brighter ink ramp (`--card-ink-2 .78`, `--card-ink-3 .62`, values white) instead of `#6B7686`
    / `#4E5866`; take every size, weight, spacing and border from §7.
12. **Page side padding** (confirmed 2026-10-25, Session 1): keep `clamp(18px, 4vw, 48px)`, the value the
    navbar and Events use, so the pages stay aligned; the prototype's `clamp(18px, 4.4vw, 64px)` is not
    used. The space before the footer also stays on the shared mechanism
    (`padding-bottom: calc(var(--sb-earth-h, 190px) + 32px)`, as Events) instead of §1's spacer.
13. **Mean completeness with nothing final** (confirmed 2026-10-25, Session 2): show `—`, not the
    prototype's `0%`, when the window has no datatake with a final completeness (only Planned /
    Processing — e.g. 1D, which covers today + tomorrow).
14. **Mock statuses** (Session 2): `mock.ts` decides Planned / Processing from the real current time:
    start > now → Planned; started less than 24 h ago → Processing; older → outage / acquired /
    partial logic. Every window change goes through one `changeWindow` helper that clears the pick.
15. **Lost datatakes must not look like Planned** (confirmed 2026-10-25, option b). In the prototype a
    0 % bar is `#8B98A6`, almost the Planned grey `#7A8696`, and the Status list shows Unavailable as
    red — two contradicting colour systems. Bars keep the completeness bands, except 0 %:
    - lost colour = `#E8514B` (the Status dot and the "Datatakes lost" KPI colour) — replaces
      `MISSING #8B98A6` in `barColor`, so the card's ring/badge and the tooltip use it too;
    - the 0 % **bar** is drawn hatched, so it differs from a solid fire-red Partial (`#E8200F`):
      `background: repeating-linear-gradient(135deg, #E8514B 0 2px, #12161B 2px 5px); border-color: #E8514B;`
      (other bars keep the `#EAF0F6` border);
    - Planned `#7A8696` and Processing `#5B9BE8` unchanged.
    The Description legend (Decision 10) shows: the five bands, Lost (hatched), Planned, Processing.
