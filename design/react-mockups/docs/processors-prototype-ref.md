# Processors page — prototype reference (extracted from SentiBoard.html, src-processors)

Extracted 2026-10-25 from the bundled prototype `SentiBoard.html` (the page is base64-encoded inside it
as `<script type="text/plain" id="src-processors">`, the page reached from the **Processors** nav link).
The shell around the pages injects no CSS into this page; it only toggles `sb-paused` on `<html>` while
the page is off-screen (pauses the star twinkle). Everything below comes from the page itself. These
are the exact values to reproduce. Do not decode the bundle again; use this file.

How to read it:

- The page's CSS is a pile of overrides: the page's own sheet, three "aligned with the other pages"
  sheets, the shared `#sb-unified` block (`html body …` and `!important`), then two late page sheets
  (`.pr-toolbar`, `.sb-kpis`, `.sheet .mk` …). Scripts then **move and rebuild parts of the markup**
  (the Mission dropdown is moved into a toolbar created by script; the range buttons are re-created
  there). The values below are the **resolved winners** for the final DOM. Where a later rule kills an
  effect (a hover colour, a transition), that is stated.
- Tokens after the last override (dark): `--bg #0B0E13` (nav only; the page body is `#000`),
  `--ink #EAF0F6`, `--ink-dim #93A0B0`, `--ink-faint #6B7686`, `--line rgba(255,255,255,0.08)`,
  `--line2 rgba(255,255,255,0.14)`, `--accent #2FC6DC`, `--inforce #3FCF7F` (current baseline),
  superseded ring `#7D8792`, `--pad clamp(18px, 4.4vw, 64px)`, controls `--ctl-line #454C53`,
  `--ctl-ink #B9C2C8`. Mission colour `--mis`: S1 `#FF8F5E`, S2 `#4ADE80`, S3 `#6FA8FF`, S5P `#A78BFA`.
  Font: Noto Sans everywhere (`--mono` = Noto Sans), `font-variant-numeric: tabular-nums` on `body`.
  Only release-note `code` uses `"JetBrains Mono","SF Mono",ui-monospace,Consolas,monospace`.
- All colours below are the dark theme. The page module is token-based (dark and light); map each
  value to the token the module already uses (Decision 28).
- Scope: only the page body under the hero (KPIs, toolbar, satellite column, timeline, detail panel).
  The hero and the Description panel come from the shared `PageHeader`; only the Description **copy**
  is recorded (§14).

Things the final prototype **hides or never builds** (do not build them):

- The processor **accordion list**: `.plist`, `.prow`, `.phdr` (name, current version in mission
  colour, chevron), `.panel`, `.chev` — CSS only, no markup.
- The **version select** `.vsel` (`<select>` + label) and the satellite chips `.rn .sats` — CSS only.
- The range buttons above the chart (`.sheet .tl-range`) — `display: none`; the range lives in the
  toolbar (§3.2). The chart header `.tl-bar` keeps only the caption "Release timeline".
- The hint block under the chart (`.sheet .detail`, `.dt-top/.dt-head` inside the sheet) — created but
  never filled (the detail is written into the right-hand `.detailpane`), and `display: none` in the
  detail view.
- The page's own planet `#earth` and rotating star sky `#sky` (with the two crossing satellites
  `.msat-a/.msat-b`) — `display: none`. The shared planet and shared sky are used (= our
  `SpaceBackdrop` / shared Earth).
- `.satpane` — empty, `height: 0`. The satellite images are drawn on a separate `.orbit` layer (§5.3).
- The Mission dropdown's original place in the left column — the script moves it into the toolbar.
- A value next to the Mission caption — Mission has no `.fdrop-val` (Baseline has one).
- Any highlight of the chosen mission in its list (the `aria-pressed` white is beaten by an
  `!important` 0.9, so all four items look the same — Decision 4).
- Hover effects on range buttons and list items — killed by `!important` colours.
- The interactions the Description copy promises: **no mouse-wheel zoom, no drag** on the timeline, and
  the detail is on the right, not "in the lower part of the screen" (Decision 23).
- KPI count-up, a range heading, a Reset button — none on this page.
- A user pause button for ambient motion — none (the shell pauses twinkle off-screen only). Our
  drifting sky strip, the 9 s satellite float, the satellite glow layers and the "Sentinel-N
  Visualization" placeholder are not in the prototype either.

---

## 1. Page layout and spacing (top to bottom)

| Block              | Value                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board (page body)  | same rise over the hero as every page: `margin-top: calc(-1 * clamp(140px, 17vh, 230px))`, `.scene padding-top: clamp(66px, 8vh, 112px)`, transparent — **reuse the Events/Acquisitions/Data Availability implementation**. Side padding: **`clamp(18px, 4vw, 48px)`, the codebase value** (prototype `--pad clamp(18px, 4.4vw, 64px)`) — Decision 2 |
| KPIs row           | `padding: clamp(10px, 1.4vw, 22px) 0 clamp(8px, 1vw, 16px)`, `margin-top: calc(-1 * var(--sb-lede-comp, 0px))` — the shared KPI block (§2)                                                                                                                                                                                                           |
| Toolbar            | `margin-top: clamp(16px, 2.6vh, 28px)`, `padding: 0 var(--pad)`, **no padding-bottom** (shared value is `clamp(10px, 1.6vw, 20px)` — Decision 1)                                                                                                                                                                                                     |
| Toolbar → timeline | `.split { margin-top: var(--pr-align) }`, `--pr-align: clamp(24px, calc(49.4vh - 355px), 240px)` → ≈ 90 px on a 900 px-high window, 179 px at 1080, 240 px from 1205 up (comment: "one distance from the filters to the processors table for every mission"). Decision 1                                                                             |
| Split              | `position: relative; z-index: 3; display: grid; grid-template-columns: 50% 50%; align-items: start` — satellite column \| timeline column (§5)                                                                                                                                                                                                       |
| After the split    | the prototype grows the scene so the planet's edge sits `max(24px, 3.5vh)` under the satellite; **use the shared bottom spacing** `padding-bottom: calc(var(--sb-earth-h, 190px) + 32px)` (Decision 21)                                                                                                                                              |

Nothing on the page has a card or box: KPIs, filters, satellite, timeline and detail all sit on the
starfield.

## 2. KPIs

The shared KPI block (identical to Acquisitions §2 / Data Availability §2 — reuse it):

```css
.sb-kpis {
  position: relative;
  z-index: 3;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 0;
  padding: clamp(10px, 1.4vw, 22px) 0 clamp(8px, 1vw, 16px);
  margin-top: calc(-1 * var(--sb-lede-comp, 0px));
  animation: sbUp 760ms cubic-bezier(0.2, 0.7, 0.2, 1) 380ms backwards;
} /* sbUp: from opacity 0, translateY(20px) */
.kpi {
  width: clamp(140px, 16vw, 220px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 5px;
}
.kpi b {
  font-size: clamp(26px, 2.9vw, 37px);
  font-weight: 700;
  line-height: 1;
  color: #eaf0f6;
  font-variant-numeric: tabular-nums;
}
.micro {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  line-height: 1.5;
  color: rgba(255, 255, 255, 0.72);
} /* the !important .72 / 10.5px win */
@media (max-width: 900px) {
  .kpi {
    width: clamp(130px, 44vw, 200px);
  }
}
```

Value **over** caption. No value is coloured. Labels, in order: `Processors` · `Releases` ·
`Released in the last year` · `Latest release`. Plain numbers (no zero padding), no count-up.

The KPIs follow **the Mission only** (not the range, the Baseline filter, the search or the pick):

```js
NOW = Date.UTC(2026, 8, 24)                      // prototype: a FIXED date (24 Sep 2026) — Decision 9
rel  = every release date of every processor of the mission
Processors               = m.procs.length          // includes processors with no release (empty lanes)
Releases                 = rel.length              // all releases, whatever their date
Released in the last year = rel.filter(t => NOW - t <= 365 days && t <= NOW).length
Latest release           = year of max(rel.filter(t => t <= NOW))  or '—'
```

## 3. Filter toolbar

One centred, wrapping row built by script: **Mission · 1Y 2Y ALL · Baseline · search**. Nothing else
(no heading, no Reset). Every control sits on one **49 px line** so all hairlines share one bottom edge.

```css
.pr-toolbar {
  position: relative;
  z-index: 3;
  margin-top: clamp(16px, 2.6vh, 28px);
  padding: 0 var(--pad);
}
.pr-toolbar .filters {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 2px 26px;
  text-shadow: none;
}
```

No narrow-screen rule: the row just wraps, centred (Decision 22).

### 3.1 Mission dropdown

```css
.fdrop {
  position: relative;
  width: 220px;
  margin: 0;
  border-top: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
} /* hairline never changes */
.fdrop-head {
  width: 100%;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
.fdrop-head > span:first-child {
  flex: 1 1 auto;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #ffffff;
}
.fdrop-head:hover > span:first-child,
.fdrop.open .fdrop-head > span:first-child {
  color: #2fc6dc;
} /* the CAPTION turns cyan */
.fdrop-head svg {
  color: rgba(255, 255, 255, 0.85);
  transition: transform 460ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.fdrop.open .fdrop-head svg {
  transform: rotate(180deg);
} /* on THIS page the chevron rotates (Events style) */
/* chevron 12×12: <svg viewBox="0 0 16 16" fill="none"><path d="M3 6l5 5 5-5" stroke="currentColor" stroke-width="1.4"/></svg> */

/* the list opens IN FLOW (.pr-toolbar .fdrop-body { position: relative }) and pushes the page down */
.fdrop-body {
  position: relative;
  height: 0;
  overflow: hidden;
  transition: height 480ms cubic-bezier(0.2, 0.7, 0.2, 1);
} /* JS: height = inner.offsetHeight */
.fdrop-inner {
  padding: 6px 0 14px;
}
.fgroup {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.fmis {
  width: 100%;
  min-height: 34px;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
}
/* hover and aria-pressed="true" → #FFF are beaten by the !important 0.9: no visible hover, no visible choice */
```

(The Acquisitions/DA dropdown differs: 420 ms, inner padding `12px 0 16px`, head padding `0 2px`,
chevron static — Decision 3.)

- Caption `Mission`, **no value** beside it. Items: `Sentinel-1`, `Sentinel-2`, `Sentinel-3`,
  `Sentinel-5P` (no "All"). Default Sentinel-1.
- Picking an item closes the list (also when it is the current mission, which is a no-op). A click
  outside closes it; Escape closes it and focuses the head.
- While the Mission list is open, `body.mis-open .orbit .sat { opacity: .16 }` (transition .35s ease):
  the satellites fade (Decision 27).
- Picking a mission: clears that mission's pick, repaints KPIs, heading and timeline, and runs the orbit
  rotation (§11). It does **not** leave the detail view if one is open (prototype bug — Decision 8).

### 3.2 Range buttons `1Y 2Y ALL`

```css
.frange {
  height: 49px;
  display: flex;
  align-items: center;
  gap: 18px;
  border: 0;
}
.frange button {
  height: 49px;
  min-height: 49px;
  padding: 0 1px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  background: none;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
}
.frange button.on {
  color: #ffffff;
  border-bottom-color: #2fc6dc;
}
/* hover: NO change (the !important .72 wins); no transition */
```

Labels `1Y`, `2Y`, `All` (shown `ALL`). Default `All`. A click: sets the range, **clears the pick and
returns to the overview** (§7 `clearSel`), zooms the window to the range (820 ms, §7) and scrolls the
chart to its end. The toolbar keeps the range underlined while a release is picked.

Windows (`now` = real today; dates local in the prototype, UTC in our code — keep UTC):

```js
bounds(m) = [ first-of-quarter(min(earliest release of m, 2014-01-01)) − 3 months , first of (today's month + 3) ]
1Y  = [ first of (today's month − 12), bounds.end ]
2Y  = [ first of (today's month − 24), bounds.end ]
All = bounds                                       // today: Oct 2013 → Jan 2027 for every mission
```

The prototype keeps a **separate range per mission** (switching mission shows that mission's last
range) — Decision 7.

### 3.3 Baseline dropdown

Same `.fdrop` box as Mission (220 px, hairline `.30`, caption cyan on hover/open, rotating chevron,
in-flow list 480 ms, inner `6px 0 14px`), plus a value:

```css
.fdrop-val {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: none;
  color: rgba(255, 255, 255, 0.92);
}
.pr-toolbar .fitem {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 34px;
  padding: 0 2px;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
}
.fitem.off {
  color: rgba(255, 255, 255, 0.5);
} /* no opacity on this page (DA/Acq also had opacity .3) */
/* hover: no change */
```

- Markup per item: `<button class="fitem[ off]"><u>All releases</u></button>`. There is **no
  `.fitem u` rule on this page**, so the labels render **underlined** by the browser default
  (Decision 5).
- Items: `All releases` (value `All`), `Current baselines` (value `Current`). Default All.
- Single choice: picking closes the list; the item **not** chosen gets `.off` — also when "All
  releases" is chosen (initially "Current baselines" is `.off`).
- Unlike Mission, Baseline has **no** outside-click or Escape close, so both lists can be open together.
- Effect: `Current` → every superseded marker **and its stem** fade to `opacity: 0.1` with
  `pointer-events: none` (rows, names and zoomed version labels are untouched; nothing is removed, so
  rows never jump). KPIs unchanged.

### 3.4 Search

```css
.fsearch {
  width: 220px;
  height: 49px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.3);
} /* no change on focus */
.fsearch input {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: none;
  border: 0;
  outline: 0;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0;
  color: #ffffff;
}
.fsearch input::placeholder {
  color: #ffffff;
  opacity: 1;
}
```

Icon 13×13: `<svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.6" stroke="currentColor" stroke-width="1.3"/><path d="M10.4 10.4L14 14" stroke="currentColor" stroke-width="1.3"/></svg>`.
Placeholder `Search`, `aria-label="Search the releases"`.

Semantics (live on `input`, and re-run after a range or mission change):

```js
words = query.trim().toLowerCase().split(/\s+/)
for each marker: hay = marker aria-label (processor name, version, long date, "current baseline"/"superseded")
                     + mission name + processor name + processor description
                     + version + year + release-note lead + every release-note item (heading and text), tags stripped
hit = no words || every word is a substring of hay          // AND of words
not hit → marker + its stem get .sb-dim → opacity 0.12
```

Names, rows, zoomed version labels and KPIs are untouched. (The prototype loses the dimming when the
chart redraws after a pick — a bug; apply it on every render — Decision 6.)

Marker/stem fade: `transition: opacity 240ms ease` (§6.5).

## 4. Data (prototype) and states the mock must produce

Prototype model: mission → processors (`n` name, `d` description) → `hist[]` of releases
`{ y, m, d, v, lead, items[[heading, html]] }` in date order. **Current baseline = the last release of
the processor** (`j === hist.length - 1`), whatever its date. `v` may be null → the version shown is
`'Mon YYYY'` of the release (`verOf`). Satellites = the mission's list (S1: S1C, S1D; S2: S2A, S2B, S2C;
S3: S3A, S3B; S5P: S5P).

Prototype rosters (lane counts drive the row height):

- S1 (3 lanes): L0, SAR L1/L2, SETAP — 3/4/2 releases, versions present.
- S2 (4): MSI L0, MSI L1 (first release without a version), MSI L2, **EUP (no releases)**.
- S3 (20): PUG, L0, OL1, OL1_RAC, OL1_SPC, OL2, SL1, SL2, SL2_LST, SL2_FRP, SR1, SR2, SM2_HY, SM2_LI,
  SM2_SI, MW1, SY2, SY2_AOD, SY2_VGS, SY2_VGP — several with **no releases**, all versions null, many
  releases on the **same date**.
- S5P (3): L1B, L2, **SNPP_CLOUD (no releases)**; L1B and L2 share one release (26 Nov 2025) whose notes
  are the real S5P release note.

Our page reads `useProcessors()` (feed shape `ProcessorGroup`/`ReleaseRecord`, `isCurrent` from the
feed). The mock must produce every state the design shows: current vs superseded; a processor with
no releases (empty lane); a release without a version (if the feed allows it); several releases on
one date; > 12 lanes (22 px rows) and ≤ 8 lanes (44 px rows); a release in the last 365 days and none
in the future; release notes with and without a "Changes introduced" section; empty notes;
`releasedMs` missing; `processingBaseline` present and absent.

## 5. Split layout, satellite column, heading

### 5.1 Overview (nothing picked)

```css
.split {
  display: grid;
  grid-template-columns: 50% 50%;
  grid-template-areas: "lcol proc";
  align-items: start;
}
.lcol {
  grid-area: lcol;
  min-width: 0;
  padding: 0 var(--pad);
} /* holds nothing but the satellite (§5.3) */
.procpane {
  grid-area: proc;
  min-width: 0;
  position: relative;
  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.95),
    0 0 8px rgba(0, 0, 0, 0.85),
    0 1px 14px rgba(0, 0, 0, 0.7);
} /* Decision 20 */
.sheet {
  padding: 0 var(--pad) 0 30px;
  display: flex;
  flex-direction: column;
} /* one per mission; the current one is in flow */
```

Satellite on the left half, timeline on the right half. The timeline column has **30 px** on its left
and the page padding on its right.

### 5.2 Heading and caption

```css
.sheet .phead {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-height: 49px;
  padding-top: 14px;
  margin-bottom: 16px;
} /* border-box: 49 includes the 14 */
.sheet .phead h2 {
  margin: 0;
  font-size: clamp(17px, 1.7vw, 22px);
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  line-height: 1;
  color: #eaf0f6;
}
.tl-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.tl-cap {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #ffffff;
} /* !important winners */
```

Texts: `Sentinel-1 processors` (shown `SENTINEL-1 PROCESSORS`), caption `Release timeline`. Heading top
→ caption top = 49 + 16 = 65 px. Then the chart (`margin-top: 8px`, §6).

### 5.3 Satellite (left column)

The images are transparent cut-outs (WebP with alpha, ESA artist's impressions): no background, no glow
layers, no blend mode, no float animation.

```css
.orbit .sat {
  position: absolute;
  left: 0;
  top: 0;
  object-fit: contain;
  filter: drop-shadow(0 18px 40px rgba(0, 0, 0, 0.5));
  transition: opacity 0.35s ease;
} /* alt: "Artist's impression of Sentinel-1" */
.orbit {
  transition: opacity 0.5s ease;
}
body.tl-focus .orbit {
  opacity: 0;
} /* hidden while a release is open (§10) */
```

Size and place (`placeSats`), computed once for the settled layout, not while scrolling:

```js
aw  = left column width (50% of the page)
top = toolbar bottom + 12                              // just under the filters
ah  = max(110, horizon − top − 10)                    // horizon = the shared planet's edge under the left column, page pinned at the filters
box = { width: aw × (aw < 420 ? 0.92 : 0.66), height: ah × 0.8 }   // object-fit: contain inside it
centre = (aw / 2, top + ah / 2)                        // centred in the left half and in the free sky below the filters
```

At 1440×900 that is a ≈ 475 × 410 px box whose top is ≈ 50 px under the toolbar; at 1920×1080
≈ 630 × 515 px. A CSS approximation of the height: `clamp(220px, calc(57vh - 103px), 640px)`.
The layer scrolls **with the page** (not sticky — the final prototype moved it out of the sticky
stage on purpose: "the satellites travel with the page").

## 6. Timeline chart (port exactly: absolute positions in a fixed-height track)

### 6.1 Frame

```css
.tl {
  position: relative;
  z-index: 3;
  padding: 0 0 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.tl-scroll {
  margin-top: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.18) transparent;
}
.tl-scroll::-webkit-scrollbar {
  height: 6px;
}
.tl-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.16);
  border-radius: 3px;
}
.tl-chart {
  position: relative;
  display: grid;
  grid-template-columns: 100px 1fr;
}
```

**Width:** `min-width = max(600, round(100 + months × 6)) px`, `months = window / 30.44 days` — the
chart widens about 6 px per month and scrolls sideways. All (≈ 159 months) → ≈ 1054 px; 1Y/2Y/zoom →
600 px. During the zoom animation the width follows the animated window (Decision 13).

**Scroll position:** after every render/pick: overview → scrolled to the **end** (latest releases and
TODAY), picked → to the **middle**; `behavior: smooth` (auto with reduced motion).

### 6.2 Geometry

```js
n  = processors of the mission (lanes, including those without releases)
rh = n > 12 ? 22 : n > 8 ? 28 : 44
TOP = 42                        // rows start under the year + month labels
H  = TOP + rh × n + 26          // 26: room for the TODAY label under the last row
row i: y = TOP + i × rh, marker centre cy = y + rh / 2
x(t) = (t − win.start) / (win.end − win.start) × 100 %     // releases outside −2 % … 102 % are not drawn
```

### 6.3 Names column (pinned)

```css
.tl-labels {
  position: sticky;
  left: 0;
  z-index: 2;
  height: H;
  background: linear-gradient(to right, #000 82%, rgba(0, 0, 0, 0));
} /* full height in the prototype — Decision 14 */
.tl-labels span {
  position: absolute;
  left: 0;
  top: y;
  height: rh;
  width: 96px;
  display: flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(234, 240, 246, 0.55);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition:
    color 0.3s,
    opacity 0.3s;
}
.tl-labels span.on {
  color: #ffffff;
} /* the picked release's row */
.tl .dim {
  opacity: 0.3;
} /* every other row while a release is picked (names, stems, markers, version labels) */
```

Name = processor name minus the mission prefix **and** minus a leading `MSI `/`TROPOMI `:
`name.replace(/^S\d\w?\s+/, '').replace(/^(TROPOMI|MSI)\s+/, '')` (`S2 MSI L1` → `L1`, `S5P L1B` →
`L1B`); `title` = full name.

### 6.4 Axis, grid, rows, TODAY

```css
.tl-track {
  position: relative;
  overflow: hidden;
  height: H;
}
.g {
  position: absolute;
  top: 22px;
  bottom: 0;
  width: 1px;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
} /* month line */
.g.y {
  top: 0;
  background: rgba(255, 255, 255, 0.15);
} /* January */
.yl {
  position: absolute;
  top: 3px;
  padding-left: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(234, 240, 246, 0.6);
  white-space: nowrap;
} /* unified wins over 11px/.06em */
.ml {
  position: absolute;
  top: 24px;
  padding-left: 4px;
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #6b7686;
  white-space: nowrap;
}
.rl {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
} /* at TOP + i × rh, i = 0 … n */
.today {
  position: absolute;
  top: 40px;
  bottom: 22px;
  width: 1px;
  background: #2fc6dc;
}
.today b {
  position: absolute;
  left: 0;
  top: calc(100% + 6px);
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #2fc6dc;
  white-space: nowrap;
} /* text "TODAY" */
.today.end b {
  transform: translateX(-100%);
} /* when TODAY is past 94 % */
/* every grid element, label, TODAY and version label: pointer-events: none */
```

```js
every = months <= 15 ? 1 : months <= 28 ? 2 : months <= 60 ? 3 : 12      // > 5 years: years only
for each month start d from the window start's month to the window end:
  x = x(d); jan = d is January
  if x >= -1 && (month % every == 0 || jan): grid line (.g, .g.y for January);
                                             month label 'Jan'…'Dec' if x < 93 && every < 12
  if x >= -1 && x < 95 && (jan || first label not printed yet): year label at max(0, x)
TODAY drawn only if 0 <= x(now) <= 100
```

(The prototype prints the first-year label without checking room, so "2013" can overprint "2014";
our `leadRoom` 8 % check is kept — Decision 15.)

### 6.5 Releases: stem, marker, version label

```css
.stem {
  position: absolute;
  top: 40px;
  height: cy − 40;
  width: 1px;
  background: rgba(255, 255, 255, 0.16);
  pointer-events: none;
}
.mk {
  position: absolute;
  z-index: 1;
  left: x;
  top: cy;
  width: 13px;
  height: 13px;
  margin: -6.5px 0 0 -6.5px;
  padding: 0;
  box-sizing: border-box;
  border-radius: 50%;
  background: #000;
  border: 1.5px solid #7d8792;
  cursor: pointer;
} /* superseded = ring */
.mk:hover {
  border-color: #c3cad1;
  transform: scale(1.3);
}
.mk.now {
  background: #3fcf7f;
  border-color: #3fcf7f;
  box-shadow: 0 0 10px rgba(63, 207, 127, 0.45);
} /* current = filled; keeps its green border on hover */
.mk.sel {
  transform: scale(1.25);
  box-shadow:
    0 0 0 4px #000,
    0 0 0 5px #fff,
    0 0 18px 6px rgba(255, 255, 255, 0.35);
} /* stays 1.25 on hover */
.mk.now.sel {
  box-shadow:
    0 0 0 4px #000,
    0 0 0 5px #3fcf7f,
    0 0 18px 6px rgba(63, 207, 127, 0.55);
}
.sheet .mk,
.sheet .stem {
  transition: opacity 240ms ease;
}
/* ↑ this later rule REPLACES the marker's own "transform .2s, box-shadow .3s, opacity .3s, border-color .2s":
   hover scale, ring and border colour snap with no animation; only opacity fades (Decision 16) */
.vl {
  position: absolute;
  left: x;
  top: cy;
  margin: -8px 0 0 14px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: #93a0b0;
  white-space: nowrap;
  pointer-events: none;
} /* only while zoomed; no entrance animation */
.vl.now {
  color: #3fcf7f;
}
```

Marker `aria-label`: `"<processor> <version>, <D Month YYYY>, current baseline|superseded"`,
`aria-pressed` = picked. While the window is animating the markers get **no handlers** (inert).
Version label text = version, or `Mon YYYY` when the release has none.

Filter states on markers and stems (§3.3, §3.4): Current-only `opacity .1` + `pointer-events: none`;
search miss `opacity .12`; row dim `.3`.

## 7. Picking a release (zoom)

```js
click marker: same as picked → clearSel (overview) ; else select(i, j)
select:   sel = {i, j}; setFocus(true) (§10); zoom window to zoomWin(release); scroll chart to the middle; render detail
clearSel(range?): range ← range if given; sel = null; setFocus(false); zoom to the range window; scroll chart to the end
zoomWin: [release − 5 months, release + 5 months], slid back inside bounds when it runs past either end

zoomTo (camera glide): 820 ms, ease-in-out cubic (k < .5 ? 4k³ : 1 − (−2k + 2)³ / 2);
  centre interpolated linearly, WIDTH interpolated logarithmically (w = w0 × (w1 / w0)^e);
  a new target cancels the running one and starts from where it got to; reduced motion → jump
```

While zoomed: the picked row's name is white (`.on`), every other row (name, stems, markers, version
labels) at `.3`; every release in the window shows its version label.

(Current code already matches this section, except the chart width rule §6.1.)

## 8. Hover card (tooltip)

Lives on `<body>`, fixed to the window (keep our portal — an ancestor has a transform).

```css
.tl-tip {
  position: fixed;
  z-index: 55;
  width: 236px;
  padding: 14px 16px 13px;
  box-sizing: border-box;
  background: rgba(9, 12, 16, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  pointer-events: none;
  text-shadow: none;
  opacity: 0;
  transform: translateY(4px);
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.tl-tip.on {
  opacity: 1;
  transform: none;
} /* fades out the same way on hide */
.tt-title {
  margin: 0 0 10px;
  font-size: 14.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #fff;
}
.tt-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.tt-k {
  display: block;
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(234, 240, 246, 0.45);
}
.tt-v {
  display: block;
  margin-top: 4px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.15;
  color: #eaf0f6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tt-v.go {
  color: #19e27a;
} /* NOTE: brighter than the marker green #3FCF7F */
.tt-v.old {
  color: #93a0b0;
}
.tl-tip hr {
  margin: 11px 0 9px;
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}
.tt-rows {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 5px 12px;
  align-items: baseline;
  margin: 0;
}
.tt-rows dt {
  font-size: 8.5px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(234, 240, 246, 0.45);
}
.tt-rows dd {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.4;
  color: rgba(234, 240, 246, 0.88);
}
.tt-hint {
  margin-top: 9px;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #2fc6dc;
}
```

Content: title = processor name; Version (green `.go` if current) · Status `Current`/`Superseded`;
rows `Released` (`YYYY-MM-DD`), `Satellites` (mission list), `Changes` = the release-note item
headings, first two joined `, ` + ` + N more` (or the lead when there are none) — **inline beside its
label**, not full-width. Hint: `Click to zoom in and read the notes` / `Click to go back to the
overview` (picked). Decision 17.

Placement (from the marker's rect `br`, the chart frame `tr`, card size `tw × th`):

```js
skyTop = max(nav bottom, stage top) + 8          // under the fixed nav
skyBot = planet horizon − 12                     // ours: window.innerHeight − 12 (no horizon line here)
cx = br.left + br.width / 2; gap = 12
vx = clamp(cx − tw / 2, tr.left, tr.right − tw)   // centred on the marker, kept inside the chart frame
if (br.top − th − gap >= skyTop)       vy = br.top − th − gap          // above
else if (br.bottom + th + gap <= skyBot) vy = br.bottom + gap           // below
else { vx = cx + 16 + tw <= tr.right ? cx + 16 : cx − 16 − tw;         // beside, vertically centred
       vy = clamp(br.top + br.height / 2 − th / 2, skyTop, skyBot − th) }
```

Shown on mouseenter and focus; hidden on mouseleave, blur, click, **page scroll** and chart scroll.

## 9. Detail panel (right half while a release is picked)

```css
.detailpane {
  grid-area: detail;
  min-width: 0;
  padding: 14px var(--pad) 48px 34px; /* +var(--below) in the prototype — Decision 21 */
  text-shadow:
    0 0 2px rgba(0, 0, 0, 0.95),
    0 0 8px rgba(0, 0, 0, 0.85),
    0 1px 14px rgba(0, 0, 0, 0.7);
  opacity: 0;
  transform: translateX(56px);
  transition:
    opacity 420ms ease,
    transform 640ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.detailpane.on {
  opacity: 1;
  transform: none;
}
.dt-in.swap {
  animation: vswap 320ms ease;
} /* vswap: opacity .25 → 1 — stepping / picking another release while open */

.dt-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.dt-back {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(234, 240, 246, 0.55);
  transition: color 0.2s;
}
.dt-back:hover {
  color: #fff;
}
/* back icon 12×12: viewBox 0 0 16 16, stroke 1.5, path "M7 3L2 8l5 5M2 8h12"; text "Overview" */
.dt-steps {
  display: flex;
  gap: 8px;
}
.step {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 0;
  border: 1px solid #454c53;
  background: rgba(8, 12, 16, 0.35);
  color: #b9c2c8;
  cursor: pointer;
  transition:
    color 0.2s,
    border-color 0.2s;
}
.step:hover:not(:disabled) {
  border-color: #6a737a;
  color: #fff;
}
.step:disabled {
  border-color: #262c31;
  color: #3b4247;
  cursor: default;
} /* no opacity change */
/* chevrons 13×13: viewBox 0 0 24 24, stroke 2.4; previous "M15 5l-7 7 7 7", next "M9 5l7 7-7 7"; aria-labels "Previous release" / "Next release" */

.dt-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}
.dt-proc {
  display: block;
  font-size: 11.5px;
  color: #6b7686;
} /* "S1 SAR L1/L2 · SLC · GRD · OCN · all modes" */
.dt-ver {
  display: block;
  margin-top: 4px;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1;
  color: #eaf0f6;
}
.vtag {
  margin-left: auto;
  padding: 6px 12px;
  border-radius: 0;
  border: 1px solid currentColor;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.vtag.now {
  color: #3fcf7f;
}
.vtag.old {
  color: #6b7686;
} /* "Current baseline" / "Superseded" */

.meta {
  display: grid;
  gap: 8px;
  margin: 0 0 20px;
}
.meta div {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12.5px;
  color: #93a0b0;
}
.meta dt {
  font-weight: 400;
  color: #6b7686;
}
.meta dd {
  margin: 0;
  font-weight: 600;
  color: #eaf0f6;
}

.rn h4 {
  margin: 0 0 12px;
  font-size: 12.5px;
  font-weight: 700;
} /* "Release notes" */
.rn p {
  margin: 0 0 10px;
  font-size: 12.5px;
  color: #93a0b0;
} /* the lead */
.rn ul {
  margin: 0 0 18px;
  padding-left: 19px;
}
.rn li {
  margin-bottom: 5px;
  font-size: 12.5px;
  line-height: 1.62;
  color: #93a0b0;
}
.rn li b {
  font-weight: 600;
  color: #eaf0f6;
} /* item heading, then ": text" */
.rn code {
  font-family: "JetBrains Mono", "SF Mono", ui-monospace, Consolas, monospace;
  font-size: 11.5px;
  color: var(--mis);
} /* mission colour — Decision 19 */
```

Meta rows (prototype): `Processor Baseline ID:` `June 2026 Release` (`<Month> <YYYY> Release`) ·
`Operational since:` `15 June 2026` · `Impacted satellite(s):` `S1C, S1D` (Decision 18).
Steps: previous/next release **of the same processor**, disabled at the ends; a step is a new pick
(the window re-zooms, the content swaps with `vswap`).

## 10. Overview ↔ detail motion

```js
setFocus(true)  — open (first pick only):
  FLIP on the timeline column: measure, switch the grid, measure again;
    procpane.transform = translate(dx, dy) with no transition → next frame
    transition 'transform 720ms cubic-bezier(.2,.7,.2,1)', transform '' (it glides from the right half to the left)
  grid: areas "proc detail" (columns stay 50% 50%); satellite column display none; detail display block
  detail: .on added after 180 ms (fade 420 ms + slide from 56 px, 640 ms)
  satellites: body.tl-focus → .orbit opacity 0 (.5 s)
setFocus(false) — close (Overview, same marker, a range button):
  detail: .on removed (fades/slides out), THEN after 280 ms: grid back to "lcol proc",
  timeline FLIPs back to the right (720 ms), satellite column re-enters: animation 'lcolIn 560ms ease both'
  (from opacity 0, translateX(−24px)); satellites fade back in (.5 s)
picking another release while open: no layout change; content swaps with vswap 320 ms
reduced motion: everything instant (the prototype kills every transition and animation)
```

Keep the last release rendered while the detail fades out (as on Acquisitions/DA).

## 11. Mission change: the orbit rotation

Everything turns together around the planet's centre, like one rigid body: satellites, the mission's
timeline sheet, the shared sky and the shared planet.

```js
// stage = the viewport below the nav (W × H, H = 100vh − 64px)
s = H / 1600; centre = (W / 2, H + 6133.05 × s)          // = (W/2, 4.833 H): far below the stage
STEP = W × 1.08 / (centreY − H / 2)  ≈ 0.249 × W / H rad   // per mission (≈ 0.43 rad at 1440×836)
pos  = animated mission index (0 = S1 … 3 = S5P); phi = pos × STEP
duration = 1300 + 600 × max(0, |to − from| − 1) ms, ease-in-out cubic; reduced motion → jump

satellite i: off = i − pos; hidden when |off| >= 0.999;
  placed at angle a0 + off × STEP on the circle through its home position (§5.3) around centre,
  image rotated by off × STEP rad
sheet i (heading + timeline of mission i): hidden when |off| >= 0.999;
  transform-origin = the planet centre (in the sheet's own box); transform rotate(off × STEP rad);
  opacity = max(0, 1 − |off| × 1.4); the current sheet is in flow, the others absolutely on top of it
shared planet + shared sky: turned by phi every frame (SharedEarth.own(phi, false)): texture and sky
  shift by phi × 6335.53 units × (1.5 W / 1480) px per unit ≈ 6.42 × phi × W px
```

Decision 11.

## 12. Keyboard

Prototype: Escape closes the Mission list only. No Escape for Baseline or for the detail; no arrow keys.
(Ours: Decision 24.)

## 13. Responsive

```css
@media (max-width: 1080px) {
  .split {
    grid-template-columns: 40% 60%;
  } /* satellite stays on the left */
  .sheet {
    padding: 0 var(--pad) 0 12px;
  }
  .split.focus {
    grid-template-columns: 100%;
    grid-template-areas: "proc" "detail";
  } /* detail under the timeline */
  .split.focus .detailpane {
    padding-left: var(--pad);
    padding-top: 4px;
  }
}
@media (max-width: 640px) {
  .split {
    grid-template-columns: 34% 66%;
  }
  .lcol {
    padding: 0 10px 0 var(--pad);
  }
  .sheet {
    padding: 0 var(--pad) 0 4px;
  }
  /* the 14px heading rule is beaten by the unified clamp(17px, 1.7vw, 22px) */
}
/* satellite box width: 92 % of the column when the column is under 420 px, else 66 % */
```

## 14. Description copy (shared PageHeader `desc` prop)

> The Processors tab shows the complete list of the releases of the Copernicus Sentinels processors,
> on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged to
> the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a
> coloured box, the details relevant to the selected processor release is displayed in the lower part
> of the screen.
>
> Select a release on the timeline to read its baseline notes. _(same paragraph style; `margin-top: 22px`)_
>
> Legend: ● Current baseline _(filled `#3FCF7F`, glow `0 0 8px rgba(63,207,127,.45)`)_ ○ Superseded
> _(1.5px ring `#7D8792`, hollow)_ — dots 11×11, gap 9px; labels 11px/600/.16em uppercase `.55`; legend gap `10px 22px`.

Paragraphs: 15px, line-height 1.75, `rgba(234,240,246,.70)`, margin `0 0 20px`. Hero subtitle (lede):
`The complete list of Copernicus Sentinel processor releases on an interactive timeline.`

(The copy promises wheel zoom, drag and a detail "in the lower part of the screen"; the prototype has
none of them — Decision 23.)

---

## 15. Current code vs. reference (as of 2026-10-25)

Files: `processors.tsx`, `processors.module.css` (check the global styles and `page-header.css` for
overrides before changing anything).

| Area                | Current code                                                                                                                                                                                                                                                                       | Reference                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dead code           | sky strip (`.skyStrip/.skyTrack/.skyTile`, `skyDrift` 150 s), `satFloat`, `.artGlow/.art`, `.placeholder`, `.captionRow`, `.motionBtn`, `.paused`, `motionPaused` state, unused imports `AmbientSky`, `MotionToggle`, `ambientRoot`, `useAmbientMotion`; `.caption` declared twice | none of it exists                                                                                                                                                                                                             |
| Backdrop            | `<SpaceBackdrop page={1}>`                                                                                                                                                                                                                                                         | Processors is the **third** window of the shared panorama (prototype `PAGE = 2`; Events 0, DA 1) — Decision 25                                                                                                                |
| Page rise over hero | `.headArt + .container { margin-top: calc(16px - var(--hero-after-pad, 72px)) }`, stats `padding-top: 22px`                                                                                                                                                                        | same board rise as the other pages (§1)                                                                                                                                                                                       |
| KPI block           | own `<dl>` grid, 4 columns, `padding 56px 16px 44px`, label **above** value, value `font-display` 600 `clamp(36px,4.2vw,52px)`                                                                                                                                                     | the shared KPI block (§2): value over caption, 700 `clamp(26px,2.9vw,37px)`                                                                                                                                                   |
| KPI formulas        | real now; last year = `ms >= now − 1 calendar year` (includes future); latest = max of all                                                                                                                                                                                         | `t ∈ (now − 365 d, now]`; latest = max ≤ now; fixed NOW in the prototype (Decision 9)                                                                                                                                         |
| Toolbar spacing     | none above; `.split margin-top: 56px`                                                                                                                                                                                                                                              | toolbar `margin-top clamp(16px,2.6vh,28px)`; toolbar → split `--pr-align` (Decision 1)                                                                                                                                        |
| Toolbar alignment   | `align-items: flex-end`                                                                                                                                                                                                                                                            | `flex-start`, every control on the 49 px line                                                                                                                                                                                 |
| Dropdowns           | local `FilterDropdown`: absolute menu, head `padding 6px 0 9px`, caption 11/700/.16em, hairline `--line-strong` → transparent when open, chevron 13 px (24 box, 2.4) rotating 0.2 s, items 11/700/.16em mute, chosen = underlined white                                            | the shared dropdown (Decision 3): in flow, 48 px head, caption 11/600/.2em white → cyan, hairline `.30` fixed, 12 px chevron (16 box, 1.4), items 12.5/500/.12em `.9`, non-chosen `.off .5`                                   |
| Mission list        | no indication of the choice                                                                                                                                                                                                                                                        | prototype: none either; Decision 4                                                                                                                                                                                            |
| Range buttons       | `font-mono` 12px/600/.12em mute, `padding 4px 0 3px`, hover → white, 0.2 s transitions                                                                                                                                                                                             | 11px/600/.16em `.72`, 49 px tall, 2 px cyan underline, no hover, no transition                                                                                                                                                |
| Search box          | `padding 6px 0 9px`, gap 10, icon 14 px (24 box), focus → cyan hairline, input 13px/600/.02em, placeholder `.85`                                                                                                                                                                   | 49 px, gap 8, icon 13 px (16 box), no focus change, input 14px/500/0, placeholder white `1`                                                                                                                                   |
| Search semantics    | group label/sub or baseline substring                                                                                                                                                                                                                                              | all words, over name, description, version, year, notes text (Decision 6)                                                                                                                                                     |
| Layout mechanism    | 3-column grid `1fr 1fr 0fr` ↔ `0fr 1fr 1fr`, `grid-template-columns 0.7s var(--ease)`                                                                                                                                                                                              | 2 areas 50/50, FLIP 720 ms + detail slide 56 px (Decision 12)                                                                                                                                                                 |
| Satellite column    | sticky `top: 24px`, `padding 32px 24px 0`, max-height 640, glow + radial art, `mix-blend-mode: screen`, opacity .92, 9 s float, placeholder text                                                                                                                                   | scrolls with the page; transparent cut-out with `drop-shadow(0 18px 40px rgba(0,0,0,.5))`; size §5.3; fades out (.5 s) in detail (Decision 10)                                                                                |
| Columns' padding    | timeline `padding: 0 clamp(16px,3vw,48px) 96px`; detail `0 clamp(16px,3vw,48px) 96px 0`                                                                                                                                                                                            | sheet `0 pad 0 30px`; detail `14px pad 48px 34px` (Decision 2)                                                                                                                                                                |
| Heading             | `font-display` 20px/700/.08em, `margin 0 0 30px`                                                                                                                                                                                                                                   | `clamp(17px,1.7vw,22px)`/700/.02em, lh 1, block 49 px with 14 px top padding, 16 px below                                                                                                                                     |
| Caption             | 10.5px/700/.22em `--text-dim`                                                                                                                                                                                                                                                      | 11px/600/.2em white                                                                                                                                                                                                           |
| Chart frame         | border-bottom `var(--line)`                                                                                                                                                                                                                                                        | `rgba(255,255,255,.12)`                                                                                                                                                                                                       |
| Chart width         | fixed `minWidth: 600`                                                                                                                                                                                                                                                              | `max(600, 100 + 6 px/month)` (Decision 13)                                                                                                                                                                                    |
| Names               | 10.5/700/.12em `--text-dim`; backdrop starts at 42 px; prefix rule drops only `S1 …`                                                                                                                                                                                               | 10/600/.14em `.55`; backdrop full height (Decision 14); also drops `MSI `/`TROPOMI `                                                                                                                                          |
| Grid / labels       | hairlines 8 % / 16 % of text; years 11px/.06em dim; months dim (contrast fix for light)                                                                                                                                                                                            | `.06` / `.15`; years 10px/600/.08em `.6`; months 9px `#6B7686`                                                                                                                                                                |
| Markers             | transitions transform .2 s etc.; hovering the picked marker scales to 1.3                                                                                                                                                                                                          | only opacity 240 ms survives; picked stays 1.25 on hover (Decision 16)                                                                                                                                                        |
| Version labels      | `vlIn` 0.4 s fade-in                                                                                                                                                                                                                                                               | no animation                                                                                                                                                                                                                  |
| Tooltip             | unmounts at once (in: `tipIn` 0.18 s with margin-top 4px); placement: above unless `r.top < 330`, clamped to the scroll box; bg `--bg-1 96%`, `--shadow`; Version green = `--bl-current`; rows Released / Operational since / Satellites / Changes (full width)                    | fades in **and out** (opacity + translateY 4 px, .18 s); placement §8; `rgba(9,12,16,.96)`, `0 12px 28px rgba(0,0,0,.55)`; `.go #19E27A`; rows Released / Satellites / Changes inline (Decision 17); hides on page scroll too |
| Detail entrance     | `dtIn` 0.45 s translateY(8px); `min-width: 440px`                                                                                                                                                                                                                                  | pane fade 420 ms + slide X 56 px 640 ms after 180 ms; steps/reselect `vswap` 320 ms                                                                                                                                           |
| Back button         | font-mono 11px, stroke 1.6                                                                                                                                                                                                                                                         | 10.5px/700/.2em `.55`, stroke 1.5                                                                                                                                                                                             |
| Step buttons        | 36 × 36, `--line-strong`, hover cyan + glow, disabled opacity .3                                                                                                                                                                                                                   | 40 × 40, `#454C53`, bg `rgba(8,12,16,.35)`, hover `#6A737A`/white, disabled `#262C31`/`#3B4247`                                                                                                                               |
| Detail head         | proc 12px; version `font-display` 40px, margin-top 8; `margin-bottom 28px`; `dtTop margin-bottom 36px`                                                                                                                                                                             | 11.5px `#6B7686`; 28px/700, margin-top 4; 18 px; 18 px                                                                                                                                                                        |
| Status tag          | 11px, `padding 9px 14px`, green = `--ok`                                                                                                                                                                                                                                           | 10.5px/600/.18em, `6px 12px`, `#3FCF7F`                                                                                                                                                                                       |
| Meta                | 13px, gap 10, margin-bottom 32; rows Processing baseline / Released / Operational since / Impacted satellite(s)                                                                                                                                                                    | 12.5px, gap 8, margin-bottom 20; rows Processor Baseline ID / Operational since / Impacted satellite(s) (Decision 18)                                                                                                         |
| Release notes       | sanitized feed HTML, 13px lh 1.62, h4 13px                                                                                                                                                                                                                                         | 12.5px; h4 12.5px; items `<b>heading</b>: text`; `code` mission colour (Decision 19)                                                                                                                                          |
| Text shadow         | none                                                                                                                                                                                                                                                                               | dark halo on the timeline and detail columns (Decision 20)                                                                                                                                                                    |
| Escape              | closes the detail; dropdown has its own                                                                                                                                                                                                                                            | prototype: Mission list only (Decision 24)                                                                                                                                                                                    |
| Mission change      | clears the pick (good), instant swap                                                                                                                                                                                                                                               | orbit rotation (Decision 11)                                                                                                                                                                                                  |
| Responsive          | ≤1080 stacked (satellite on top, `min-height 52vh`), ≤768 toolbar in a column                                                                                                                                                                                                      | ≤1080 40/60 and ≤640 34/66 with the satellite still left; detail under the timeline ≤1080 (Decision 22)                                                                                                                       |
| Description legend  | both dots filled (green `--ok`, grey `--text-mute`)                                                                                                                                                                                                                                | filled green vs hollow ring (Decision 23)                                                                                                                                                                                     |

## 16. Decisions (to confirm — edit this list before running the prompts; the prompts follow it)

Recommended choice first. Strike the ones you reject and write what you want instead. When a session
applies one, it writes **"Applied in Session N (date): …"** under it with the exact values.

1. **Toolbar → timeline distance.** The prototype has no toolbar padding-bottom and a split margin of
   `clamp(24px, calc(49.4vh - 355px), 240px)`. → _Recommended:_ keep the shared toolbar
   `padding-bottom: clamp(10px, 1.6vw, 20px)` and give the split
   `margin-top: max(0px, clamp(24px, calc(49.4vh - 355px), 240px) - clamp(10px, 1.6vw, 20px))`, so the
   total equals the prototype (same approach as DA Decision 1).

   **Applied in Session 2 (2026-10-25):** `.filters` gets `margin-top: clamp(16px, 2.6vh, 28px)` and `padding-bottom: clamp(10px, 1.6vw, 20px)`. `.split` margin-top deferred to Session 3.

   **Applied in Session 3 (2026-10-25):** `.split { --pr-align: clamp(24px, calc(49.4vh - 355px), 240px); margin-top: max(0px, var(--pr-align) - clamp(10px, 1.6vw, 20px)); }`. The `--pr-align` custom property is also used by `.lcol` margin-top (satellite positioning).

2. **Side padding and gutters.** → _Recommended:_ page outer edges at the codebase
   `clamp(18px, 4vw, 48px)` (DA Decision 12); inner gutters as the prototype: 30 px before the timeline
   in the overview, 34 px before the detail; in the detail view the timeline's **left** edge sits at the
   page padding (the prototype leaves it at 30 px from the window edge). Narrow screens: 12 px (≤1080)
   and 4 px (≤640) before the timeline; the satellite column's right padding 10 px at ≤640.

   **Applied in Session 1 (2026-10-25):** `padding-inline: clamp(18px, 4vw, 48px)` added to `.container` in `processors.module.css`. Inner gutters and narrow-screen breakpoints are Session 2+.

   **Applied in Session 3 (2026-10-25):** Outer edges from `.container padding-inline` only. Inner gutters: `.sheet { padding: 0 0 0 30px }` (overview); `.split.focus .sheet { padding-left: 0 }` (detail: timeline left edge at page padding); `.detailpane { padding: 14px 0 48px 34px }`; ≤1080 `.sheet { padding-left: 12px }`, `.focus .detailpane { padding: 4px 0 48px 0 }`; ≤640 `.sheet { padding-left: 4px }`, `.lcol { padding-right: 10px }`. No `var(--pad)` used anywhere.

3. **Dropdown behaviour.** The prototype's lists here differ from Acquisitions/DA (480 ms, inner
   `6px 0 14px`, head padding 0, chevron rotates 180° in 460 ms, Baseline ignores Escape/outside, two
   lists can be open). → _Recommended:_ the shared dropdown exactly as Acquisitions/DA implement it
   (in flow, 420 ms, caption cyan on hover/open, hairline `.30` fixed, chevron as Acquisitions, one
   open at a time, Escape and a click outside close it). Widths 220 px for both.

   **Applied in Session 2 (2026-10-25):** DA in-flow fdrop pattern ported to `processors.tsx` / `processors.module.css`. Static chevron (`ChevronDown`, 12 × 12, viewBox 0 0 16 16, path `M3 6l5 5 5-5`, no rotation). Body: `grid-template-rows 0fr → 1fr`, 420 ms `cubic-bezier(0.2,0.7,0.2,1)`. Head 48 px, caption 11/600/.2em → cyan on hover/open. `inert` on closed body. `aria-expanded` / `aria-controls` on each head. One `openDrop` state for both dropdowns.

4. **Mission list: showing the choice.** The prototype shows nothing (no value, no highlight — the
   `!important .9` kills it). → _Recommended:_ dim the non-chosen missions with `.off` (`.5`), the same
   rule Baseline uses; no value text beside the caption (the heading and the satellite name the
   mission). Alternative: prototype as is.

   **Applied in Session 2 (2026-10-25):** Mission items: non-chosen get `.fitemOff` (`.5` opacity via `color-mix`). No value beside the caption.

5. **Baseline list.** → _Recommended:_ no underline on the labels (the `<u>` underline is an accident:
   every other page has `.fitem u { text-decoration: none }`); keep the prototype rule that the item
   not chosen is `.off`, also when "All releases" is chosen.

   **Applied in Session 2 (2026-10-25):** `.fitem u { text-decoration: none }` on both lists. Baseline items: non-chosen get `.fitemOff`. Current value (`All` / `Current`) shown as `.fdropVal` beside the label.

6. **Search.** → _Recommended:_ the prototype's free search (§3.4: every word must appear in processor
   name, description, version, year, notes text), applied on every render (the prototype loses it after
   a pick). Non-matching markers and stems at `.12`; nothing else changes. Search text in our feed =
   label, sub, baseline, `processingBaseline`, year of `ms`, `htmlToText(notesHtml)`.

   **Applied in Session 2 (2026-10-25):** `haystacks` useMemo in `ReleaseTimeline` — Map from release id to lowercased haystack joining `g.label`, `g.sub`, `r.baseline`, `r.processingBaseline`, `year(r.ms)` and `htmlToText(r.notesHtml)`. `words = query.trim().split(/\s+/)`. `faint = words.length > 0 && !words.every(w => haystack.includes(w))`. Applied on every render, fixing the prototype bug of losing dimming after a pick.

7. **Range memory.** The prototype remembers 1Y/2Y/All per mission. → _Recommended:_ one range for the
   page (it is a toolbar filter; switching mission keeps it). Alternative: per mission.
8. **One view helper.** Mission change in the prototype leaves a stale detail open (bug). →
   _Recommended:_ every action that changes the view (mission, range, Overview, Escape, same marker,
   steps) goes through one helper, so the pick, the zoom window and the scroll position are always reset
   together: mission → clear pick, keep range and filters; range → clear pick; Baseline and search
   never clear the pick (they only fade markers; a picked release that becomes faded stays open).

   **Applied in Session 2 (2026-10-25):** `changeView` helper in `Processors()`. `toggleRelease`, `stepRelease`, and `onClose` all call `changeView`. No `setSelected` anywhere outside `changeView`.

9. **KPIs.** → _Recommended:_ real `now` (the prototype's fixed 24 Sep 2026 is a demo artefact);
   date = `ms` (operational since, the date the timeline plots); Processors counts every lane
   (including those without releases); Releases counts all; Last year = `(now − 365 d, now]`;
   Latest = year of the latest release ≤ now, `—` if none; `—` for all four while loading. Use the shared
   KPI block; count-up only if Events/Acquisitions/DA have it (keep the block identical).

   **Applied in Session 1 (2026-10-25):** `now = Date.now()`; `yearStart = now − 365 * DAY`; last-year window is `r.ms > yearStart && r.ms <= now`; latest = max `r.ms` where `r.ms <= now`, then `getUTCFullYear()`, `—` if none. `—` for all four while `!ready`. Entrance animation: `<Reveal>` (global translateY 20px / 0.7s) instead of §2's `sbUp` keyframe (same opacity+translateY motion, IntersectionObserver trigger instead of page-load delay).

10. **Satellite column.** → _Recommended:_ follow the prototype: not sticky, no glow layers, no blend
    mode, no float, no placeholder text; `drop-shadow(0 18px 40px rgba(0,0,0,.5))`; box 66 % of the
    column width (92 % under 420 px) × `clamp(220px, calc(57vh - 103px), 640px)`, centred, top ≈ 12 px
    under the toolbar; hidden (opacity 0, .5 s) in the detail view. **Check** that
    `/assets/img/satellites/s*_.png` have transparent backgrounds (the current `mix-blend-mode: screen`
    suggests black ones); if not, use the prototype cut-outs (`s1-cutout.webp` … `s5p-cutout.webp`,
    delivered with this file; ESA artist's impressions, alt text "Artist's impression of Sentinel-N").

    **Applied in Session 3 (2026-10-25):** Transparency check: `s1.webp`, `s2.webp`, `s3.webp`, `s5p.webp` all confirmed "RIFF Web/P image, with alpha" — used these. The `_` PNG variants are 8-bit colormap (likely black backgrounds). No cutout files needed. CSS: `.lcol` (was `.satpane`) not sticky, no glow/art/placeholder; `.orbit { width: 66%; height: var(--pr-sat-h); transition: opacity 0.5s ease; }`; `.split.focus .orbit { opacity: 0; visibility: hidden; transition: opacity 0.5s ease, visibility 0s linear 0.5s; }`; `.sat { filter: drop-shadow(0 18px 40px rgba(0,0,0,0.5)); }`; `@container (max-width: 419px) { .orbit { width: 92%; } }`. In focus at ≥1081 px the `.lcol` is `position: absolute; left:0; top:0; width:50%; pointer-events:none` (stays painted for the fade). At ≤1080 focus: `display: none` (stacked layout). `@keyframes lcolIn` (from opacity:0 translateX(-24px)) applied via `.lcolEnter .orbit { animation: lcolIn 560ms ease both }` on re-entry. `.lcol margin-top: calc(12px + 0.125 * var(--pr-sat-h) - var(--pr-align))` positions the satellite ≈ 12 px under the toolbar.
11. **Mission-change motion (§11).** → _Recommended:_ build it, in its own session (Session 7) after
    everything else works, so it can be dropped if it costs too much: satellites and the timeline sheet
    rotate about the planet centre (1300 + 600·(n−1) ms, ease-in-out cubic), the outgoing sheet fades at
    1.4× its offset; the shared planet/sky turn only if our backdrop component already exposes a turn
    (check how Events/DA turn it). Until then: instant swap. Reduced motion: instant.
12. **Overview ↔ detail motion (§10).** → _Recommended:_ the prototype's: two 50 % areas, FLIP of the
    timeline column 720 ms `cubic-bezier(.2,.7,.2,1)`, detail fade 420 ms + slide from 56 px 640 ms
    after 180 ms, close = detail out first then layout back after 280 ms with the satellite column
    entering from −24 px (560 ms). Replaces the animated `grid-template-columns`.

    **Applied in Session 3 (2026-10-25):** `focusClass` state drives `.split.focus` (grid switch). `detailOn` state drives `.detailpane.on` (opacity 1 / transform none), added 180 ms after open. `lcolEnter` state drives `.lcolEnter .orbit` animation (560 ms), applied on re-entry. FLIP: `useLayoutEffect` on `[focusClass]` — captures rect before `setFocusClass` (inside the orchestration `useEffect` on `[isDetail]`), measures after, applies `translate(dx,dy)` + 720 ms transition. Double `requestAnimationFrame` ensures the start-transform paints before the transition begins. Close sequence: `setDetailOn(false)` → 280 ms → capture rect → `setFocusClass(false)` + `setLcolEnter(true)` → 560 ms → `setLcolEnter(false)`. All timers cleared on cleanup. `prefers-reduced-motion`: JS delays set to 0; CSS adds `transition: none !important` on `.procpane`, `.detailpane`; `animation: none` on `.lcolEnter .orbit`. `lastSelected` ref keeps detail content while pane fades — unchanged from Session 2.
13. **Chart width.** → _Recommended:_ the prototype's `max(600, 100 + 6 px × months)` (All ≈ 1054 px,
    scrolled to the end on load), unless the fixed 600 px was a stakeholder request — say so if it was.
14. **Names column backdrop.** → _Recommended:_ keep ours (the gradient starts under the axis at 42 px,
    so year/month labels scrolled under the names stay readable); colour from `--bg` instead of `#000`.
15. **First-year label** (confirmed 2026-10-25): **follow the prototype** — the year of the first
    month drawn is always labelled (`x >= -1 && x < 95`, printed once, at `max(0, x)`), with **no room
    check**: remove `leadRoom`. This is also what the live SentiBoard does ("2025" at the left edge).
    Accepted consequence: in **All** the window starts in Oct 2013, so "2013" sits 3 months (≈ 18 px
    with Decision 13) before "2014" and the two overlap at the far left of the chart. The chart opens
    scrolled to the end, so this shows only when scrolling all the way left. 1Y, 2Y and the zoom window
    never overlap (the next January is at least 10 % of the track away).
16. **Marker motion.** The resolved prototype keeps only `opacity 240ms` (hover scale/ring snap) and no
    version-label fade. → _Recommended:_ follow the resolved prototype (as we did for DA's killed
    hovers). Alternative: keep `transform .2s` for the hover scale.
17. **Tooltip.** → _Recommended:_ prototype frame, typography, colours (`.go #19E27A`), fade in and out,
    placement (§8, with `skyBot = innerHeight − 12`), hidden on page scroll; **keep our rows**
    (Released + Operational since from the feed, the release's own satellites, Changes from the
    "Changes introduced" section) but put Changes **inline** beside its label as the prototype does,
    clipped as now. Alternative: Changes full-width (current).
18. **Detail meta rows** (confirmed 2026-10-25, from the live SentiBoard page): the three rows of the
    prototype and of the live site, in this order, with the prototype typography (§9):
    - `Processor Baseline ID:` = our `processingBaseline` (e.g. `S1_SETAP:3.0`; the prototype's
      `<Month YYYY> Release` was placeholder text); `—` when the feed has none;
    - `Operational since:` = `ms` as `24 June 2025` (`longDate`, never the raw `Date.toString()` the
      live site prints);
    - `Impacted satellite(s):` = the release's satellites joined with `, ` (`S1A, S1C`).
      The `Released:` row is removed from the detail (it stays in the hover card, Decision 17).
      Check while doing it: the feed's dates are local midnight (`… 00:00:00 GMT+0200`), and the page
      formats in UTC (`toISOString`, `timeZone: "UTC"`) — make sure a release on 24 June still shows
      24 June (not 23) in the detail, the tooltip and on the axis.
19. **Mission colour.** In the prototype it appears only on release-note `code` and on focus outlines.
    → _Recommended:_ `code` in the mission colour (S1 `#FF8F5E`, S2 `#4ADE80`, S3 `#6FA8FF`, S5P
    `#A78BFA`) — reuse mission colour tokens if the codebase has them, else skip; focus outlines stay the
    shared accent.
20. **Text shadow** on the timeline and detail text. → _Recommended:_ do what DA did for its row-label
    shadow (check `availability.module.css`): if DA kept it in dark only, same here; light theme: none.

    **Applied in Session 3 (2026-10-25):** DA applies text-shadow as a bare rule (no dark guard). Here applied dark-only via `:root:not([data-theme="light"]) .procpane, :root:not([data-theme="light"]) .detailpane { text-shadow: 0 0 2px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.85), 0 1px 14px rgba(0,0,0,.7); }`. Existing `.rn h4 { text-shadow: none }` suppresses it on the notes heading. Noticed: DA applies the same dark text-shadow in light mode.
21. **Prototype leftovers of the page's own planet.** The horizon mask (content fades out 56 px above a
    fixed line at ~83 % of the viewport), the `--below` padding and the scene-height adjustment. →
    _Recommended:_ not built; bottom spacing via `--sb-earth-h` as every page.

    **Applied in Session 1 (2026-10-25):** `.headArt + .container` now has `padding-bottom: calc(var(--sb-earth-h, 190px) + 32px)` (consolidated from the separate `.container` rule at file bottom). The duplicate bare `padding-bottom: 48px` on `.container` removed.

22. **Responsive.** → _Recommended:_ the prototype's: satellite stays on the left (40/60 ≤1080, 34/66
    ≤640), detail under the timeline ≤1080; the toolbar wraps like Acquisitions/DA (match their narrow
    rules).

    **Applied in Session 3 (2026-10-25):** ≤1080: `.split { grid-template-columns: 40% 60% }`, `.sheet { padding-left: 12px }`. Focus at ≤1080: `grid-template-columns: 100%; grid-template-areas: "proc" "detail"`, `.split.focus .lcol { display: none }`, `.split.focus .sheet { padding-left: 0 }`, `.split.focus .detailpane { padding: 4px 0 48px 0 }`. ≤640: `grid-template-columns: 34% 66%`, `.lcol { padding-right: 10px }`, `.sheet { padding-left: 4px }`. Toolbar wraps centred by default (no extra rules needed).
23. **Description.** → _Recommended:_ the §14 copy verbatim (stakeholders' text, as DA Decision 10),
    with the legend markers drawn like the timeline: Current baseline = filled `#3FCF7F` with glow,
    Superseded = hollow 1.5 px ring `#7D8792`; dot size the shared 8×8 (as DA). Open point for the
    stakeholders: the copy promises wheel zoom, drag and a detail "in the lower part of the screen".

    **Applied in Session 1 (2026-10-25):** Copy verbatim in `DESCRIPTION` constant. Legend uses `.dot-bl-current` (filled `var(--bl-current)` + glow via `color-mix`) and `.dot-bl-superseded` (hollow, `inset 0 0 0 1.5px var(--bl-past)`), both added to `src/styles/page-header.css`. Token colours differ from prototype hex (`--bl-current` = `#00e676` dark / `#0b754e` light; `--bl-past` = `#8b95a6` dark / `#636d79` light vs prototype `#3FCF7F` / `#7D8792`). Paragraph spacing 20 px via `.desc-in p { margin: 0 0 20px }` (prototype §14 says 22 px — accepted 2 px deviation, no inline styles).

24. **Escape.** → _Recommended:_ as Acquisitions: Escape closes the open dropdown, else the detail.

    **Applied in Session 2 (2026-10-25):** Single `keydown` useEffect, deps `[openDrop, isDetail]`. Escape: if `openDrop !== null` → `setOpenDrop(null)` and refocus the head button; else if `isDetail` → `changeView({ sel: null })`. Search input intercepts Escape via `stopPropagation` and only clears `query`.

25. **Backdrop window.** Check the `page` index Events and DA pass to `SpaceBackdrop`; Processors is the
    third window (prototype `PAGE = 2`), currently `1`. → _Recommended:_ fix it to the third window.

    **Applied in Session 1 (2026-10-25):** `<SpaceBackdrop page={2} …>` in `processors.tsx`. Noticed: Events currently passes `page={1}` but should be `page={0}` (DA is `page={1}`); not fixed here (out of scope).

26. **Loading / error / empty states.** Not in the prototype. → _Recommended:_ keep ours, restyled in
    the caption register (11px/600/.2em, Noto Sans — the "Try again" button is still in the mono font).
    Seen 2026-10-25: the page shows "Backend unreachable" because `useProcessors()` fetches from a
    backend that is not running, while the other pages read local mock data. Session 0 gives the page a
    local mock source first (Decision 29), so the error state only appears when it is really wanted.

    **Applied in Session 1 (2026-10-25):** `.status`, `.statusTitle`, `.retry` in `processors.module.css` — `font-family` → `var(--font-sans)`, `font-weight` → `600`. The retry border is kept. Decision text said "Try again button is still in mono font" — applied as written: corrected as a defect, not deviation. Font-size and letter-spacing unchanged (already correct).

27. **Data source** (added 2026-10-25). → _Recommended:_ the mock-ups read processors from **local
    mock data by default**, as the other pages do, so the page works with no backend (locally and on the
    server where the designers review it). The API path stays available behind one switch (an env
    variable, or whatever switch the other pages already use). The mock has the feed's exact shape
    (`ProcessorGroup` / `ReleaseRecord`) and covers every state in §4.

    **Applied in Session 0 (2026-10-25):**
    - `src/api/client.ts`: `USE_MOCKS` default flipped from `=== "true"` to `!== "false"` — mock is now
      on unless `VITE_USE_MOCKS=false` is set explicitly in `.env.local` or baked into the build.
    - `src/data/processor-releases.ts`: `RawRelease` gained optional `release_date` and
      `processing_baseline` fields (both exist in the API schema); `build()` carries them through to
      `releasedMs` and `processingBaseline` on each `ReleaseRecord`. Three entries gained `release_date`
      and two gained `processing_baseline` (details in the table below).
    - `.env.example`: comment updated — copying the file to `.env.local` switches to the real API
      (because it sets `VITE_USE_MOCKS=false`); leaving the var unset means mock data.
    - `src/api/processors.ts` and `processors.tsx`: unchanged.

    **§4 state → mock entry (derived from ROSTER + RELEASES, 2026-10-25):**

    | §4 state                      | Processor · baseline · date                                                                                                                                                                                                                                                                                                                                                                               |
    | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | Current baseline              | Every processor's last release, e.g. S1_L1L2 003.71 (2026-06-16), S3_OL2 OL_07.02 (2026-06-02), S5P_L1B 02.06 (2025-02-25)                                                                                                                                                                                                                                                                                |
    | Superseded                    | All non-last releases, e.g. S1_L1L2 003.40 (2022-09-06), 003.52 (2023-03-14), 003.61 (2024-06-11); S3_OL2 OL_06.10 (2023-05-16)                                                                                                                                                                                                                                                                           |
    | Empty lane (0 releases)       | S3_SR2 — ROSTER entry, no RELEASES match                                                                                                                                                                                                                                                                                                                                                                  |
    | Several releases on same date | S3_OL1 OL_06.10 + S3_OL2 OL_06.10 + S3_L0 03.00: 2023-05-16; S3_OL1 OL_07.01 + S3_OL2 OL_07.01 + S3_OL1_RAC 07.01: 2024-09-24; S3_SL1 SL_07.00 + S3_SL2 07.00 + S3_SL2_LST SL_07.00 + S3_SL2_FRP 07.00: 2025-11-04; S3_SM2 + S3_SM2_LI + S3_SM2_SI 06.10: 2023-03-19; S3_SY2 + S3_SY2_AOD + S3_SY2_VGS + S3_SY2_VGP 06.20: 2023-06-05; S5P_L1B 02.06 + S5P_L2_NO2 02.06 + S5P_L2O3_OFFL 02.06: 2025-02-25 |
    | > 12 lanes → 22 px rows       | S3: 20 ROSTER entries                                                                                                                                                                                                                                                                                                                                                                                     |
    | ≤ 8 lanes → 44 px rows        | S1: 3 ROSTER entries                                                                                                                                                                                                                                                                                                                                                                                      |
    | Release in last 365 days      | S3_OL2 OL_07.02 (2026-06-02), S1_L1L2 003.71 (2026-06-16), S2_L0/L1/L2 06.05 (2026-02-04), S3_SR1 SR_07.00 (2026-01-21)                                                                                                                                                                                                                                                                                   |
    | No future releases            | Latest is S1_L1L2 003.71 on 2026-06-16                                                                                                                                                                                                                                                                                                                                                                    |
    | Notes with `<ul><li>` items   | S1_L1L2 003.71; S2_L2 06.05                                                                                                                                                                                                                                                                                                                                                                               |
    | Empty notes                   | S1_SETAP 001.04; S2_L0 06.03; S3_L0 03.00; S3_OL1 OL_06.10; S3_OL2 OL_06.10; S3_SL1 SL_06.08; S3_SL2_LST SL_06.08; S3_SR1 SR_06.20; S3_SM2/SM2_LI/SM2_SI 06.10; S3_SY2/SY2_AOD/SY2_VGS/SY2_VGP 06.20; S5P_L1B 02.01; S5P_L2_NO2 02.04; S5P_L2O3_OFFL 02.04                                                                                                                                                |
    | `releasedMs` absent           | All entries without `release_date` (default)                                                                                                                                                                                                                                                                                                                                                              |
    | `releasedMs` present          | S1_L1L2 003.71 (`release_date: "2026-06-18"`); S3_OL2 OL_07.02 (`release_date: "2026-06-09"`); S5P_L1B 02.06 (`release_date: "2025-03-01"`)                                                                                                                                                                                                                                                               |
    | `processingBaseline` absent   | All entries without `processing_baseline` (default)                                                                                                                                                                                                                                                                                                                                                       |
    | `processingBaseline` present  | S1_SETAP 001.06 (`"S1_SETAP:001.06"`); S5P_L1B 02.06 (`"S5P_L1B:02.06"`)                                                                                                                                                                                                                                                                                                                                  |

28. **Theme.** → _Recommended:_ values above are the dark theme; implement with the module's tokens
    (`--text`, `--text-dim`, `--text-mute`, `--line`, `--line-strong`, `--accent`, `--bl-current`,
    `--bl-past`, `--bg`) and `color-mix` of `--text` for the white alphas, as the module does now; check
    that `--bl-current` = `#3FCF7F` and `--bl-past` = `#7D8792` in dark.

    **Applied in Session 1 (2026-10-25):** … (leave as it is)

    **Confirmed 2026-10-25 — option (b), the prototype's greens and greys on this page only.** Two NEW
    tokens in `src/styles/tokens.css` (do not change `--ok`, `--bl-current` or `--bl-past`: the
    version matrix uses them):
    - `--pr-current`: dark `#3FCF7F`, light `#1F9D5C`
    - `--pr-past`: dark `#7D8792`, light `#7D8792`
    - `--pr-current-text` (tooltip "Current" and version text): dark `#19E27A`, light `#167A46`

    Use them for: the module aliases `--tl-inforce: var(--pr-current)` and `--tl-past: var(--pr-past)`
    (markers, ring, glow, version labels), the tooltip's `.go` text (`--pr-current-text`) and `.old`
    text (`--text-dim`), the detail's "Current baseline" tag (`--pr-current`), and the Description
    legend classes `.dot-bl-current` / `.dot-bl-superseded` in `page-header.css`. Glows use
    `color-mix(in srgb, var(--pr-current) 45%, transparent)` (55% on the picked marker). Light values
    were chosen for contrast on the light background: markers and rings ≥ 3:1, tooltip text ≥ 4.5:1.
    Every other colour follows the recommendation above.
