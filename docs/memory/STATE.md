# State

Last updated: 2026-11-09 (branch `feature/DEVOCS-219-acquisitions`).

## Frontend (`sentiboard-frontend/`)

- Scaffolded with `create-next-app` 16.4.2: Next.js 16.4.2 (App Router, Turbopack, Cache Components
  and Partial Prefetching on), React 19.3.0, TypeScript 5.9, ESLint 9, pnpm 12.14.0 (via corepack).
- **First vertical slice ported** from the Vite prototype (`~/work/SentiBoard/design/react-mockups`):
  - App shell: nav, footer, dark/light theme without a flash, Noto Sans via `next/font/local`, the
    prototype's global styles (verbatim).
  - Processors page at `/processors` with real backend data — see [features/processors.md](features/processors.md).
  - Legacy `/processors-viewer.html` and `/processors-viewer` redirect there with 308.
  - `sitemap.xml` (ported pages only), `robots.txt` (disallow-all unless `ALLOW_INDEXING=true`).
- **Second vertical slice ported** (2026-10-22, branch `feature/DEVOCS-219-events`):
  - Events & Anomalies page at `/events` with real backend data — see [features/events.md](features/events.md).
  - Legacy `/events.html` redirects there with 308.
- **Third vertical slice ported** (2026-10-27, branch `feature/DEVOCS-219-home`):
  - Home page at `/` — hero video, module panels, FAQ, live news bar — see [features/home.md](features/home.md).
  - Legacy `/index.html` and `/index` redirect there with 308.
- Remaining pages (acquisitions ×2, terms, cookie notice) are
  "coming soon" placeholders (noindex, not in the sitemap).
- **Acquisitions — Slice 2 done (Session 2, 2026-11-09, branch `feature/DEVOCS-219-acquisitions`):**
  Globe engine: `ThreeEarth.tsx` (paused prop + forceContextLoss), `dayNightEarth.ts`,
  `stylizedEarth.ts`, `land.ts`, `AcquisitionsGlobe.tsx` (both looks, zoom controls, drag/wheel/key
  interaction, IntersectionObserver off-screen pause, useSyncExternalStore ⌘/Ctrl label).
  Earth textures in `public/assets/globe/`. Both routes now render the globe client-side via
  `next/dynamic({ ssr: false })`. 418 tests pass. Build clean.
- **Acquisitions — Slice 3 done + Session 4 bug fixes (2026-11-10, branch `feature/DEVOCS-219-acquisitions`):**
  Datatake overlays + simulation clock (Session 3), then four visual bug fixes (Session 4).
  New files: `acqGeometry.ts` (orbital mechanics + `buildFootprintFill` + `FILL_R`/`OUTLINE_R`),
  `acqGeometry.test.ts` (460 tests total: 24 geometry + 18 fill-mesh across 3 swath sizes).
  `AcquisitionsGlobe.tsx`: simbar, overlay badges (DOM-ref driven), footprint fills via
  `buildFootprintFill` (quad-strip, slerp for > 500 km, indexed BufferGeometry, renderOrder
  14+idx/18+idx), `THREE.Line` outline at OUTLINE_R, `SpaceBackdrop page={-1}`.
  `mock-data.ts`: `getMockData` returns raw `RawAcqSpec[]`; `resolveMockTimes(specs, nowMs, dayMs)`
  resolves offsets against NOW and filters `minutesFromMidnight >= 0`. Both page components
  (`acquisitions-globe-earth`, `acquisitions-globe`) call `resolveMockTimes` after `connection()`
  then `adaptAcquisitions`. `data.ts` returns `{ rawSpecs, stations }` (not adapted).
  acq-globe.module.css: simbar, .overlayBadges, badge classes.
  460/460 tests pass. Lint + build clean (both routes PPR ◐). Session 5 (filter toolbar, KPIs, dropdowns) next.
- Verified on 2026-10-21: `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm build` pass;
  `pnpm dev` and `pnpm start` serve the pages; behaviour checks listed in the feature file.
- Automated tests: `pnpm test` (Vitest, 418 tests as of 2026-11-09), runnable with no backend and no network.
- **Observability (2026-11-04):** structured JSON server logs (`src/lib/log.ts`), `onRequestError`
  logging, opt-in OpenTelemetry traces + Node runtime metrics over OTLP
  (`src/instrumentation*.ts`). Fixed a jsdom memory leak in the release-notes sanitizer that
  crashed the deployed container (DECISIONS.md 2026-11-04).

## Backend (`sentiboard-backend/`)

- Not in this repo yet (`sentiboard-backend/` holds only an empty `.gitignore`). A FastAPI backend runs
  separately at `http://localhost:8000`; its contract is committed at
  `sentiboard-frontend/api/openapi.json` (matched the live `/openapi.json` on 2026-10-21).

## Memory tooling

- `pnpm memory:check` does **not** exist: there is no root `package.json` (see HANDOFF.md).
