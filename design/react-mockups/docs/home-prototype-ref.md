# Home page — prototype reference (extracted from SentiBoard.html, src-home)

Extracted 2026-10-26 from the bundled prototype `SentiBoard.html` (the page is base64-encoded inside it
as `<script type="text/plain" id="src-home">`, the page reached from the SentiBoard logo; our route
`/index`). These are the exact values to reproduce. Do not decode the bundle again; use this file.

How this page differs from the other four (read this first):

- `src-home` is **not** a hand-written prototype page like Events/Acquisitions/DA/Processors. It is a
  **browser-saved snapshot of an older build of this React app**: the DOM serialised with React's
  inline styles, plus a dump of the app's whole stylesheet (all CSS modules of the other pages under
  hashed names, `examples.css`, `global.css`, an older `tokens.css`). On top of that the prototype adds
  only two small late sheets (§1.3) and one behaviour script (§3.1). There is **no `#sb-unified` block
  and no `html body …` rule** on this page.
- Consequences, all verified by rendering the page in Chromium at 1440×900 and reading computed styles
  (`:hover` forced through DevTools on every interactive element):
  - Several custom properties the inline styles use are **undefined** in the snapshot's dark theme:
    `--ground`, `--mono`, `--muted`, `--line-soft`. A declaration with an undefined variable falls back
    to `unset`, so: `background: var(--ground)` → transparent; `font-family: var(--mono)` → the
    inherited body font; `color: var(--muted)` → the inherited colour (white); `border: 1px solid
var(--line-soft)` → **no border**. The values below are what actually renders.
  - The snapshot's fonts (`Plus Jakarta Sans`, `Space Grotesk`, `JetBrains Mono` from `/fonts/…`) are
    not in the bundle, so the prototype renders in fallback fonts. `<button>` text does not inherit the
    font in Chromium, so the FAQ titles render in **Arial**. Font **sizes, weights and spacings** below
    are binding; font **families** follow the codebase (Decision 2).
  - React is not running: **the FAQ never opens** in the prototype (§7).
- Tokens of the snapshot (dark): `--bg #000000` (body), `--text #FFFFFF`, `--text-dim #CCCCCC`,
  `--accent / --accent-cyan #00E5FF`, `--ease cubic-bezier(.22, 1, .36, 1)`, `--nav-h 68px`,
  `--wrap 1320px`. Every white alpha below (`rgba(255,255,255,X)`) is relative to `#FFFFFF`.
- Scope: everything between the nav and the footer — the fixed News bar (+ its list), the video hero,
  the four module panels, the FAQ. Nav and footer are out of scope.

Things the final prototype **hides or never builds** (do not build them):

- **No star sky, no `SpaceBackdrop`, no shared planet, no PageHeader hero, no Description panel, no
  KPIs, no toolbar.** The page is plain black (`body` `#000`). → SpaceBackdrop window: **none**
  (Decision 18). The shell does place Home at slot 0, left of Acquisitions (`ORDER = { home: 0,
acquisitions: 1, events: 2, 'data-availability': 3, processors: 4 }`), but Home owns no sky to slide.
- **No video source**: the `<video>` holds only the comment `<!-- home.mp4 goes here -->` and has no
  `muted` attribute, so the hero is black in the prototype (Decision 8).
- **No eyebrow on the module panels.** The current code renders an empty `<span>` (display block,
  `margin-bottom: 14px`) above each title; the prototype markup has nothing there (Decision 10).
- **No FAQ answers and no open state.** The six bars are buttons with no handler; clicking does nothing.
  The answers, the open edge and the reveal animation in our code have no prototype counterpart
  (Decisions 12–14).
- **No hover effect anywhere on the page body**: News button, ticker, FAQ bars, FAQ buttons, the
  contact link, "Open module →", panel titles — forced `:hover` changes nothing (Decision 11).
- **No reduced-motion rule for the ticker** (its animation is an inline style, so the
  `.ticker-track` media rule never applies) — add one (Decision 7).
- No Escape, no click-outside close and no `aria-controls` on the News list (Decision 6).
- Unused CSS present in the snapshot (do not port): `.vhero*`, `.nt-row/.nt-lab/.nt-news-*/.nt-live-*`
  (the two-row ticker), `.ticker-track/.ticker-item`, `.pagecards/.pagecard`, `.ed-*`, `.spot-*`,
  `.tl-*` timeline proposal, `details.faq`, `.faq-group/.faq`, `.hero-grid/.hpanel/.feed-item`,
  `.px-intro/.px-cue*`, `.px-num/.px-panel-meta/.px-metric` and every `:root[data-theme="light"]` rule.
- The `button[style*="rgb(61, 220, 132)"]` and `section#faq … !important` overrides that our
  `examples.css` carries **are not in the prototype** (they were added to the codebase later; see
  Decisions 4 and 16).

---

## 1. Page layout (top to bottom)

| Block                    | Value (1440×900)                                                                                                                                                                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nav (out of scope)       | sticky, `height: 68px` (`--nav-h`)                                                                                                                                                                                                                                                 |
| News bar                 | `position: fixed; top: 56px; left: 0; right: 0; z-index: 45` — **overlaps the nav's bottom 12 px** (the nav is z-index 100 and translucent, so those 12 px sit under the blurred nav). Visible strip: y = 68 → 124, i.e. **56 px** including its 1 px bottom hairline (Decision 3) |
| Hero `<section>`         | in flow right under the nav (y = 68), `min-height: 100vh`, `padding-top: calc(124px)` (= 56 + 68)                                                                                                                                                                                  |
| Module panels            | wrapper `position: relative; z-index: 1`; four sticky panels, `100vh` each → wrapper 3600 px                                                                                                                                                                                       |
| FAQ `<section id="faq">` | `position: relative; z-index: 10; padding: 120px 0 130px`; background transparent → body `#000`                                                                                                                                                                                    |
| Footer (out of scope)    | starts right after the FAQ's 130 px                                                                                                                                                                                                                                                |

No card or box anywhere except the FAQ bars. Page height at 1440×900: 5756 px.

### 1.1 Spacing rules the shared choices touch

- **Side padding.** The prototype uses fixed values: panel copy 56 px from the outer edge / 28 px from
  the inner edge, FAQ column `padding: 0 56px` inside `max-width: 920px`, hero copy `padding: 0 28px`
  inside `max-width: 600px`. None of them has a narrow-screen rule (Decisions 9, 15).
- **Bottom spacing.** No planet on this page: the FAQ's own `padding-bottom: 130px` is the space before
  the footer. `--sb-earth-h` does not apply (Decision 17).
- **Hero z-index rule** (`.page > * { position: relative; z-index: 1 }`) does not apply: there is no
  PageHeader. Stacking is: panels wrapper 1, FAQ 10, News bar 45 (fixed), nav 100.

### 1.2 Fonts actually rendered

| Element                                                   | Declared                               | Renders as                          |
| --------------------------------------------------------- | -------------------------------------- | ----------------------------------- |
| Body, ticker titles, list text, hero `p`, panel `p`       | `var(--font-sans)`                     | sans fallback                       |
| Hero `h1`, panel `h2`, FAQ `h2`                           | `var(--font-display)` (global `h1–h4`) | display fallback                    |
| News label/count, ticker time, list time, "Open module →" | `var(--mono)` — **undefined**          | inherited body sans (not monospace) |
| FAQ titles (inside `<button>`)                            | none (no `font: inherit` reset)        | Arial                               |

→ Decision 2.

### 1.3 The prototype's two late sheets (they win over the inline styles)

```css
/* sb: news bar on black — the News bar and its list stay fixed under the menu: an opaque black ground */
main > div[style*="position: fixed"],
main > div[style*="position: fixed"] > div,
main > div[style*="position: fixed"] button {
  background: #000 !important;
}
main > div[style*="position: fixed"] [role="region"] {
  background: #000 !important;
}

/* the shell draws one fixed scrollbar for every page (out of scope) */
html {
  scrollbar-width: none;
}
html::-webkit-scrollbar,
body::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}
```

So the bar, its row, the News button **and the News list** (a `div` child of the bar, §3.1) are opaque
`#000`. The page never shows through.

## 2. News bar — closed state

Markup (one row; the list of §3 is appended under it):

```html
<div class="bar">
  <!-- fixed, flex column -->
  <div class="row">
    <!-- height 68px, border-bottom, overflow hidden -->
    <button class="news">
      <!-- aria-expanded (set by the script) -->
      <i></i>News<span>5</span><svg>…chevron…</svg>
    </button>
    <div class="mask"><div class="track">item × 2N</div></div>
  </div>
</div>
```

```css
.bar {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  z-index: 45;
  display: flex;
  flex-direction: column;
  background: #000;
}
.row {
  height: 68px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  background: #000;
}
/* border-box: the 68 px include the hairline → button and mask are 67 px tall */

.news {
  flex: none;
  display: flex;
  align-items: center;
  gap: 11px;
  height: 100%;
  padding: 0 24px;
  position: relative;
  z-index: 2;
  background: #000;
  border: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0.18em /* 2.16px */;
  text-transform: uppercase;
  color: #3ddc84;
  cursor: pointer;
} /* hover: no change */
.news i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3ddc84;
  box-shadow: 0 0 11px #3ddc84;
}
.news span {
  font-size: 11px;
  color: #3ddc84;
} /* letter-spacing 2.16px inherited (px, not em) */
.news svg {
  width: 9px;
  height: 9px;
  color: #3ddc84;
  transition: transform 420ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
/* <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 9l7 7 7-7"/></svg>
                rotate(180deg) while the list is open */
```

Button width at 1440: 152 px. Text: `News` (shown `NEWS`), then the number of news items (`5`).
Colour → Decision 4.

### 2.1 Ticker

```css
.mask {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  overflow: hidden;
  position: relative;
}
.track {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  width: max-content;
  white-space: nowrap;
  animation: slide 68s linear infinite;
} /* slide: translateX(0) → translateX(-50%) */
.item {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  padding: 0 4px;
  font-size: 16px;
  font-weight: 400;
  color: #ffffff;
  opacity: 0.92;
} /* opacity covers the separator too */
.sep {
  width: 2px;
  height: 16px;
  background: #29c3d6;
  flex-shrink: 0;
  margin: 0 6px;
}
.time {
  flex: 0 0 auto;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #ffffff;
} /* var(--muted) undefined → white */
```

- Item = `<span>title</span><span class="sep"/><time>DD Mon YYYY HH:MM</time>` (e.g. `20 Jul 2026 08:55`).
- The list is rendered **twice** (2N items) so `-50%` loops seamlessly. Between two items there is
  only the 2 × 4 px padding (time → next title 8 px); title → separator → time is 12 + 6 / 6 + 12 px.
- The track starts at the button's right edge; no fade mask at either end. No pause on hover.
- Speed: 5 items, track 5878 px doubled → 2939 px per 68 s ≈ **43 px/s** (Decision 7).
- Prototype items (title · time), in this order:
  1. `Copernicus Sentinel-1A/C, Sentinel-2A/B/C and Sentinel-5P operation impacts` · `20 Jul 2026 08:55`
  2. `Sentinel-1C orbital reconfiguration dates` · `13 Jul 2026 12:56`
  3. `Sentinel-5p planned maintenance activities starting on 17/06/2026` · `12 Jul 2026 11:22`
  4. `Copernicus Sentinel-5P: INU Station WAN Outage` · `11 Jul 2026 10:05`
  5. `Copernicus Sentinel-2B/2C operation impacts` · `08 Jul 2026 08:41`

## 3. News list (opened from the News button)

Built by the prototype's script (§3.1) from the ticker: **every distinct ticker item, in ticker order**,
showing the **title** (not a longer text) and its time.

```css
.list {
  height: 0;
  overflow: hidden;
  opacity: 0;
  background: #000; /* #000 from the late sheet */
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  transition:
    height 520ms cubic-bezier(0.2, 0.7, 0.2, 1),
    opacity 360ms ease;
}
.list > div {
  display: flex;
  align-items: baseline;
  gap: 18px;
  padding: 14px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
} /* every row, the first included */
.list time {
  flex: 0 0 auto;
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #ffffff;
} /* = ticker time */
.list span {
  font-size: 15px;
  color: #ffffff;
  opacity: 0.92;
}
/* row height 52.25 px; 5 rows → 261 px */

@keyframes sbNewsIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.list.open > div {
  animation: sbNewsIn 420ms cubic-bezier(0.2, 0.7, 0.2, 1) backwards;
}
.list.open > div:nth-child(k + 1) {
  animation-delay: (80 + k × 60) ms;
} /* k = 0…7 → 80, 140, 200 … 500 ms */
@media (prefers-reduced-motion: reduce) {
  .list,
  .list > div {
    transition: none !important;
    animation: none !important;
  }
}
```

The list sits **inside the fixed bar**, under the row: it overlays the page (fixed), it does not push
anything down.

### 3.1 Behaviour (prototype script, verbatim logic)

```js
max = window.innerHeight - 140                         // measured on each open
open:   list.classList.add('open');
        h = min(list.scrollHeight, max);
        list.style.overflowY = list.scrollHeight > max ? 'auto' : 'hidden';  // scrolls inside when too tall
        list.style.height = h + 'px'; list.style.opacity = '1';
close:  list.style.height = list.offsetHeight + 'px';
        next frame: height 0, opacity 0;
        after 540 ms (if still closed): remove 'open' (so the rows re-stagger on the next open), overflowY hidden
both:   button aria-expanded = 'true' | 'false'; chevron rotate(180deg) | rotate(0deg)
```

Not in the prototype: Escape, click-outside close, `aria-controls`, close on scroll (it stays open while
the page scrolls under it) — Decision 6.

## 4. Hero

```html
<section class="hero">
  <video autoplay loop playsinline>…</video>
  <!-- no source, no muted in the prototype -->
  <div class="overlay">
    <div class="copy">
      <h1>Copernicus <span>Sentinel</span> Operations Dashboard</h1>
      <p>
        Real-time mission monitoring — a central point of access for events
        impacting data availability, real-time data collection insights, and key
        stats on products delivered.
      </p>
    </div>
  </div>
</section>
```

```css
.hero {
  position: relative;
  z-index: 1;
  min-height: 100vh;
  padding-top: calc(124px);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  background: #000;
}
.hero video {
  width: 100%;
  height: 100%;
  object-fit: cover;
} /* IN FLOW: height:100% of a min-height box resolves to auto */
.overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.copy {
  max-width: 600px;
  padding: 0 28px;
}
.hero h1 {
  font-size: 56px;
  font-weight: 700;
  margin: 0 0 16px;
  color: #ffffff;
  letter-spacing: -0.02em;
  line-height: 1.1;
} /* 61.6 px lines */
.hero h1 span {
  color: #29c3d6;
}
.hero p {
  font-size: 16px;
  margin: 0;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.6;
}
```

- The overlay covers the whole section (padding included), so the copy is centred in the full
  `100vh` box: at 1440×900 the h1 starts at y = 379, the paragraph ends at y = 657. h1 wraps on three
  lines (`Copernicus Sentinel` / `Operations` / `Dashboard`); no responsive size (still 56 px at 390 px).
- With the video **in flow**, a real 16:9 file at 1440 px is 810 px tall: the section grows to
  124 + 810 = 934 px and a **68 px black band** shows between the News bar and the top of the video
  (the 124 px padding minus the 56 px bar). The prototype hides this only because it has no video →
  Decision 8.
- No animation on the hero. No hover.

## 5. Module panels ("stacked cards")

Four sections, alternating sides. Each is sticky at the top, so every next panel slides up **over** the
previous one (DOM order paints the later one on top).

```css
.panels {
  position: relative;
  z-index: 1;
}
.px-panel {
  position: sticky;
  top: 0;
  height: 100vh /* 100dvh where supported */;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
}
/* justify-content: flex-start (panels 1, 3) | flex-end (panels 2, 4) */
.px-panel-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transform: scale(1.08);
  animation: px-kenburns 18s var(--ease) infinite alternate;
  will-change: transform;
} /* → scale(1) */
.px-panel-veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    rgba(3, 5, 10, 0.45),
    rgba(3, 5, 10, 0) 28%,
    rgba(3, 5, 10, 0.35) 58%,
    rgba(3, 5, 10, 0.9)
  );
}
.px-panel-inner {
  position: relative;
  z-index: 2;
  color: #ffffff;
  padding-bottom: clamp(56px, 11vh, 130px) /* 99px at 900 */;
  max-width: 640px;
}
/* left panels:  text-align left;  margin: 0 auto 0 0; padding-left 56px; padding-right 28px
                 right panels: text-align right; margin: 0 0 0 auto; padding-left 28px; padding-right 56px */
@media (prefers-reduced-motion: reduce) {
  .px-panel-bg {
    animation: none;
    transform: none;
  }
}
```

These `.px-panel*` rules are **identical** to our `global.css` (lines 1296–1415 of the attached copy).

Copy block (no eyebrow, nothing above the title):

```css
.panel h2 {
  margin: 0 0 15px;
  font-size: clamp(30px, 3.6vw, 46px);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.08;
  color: #ffffff;
  white-space: nowrap;
} /* 46px from 1278px up */
.panel .lead {
  margin: 0 0 16px;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.92);
}
.panel .long {
  margin: 0 0 30px;
  font-size: 13px;
  line-height: 1.72;
  color: rgba(255, 255, 255, 0.74);
}
.panel .long b {
  font-weight: 600;
  color: #e2e8f0;
} /* global `p b` */
.panel a {
  display: inline-block;
  font-size: clamp(19px, 1.7vw, 26px) /* 24.48px at 1440 */;
  letter-spacing: -0.01em;
  color: #ffffff;
  text-decoration: none;
} /* "Open module →"; hover: none */
```

At 1440×900 the left copy is 556 px wide, its title top at 539 px from the panel top; "Open module →"
ends 99 px above the panel bottom.

Entrance (`.reveal`, IntersectionObserver `threshold: 0.12`, once):

```css
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition:
    opacity 0.7s var(--ease),
    transform 0.7s var(--ease);
}
.reveal.in {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .reveal {
    opacity: 1;
    transform: none;
  }
}
```

Panels, verbatim (title · lead · long text · link target). Background images are the four JPEGs in the
bundle, all `background-position: center center`:

| #   | Title                 | Lead                                                                                      | Image (size · sha256)                                                                                            | Link              |
| --- | --------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | `Acquisitions Status` | `Past, current and planned Sentinel acquisitions on an interactive 3D globe.`             | Earth at night, city lights · 1400×932 · `3cce5f071b1f8af7b2f05e5e15978df9bcd43719a16c962ed74c19554d893d44`      | Acquisitions      |
| 2   | `Events`              | `Calibration activities, manoeuvres and anomalies that could impede data production.`     | Svalbard Satellite Station, snow · 1920×904 · `466fdddf72a47ec853f8ee1df9955788b8b8da03bf20043d22728722158378bf` | Events            |
| 3   | `Data Availability`   | `Real-time list of available collections delivered by the missions, with key metrics.`    | Earth limb with a station module · 1400×932 · `703527aa5227b9c7194ae746e23da74df703279a444d913e65140853f1875306` | Data Availability |
| 4   | `Processors`          | `The complete list of Copernicus Sentinel processor releases on an interactive timeline.` | Server racks · 1400×786 · `be23cfe3e43f44e8a8e09d744fd76a0ae879c405062b432e433e6db9cd49d382`                     | Processors        |

(Image 1 is the same file the codebase uses as `/assets/img/modules/acquisitions.jpg` in `.about-bg`.)

Long texts:

1. `The <b>Acquisitions Status</b> view displays the past, current and future Copernicus Sentinels' acquisition on an interactive, 3D globe. Through this view, users can either inspect the status of a past acquisition, or learn about the planned acquisitions for the mission of interest. By default, the real-time sensing scenario is displayed.`
2. `The <b>Events</b> page provides details of the events over the past three months that could impede data production, such as planned calibration activities, manoeuvres, or anomalies. Information on the extent to which these events affect data production and the data products impacted is provided.`
3. `The <b>Data Availability</b> section of the dashboard hosts a real-time list of available collections delivered by the missions, enabling users to scan through these products to find data that meet their research and development requirements, to verify whether specific data of interest is available, check its current status and review key availability metrics such as availability percentage.`
4. `The <b>Processors</b> tab shows the complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged to the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a coloured box, the details relevant to the selected processor release is displayed in the lower part of the screen.`

(Text 4 is the Processors Description copy; it promises wheel zoom and drag that the Processors page
does not have — same open point as Processors Decision 23.)

## 6. Narrow screens (prototype, 390×844)

Nothing adapts (every value is inline): the News bar keeps 152 px for the button and the ticker runs in
the remaining 238 px; the h1 stays 56 px (four lines); panel copy keeps 56 / 28 px padding (306 px of
text); the FAQ keeps `padding: 0 56px` (278 px bars). No horizontal overflow. → Decisions 9, 15, 22.

## 7. FAQ

```html
<section id="faq">
  <div class="in">
    <div class="head">
      <span>05 — Support</span>
      <h2>FAQs</h2>
      <p>Find answers to the most common questions about the dashboard.</p>
    </div>
    <div class="list">
      <div class="item">
        <button>
          <span class="ico"><svg 17×17 /></span
          ><span class="title">General Information</span><svg chevron />
        </button>
      </div>
      … × 6
      <p class="contact">
        For any inquiries on the Copernicus Sentinel Operations Dashboard
        contact
        <a href="mailto:sentiboard@coordination-service.eu"
          >sentiboard@coordination-service.eu</a
        >
      </p>
    </div>
  </div>
</section>
```

```css
#faq {
  position: relative;
  z-index: 10;
  padding: 120px 0 130px;
  background: transparent;
} /* var(--ground) undefined → body #000 */
.in {
  max-width: 920px;
  margin: 0 auto;
  padding: 0 56px;
} /* 808 px column at 1440 */
.head {
  text-align: center;
  margin-bottom: 44px;
}
.head span {
  display: block;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #00e5ff;
  margin-bottom: 16px;
} /* "05 — SUPPORT" */
.head h2 {
  margin: 0 0 12px;
  font-size: clamp(30px, 3.6vw, 46px);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.08;
  color: #ffffff;
}
.head p {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.82);
}

.item {
  margin-bottom: 12px;
  overflow: hidden;
  border-radius: 0;
  background: rgba(10, 18, 24, 0.7); /* = #070D11 on black */
  border: none; /* var(--line-soft) undefined → no border */
  transition: border-color 0.2s;
}
.item button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 16px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  color: #ffffff;
  transition: 0.2s;
} /* 49 px tall; hover: none */
.ico {
  flex: 0 0 auto;
  width: 19px;
  display: grid;
  place-items: center;
} /* svg 17×17, stroke 1.7, round caps/joins */
.title {
  flex: 1 1 0%;
  text-align: left;
  color: #ffffff;
}
.item button > svg {
  width: 14px;
  height: 14px;
  transition: transform 0.2s;
} /* stroke 2.4, path "M6 9l6 6 6-6", rotate 0 */
.contact {
  margin: 40px 0 16px;
  text-align: center;
  font-size: 13px;
  line-height: 1.7;
  color: #ffffff;
} /* var(--muted) undefined → white */
.contact a {
  color: #00e5ff;
  text-decoration: none;
} /* hover: none */
```

- Rendered weight: 600 declared, but the fallback font (Arial) has no semibold, so the titles look
  **bold** (700). Our current 700 reproduces what the designers saw (Decision 12).
- Group titles and icons: identical to `FAQ_GROUPS` in `Home.tsx` (same six titles, same SVG paths).
- Clicking a bar does **nothing** (no handler in the snapshot; the section height stays 843 px). There
  is no prototype for answers, the open state or its motion.

## 8. Motion summary

| What           | Prototype                                                                                                                                                   | Reduced motion (prototype)        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Ticker         | `slide` 68 s linear infinite, −50 %                                                                                                                         | **still runs** (inline animation) |
| News chevron   | 420 ms `cubic-bezier(.2,.7,.2,1)`, 0 ↔ 180°                                                                                                                 | still animates (no rule)          |
| News list      | height 520 ms `cubic-bezier(.2,.7,.2,1)` + opacity 360 ms ease; rows `sbNewsIn` 420 ms, delays 80 + 60k ms; close: height → 0, `.open` removed after 540 ms | no transition, no row animation   |
| Panel entrance | `.reveal` opacity + translateY(20px), 700 ms `var(--ease)`, IO 0.12, once                                                                                   | shown at once                     |
| Ken Burns      | scale 1.08 → 1, 18 s `var(--ease)`, infinite alternate                                                                                                      | none, `transform: none`           |
| Hero video     | autoplay, loop (no source)                                                                                                                                  | —                                 |
| FAQ            | chevron `transition: transform .2s` (never triggered)                                                                                                       | —                                 |

## 9. Keyboard and accessibility (prototype)

News button: `aria-expanded` only; FAQ buttons: nothing (`aria-expanded` absent, inert). No Escape
handling. No `:focus-visible` style on the News button or the FAQ buttons.

---

## 10. Current code vs. reference (as of 2026-10-26)

Files: `src/pages/home/Home.tsx` (no CSS module), `src/styles/examples.css` (`faq-*`, `nt-sep`,
`@keyframes slide`, `section#faq` / `button[style*=…]` overrides — shared, do not edit), `global.css`
(`px-panel*`, `wrap`, `p b`), `src/data/mock.ts` (`REALTIME`, `MODULES`).

| Area              | Current code                                                                                                                                                                                                                                                   | Reference                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Styling           | inline styles everywhere; `color: "#3DDC84 !important"` is an invalid inline value and is dropped; hex values inline                                                                                                                                           | resolved values above, as tokens in a module (Decisions 1, 19)                                                                                               |
| Fonts             | `var(--mono)` on label, times, "Open module →" (check what `--mono` is in `tokens.css`)                                                                                                                                                                        | body sans (the variable is undefined in the prototype) — Decision 2                                                                                          |
| Bar position      | `top: 56px`, 68 px row                                                                                                                                                                                                                                         | same, but the codebase nav height decides what is visible — Decision 3                                                                                       |
| Bar background    | `var(--ground)` (check: is `--ground` defined in dark? if not, the bar is transparent)                                                                                                                                                                         | `#000` opaque, bar + row + button + list                                                                                                                     |
| News colour       | children inline `#3DDC84`; `examples.css` has `button[style*="rgb(61, 220, 132)"]` rules that recolour to cyan **only if** the button's own style attribute contains that colour (it does not, since the `!important` value is dropped) — check in the browser | green `#3DDC84`, glow `0 0 11px` — Decision 4                                                                                                                |
| Count             | `REALTIME.length`                                                                                                                                                                                                                                              | number of items in the list                                                                                                                                  |
| Chevron           | 720 ms `cubic-bezier(.65,0,.25,1)`                                                                                                                                                                                                                             | 420 ms `cubic-bezier(.2,.7,.2,1)`                                                                                                                            |
| Ticker            | 68 s, doubled, item gap 12 / pad 0 4 / 16px / .92, `.nt-sep`, `slide` from examples.css; time colour `var(--muted)`                                                                                                                                            | same geometry; time white; reduced motion → Decision 7                                                                                                       |
| News list content | `REALTIME.slice(0, 5)`, shows `item.text`                                                                                                                                                                                                                      | every item, shows the **title** (= ticker) — Decision 5                                                                                                      |
| News list layout  | grid `140px 1fr`, gap 18, padding `13px 26px`, text 13 / lh 1.5, time 10.5 px `--text-dim`, borders between rows only                                                                                                                                          | flex baseline, gap 18, padding `14px 24px`, border-top on every row `.06`, list border-bottom `.08`, time 13 px / .04em white, text 15 px / .92              |
| News list ground  | `rgba(6,12,16,.94)` + `blur(10px)`; border-top toggles                                                                                                                                                                                                         | opaque `#000`                                                                                                                                                |
| News list motion  | `max-height` 0 ↔ 400px + opacity, 720 ms `(.65,0,.25,1)`; no row stagger; no reduced-motion                                                                                                                                                                    | height 520 ms + opacity 360 ms; rows stagger 420 ms; max `100vh − 140px`, scrolls inside; reduced motion — Decision 6                                        |
| News a11y         | no `aria-expanded`                                                                                                                                                                                                                                             | `aria-expanded` (+ Decision 6)                                                                                                                               |
| Hero              | identical inline values; `muted` + `/assets/mv/home.mp4`; video in flow                                                                                                                                                                                        | no source — Decision 8                                                                                                                                       |
| Panel eyebrow     | empty `<span>` with `margin-bottom: 14px` → 14 px extra above every title                                                                                                                                                                                      | none — Decision 10                                                                                                                                           |
| Panel padding     | inline 56 / 28                                                                                                                                                                                                                                                 | prototype 56 / 28 — Decision 9                                                                                                                               |
| Panel classes     | `px-panel` + inline duplicates of its own rules; `px-panel-inner wrap` + inline overrides; `copy`                                                                                                                                                              | `.px-panel*` global rules = prototype; text styles in the module (watch specificity: `.px-panel-inner p` (0,1,1) beats a module class (0,1,0))               |
| Panel entrance    | `<Reveal as="section">` (check it gives `.reveal` → `.in`, 700 ms, translateY 20, threshold 0.12)                                                                                                                                                              | §5                                                                                                                                                           |
| FAQ head          | no eyebrow                                                                                                                                                                                                                                                     | `05 — SUPPORT` — Decision 13                                                                                                                                 |
| FAQ bars          | `#070d11`, `border: 1px solid transparent`, hover `#0a1217`, open edge `rgba(54,208,224,.35)`; head `min-height 48px; padding 0 22px; gap 14px`; weight 700; icon box 17; chevron 12 px / stroke 2.6, `.2s`                                                    | `#070D11` (same), no border, no hover; `padding 16px 20px` (49 px); gap 12; weight 600 (renders bold); icon box 19; chevron 14 px / stroke 2.4 — Decision 12 |
| FAQ open          | working accordion (several open), `.faq-body` `tl-reveal .25s`, answers styled in `examples.css` (no reduced-motion guard)                                                                                                                                     | none in the prototype — Decision 14                                                                                                                          |
| FAQ column        | `.faq-in` 920 / `padding 0 56px`, 18 px under 640                                                                                                                                                                                                              | 920 / 56, no narrow rule — Decision 15                                                                                                                       |
| FAQ contact       | `margin 44px 0 0`; link `var(--accent-cyan, #00e5ff)`, underline on hover                                                                                                                                                                                      | `margin 40px 0 16px`; `#00E5FF`, no hover                                                                                                                    |
| FAQ overrides     | `examples.css` `section#faq h2 / button span / p / svg { #fff !important }` hit Home's `#faq`                                                                                                                                                                  | not in the prototype; they happen to give the same white — Decision 16                                                                                       |
| Section ground    | `.faq-sec { background: var(--ground, #000) }`                                                                                                                                                                                                                 | `#000` (transparent over the black body)                                                                                                                     |

## 11. Decisions (to confirm — edit this list before running the prompts; the prompts follow it)

Recommended choice first. Strike the ones you reject and write what you want instead. When a session
applies one, it writes **"Applied in Session N (date): …"** under it with the exact values.

1. **CSS module.** → _Recommended:_ yes — create `src/pages/home/home.module.css` and move every inline
   style into it (inline styles cannot express hover, focus-visible, reduced motion or media queries,
   and one of them is already invalid). Keep using the global `.px-panel`, `.px-panel-bg`,
   `.px-panel-veil` (identical to §5) and the shared `<Reveal>`; replace `px-panel-inner`, `wrap`,
   `copy`, `nt-sep`, `slide` and every `faq-*` class with module classes (module keyframes are scoped).
   Home stops importing `examples.css` in the FAQ session. `examples.css` and `global.css` are not
   edited; if a global class ends up unused, list it under "Noticed, not done".
   **Applied in Session 1 (2026-10-26):** Created `src/pages/home/home.module.css`. Added `import styles from './home.module.css'` in `Home.tsx` after the `examples.css` import (line 7). Module classes replace all inline styles on bar/row/button/dot/count/chevron/mask/track/item/sep/time. `examples.css` import kept (`FAQ` still uses it). `nt-sep` className → `styles.sep`; keyframe renamed `tickerSlide` (scoped). Global classes `.px-panel*` and `<Reveal>` unchanged.
2. **Fonts.** → _Recommended:_ the codebase's fonts as the other pages use them (`--font-sans` for text,
   the global `h1–h4` display face for h1/h2). Where the prototype says `var(--mono)` (News label,
   count, times, "Open module →"), use the **sans** face — that is what renders — with
   `font-variant-numeric: tabular-nums` on the times and the count. FAQ titles: sans, not Arial.
   **Applied in Session 1 (2026-10-26):** `--font-sans` on `.news` (`home.module.css`); `.count` and `.time` get `font-variant-numeric: tabular-nums`. `.time` uses `color: var(--text)` (white) because `--muted` is undefined in the codebase's dark tokens. Label and chevron inherit colour/font from `.news`. FAQ titles deferred.
3. **News bar placement.** The prototype puts a 68 px bar 12 px under a 68 px nav, so 56 px show.
   → _Recommended:_ place the bar at the nav's real bottom edge (use whatever the other pages use for
   "under the nav" — `var(--nav-h)` or the measured `.nav` — cite file:line) and give the row a
   **56 px** height (hairline included), so the visible strip matches the prototype and its content is
   centred in it. Hero `padding-top` follows (Decision 8). Alternative: prototype literal (top 56 px,
   68 px row) — only right if our nav is also 68 px.
   **Applied in Session 1 (2026-10-26):** Recommended applied. `.bar { top: var(--nav-h); }` (68 px, `tokens.css:51`); `.row { height: 56px; }` (includes hairline). Visible strip y = 68–124 at 1440×900. Hero `padding-top` deferred to Session 3 (hero, Decision 8). `events.module.css:48` cited as the only other page using `--nav-h` for layout.
4. **News colour.** The prototype is green `#3DDC84` (label, dot + `0 0 11px` glow, count, chevron).
   `examples.css` carries later rules meant to turn it cyan (`--accent-cyan`). → _Recommended:_ the
   prototype's green as a new token `--home-live: #3DDC84`, unless the cyan was a stakeholder request —
   say so if it was.
   **Applied in Session 1 (2026-10-26):** `--home-live: #3DDC84` added to `tokens.css` dark block (`:root[data-theme="dark"]`, line 59). Applied to `.dot` (background + `box-shadow: 0 0 11px var(--home-live)`), `.news` (color, inherited by label span and SVG via `currentColor`), `.count` (explicit). No stakeholder request for cyan known.
5. **News list content.** → _Recommended:_ the prototype's: every news item (not `slice(0, 5)`), in
   ticker order, showing the same **title** as the ticker and its `date time`; the count beside "News"
   = the number of items. If `REALTIME` holds something other than news headlines, report it before
   building (do not change the shared mock).
   **Applied in Session 2 (2026-10-26):** `REALTIME.map(...)` (all 5 items, no `slice`); `item.title` (not `item.text`). `{REALTIME.length}` count on the button unchanged — equals the number of rows shown.
6. **News list behaviour.** → _Recommended:_ prototype values (§3) — 520 ms height + 360 ms fade,
   rows `sbNewsIn` 420 ms staggered 80 + 60k ms, max `calc(100vh - 140px)` then scroll inside, opaque
   ground, overlays the page. Build the height animation the way the DA/Acquisitions in-flow dropdown
   does (cite it), not with `max-height`. Additions (not in the prototype): **Escape closes it and
   returns focus to the button**, `aria-controls` on the button; no click-outside close, stays open on
   scroll (as the prototype). Reduced motion: no transition, no stagger.
   **Applied in Session 2 (2026-10-26):** List replaced with `<div ref={listRef} id="news-list" className={newsOpen ? styles.list+styles.listOpen : styles.list} aria-hidden={!newsOpen} inert={!newsOpen}>`. Height animation reuses **`data_availability/data-availability.tsx:231-265`** (double rAF + `scrollHeight`), not the filter-dropdown `grid-template-rows` trick — because the prototype script measures `scrollHeight` and caps at `innerHeight−140`, which the grid-rows technique cannot express. On open: `height:0px;transition:none` → double rAF → read `el.scrollHeight`, clamp to `window.innerHeight−140`, set `overflowY:auto` when taller, then transition `height 520ms cubic-bezier(.2,.7,.2,1)` + `opacity 360ms ease`. On close: snapshot `el.offsetHeight` → double rAF → `height:0; opacity:0`; after 540 ms reset `style.cssText=''`. Reduced motion: open sets pixel height + opacity directly (same cap logic, no rAF, no transition); close resets `cssText` immediately. One helper `setNews(open: boolean)`; button calls `setNews(!isOpenRef.current)`; Escape calls `setNews(false)` then `btnRef.current?.focus()`. Escape handled by `document.addEventListener('keydown', …)` mounted only while `newsOpen` is true. `aria-controls="news-list"` on button. Unmount cleanup via `useEffect(()=>…, [])` cancels both rAFs and the timer. Row stagger: `@keyframes sbNewsIn` in `home.module.css`; `animation-delay: calc(80ms + var(--k) * 60ms)` driven by `style={{ "--k": k }}` on each row — no hard-coded nth-child rules. CSS: `.list { height:0; opacity:0; overflow:hidden; background:var(--home-ground); border-bottom:…8%… }`. `.listRow { flex; baseline; gap 18; padding 14px 24px; border-top:…6%… }`. `.listTime { 13px; .04em; var(--text) }`. `.listText { 15px; var(--text); opacity:.92 }`. Reduced-motion guard: `transition:none !important` on `.list`, `animation:none !important` on `.listOpen .listRow`. Deleted: `max-height 720ms`, `rgba(6,12,16,.94)`, `backdropFilter:blur(10px)`, `grid 140px 1fr`, `item.text`, `slice(0,5)`, toggling `borderTop`.
7. **Ticker.** → _Recommended:_ prototype geometry and 68 s **for 5 items**; if the item count differs,
   keep the speed: `duration = 13.6 s × items`. No pause on hover (prototype). Reduced motion: no
   scrolling — the track stands still at its start (the extra copies stay hidden by the mask).
   **Applied in Session 1 (2026-10-26):** `@keyframes tickerSlide` (renamed from `slide`) in `home.module.css`. Duration set via CSS variable: `style={{ "--ticker-dur": \`${13.6 \* REALTIME.length}s\` } as React.CSSProperties}`on`.track`; animation: `tickerSlide var(--ticker-dur, 68s) linear infinite`(68 s fallback = 5 items × 13.6 s).`@media (prefers-reduced-motion: reduce) { .track { animation: none; } }`.
8. **Hero video.** The prototype has no video; in flow, ours leaves a 68 px black band under the bar
   and grows the hero past 100vh. → _Recommended:_ the video fills the hero
   (`position: absolute; inset: 0; width/height 100%; object-fit: cover`) under the overlay; hero
   `min-height: 100vh`, no padding-top needed (nothing is in flow); keep `muted autoplay loop
playsInline`; under `prefers-reduced-motion` do not autoplay (first frame, paused). Every other hero
   value as §4. Alternative: prototype literal (in flow, `padding-top` = nav + bar).
9. **Panel side padding.** → _Recommended:_ outer edge = the codebase page padding
   `clamp(18px, 4vw, 48px)` (aligned with the nav and every other page; 48 px instead of 56 px at
   desktop, 18 px on phones), inner edge 28 px as the prototype; `max-width: 640px` box unchanged.
   Alternative: prototype 56 / 28 everywhere.
10. **Panel eyebrow.** → _Recommended:_ remove the empty `<span>` (prototype has none; it adds 14 px).
11. **Hovers.** → _Recommended:_ follow the resolved prototype — no hover on the News button, ticker,
    "Open module →", contact link (the FAQ bars: Decision 12). Every interactive element keeps (or
    gets) the shared `:focus-visible` ring other pages use.
    **Applied in Session 1 (2026-10-26):** No `:hover` rule anywhere in `home.module.css`. `.news:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }` — colour/width from `processors.module.css:100-103`; offset `-2px` (inside) instead of `+3px` because `.row` has `overflow: hidden` and an outset ring would be clipped.
12. **FAQ bars (closed).** → _Recommended:_ prototype geometry: `padding: 16px 20px` (49 px), gap 12,
    icon box 19 (svg 17, stroke 1.7), chevron 14 px stroke 2.4 rotating 0.2 s, no border when closed,
    ground `#070D11` (token), 12 px between bars; title weight **700** (what the prototype renders).
    Interactive states the prototype cannot show — keep ours: hover ground `#0A1217`, open edge
    `rgba(54,208,224,.35)`, chevron rotated when open. Alternative: no hover (strict prototype).
13. **FAQ eyebrow `05 — Support`.** It numbers a 5th section, but the panels carry no 01–04.
    → _Recommended:_ leave it out (as the current code). Alternative: prototype (10px, .2em, uppercase,
    `#00E5FF`, 16 px below).
14. **FAQ open state.** No prototype. → _Recommended:_ keep ours (several groups open at once, answers
    as now, reveal 0.25 s) moved into the module, with a reduced-motion guard, `aria-expanded` and
    `aria-controls`. Values recorded in the Applied note.
15. **FAQ column.** → _Recommended:_ 808 px of bars at desktop as the prototype, with the shared
    padding: `max-width: calc(808px + 2 * clamp(18px, 4vw, 48px)); padding-inline: clamp(18px, 4vw, 48px)`
    (18 px on phones, replacing the current 640 px media rule). Answers keep their left inset under the
    title (icon box + gap + side padding).
16. **`section#faq` overrides in `examples.css`.** They use `!important` and hit any `section#faq`
    while that sheet is loaded (Vite keeps a CSS import global once any page imports it).
    → _Recommended:_ after the move, check whether anything links to `#faq` (grep); if nothing does,
    drop the `id`; if something does, keep it and verify in the browser that every FAQ colour still
    equals the module's value (the overrides set h2, button spans, `p` and svg to `#fff !important`).
17. **Bottom spacing.** → _Recommended:_ the FAQ's own `padding: 120px 0 130px`; no `--sb-earth-h`
    (Home has no planet).
18. **SpaceBackdrop.** → _Recommended:_ none — the prototype Home has no sky and no planet. Do not add one.
19. **Tokens** (new, in `tokens.css`, dark block; never change shared ones):
    - `--home-ground: #000000` — News bar, row, button, list; hero; FAQ section
    - `--home-live: #3DDC84` — News label, dot, glow, count, chevron (Decision 4)
    - `--home-accent: #29C3D6` — "Sentinel" in the h1, ticker separator
    - `--home-faq-bar: #070D11`, `--home-faq-bar-hover: #0A1217`, `--home-faq-open: rgba(54, 208, 224, 0.35)`
    - `--home-link: #00E5FF` — contact link (reuse an existing token if one already holds `#00E5FF`)
    - white alphas as `color-mix(in srgb, var(--text) N%, transparent)` if `--text` is `#FFFFFF`;
      otherwise add `--home-ink: #FFFFFF` and mix that. `#E2E8F0` for `<b>` comes from the global `p b`
      rule — leave it there. The overlay `rgba(0,0,0,.3)` = `color-mix(in srgb, var(--home-ground) 30%, transparent)`.
      **Applied in Session 1 (2026-10-26):** Tokens added to `:root[data-theme="dark"]` (`tokens.css:59` — the selector applied when the app sets `data-theme="dark"` on `<html>`): `--home-ground: #000000`, `--home-live: #3DDC84`, `--home-accent: #29C3D6`, `--home-faq-bar: #070D11`, `--home-faq-bar-hover: #0A1217`, `--home-faq-open: rgba(54, 208, 224, 0.35)`. `--home-link` not added — Session 5 uses `var(--accent-cyan)` directly (`tokens.css:27`, value `#00E5FF`). `--home-ink` not needed: `--text` is `#ffffff` in dark so `color-mix(in srgb, var(--text) N%, transparent)` works.
20. **Copy.** → _Recommended:_ the §5 texts verbatim (check `MODULES` in `mock.ts` word for word; the
    Processors long text is the stakeholders' copy, keep it even though it promises wheel zoom/drag).
21. **Panel images.** → _Recommended:_ compare `sha256sum` of the files `MODULES[i].img` points to with
    §5; if any differs, tell me and I will send the prototype's four JPEGs.
22. **Narrow screens.** No prototype rules. → _Recommended:_ only what Decisions 9 and 15 give, plus a
    check at 320 / 390 px that no panel title (`white-space: nowrap`) overflows; h1 stays 56 px
    (prototype) unless it overflows at 320 px.
