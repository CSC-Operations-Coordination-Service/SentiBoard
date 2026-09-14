# Acquisitions — second mockup concept: **Acquisition Ladder**

Proposed route: `/examples/acquisitions-ladder`
Status: **proposal only — not built.** Awaiting confirmation before implementation.

Alternative to `/examples/acquisitions-globe` (Anthony's 3D globe, already reviewed and adopted).
`/acquisitions` stays untouched, as with every other proposal under `/examples`.

---

## 1. The idea in one sentence

The globe answers **"where is the fleet acquiring?"**. This concept answers **"where in the
processing chain is the data being lost?"** — it drops geography entirely and makes the
**product-level chain the primary axis**, with time as the selector rather than the subject.

That inversion is the whole proposal. It is not a flat-map globe, not a re-skin, and it shares no
structure with `/examples/coverage-timeline` (which is a mission × day heatmap for the Data
Availability page, and is about *when* coverage broke, not *at which processing stage*).

## 2. Why this shape falls out of the gaps you identified

**Missions organise levels differently.** On the globe this is a fixed-geometry problem: the
completeness plates are a per-level isometric block that draws at most eight prisms and has to cap
Sentinel-3's fourteen Level-2 types, and has to render Sentinel-5P's missing Level 0 as an absence
inside a layout that expects three plates. A **vertical ladder is naturally ragged** — the rungs are
whatever levels the datatake actually carries, so a two-rung ladder and a three-rung ladder sit side
by side without either being a special case:

| Mission | Ladder shape (from `src/data/mock.ts`) |
| --- | --- |
| **S1** (SAR) | 3 rungs. L2 for the sample IW datatake is entirely `pct: null` → drawn as a dashed **"not expected"** rung, visibly different from a rung at 0%. |
| **S2** (MSI) | 3 rungs. The L1 rung carries `MSI_L1A_DS` / `L1B_GR` / `L1C_TC` as three segments in one rung, tagged **collapsed** — the backend's own collapsing shown as a fact, not hidden. |
| **S3** (OLCI/SLSTR/SRAL/MWR/SYN) | 3 rungs, each subdivided into **instrument groups** with their own roll-up. The 14 L2 types read as 5 groups. A rung is a horizontal band that can wrap to a second line, so **no cap is needed** — nothing is ever hidden behind an "and 6 more" line. |
| **S5P** (TROPOMI) | **2 rungs.** The ladder simply starts at L1B; the base is labelled `TROPOMI downlink → L1B (no Level 0 product)`. A structural difference stated, rather than a hole in a three-plate layout. |

**Weight.** No canvas, no 3D scene, no offscreen buffers, no coastline geometry — the ladder is SVG
rects and CSS. That removes the two heaviest sources on the globe route: `src/data/land.ts` (67 kB)
and `src/components/AcquisitionGlobe.tsx` (68 kB) — 135 kB of source out of the mockups app's single
946 kB bundle (`dist/assets/index-DHAjfLjg.js`), before minification and gzip. It also removes the
per-frame cost entirely: nothing animates except the UTC clock, so there is no render loop to
demand-drive, no IntersectionObserver, no visibility handling.

**Aesthetic.** SpaceX mission-control register kept: mono labels, thin rules, accent-per-mission
hues, the glowing "now" marker. Colour comes only from the existing shared tokens and the five
production completeness states, so light/dark works through the global switch with no palette of its
own — same discipline as `coverage.module.css`.

## 3. Layout

Three stacked bands, full-bleed inside `wrap pad`.

### Band 1 — Fleet strip (the selector)

A single horizontal time axis across all satellite units, one lane per unit (S1A, S1C, S2A, S2B,
S2C, S3A, S3B, S5P). Each datatake is a bar at its sensing start, width from `sensingS`.

- One vertical **now** line with a live UTC clock, so **past sits left, planned sits right**.
- Past bars are filled in their completeness colour; planned bars are hollow with a dashed outline —
  the "not flown yet" / "flown but degraded" distinction the production legend already makes.
- A small notch under each bar carries the downlink station code (from `data/downlink.ts`), so the
  station is on the strip rather than only in a detail panel.
- Window presets: **−24 h / −6 h / ±6 h / +24 h**, plus mission chips that dim non-matching lanes.

This band replaces both the globe's clock track *and* its single mission dropdown: it is the
selector, and it is also the past/current/future answer on its own.

### Band 2 — The ladder (the centrepiece)

For the selected datatake, the levels stacked **bottom-to-top, L0 at the base feeding upward**.

Each rung is a horizontal band of segments, one segment per product type, each segment a fill meter
of its `pct`. Above the rung, the level mean (`levelMean()`, unchanged). To the left of the rung, the
level label.

The diagnostic move: **the connector between rungs shows the yield drop.** For the sample S1A
datatake, L0 sits at 99.0% and L1 at 59.6% — the connector reads `−39.4 pts` and thickens/reddens.
That is the sentence an operator wants: *the loss enters between downlink and L1 processing.* The
globe's plates show each level independently and leave that subtraction to the reader.

- A rung with every type `null` renders as a dashed empty rung: **"not expected"**, not 0%.
- Alarm outline below 95%, as on the plates.
- The header KPI stays `meanCompleteness()`, and missing time stays `missingSeconds()` — same
  functions, so this route cannot disagree with the globe or the header.

### Band 3 — Fleet roll-up

Four mission cards (S1 / S2 / S3 / S5P), each a **mini-ladder**: the ladder collapsed to one bar per
level. Four ragged silhouettes side by side is the cross-mission comparison the globe has no room
for, and it is where the differing level structures become readable *as a difference* rather than as
four separate inspections. Clicking a card filters Band 1.

## 4. Interaction model

| Action | Result |
| --- | --- |
| Click a bar in Band 1 | Selects that datatake; Bands 2 and 3 update |
| `←` / `→` | Previous / next datatake in time order (roving tabindex over the strip, one tab stop) |
| `↑` / `↓` | Move between satellite lanes |
| Hover / focus a segment | Product type, `pct`, and its share of `missingSeconds()` |
| Click a rung | Expands to the per-type numbers table underneath |
| Window preset / mission chip | Re-scopes Band 1 only; selection is preserved if still in range |

Everything is a real focusable element — buttons, a real `<table>` in the expanded rung — so there is
no `role="img"` canvas needing a hand-written live description or an `aria-keyshortcuts` mirror-button
list. Accessibility comes from the DOM rather than being reconstructed on top of a canvas.

## 5. The trade-off, stated plainly

**You lose geography.** There is no footprint, no swath, no station coverage circle, no "is this pass
over the Atlantic". The ladder shows the footprint centre as a lat/lon readout and the station name,
and nothing more — deliberately, because a static map or a 2D projection would drag `land.ts` back in
and make this a globe variant, which is exactly what you asked it not to be.

So this is not a replacement for `acquisitions-globe`. The two answer different questions and the
honest framing for review is: the globe is the **geographic** reading of acquisitions, the ladder is
the **pipeline** reading. If only one route ships, that is a decision about which question the
Acquisitions page is for.

## 6. What building it would touch

- New: `src/pages/acquisitions-ladder/AcquisitionsLadder.tsx` + `ladder.module.css`, one route in
  `src/App.tsx`, an entry in `design/react-mockups/README.md`, and cross-links to/from
  `/examples/acquisitions-globe`.
- Reused unchanged: `ACQ_DATATAKES`, `AcqLevel` / `AcqProductType`, `expectedTypes()`,
  `meanCompleteness()`, `levelMean()`, `missingSeconds()`, `sensingMs()`, `passesFor()`,
  `COMPLETENESS_COLOR`, `PageHeader` / `Reveal`.
- **No new mock data needed** — every field the ladder draws already exists. The one gap is the same
  one the globe has: no datatake-to-pass join in the backend, so Band 1's station notch reads from
  `data/downlink.ts`.
- Not touched: `AcquisitionGlobe.tsx`, `land.ts`, `/acquisitions`.
- Next.js copy under `frontend/app/examples/` only if it is the concept that gets chosen, per the
  handover's rule about `mock.ts` being byte-identical in both copies.

---

## 7. Built — 2026-08-21

Live at **`/examples/acquisitions-ladder`** (`design/react-mockups`, `npm run dev` → port 5180).
Source: `src/pages/acquisitions-ladder/AcquisitionsLadder.tsx` + `ladder.module.css`. Routed in
`src/App.tsx`, carded in the `/examples` gallery as *b) Acquisitions · Level ladder*, listed in
`README.md`, and cross-linked in both directions with `/examples/acquisitions-globe`.

`components/AcquisitionGlobe.tsx`, `data/land.ts`, `data/mock.ts` and `/acquisitions` are unmodified
(`git diff --stat` on all four is empty). No mock data was added; the page reads `ACQ_DATATAKES`,
`expectedTypes()`, `meanCompleteness()`, `levelMean()`, `missingSeconds()`, `sensingMs()`,
`passesFor()` and `COMPLETENESS_COLOR` as they stand.

### What the built page does that the proposal only described

- **The scenario clock is a scrub, not a simulation.** `ACQ_DATATAKES` is a fixed 15–16 Jul 2026
  scenario — the same day `DAY_START` pins in the globe component — so "now" is a scenario instant.
  It defaults to `09:35:00Z` because that one instant puts all three phases on screen at once: four
  datatakes flown, `S1A-57622` mid-sensing, `S2A-48201-1` still scheduled. Deliberately no playback:
  a play loop would reintroduce the per-frame cost this concept exists to avoid.
- **A scheduled datatake withholds its percentages** rather than showing its eventual ones. Rungs
  read *pending*, connectors read *—*, the KPI reads *not yet sensed*. Withholding is what "not yet
  sensed" means; the numbers exist in the fixture but are not facts at that instant.
- **The datatake id sits under the bar, not in it.** At a full-scenario window a bar is 14–27 px and
  the id needs 50–62 px, so five of six were clipping to nothing. Bar width now encodes duration
  only; the line beneath carries id + downlink stations, and flips to right-anchored past 70% of the
  window so it cannot be clipped at 390 px.

### Verified

Typechecks and builds clean. Driven in headless Chrome over CDP at 1440 px and 390 px, both themes:

| Claim | Reading |
| --- | --- |
| Yield connector | `−39.4 pts · loss enters here` between L0 99.0% and L1 59.6% on `S1A-57622`, on load |
| KPI agreement | 79.3% and 5m 40s — `meanCompleteness()` / `missingSeconds()` over the 8 expected types |
| S3 generalises | 3 rungs, instrument groups per rung, **all 14 L2 types drawn**, nothing capped; expanded table = 14 rows |
| S5P generalises | 2 rungs, `Level 1B` / `Level 2`, base note "publishes no Level 0 product" |
| S1 L2 | dashed "not expected" rung — distinct from the failed datatake's `0.0%` |
| Failed datatake | `S3A-055-358` → 0.0% / 0.0% / not expected / Unclassified, "no passes recorded" |
| Scheduled | `S2A-48201-1` → pending rungs, `not yet sensed`, `—` connectors |
| Ragged silhouettes | roll-up rows: S1 `L0/L1/L2`, S2 `L0/L1/L2`, S3 `L0/L1/L2/n-c`, S5P `L1B/L2` |
| Window presets | 2 h narrows to "1 of 6 datatakes in window · 5 outside" |
| Keyboard | arrow walk moved selection and **focus followed it** (`aria-pressed=true`, ladder re-titled) |
| Overflow | `scrollWidth == innerWidth` at 1440 and 390, both themes |
| Cross-links | globe → ladder, ladder → globe, gallery lists both a) and b) |

### One correction to §2 above

The proposal's weight argument needs qualifying. The ladder genuinely carries no canvas, no 3D scene
and no coastline data — but the mockups app emits a **single chunk**, so adding the route made the
bundle *larger*, not smaller: **946,389 → 963,719 bytes (+17,330)**. The ladder's own cost is that
17 kB against the globe's ~135 kB of source. Nobody downloads less by choosing the ladder unless the
globe route is dropped or the build is code-split. What is unconditionally true is the runtime cost:
no render loop, no offscreen buffers, no IntersectionObserver bookkeeping, no visibility handling.
