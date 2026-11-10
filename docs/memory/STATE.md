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
  460/460 tests pass. Lint + build clean (both routes PPR ◐).
- **Acquisitions — Slice 4 done (2026-11-10, branch `feature/DEVOCS-219-acquisitions`):**
  Filter toolbar + KPI row wired to URL state.
  `AcquisitionsGlobe.tsx`: `useSearchParams` + `parseAcqView` → `view`; three-tier filter cascade
  (`satFilteredDatatakes` → `satDayDatatakes` → `filteredDatatakes`; `dropdownDatatakes` = sat+day+search);
  KPI row (`kpiStats`); toolbar with Satellite / Day / Datatake dropdowns and Search; all 49 px tall;
  in-flow class-driven animation (`.fdropOpen` → `grid-template-rows: 1fr` + `visibility: visible`);
  navigate via `history.pushState`; Monday-first calendar (`leadBlanks=(dow+6)%7`), only days with
  datatakes are `<button>`; stale params treated as absent, never URL-replaced from effect;
  visibility effect `[scene, prepared, filteredDatatakes, ...]` toggles `.visible` on
  `footprintMeshesRef` without rebuilding geometry; `filteredUnitsRef` hides satellite dots/trails
  in the rAF loop; single document Escape handler (no canvas Escape); outside-click handler.
  acq-globe.module.css: KPIs, toolbar, dropdowns, calendar, search + responsive breakpoints.
  460/460 tests pass. Lint + build clean (both routes PPR ◐).
- **Acquisitions — Slice 5 done (2026-11-10, branch `feature/DEVOCS-219-acquisitions`):**
  Datatake detail panel + selection flow.
  New: `DatatakePanel.tsx` (eyebrow, ID, pill, completeness KPI, sensing/missing, 15 record rows).
  `AcquisitionsGlobe.tsx`: selection = `?datatake=` URL param via `navigateRef`; `displayedDtk` with
  460 ms fade-out; stable refs (`navigateRef`, `urlViewRef`, `filteredDatatakesRef`) synced via
  `useLayoutEffect` (placed before keyboard effect in source order, React Compiler compliant); extended
  document keydown (`[`/`]` cycle, `Enter` play/pause, `Escape` chain); fly-to with
  out-first zoom when switching while zoom > 1.6; `fitZoom`+`geoDistRad` helpers; globe picking via
  `THREE.Raycaster` in `onPointerUp`; `⌖` deselects when selected; footprint pulse in rAF (0.34–0.52
  selected, 0.14 others when any selected, 0.24 default); selected satellite: white dot + 70% trail +
  dashed `aheadTrail`; outline opacity corrected to 1.0; trail corrected to white.
  acq-globe.module.css: `.sideCol` (820 ms cubic-bezier expand), `.dtkRail`, `.dtkBlock` + `@keyframes
  acqIn`, panel typography + record rows; < 980 px panel drops below globe; reduced-motion.
  460/460 tests pass. Lint + build clean (both routes PPR ◐).
- **Acquisitions — Slice 7 done (2026-11-10, branch `feature/DEVOCS-219-acquisitions`): ready for PR.**
  `mock-data.ts` deleted. `stations.ts` added with the 5 real Copernicus ground stations. `data.ts` returns empty stub `{ datatakes: [], stations: COPERNICUS_STATIONS }`. Both page components simplified (no `resolveMockTimes`, no early-return). `AcquisitionsGlobe.tsx`: `simDayMs2` duplicate removed; `navigate` function removed (all 6 inline call sites now use `navigateRef.current`); empty-state message shown when datatakes empty. 468/468 tests. ESLint + tsc + build clean (both routes PPR ◐).
- **Acquisitions — Session 6b: Slice 6 audit fixes (2026-11-10, branch `feature/DEVOCS-219-acquisitions`):**
  F1 `kpiStats`: `acquiredPct` now counts `status !== "Failed"` (not `comp !== 0`); `failedCount`
  stays `comp === 0`. 468/468 tests (8 new kpiStats tests added).
  F2 `handleReady`: `console.warn` → `log.warn` via `logger("acquisitions-globe")` from `@/lib/log`.
  F3 reduced-motion: `.fdropBody` and `.fdropInner` added to the block.
  F4 panel KPI layout: `.dtkKpi` horizontal (flex baseline, gap 22px); `.dtkAside` inside `.dtkKpi`;
  note below as `<p>`. F5 record rows: 15 rows matching the mock-up, "NA" for missing fields.
  F6 close button: SVG X icon, `border: 0; background: none`.
  F7 simbar: span shows `YYYY-MM-DD HH:MM:SSZ`; `<small>SIMULATION TIME</small>` (static).
  F8 station Three.js: cap/ring/link all `0x00e5ff`; cap opacity 0.06, ring 0.28, link 0.75
  dashSize 0.006 gapSize 0.006. F9 `.acqRecord > div:last-child` bottom border. F10 `.dtkId`
  font-size `clamp(25px, 2.6vw, 36px)`. F11 scrub track 5px white thumb.
  ESLint disables at AcquisitionsGlobe.tsx:427 and :1172-1178 confirmed real — kept in place.
  Slice 7 items noted below in HANDOFF.md. 468/468 tests. Lint + build clean (both routes PPR ◐).
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
