# SentiBoard v2 — React UI Mockups

SpaceX-inspired redesign of the Copernicus Sentinel Operations Dashboard, built as an
interactive React prototype. **Design proposal only** — data is static mock data; the real
product keeps its Flask SSR backend (no browser-exposed JSON API).

## Highlights

- **Two themes**, one token set — dark is the default (cinematic "mission-control"), light is a
  first-class toggle in the header. Theme persists via `localStorage` and applies before first
  paint (no flash).
- **SpaceX design language**: full-bleed hero media + veil, thin uppercase mono labels, restrained
  blue→cyan accent, scroll-reveal module scroller.
- **All functional areas** from the current app are represented: Home, Acquisitions Status (3D globe),
  Events (calendar), Data Availability (donuts + datatake table), Processors (timeline), About + FAQ,
  Product Timeliness, Publication Statistics, Data Archive, Space Segment, Data Access,
  Terms & Conditions, Cookie Notice. There is no separate News page — news and real-time events are
  sections of the index. See [Pages](#pages) for every route.
- Client copy is taken verbatim from the current SentiBoard templates.

## Run

```bash
cd design/react-mockups
npm install
npm run dev          # http://localhost:5180
```

## Pages

Every route in the app, with how you get to it. Prefix each path with the dev origin
(`http://localhost:5180`), or with `VITE_BASE` if the build was deployed under a sub-path.

### Real pages — reachable from the header nav

| Route | Page | Source |
| --- | --- | --- |
| `/` | Index — hero, module scroller, news + real-time events | `pages/Home.tsx` |
| `/about` | About + FAQ — layout A, page-header led | `pages/About.tsx` |
| `/acquisitions` | Acquisitions Status — interactive 3D globe, filters, datatake list | `pages/Acquisitions.tsx` |
| `/events` | Events — month calendar | `pages/Events.tsx` |
| `/availability` | Data Availability — donuts + datatake table | `pages/Availability.tsx` |
| `/processors` | Processors — release timeline | `pages/Processors.tsx` |

### Proposals — `/examples`, not reachable from the nav

`/examples` is the proposal gallery: open it directly and every proposal below has a card there.
The real pages above are unaffected by anything under `/examples`.

| Route | Proposal | Alternative to | Source |
| --- | --- | --- | --- |
| `/examples` | Gallery of all proposals, grouped by the page each replaces | — | `pages/IndexExamples.tsx` |
| `/examples/fleet` | Index A — news ticker over video + Sentinel fleet + page cards | `/` | `pages/IndexExamples.tsx` |
| `/examples/gallery` | Index B — news + real-time console first, then a diagonal linkable gallery | `/` | `pages/IndexExamples.tsx` |
| `/examples/reveal` | Index C — editorial first section, pages revealed on scroll | `/` | `pages/IndexExamples.tsx` |
| `/examples/about` | About — layout B, hero led | `/about` | `pages/AboutRedesign.tsx` |
| `/examples/events-swimlanes` | **FINAL CONCEPT.** Events — **mission swimlanes**: one collapsible row per mission (S1, S2, S3, S5P), collapsed by default, each header carrying its event count, affected datatakes, types present and an "N active" badge | `/events` | `pages/events-swimlanes/EventsSwimlanes.tsx` |
| `/examples/events-spacex` | **FINAL CONCEPT.** Events — two layouts behind a tab bar: **A · orbital timeline** (missions on Y, the month's days on X) and **B · telemetry grid** (day tiles over a UTC day log) | `/events` | `components/EventsSpaceXConcepts.tsx` |
| `/examples/events-manifest` | **FINAL CONCEPT.** Events — mission manifest, **filters + day drawer**: mission / satellite / type / search filters, one **event-type icon** per event on its day, day detail in an overlay Day Manifest drawer | `/events` | `pages/events-manifest/EventsManifest.tsx` |
| `/examples/acquisitions-globe` | Acquisitions — demand-driven globe (footprints, keyboard operation, sensing marks) + a "what changed" summary | `/acquisitions` | `pages/AcquisitionsGlobe.tsx` |
| `/examples/acquisitions-ladder` | Acquisitions — **level ladder**: the page read as a processing chain rather than a map. Band 1 a fleet strip (one lane per satellite unit, scrubbable scenario clock splitting flown / sensing-now / scheduled, window presets, station notches); Band 2 the selected datatake's levels stacked bottom-to-top with the **yield drop named between rungs**; Band 3 per-mission mini-ladders. Ragged by design — S5P two rungs, S3 Level 2 as five instrument groups with nothing capped. No canvas, no 3D, no coastline geometry | `/acquisitions` | `pages/acquisitions-ladder/AcquisitionsLadder.tsx` |
| `/examples/data-availability` | Data Availability — three donuts describing the current filter selection, over a sortable datatake table | `/availability` | `pages/DataAvailability.tsx` |

`/about` and `/examples/about` are cross-linked in both directions and render the same canonical
text from `src/data/about.ts` — they differ only in presentation.

`/examples/acquisitions-globe` and `/examples/acquisitions-ladder` are cross-linked in both
directions and read the same `ACQ_DATATAKES`. They are not competing versions of one layout: the
globe is the **geographic** reading of acquisitions (where the fleet is sensing) and the ladder is
the **pipeline** reading (where in the level chain the data is being lost). The ladder carries no
map at all — geography is a lat/lon readout — which is what lets it drop the canvas, the 3D scene
and `src/data/land.ts` entirely.

### Direct-URL only — styled placeholders

These carry the real feature copy and KPI framing but are not linked from the nav, the footer or any
page. Type the path to reach them. All five render `StatPage` from `pages/Simple.tsx`, configured
inline in `App.tsx`.

| Route | Page |
| --- | --- |
| `/product-timeliness` | Product Timeliness |
| `/publication-statistics` | Publication Statistics |
| `/data-archive` | Data Archive |
| `/space-segment` | Space Segment |
| `/data-access` | Data Access |

### Utility pages — reachable from the footer

| Route | Page | Source |
| --- | --- | --- |
| `/terms-conditions` | Terms & Conditions | `pages/Simple.tsx` |
| `/cookie-notice` | Cookie Notice | `pages/Simple.tsx` |
| any unmatched path | 404 — Page not found | `pages/Simple.tsx` |

## Structure

```
src/
  App.tsx                Route table — the authoritative list of paths
  main.tsx               Entry point; feeds VITE_BASE to react-router as its basename
  theme.tsx              Theme provider + toggle (dark default, persisted)
  styles/tokens.css      Dark + light design tokens (semantic vars)
  styles/global.css      Component styles (nav, hero, cards, table, calendar, globe, timeline…)
  styles/examples.css    Styles used only by the /examples proposals
  styles/data-availability.css /examples/data-availability
  data/mock.ts           Static mock data mirroring the real domain shapes
  data/about.ts          Canonical About copy, shared by both About layouts
  data/events-mock.ts    August 2026 Events data + helpers for the Mission swimlanes proposal,
                         its only consumer. Colour comes from the app-level tokens (--evt-* event
                         type, --cmp-* completeness), which are production's own two legends, so
                         it cannot drift from the shipping dashboard.
  data/land.ts           Natural Earth 110m land outlines, drawn as globe coastlines
  components/            Nav, Footer, ThemeToggle, Partners, EventIcon, FeatureCard,
                         FilterBar, AcquisitionGlobe, shared UI (Reveal, Pill, PageHeader)
  pages/                 One file per route (IndexExamples.tsx holds four)
  pages/events-manifest/ A final concept. Its mock.ts stays byte-identical with the Next.js
                         copy (see below); manifest.module.css has diverged, because the
                         responsive work landed here only:
                           EventsManifest.tsx      the page — filters, grid, Day Manifest drawer
                           mock.ts                 August 2026 events + the pure helpers
                           manifest.module.css     a CSS module, so its class names cannot
                                                   collide with global.css
  pages/events-swimlanes/      Mission swimlanes.
                           EventsSwimlanes.tsx     fleet totals, filters, four collapsible lanes
                           swimlanes.module.css    CSS module; --sw-* are canvas aliases only
```

### Events rework — DEVOCS-219

**Three final concepts** are under comparison, and no further consolidation is planned:
`events-swimlanes`, `events-spacex` and `events-manifest`. All three keep their routes as they are.

Two earlier Events proposals were **removed** to keep the branch light — `events-calendar-grid`
(a consolidation attempt that was not taken forward) and `events-log-v3` (mission tiles + side
panel). Both are recoverable from git history; `events-log-v3` was committed work, the other was
never committed.

A kanban board grouped by event status was asked for and is **not built**: the Events feed has no
lifecycle status field, so Active / Scheduled / Resolved cannot be populated without inventing one.
The reading of the data model is in
[`design/events-kanban-data-gap.md`](../events-kanban-data-gap.md).

Wherever a view shows an "N active" badge, it means **datatake completeness still degraded, lost or
in progress** — derived from completeness, not read from a status field. The single definition is
`ACTIVE_DEFINITION` in `data/events-mock.ts`, and every page that shows the badge prints it.

**Day markers in `events-manifest` are event-type icons**, not dots: one mark per event, drawn with
the glyph its type carries in the filter pills and in the drawer rows, so the same event reads
identically in all three places. They stay uncoloured — this page spends colour on completeness
only, and the pills draw the same glyphs in the accent rather than in five hues, so shape carries
type and the stripe under the cell carries loss. A day with more events than the cell can draw
summarises the tail as "+n"; the cell's `aria-label` still names every event and every type, so the
visual cap hides nothing from a screen reader. `MARKS_SHOWN` in `EventsManifest.tsx` is the cap.

The same proposal also exists in the Next.js frontend at
`frontend/app/examples/events/` — see `frontend/README.md`. `mock.ts` is byte-identical between
the two; the page differs only in routing (`react-router` vs `next/link`), the `"use client"`
directive and nav-aware geometry. Edit both, or neither.

`App.tsx` is the source of truth for routing — if the table above and `App.tsx` ever disagree,
`App.tsx` is right.

## Image credits (module scroller)

Module imagery lives in `public/assets/img/modules/` (self-contained, no hotlinks):

| Module | Image | Source / licence |
|---|---|---|
| Acquisitions Status | Earth at night from orbit | Unsplash (free licence) |
| Events | Svalbard Satellite Station — Copernicus Sentinel ground segment | Wikimedia Commons, ESA · CC BY-SA |
| Data Availability | Earth from space | Unsplash (free licence) |
| Processors | Data-centre server racks | Unsplash (free licence) |

These are placeholders for the mockup. For production, prefer official ESA/Copernicus
mission imagery with proper attribution.

### Proposal header art

The ESA/Copernicus images in the same folder are used as header backdrops on the concept pages,
one per page, via the shared `.ex-hero-bg` recipe in `styles/global.css`:

| Page | Image |
|---|---|
| `/examples/events-manifest` | `Tibetan_Plateau.jpg` |
| `/examples/events-swimlanes` | `Earth_rainforests.jpg` |
| `/examples/events-spacex` | `Ice_Greenland.jpg` |
| `/examples/data-availability` | `Tierra_Fuego_S1D.jpg` |
| `/examples/data-availability-spacex` | `FLEX_Sentinel-3.jpg` |
| `/examples/coverage-timeline` | `Protecting_Atlantic.jpg` |

The pairing is arbitrary — assigned by a shuffle, not by subject — so treat any of it as swappable.
`Earth_Australia.jpg`, `Earth_Crater.jpg` and `Earth_Moon.jpg` are unused and available.

Two notes for whoever takes these to production. `Protecting_areas_of_the_Atlantic_Ocean_from_
human_activity(2).jpg` is byte-identical to `Protecting_Atlantic.jpg` (same MD5) and can be
deleted; its parentheses would also need URL-encoding in CSS. And these files are unoptimised —
`Earth_rainforests.jpg` is 1.3 MB and `Protecting_Atlantic.jpg` 3000×4400 — so they want resizing
and re-compressing before this is anything but a mock-up. Each still needs its individual ESA
credit line recorded here.

## Design tokens

Every color is a semantic CSS variable (`--bg`, `--text`, `--accent`, `--ok`/`--warn`/`--crit`…).
Components never hard-code color, so both themes stay consistent and new themes are cheap to add.
