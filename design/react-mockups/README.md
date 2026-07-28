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
  Product Timeliness, Publication Statistics, Data Archive, Space Segment, Data Access, News,
  Terms & Conditions, Cookie Notice.
- Client copy is taken verbatim from the current SentiBoard templates.

## Run

```bash
cd design/react-mockups
npm install
npm run dev          # http://localhost:5180
```

### Proposals with more than one option

Some pages exist as competing layouts. These are the routes that are **not** reachable from the nav:

| Route | What it is |
| --- | --- |
| `/about` | About — layout A, page-header led |
| `/examples/about` | About — layout B, hero led (cross-linked with A) |
| `/examples` | index-page proposals, with cards for the three below |
| `/examples/fleet` | index A — ticker over video + fleet |
| `/examples/gallery` | index B — console + linkable gallery |
| `/examples/reveal` | index C — editorial + reveal |

The two About layouts render the same canonical text from `src/data/about.ts` — they differ only in
presentation. The real `/` Home page is untouched by the index proposals.

## Structure

```
src/
  theme.tsx              Theme provider + toggle (dark default, persisted)
  styles/tokens.css      Dark + light design tokens (semantic vars)
  styles/global.css      Component styles (nav, hero, cards, table, calendar, timeline…)
  data/mock.ts           Static mock data mirroring the real domain shapes
  components/            Nav, Footer, ThemeToggle, shared UI (Reveal, Pill, PageHeader)
  pages/                 One file per route
```

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
