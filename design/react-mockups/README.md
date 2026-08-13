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
| `/examples/events-log` | Events — the month as a chronological operations log | `/events` | `pages/EventsLog.tsx` |
| `/examples/events-log-v3` | Events — mission manifest, **mission tiles + side panel**: each event a mission-coloured tile on its day, day detail in a panel beside the grid | `/events` | `pages/EventsLogV3.tsx` |
| `/examples/events-manifest` | Events — mission manifest, **filters + day drawer**: one neutral dot per event, mission / satellite / type / search filters, day detail in an overlay Day Manifest drawer | `/events` | `pages/events-manifest/EventsManifest.tsx` |
| `/examples/acquisitions-globe` | Acquisitions — demand-driven globe (footprints, keyboard operation, sensing marks) + a "what changed" summary | `/acquisitions` | `pages/AcquisitionsGlobe.tsx` |
| `/examples/data-availability` | Data Availability — three donuts describing the current filter selection, over a sortable datatake table | `/availability` | `pages/DataAvailability.tsx` |

`/about` and `/examples/about` are cross-linked in both directions and render the same canonical
text from `src/data/about.ts` — they differ only in presentation.

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
  styles/events-log.css        /examples/events-log
  styles/events-log-v3.css     /examples/events-log-v3
  styles/data-availability.css /examples/data-availability
  data/mock.ts           Static mock data mirroring the real domain shapes
  data/about.ts          Canonical About copy, shared by both About layouts
  data/land.ts           Natural Earth 110m land outlines, drawn as globe coastlines
  components/            Nav, Footer, ThemeToggle, Partners, EventIcon, FeatureCard,
                         FilterBar, AcquisitionGlobe, shared UI (Reveal, Pill, PageHeader)
  pages/                 One file per route (IndexExamples.tsx holds four)
  pages/events-manifest/ The one proposal kept in its own folder, because it is the only page
                         that ships with its own data + stylesheet rather than reusing
                         data/mock.ts and a file under styles/:
                           EventsManifest.tsx      the page — filters, grid, Day Manifest drawer
                           mock.ts                 August 2026 events + the pure helpers
                           manifest.module.css     a CSS module, so its class names cannot
                                                   collide with global.css
```

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

## Design tokens

Every color is a semantic CSS variable (`--bg`, `--text`, `--accent`, `--ok`/`--warn`/`--crit`…).
Components never hard-code color, so both themes stay consistent and new themes are cheap to add.
