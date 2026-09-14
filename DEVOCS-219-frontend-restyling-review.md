# Acquisitions globe — front-end review of both proposals

Front-end feedback on the two acquisitions-globe proposals. Scope is UI/UX, component architecture
and mock-up feasibility; backend and data-sourcing decisions are out of scope while the stack is
being confirmed.

Both proposals can be reviewed side by side right now:

| | URL |
| --- | --- |
| Anthony's proposal | http://172.28.89.3/ |
| Our React mock-up | http://172.28.89.6:3000/examples/acquisitions-globe |
| Same, running locally | http://localhost:5180/examples/acquisitions-globe |

The deployed mock-up is serving the current branch head (bundle `index-CWkOy8ZG.js`, identical to a
fresh build), so it is up to date for review.

**Starting point:** the two proposals already agree on the fundamentals. Both replace the Cesium page
with a lightweight Canvas 2D globe, both draw acquired footprints rather than bare markers, both are
fully keyboard operable, and both stop rendering when scrolled out of view. Anthony's proposal is
where that rendering architecture came from and we adopted it deliberately — his frame-timing model
also surfaced a real bug in ours. The notes below are about scope and presentation, not about which
approach is correct.

---

## 1. Comments on Anthony's proposal

### UI/UX strengths to adopt

- **Sensing timeline with zoom, pan and aggregation tiers.** The strongest single component in either
  proposal. Marks cluster as you zoom out, with asymmetric thresholds so the clustering does not
  flip-flop mid-gesture. It is the only part of either design that already answers the density
  question, and we should take it. Ours currently plots a fixed set of marks with no zoom.
- **Telemetry HUD.** `SENTINEL-1 · 693 km`, latitude, longitude and `NO STATION IN VIEW`, updating as
  the globe turns. It gives the view a reason to be live. We already compute the same station-contact
  state and never surface it as a readout, so this is a small addition with a good return.
- **On-canvas guidance hints.** "Drag to rotate · Click a footprint · Filter by station" tells a
  first-time user what the globe does. Ours relies on discovery, which is a gap.
- **Station filter chips carrying pass counts** (`Svalbard 12 passes`). The filter doubles as a
  summary — good information density in a small control.
- **Isometric completeness prisms.** The published-solid / missing-cage treatment reads well and is
  the concept our plates are built on.
- **Land geometry served as its own cacheable asset** (55 kB TopoJSON) rather than compiled into the
  application bundle. Ours inlines 67 kB of coordinate arrays into the bundle and re-parses it on
  every load; his approach is better and is a straightforward change for us.

### Front-end limitations / areas to improve

- **Sentinel-1 only.** The page is titled *Datatake Circulation · Sentinel-1*, and the other three
  missions are where the layout gets difficult: S5P has no Level 0 at all, S2 collapses L1A/L1B/L1C
  into a single L1, and S3 is the only four-instrument mission — its Level 2 carries fourteen product
  types against Sentinel-1's four. A rail laid out for ten S1 types is not yet a rail for S3, so this
  is the main open question about extending the design.
- **Page weight, growing with the data window.** The document is 931 kB, of which **96.8% is an
  inline dataset rather than markup** — 3,623 datatake records serialised into the HTML to draw 28 on
  screen. That is 129 records shipped per record rendered, in a form the browser cannot cache and has
  to parse before first paint. It is a front-end issue and a fixable one, but it is the one pattern
  from his build we should not carry forward.
- **Screen-reader live region is too broad.** `aria-live="polite"` wraps the entire right-hand rail,
  so every selection re-announces the whole panel — datatake ID, headline KPI, metadata grid and all
  ten product percentages. A screen-reader user would hear a paragraph per click. Scoping the live
  region to the changed values would fix it without changing the visual design.
- **The completeness legend and the underlying quantity disagree.** The plate legend reads `VOLUME =
  PUBLISHED / EXPECTED`, but the figure being drawn is sensing duration. See the terminology item in
  section 3.
- **Data-quality strip fires on everything.** The diagnostic line reads "28 data warnings: footprint
  S1A-387595: normalised-longitude; …" for all 28 footprints on screen. A check with a 100% hit rate
  trains people to ignore the strip, so either the normalisation is expected and should not warn, or
  it is worth chasing.
- **No source map is published**, so behaviours can only be confirmed by reading minified output.
  Workable, but it is why a couple of the smaller questions below are questions rather than
  observations.

---

## 2. Comments on our React mock-up

### UI/UX strengths

- **All four missions, with mission-aware level plates.** Levels are driven by whatever the selected
  datatake actually carries, so S5P correctly shows no Level 0, S2's three L1 sub-levels are
  modelled, and a product type that matches no known level gets an "Unclassified" plate rather than
  being silently dropped.
- **Eight-prism cap with instrument roll-ups**, which is what makes S3 legible. A plate draws at most
  eight prisms, sorted lowest completeness first, so a cap can only ever hide healthy types; the
  remainder is named with percentages underneath rather than truncated silently; and the level
  percentage above is computed over *every* type, not the drawn subset. Levels that mix instruments
  lead with a roll-up row (`OLCI 86.6%×4 · SLSTR 89.1%×4 · SRAL 98.5%×2 · SYN 91.3%×4`), because
  fourteen bare prisms from four instruments do not read.
- **"Not expected" and "0% delivered" are drawn differently** — a flat dashed pad rather than an
  empty cage. S1's OCN Level 2 and S5P's Level 0 are genuinely the former, and collapsing them would
  assert missing data that was never due.
- **Light and dark theme support**, with the completeness and event-type palettes taken from the
  production legends rather than reinvented, then adjusted per theme so each stays legible on its own
  ground.
- **Clean component architecture.** The globe takes its data entirely through props and holds none of
  its own; the detail rail is memoised on the selected datatake alone; and the canvas setup path
  deliberately excludes anything that changes on selection, hover or playback, so choosing a datatake
  re-renders the rail without tearing down the canvas or its caches. That separation is what makes
  the port in section 4 cheap and the component reusable.
- **Selection uses one native mission-grouped dropdown**, which inherits platform keyboard handling,
  type-ahead, correct touch behaviour and self-scrolling — the same reasons the legacy page's
  dropdown works well. Colour is never the only signal: the percentage and status word are in the
  option text.
- **Responsive by container, not viewport.** Three layout tiers at 560 / 780 / 980px, sized by a
  `ResizeObserver` on the canvas stage rather than window resize events.
- **No geospatial dependencies** — projection, limb clipping and footprint picking are all ours,
  where Anthony's build carries d3-geo and versor. Fewer moving parts to maintain and audit.

### Front-end limitations / areas to improve

- **Visual appearance is unverified.** Geometry, metrics and cap-safety were checked numerically, but
  nobody has opened the page in a browser. Specifically unconfirmed: plate shading and leader-line
  placement, how three plates plus the downlink block behave in a scrolling rail, the S3B Level 2
  plate (the only capped case), and how the status glyphs render inside a native option list on
  Windows. This is the first thing to close.
- **Only six mock datatakes.** A satellite-day is roughly 164 datatakes and 75 footprints, so none of
  our density decisions have been made against realistic counts. Two follow directly: the dropdown
  over "every datatake" is right at six and wrong at six hundred, and our timeline has no
  aggregation.
- **Missing Anthony's polish** — no telemetry HUD, no on-canvas guidance hints, no station filter
  chips, and no zoom or pan on the timeline. All four are on the adopt list in section 1.
- **Footprints are synthesised.** The swath builder produces plausible-looking rings per instrument
  family and the code says so explicitly; they are illustrative geometry, not mission
  specifications. Worth stating to reviewers so the shapes are not read as real coverage.
- **The globe page carries a chart library it never uses.** `recharts` is imported by one other page
  for a single pie chart but sits in the shared bundle — 278.66 kB raw / 76.91 kB gzip that this page
  downloads and parses for nothing. Route-level splitting resolves it, and largely comes free with
  the Next.js port.
- **One internal copy inconsistency of ours.** The plate header reads "Volume = published / expected
  **sensing**" while the legend keys below still read "Published **volume** / Missing **volume**".
  Ours should be self-consistent whichever wording the ticket settles on.

---

## 3. Design and copy clarifications needed

**1. Terminology — "Volume" vs "Duration" / "Sensing Time".**
Both proposals label the completeness plates as volume, but the quantity being drawn is sensing
duration. This matters beyond this page: operators see genuine byte volumes on Publication Statistics
and Data Archive, so the same word meaning two different things across modules is a real source of
confusion. Our mock-up has partly moved to "expected sensing" and is inconsistent with itself as
noted above. **Ask:** can we agree one term — our suggestion is "sensing time" — and apply it to the
plate header, the legend keys and the tooltip copy in both proposals?

**2. Datatake selection strategy at real scale (~600+ per day).**
A single satellite-day is around 164 datatakes and 75 drawable footprints; the full constellation-day
is 600+. A native dropdown listing every datatake works at six and does not at six hundred.
Anthony's design solves this differently — selection comes from the globe and the timeline, with no
list control — and his timeline aggregates rather than plotting every mark. **Ask:** is the intended
model (a) globe scoped to one satellite-day with the timeline covering a wider range, or (b) both
scoped to the same window? And should the dropdown be dropped in favour of globe-plus-timeline
selection once aggregation lands, or kept as a searchable/filtered control for direct lookup? This
decides whether the day/satellite filters return to the page.

**3. Handling of the "Downlink Passes" block.**
The block completes the acquisition-to-product story and is a genuinely good addition to the design,
but the data behind it is not currently available — there is no per-pass volume or duration exposed,
and no link from a datatake to the passes that downlinked it. Our mock-up has it isolated behind a
single function so it can go either way without touching the rest of the rail. **Ask:** should it
stay in the design as an agreed target with the mock-up showing it, or come out of the mock-up until
the data can be sourced? The risk of leaving it in is that reviewers read the volumes and durations
as real, since nothing on screen says otherwise. A middle option, if we want to keep it visible: mark
the block as indicative in the UI.

*Two smaller behavioural questions are probably better raised with Anthony directly than on the
ticket: whether the timeline's arrow-key help text matches the implemented behaviour, and whether the
`normalised-longitude` warnings are expected on synthetic data.*

---

## 4. Immediate front-end next steps

1. **Side-by-side browser review.** Both URLs above are live. Ours has never been looked at in a
   browser, so this is the cheapest and highest-value step and the rest should queue behind it.
   Suggested order: the S3B Level 2 plate first (the only capped case), then the rail at narrow
   widths, then the dropdown glyphs on Windows. Worth doing as a short call with Anthony so the
   adopt/improve lists above can be agreed in one pass.
2. **Test with realistic density fixtures.** Build a mock feed at true scale — around 164 datatakes
   and 75 footprints for a satellite-day, across all four missions — and point the mock-up at it.
   This is pure front-end work with no backend dependency, and it turns the selection-at-scale
   question in section 3 into something we can see rather than discuss. It is also the prerequisite
   for adopting the timeline aggregation, since there is nothing to aggregate at six datatakes.
3. **Port the component into Next.js.** The mock-up is currently a Vite + react-router SPA and the
   Next.js app does not have this page yet. The work is mechanical, roughly a day: add
   `"use client"`, re-point the `@/` import alias (it resolves differently in the two apps), remove
   the react-router dependency, shim the two layout components that exist only in the mock-up app,
   and move one inline `<style>` block into the stylesheet. The component is already prop-driven,
   which is what keeps this small. Two clean-ups belong in the same change: delete the unrouted
   220-line early `AcquisitionGlobe.tsx` draft sitting in the Next.js tree, and collapse the two
   copies of the shared page-copy module, which have begun to drift.
4. **Fold in the adopted elements** — telemetry HUD, on-canvas guidance hints, station filter chips,
   fetched land geometry — as small follow-ups once the component is in Next.js, then the timeline
   aggregation on top of the realistic fixtures from step 2.
5. **Add unit tests on the geometry.** Limb interpolation, longitude unwrapping across the
   antimeridian, footprint picking and the plate cap-safety invariant are pure functions with
   checkable properties, and they are the parts that fail quietly rather than visibly. A small suite
   would cover it, and it is worth adding a CI step that runs the type-check and both builds at the
   same time.

Happy to pick any of these up, and happy to walk through the mock-up on a call if that is easier than
comparing the two URLs asynchronously.

---

*Figures above were measured against the two deployed builds and the current branch head. Visual
appearance was not verified in a browser — that is what step 1 is for.*
