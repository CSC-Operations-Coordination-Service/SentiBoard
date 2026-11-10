# Handoff

Open work and known issues, newest first. Remove an item when it is resolved.

## Acquisitions — Slice 7: mock data removed, ready for PR (2026-11-10, branch `feature/DEVOCS-219-acquisitions`)

Deleted: `src/features/acquisitions/mock-data.ts`.

Updated files:
- `src/features/acquisitions/stations.ts` — new; `COPERNICUS_STATIONS: Station[]` with the 5 real fixed positions (values from prototype mock-up `AcquisitionsGlobeEarth.tsx` STATIONS constant)
- `src/features/acquisitions/data.ts` — `getAcquisitions(dayKey)` now returns `{ datatakes: [], stations: COPERNICUS_STATIONS }` with a TODO for the real endpoint
- `src/app/acquisitions-globe-earth/page.tsx` — removed `resolveMockTimes`, `dayMs`, early-return; always adapts and renders `AcquisitionsGlobe`
- `src/app/acquisitions-globe/page.tsx` — same
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — removed `simDayMs2` duplicate (uses `simDayMs`); replaced 6 inline `navigate(...)` calls with `navigateRef.current(...)`; deleted the `navigate` function; added `<p className={s.empty}>Acquisition data is not available yet.</p>` between toolbar and globe when `data.datatakes.length === 0`

ESLint: 0 errors, 0 warnings. `tsc --noEmit`, 468/468 tests, `pnpm build` clean (both routes PPR ◐).

**What to check in the browser:**
- `/acquisitions-globe-earth` loads; globe shows with 5 station markers and sim clock running; KPIs show 0 / "—"; toolbar renders (all dropdowns empty); empty-state message "Acquisition data is not available yet." appears between toolbar and globe.
- `/acquisitions-globe` same with stylised planet.
- No console errors.

---

### Backend endpoint contract (for the backend team)

`getAcquisitions(dayKey)` in `src/features/acquisitions/data.ts` is the stub to replace. `dayKey` is a date string `YYYY-MM-DD` (UTC). The page needs:

**Per datatake** (fields of `RawAcqDatatake`, which is `AcqDatatake` without `comp`/`cls` — those are derived by the adapter):

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Unique datatake identifier |
| `sat` | `string` | Full satellite name, e.g. `"Sentinel-2A"` |
| `unit` | `string` | Short unit code, e.g. `"S2A"` |
| `station` | `string` | Downlink station name |
| `lat` | `number` | Footprint centre latitude (degrees) |
| `lon` | `number` | Footprint centre longitude (degrees) |
| `swathKm` | `number` | Swath width in km (used for footprint geometry) |
| `periodMin` | `number` | Orbital period in minutes (used for trail and ahead-track) |
| `startIso` | `string` | Sensing start time, ISO 8601 UTC |
| `sensingS` | `number` | Sensing duration in seconds |
| `status` | `string` | `"Published"` \| `"Processing"` \| `"Failed"` |
| `mode` | `string` | Instrument mode label, e.g. `"IW · DV"` |
| `absOrbit` | `string` | Absolute orbit number (zero-padded string) |
| `levels` | `AcqLevel[]` | Product types with pct per level (drives `comp`/`cls` in adapter) |
| `kmlLink` | `{ url: string; filename: string }` *(optional)* | Acquisition plan KML download |

**Ground stations** are real fixed positions committed in `src/features/acquisitions/stations.ts` — the backend does not need to serve them.

**Open decision — datatakes with a future `startIso`:** the stub returns no datatakes so this doesn't arise now. When the real endpoint exists, decide whether datatakes whose `startIso` is ahead of wall-clock time during `dayKey` should be hidden, labelled "PLANNED", or shown as-is. All mock datatakes started in the past; the UI does not currently handle future-start datatakes.

---

## Acquisitions — Session 6b: Slice 6 audit fixes (2026-11-10, branch `feature/DEVOCS-219-acquisitions`)

Updated files:
- `src/features/acquisitions/model.ts` — `kpiStats`: `acquiredPct` now counts `status !== "Failed"`; `failedCount` stays `comp === 0`
- `src/features/acquisitions/model.test.ts` — 8 new kpiStats tests (468 total); covers Failed-with-comp-gt-0
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — F2: `log.warn` via `logger("acquisitions-globe")`; F7: simbar span = `YYYY-MM-DD HH:MM:SSZ`, `<small>SIMULATION TIME</small>`; F8: station cap/ring/link all `0x00e5ff` (cap 0.06, ring 0.28, link 0.75 dashSize 0.006 gapSize 0.006); removed `fillColour` helper and its CSS-root setup (now unused)
- `src/features/acquisitions/DatatakePanel.tsx` — F4: KPI horizontal (big % beside sensing/missing); F5: 15 record rows matching mock-up (`noZone`, `isoPlus`, mode/pol parse, station-code lookup, "NA" for missing); F6: SVG close button
- `src/features/acquisitions/acq-globe.module.css` — F3: `.fdropBody`/`.fdropInner` in reduced-motion block; F4: `.dtkKpi` horizontal, `.dtkAside` flex-column, `.dtkNote` added; F6: `.acqClose` border 0 background none; F9: `.acqRecord > div:last-child` bottom border; F10: `.dtkId` `clamp(25px, 2.6vw, 36px)`, line-height 0.95, uppercase; F11: scrub track 5px `#00e5ff`, thumb 11px white box-shadow

ESLint: 0 errors, 0 warnings. `tsc --noEmit`, 468/468 tests, `pnpm build` clean (both routes PPR ◐).

**ESLint disable comments confirmed real (kept in place):**
- `AcquisitionsGlobe.tsx:427` — `set-state-in-effect`: `setDisplayedDtk` inside a `useEffect` (the timer-delayed unmount path). Lint flags it without the comment.
- `AcquisitionsGlobe.tsx:1172-1178` — `react-hooks/immutability`: `.visible` mutations on Three.js mesh refs inside a `useEffect`. Lint flags it without the comment.

**Prototype ref (acquisitions):** `~/work/SentiBoard/design/react-mockups/docs/acquisitions-prototype-ref.md`

---

## Acquisitions — Session 6: datatake detail panel (2026-11-10, branch `feature/DEVOCS-219-acquisitions`)

New files:
- `src/features/acquisitions/DatatakePanel.tsx` — panel component (eyebrow, ID, satellite, status pill with glow, close button, completeness KPI, sensing/missing, 15 record rows after 6b fixes)

Updated files:
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — selection via `?datatake=` URL param; `displayedDtk` state with 500 ms fade-out delay; `navigateRef`, `urlViewRef`, `filteredDatatakesRef` stable refs (render-body assignment); `selectedDtkIdRef`, `selectedSatUnitRef`, `prevDtkIdRef`; extended document keydown handler (`[`/`]` cycle, `Enter` play/pause, `Escape` → close dropdown then deselect); fly-to `useEffect` with out-first (1.2) when switching while zoom > 1.6; `fitZoom` + `geoDistRad` helpers; globe picking via `THREE.Raycaster` in `onPointerUp`; `⌖` deselects when something is selected; footprint pulse + selected visuals in rAF; `aheadTrail` (`LineDashedMaterial`) shown for selected satellite; side column JSX (`hasSel`, `sideCol`, `dtkRail`)
- `src/features/acquisitions/acq-globe.module.css` — `.sideCol`, `.hasSel`, `.dtkRail`, `.dtkBlock`, `@keyframes acqIn`, `.eyebrow`, `.dtkHead`, `.acqHeadR`, `.pill`, `.acqClose`, `.dtkId`, `.mission`, `.dtkKpi`, `.big`, `.dtkAside`, `.gap`, `.acqRecord`; responsive (< 980 px panel drops below globe); reduced-motion

ESLint: 0 errors, 0 warnings. `tsc --noEmit`, 460/460 tests, `pnpm build` clean (both routes PPR ◐).

**Key implementation decisions (Session 6):**

- **Selection = URL `?datatake=`**: selecting calls `navigateRef.current({ ...view, datatake: id })` via globe pick or `]`/`[` keys; deselect sets `datatake: null`; this is the same filter the toolbar Datatake dropdown uses (Decision 5).
- **`navigateRef.current` / `urlViewRef.current` / `filteredDatatakesRef.current`** updated in `useLayoutEffect([view, filteredDatatakes])`, which runs synchronously after DOM mutations and before paint — no event handler can read a stale ref between render and the first frame.
- **`displayedDtk` delayed unmount**: a 500 ms `window.setTimeout` keeps the panel mounted during the CSS opacity fade-out. Re-select cancels the timer.
- **`fitZoom` without d3**: haversine `geoDistRad` replaces `d3.geoDistance`; formula `z = want / (baseR × sin(far))` where `want = 0.3 × min(W,H)`, `baseR = 0.39 × min(W,H)`, clamped `[1.4, 5]`.
- **Globe picking NDC correction**: `ndcY = -(py/H)×2 + 0.92` corrects for `setViewOffset(W, H, 0, 0.04×H, W, H)` so the ray origin is accurate.
- **Trail color changed to white**: changed from status hex to `0xffffff` at 0.28 opacity (matches prototype spec §7); selected satellite uses 0.70 opacity. This is a visual correction from Session 3's deviation from the prototype.
- **Outline opacity changed to 1.0**: matches prototype spec §7 (was 0.55).
- **`aheadTrail`** uses `THREE.LineDashedMaterial` (dashSize 0.025, gapSize 0.05). Needs `computeLineDistances()` after each position update.
- **`[`/`]` cycle**: sorts visible datatakes by `satGroupOf(sat)` then `id`; `-1` current index → `]` goes to index 0, `[` goes to last.
- **`Escape` chain**: close open dropdown first; if none open, deselect; this extends the existing single document handler (not a second one).

**Browser checks (Session 6):**

1. Load `/acquisitions-globe-earth`. Nothing selected on load, stageRow has no `.hasSel` class, side column invisible.
2. Click a footprint footprint — `?datatake=<id>` appears in URL; side column slides in (820 ms); panel fades in with 380 ms delay; panel shows datatake ID, satellite, status pill, completeness, sensing time, 6 record rows.
3. Deep link: `?datatake=<id>` — panel opens immediately with the correct datatake.
4. Click the selected footprint again → deselect; panel fades out; side column collapses; view flies back to HOME_VIEW.
5. Click empty globe → deselect.
6. `⌖` button: when something selected → deselect + fly to HOME_VIEW. When nothing selected → reset to HOME_VIEW (original behaviour).
7. Press `]` to cycle to next visible datatake. Globe flies to it (out-first if switching while zoomed in). Press `[` for previous.
8. Press `Enter` → toggles play/pause. Press `Escape` → closes dropdown if open, else deselects.
9. Navigate to `?datatake=DT001` then Back → URL and panel revert correctly.
10. Navigate to `?datatake=DT001`, then click another footprint → out-first zoom if currently zoomed in (zoom > 1.6).
11. Under `prefers-reduced-motion`: panel appears instantly; side column jumps; fly-to is instant.
12. At ≤ 980 px: side column drops below globe at full width.

---

## Acquisitions — Session 5: filter toolbar + KPIs (2026-11-10, branch `feature/DEVOCS-219-acquisitions`)

Updated files:
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — `useSearchParams` + `parseAcqView` → `view`; three-tier filter cascade (`satFilteredDatatakes` → `satDayDatatakes` → `filteredDatatakes`; `dropdownDatatakes` = sat + day + search); KPI row; toolbar with Satellite / Day / Datatake dropdowns and Search; visibility effect `[scene, prepared, filteredDatatakes, ...]` toggles `.visible` on `footprintMeshesRef` without rebuilding geometry; `filteredUnitsRef` hides satellite dots/trails in rAF; Escape closes open dropdown (single document handler, no canvas Escape — `0` already resets view); outside-click handler; `openDropdownRef` synced via `useEffect`
- `src/features/acquisitions/acq-globe.module.css` — KPI row, toolbar, in-flow dropdowns (`.fdropOpen` class-driven: `grid-template-rows: 1fr` + `visibility: visible; transition-delay: 0s`), calendar, search, responsive breakpoints

ESLint: 0 errors, 0 warnings. `tsc --noEmit`, 460/460 tests, `pnpm build` clean (both routes PPR ◐).

**Key implementation decisions:**

- **`navigate` uses `history.pushState`** (not `replaceState`), same as availability's Explorer. All filter changes push a new history entry so Back/Forward works.
- **Search query is never auto-cleared** (not on pick, not on dropdown close) — this matches the mock-up exactly (mock-up lines 1907–1919: `setSearchQuery` is only called in `onChange`; there is no clear-on-pick or clear-on-close).
- **In-flow dropdowns** (Decision 1): `.fdropOpen` class on the `.fdrop` element drives `grid-template-rows` animation on `.fdropBody` and reveals `.fdropInner` immediately (`transition-delay: 0s`). Closing delays `visibility: hidden` by 420 ms so the collapse animates before items disappear. No `inert`, no inline `style` for the grid rows.
- **Stale params treated as absent** (approval item 5): if the URL has e.g. `?satellite=S2A&day=2023-01-01`, `satDayDatatakes` returns `[]`, KPIs show 0/—, globe shows no footprints, and the URL is never replaced. Mock-up lines 674–692 have the same behaviour (no URL side-effects in the cascade).
- **`openDropdownRef`** updated in `useEffect([openDropdown])`, not during render (approval item 2).
- **Visibility effect** declared after geometry effect and uses `[scene, prepared, filteredDatatakes, view.satellite, view.datatake]`; when `scene` or `prepared` changes both effects run in declaration order (geometry first, visibility second), so `footprintMeshesRef.current` is populated before the visibility effect reads it (approval item 3).
- **`calMonth` initial value** from `nowMs` prop, not `new Date()` (approval item 4).
- **`react-hooks/immutability`** suppressed with `/* eslint-disable/enable react-hooks/immutability */` around the Three.js `.visible` mutations in the visibility effect — same pattern as the geometry effect's `exhaustive-deps` disable.

**What is NOT in Slice 5:**
- Datatake detail panel (open on pick, close on deselect, fly-to on open)
- Deselect with Escape (Slice 5; `0` already resets the view)
- Footprint pulse / selected-trail highlight

**Browser checks (compare vs mock-up):**
1. Load `/acquisitions-globe-earth`. KPI row with four figures appears above the globe. Date heading shows "9 – 10 November 2026".
2. Open Satellite dropdown → list expands in-flow, globe stays below; caption turns cyan. Pick "S2A" → URL gets `?satellite=S2A`, only S2 footprints visible, S1/S3 satellite dots hidden.
3. Open Day → calendar shows November 2026; only today (10) is a `<button>` with cyan dot; all other days are plain `<span>` (no click). Picking 10 adds `&day=2026-11-10`; heading changes to "10 November 2026".
4. Type in Search → Datatake dropdown opens. Enter picks the first visible item. URL gets `?…&datatake=<id>`. Globe shows only that footprint; KPIs count one datatake.
5. Press Escape → open dropdown closes. No globe reset. `0` key still resets the view.
6. Browser Back → URL reverts, filters and globe update without geometry rebuild.
7. Navigate to `?satellite=S2A&day=2023-01-01` → no redirect; KPIs show 0/—; URL unchanged.

---

## Acquisitions — Session 4: visual bug fixes (2026-11-10, branch `feature/DEVOCS-219-acquisitions`)

Fixed after first browser comparison against mock-up. All checks pass; ready to commit.

**Fixes applied:**

1. **Badge labels invisible** — the parent useEffect was reassigning `stationBadgeRefs.current` and `satBadgeRefs.current` to new null-filled arrays after React had already populated them via mount ref callbacks. Removed those two lines.

2. **Night-side terminator missing** — the globe was just showing daytime over Europe at 18:35 UTC; the day/night shader was working correctly. `findEarthMesh` found the sphere (confirmed with temporary diagnostic logging, now removed).

3. **No starfield** — added `<SpaceBackdrop page={-1} paused={!stageVisible} />` before the canvas wrapper. `stageVisible` is React state (safe during render). `prefers-reduced-motion` handled inside `SpaceBackdrop`'s own `turn` effect.

4. **Footprints hidden / notched** — fan triangulation from centroid produced flat triangles whose chord edges sag below the globe sphere. Replaced with quad-strip using `buildFootprintFill(fp, swathKm)` (new pure function in `acqGeometry.ts`): 24 row pairs from `left[]`/`right[]`, 6 slerp steps across-track for swathKm > 500. Fill at `FILL_R = 1.004`, outline at `OUTLINE_R = 1.005` via `THREE.Line` (ring already closes). `renderOrder 14+idx` (fill) / `18+idx` (outline). 18 new tests: vertex radius, chord-midpoint sag, vertex count by swath class, NaN/range.

5. **Mock data on wrong day** — `getMockData` was computing `startIso = dayStart − offsetS` (yesterday). Restructured: `getMockData` now returns raw `RawAcqSpec[]` (pure, cacheable); `resolveMockTimes(specs, nowMs, dayMs)` in `mock-data.ts` computes `startIso = nowMs − offsetS` and filters `minutesFromMidnight >= 0`. Both page components call it after `connection()`. Trail "long lines" bug was a symptom of this — resolved.

Updated files:
- `src/features/acquisitions/acqGeometry.ts` — added `FILL_R`, `OUTLINE_R`, `geoToXyz`, `buildFootprintFill`
- `src/features/acquisitions/acqGeometry.test.ts` — 18 new `buildFootprintFill` tests (460 total)
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — badge ref reset removed; SpaceBackdrop added; footprint section rewritten; `THREE.Line`+`OUTLINE_R`+renderOrder
- `src/features/acquisitions/mock-data.ts` — `RawAcqSpec` exported; `getMockData` returns raw; `resolveMockTimes` added
- `src/features/acquisitions/data.ts` — `getAcquisitions` returns `{ rawSpecs, stations }`
- `src/app/acquisitions-globe-earth/page.tsx` — calls `resolveMockTimes` + `adaptAcquisitions`
- `src/app/acquisitions-globe/page.tsx` — same
- `docs/memory/features/acquisitions-plan.md` — Data section updated

ESLint: 0 errors, 0 warnings. `tsc --noEmit`, 460/460 tests, `pnpm build` clean.

**Browser checks for Session 4 (compare vs mock-up at port 5180):**
1. Station and satellite labels appear next to their markers in both looks.
2. At any time outside ~06:00–18:00 UTC over Europe, the terminator and city lights are visible.
3. Starfield (SpaceBackdrop) shows behind the globe in both looks.
4. Footprint fills are fully visible — no notches or hidden regions. Wide swaths if tested stay on-sphere.
5. Trails are short arcs behind each satellite, not long lines crossing the globe.

## Acquisitions — Session 3: datatake overlays + simulation clock (2026-11-10, branch `feature/DEVOCS-219-acquisitions`)

New files:
- `src/features/acquisitions/acqGeometry.ts` — orbital mechanics (prepDatatake, subPoint, buildFootprint, dest, bearing); no browser deps; pure module
- `src/features/acquisitions/acqGeometry.test.ts` — 24 tests (minutesFromMidnight, prepDatatake, subPoint, dest, bearing, buildFootprint)

Updated files:
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — renamed `_scene`/`_data` stubs; added prepared+satUnits useMemos; parent useEffect building all 3D overlays; rAF loop extended for clock + satellite/station/overlay updates; simbar JSX; overlay badge JSX (DOM-ref driven)
- `src/features/acquisitions/acq-globe.module.css` — simbar, overlayBadges container, .stn/.sat badge classes

ESLint: 0 errors, 0 warnings. `tsc --noEmit`, 442/442 tests, `pnpm build` all clean.

**What is in Slice 3:**
- Footprint fills (fan-triangulated from centroid, opacity 0.24) and outlines (LineLoop), colour by `cls` (ok/warn/crit → `0x34d399`/`0xf5b544`/`0xff5c5c`)
- Satellite dot (SphereGeometry r=0.012) + trail (31 pts, 0.8 min spacing, opacity 0.28)
- Station cap (fan triangles at 22° threshold), ring (LineLoop), dashed contact links (LineDashedMaterial) per satellite
- Clock advances in rAF (dt capped 0.25 s × speed); opens at time-of-day of `nowMs`
- Satellite/station badge positions written via DOM refs in rAF — no React state per frame
- Scrub is uncontrolled (`defaultValue`); `--fill` CSS custom property set via DOM ref
- Off-screen pause (IntersectionObserver from Slice 2) skips clock + all overlay updates too

**Slice 5 hook-in points (not in code):**
- Selected datatake pulsing footprint: change fill opacity from 0.24 → 0.34–0.52 animated
- Selected satellite trail: opacity 0.28 → 0.70, plus dashed ahead-track line
- Fly-to on click: call `rotateTo(lon, lat, zoom)` from the datatake click handler
- Click-to-select on footprint mesh: `Raycaster` in `onPointerUp` (no drag moved) → `setSelectedId`
- For all of the above: add `selectedId` state; pass it into the rAF loop; rebuild meshes on selection change

**Known geometry edge case:**
Wide-swath footprints (swathKm > 500) are fan-triangulated the same as narrow ones. The mock-up used slerp subdivision across-track for those; this implementation uses simple `dest()` calls for each step edge, which is correct for Slice 3. If noticeable distortion appears at high zoom on S1 Extra-Wide (400 km), add slerp subdivision in Slice 5.

**Browser checks (compare vs mock-up dev server on port 5180):**
1. Open `/acquisitions-globe-earth` or `/acquisitions-globe`. Globe renders with footprint fills and outlines over the datatake area.
2. Each satellite shows a dot and a 31-point trail behind it.
3. Station markers appear. When a satellite is within 22° of a station, the dashed link is visible and the station badge gets the cyan ring + colour.
4. Simbar at bottom: play/pause button, HH:MM:SSZ updating, scrub moves, speed pill cycles ×1/×10/×60/×600.
5. Clock starts at today's time-of-day (matches `nowMs` time component, not midnight).
6. Scroll page until globe is off-screen: the simbar clock keeps advancing and the scrub moves, but the 3D positions, trails, links and overlay badges are not updated. When you scroll back, the globe jumps to the current sim time.
7. Drag/zoom/keyboard still work; wheel-hint appears without Ctrl/⌘.

## Acquisitions — Session 2: globe engine (2026-11-09, branch `feature/DEVOCS-219-acquisitions`)

New files:
- `src/features/acquisitions/ThreeEarth.tsx` — WebGLRenderer, stars/atmosphere, `paused` prop via `useLayoutEffect`-synced ref, `forceContextLoss()` after `renderer.dispose()` in cleanup
- `src/features/acquisitions/dayNightEarth.ts` — day/night shader material; textures via `asset()`
- `src/features/acquisitions/stylizedEarth.ts` — vector coastline/land/graticule shader material
- `src/features/acquisitions/land.ts` — Natural Earth 110m land outlines (verbatim copy)
- `src/features/acquisitions/AcquisitionsGlobe.tsx` — both looks, IntersectionObserver off-screen pause, `useSyncExternalStore` ⌘/Ctrl label, zoom buttons with `type="button"` + aria-labels, drag/arrow/+−/0/Ctrl+wheel, wheel-hint, `_scene` state for Slice 3
- `public/assets/globe/earth-day.jpg`, `public/assets/globe/earth-night.jpg` — equirectangular textures

Updated files:
- `src/features/acquisitions/acq-globe.module.css` — added Slice 2 classes (`.stageRow`, `.globeStage`, `.canvasWrap`, `.globeZoomed`, `.zoomCtl`, `.acqWheelHint`, responsive)
- `src/app/acquisitions-globe-earth/page.tsx` — wired `<AcquisitionsGlobe look="imagery" ...>`
- `src/app/acquisitions-globe/page.tsx` — wired `<AcquisitionsGlobe look="stylized" ...>`

ESLint: 0 errors, 2 expected warnings (`_data` and `_scene` are Slice 3 stubs). `tsc --noEmit`, 418/418 tests, `pnpm build` all clean. Both routes build as `◐` (PPR).

**Two render loops explained:** ThreeEarth runs the only `renderer.render(scene, camera)` call (once per rAF tick). The parent's separate rAF loop updates the camera position and atmosphere size; it does not call render directly. When the stage is off-screen, the IntersectionObserver sets `stageVisibleRef.current = false`, which: (a) makes ThreeEarth's animate loop skip `renderer.render()` via `pausedRef.current`, and (b) makes the parent's rAF loop skip applyView and atmosphere updates. Exactly one render per frame, skipped when off-screen.

**WebGL leak check:** navigate between `/acquisitions-globe` and `/acquisitions-globe-earth` about 20 times in `pnpm build && pnpm start`. Open the browser console. No "Too many active WebGL contexts" warning must appear. If it does, `forceContextLoss()` is not being called — check that cleanup order in ThreeEarth is `renderer.dispose()` then `renderer.forceContextLoss()`.

**Slice 3 hook-in points:**
- `const [_scene, setScene]` → rename to `scene`; add `useEffect(() => { if (!scene) return; buildOverlays(scene, ...); }, [scene])`
- `const _data` parameter → rename to `data`; pass to `buildOverlays`
- `simTimeRef.current` is currently frozen at mount time; Slice 3 (simulation bar) advances it

## Acquisitions — Session 1b: route shells (2026-11-09, branch `feature/DEVOCS-219-acquisitions`)

New files:
- `src/features/acquisitions/copy.ts` — SEO, ACQ_HERO_IMG, ACQ_TITLE, ACQ_SUBTITLE
- `src/features/acquisitions/acq-globe.module.css` — `.page` and `.empty` (Slice 2 extends)

Updated files:
- `src/app/acquisitions-globe-earth/page.tsx` — full route with metadata, Suspense, AcquisitionsContent
- `src/app/acquisitions-globe/page.tsx` — same; canonical → `/acquisitions-globe-earth`
- `sentiboard-frontend/next.config.ts` — 308 redirects for `/acquisitions-status.html` and `/acquisitions-status`
- `sentiboard-frontend/src/app/sitemap.ts` — LEGACY_HINTS for both acquisitions routes (daily, 0.9)

ESLint, `tsc --noEmit`, 418/418 tests, `pnpm build` all clean. Both routes show as `◐` (PPR).

- **`Date.now()` blocked by `react-hooks/purity` ESLint rule** in render context. Used `new Date()` instead (same semantics; matches `availability/page.tsx` pattern). Slice 2 uses `now.getTime()` to get `nowMs` for `AcquisitionsGlobe`.
- **Slice 7 — future-start datatakes:** Decide how datatakes with a `startIso` in the future (ahead of the current wall-clock time during dayKey) are shown when real data arrives: hidden, labelled "PLANNED", or shown as-is. All mock datatakes start in the past so this only matters for the real endpoint.
- **Next:** Session 1b is complete. Session 2 — globe engine (ThreeEarth, day/night and stylised Earth materials, zoom controls, cleanup).

## Acquisitions — Session 1a: data layer (2026-11-09, branch `feature/DEVOCS-219-acquisitions`)

New files:
- `src/lib/missions.ts` — shared MissionId, MISSION_ORDER, MISSION_DISPLAY, MISSION_ID_OF, SATELLITES_OF, ALL_SATELLITES, DAY_MS, fmtDate, fmtDateTime, kpiFmt
- `src/lib/url-params.ts` — shared ParamSource, reader(), parseOffSet()
- `src/features/acquisitions/types.ts` — AcqDatatake, AcqLevel, AcqProductType, Station, AcquisitionsData
- `src/features/acquisitions/mock-data.ts` — 11 raw specs (startOffsetS), getMockData(dayKey)
- `src/features/acquisitions/model.ts` — computeAcqWindow, meanCompleteness, missingSeconds, kpiStats
- `src/features/acquisitions/model.test.ts`
- `src/features/acquisitions/adapter.ts` — adaptAcquisitions(raw, dayKey): derives comp/cls
- `src/features/acquisitions/adapter.test.ts`
- `src/features/acquisitions/data.ts` — `"use cache"` getAcquisitions(dayKey)
- `src/features/acquisitions/url-state.ts` — parseAcqView, acqViewParams, acqViewHref, DEFAULT_ACQ_VIEW
- `src/features/acquisitions/url-state.test.ts`

Updated files:
- `src/features/availability/model.ts` — now imports+re-exports from @/lib/missions; keeps all availability-specific symbols
- `src/features/availability/url-state.ts` — now imports ParamSource/reader/parseOffSet from @/lib/url-params

ESLint, `tsc --noEmit`, 418/418 tests, `pnpm build` all clean.

- **mock-data.ts** holds the 11 mock-up datatakes as `startOffsetS` offsets (seconds before midnight of `dayKey`). Max offset = 74 520 s < 24 h → all startIso values are on the previous calendar day — always in the past.
- **Future datatakes:** any datatake whose startIso is ahead of the current wall-clock time during dayKey (none in mock data) would appear as a normal datatake in the globe; the UI does not hide future-start datatakes. If the real endpoint ever returns them, Slice 7 is the right time to decide on filtering.
- **Slice 7** must delete `mock-data.ts` and wire the real endpoint (name TBD with backend team, see data.ts TODO). Blocked on backend.
- **Next:** Session 1b — route pages `/acquisitions-globe-earth` and `/acquisitions-globe`, page.tsx pattern, `connection()` + `<Suspense>`, metadata and sitemap update.

## Data Availability — push without mock data, empty state (2026-11-09, branch `feature/DEVOCS-219-data-availability`)

Updated files: `src/features/availability/data.ts` (new), `src/features/availability/model.ts`,
`src/features/availability/model.test.ts`, `src/features/availability/copy.tsx`,
`src/features/availability/Explorer.tsx`, `src/app/availability/page.tsx`,
`src/features/availability/availability.module.css`.
Deleted: `src/features/availability/mock-data.ts`.
ESLint, `tsc --noEmit`, 369/369 tests, `pnpm build` all clean.

- **Decision (Anthony 2026-11-09):** push to develop without mock data; real endpoint comes in Session 5.
- **mock-data.ts removed.** `getDatatakes()` in `data.ts` returns `[]`. Page computes the window via
  `computeDataWindow(now)` exported from `model.ts` (3 new tests).
- **Empty state:** when `datatakes` is empty the strips area shows one message ("Datatake data is not
  available yet.") instead of four empty strips. KPIs show 0 / "—". Toolbar works normally.
- **`ported: false`** and `noindex` metadata unchanged.
- **Next:** Session 5 — implement `getDatatakes()` with the real `GET /datatake/` endpoint, remove the
  empty state. Requires backend endpoint and `api/openapi.json` update.

## Data Availability — Session 4 follow-ups: no-anim reload + extract DatatakeCard (2026-11-09, branch `feature/DEVOCS-219-data-availability`)

Updated files: `src/features/availability/Explorer.tsx`, new `src/features/availability/DatatakeCard.tsx`.
ESLint, `tsc --noEmit`, 366/366 tests, `pnpm build` all clean.

- **Reload with `?pick=`:** card now appears already open with no open animation. `cardItem`,
  `cardMission`, `cardPhase` are initialized via lazy `useState` initializers from `view.pick` and
  `lanes`. `cardPhase` initializes to `"swap"` (instant display) when a pick is in the URL.
  `prevPickRef` is seeded to `view.pick` so the pick-sync effect returns early on first render
  and does not re-trigger the already-open card.
- **Extraction:** `Ring` and `DatatakeCard` moved to `src/features/availability/DatatakeCard.tsx`
  (default export `DatatakeCard`, named export `type CardPhase`). Explorer imports from there.

## Data Availability — Session 4 datatake card (2026-11-09, branch `feature/DEVOCS-219-data-availability`)

Updated file: `src/features/availability/Explorer.tsx`.
ESLint, `tsc --noEmit`, 366/366 tests, `pnpm build` all clean.

- **What is in:** `DatatakeCard` component with height-grow open (560 ms), height-shrink close (560 ms),
  instant swap. `Ring` SVG component (viewBox 0 0 70 70, r 27, track rgba .14, arc in side colour, no
  draw-in animation). Metadata rows: Data take ID, Platform, Sensor mode, Start date, Stop date,
  Acquisition badge, Publication badge (Decision #2: sensor mode kept; Decision #3: brighter ink;
  Decision #4: Processing → grey ring / "—" / ACQUIRED badge). × button `aria-label="Close details"`;
  focus returns to the picked bar on close (from `barBtnRefs` map, restored in `onClosed` via rAF).
  Card opens driven by `?pick=` in the URL (reload or shared link shows it open). Closes on Escape,
  × button, clicking the same bar again, Reset, range/pager changes (all navigate to `pick: null`).
  Filter removal that hides the picked datatake: deferred `navigate({ pick: null })` via `setTimeout(0)`.
  Instant open/close under `prefers-reduced-motion`. `ported: false` and `noindex` unchanged.
- **Decisions recorded:** DECISIONS.md 2026-11-09 session 4 entry (#2, #3, #4); plan updated.
- **What is not in yet:** real data (Session 5).
- **Next:** Session 5 — real data wiring (requires backend datatake endpoint and `openapi.json` update).

## Data Availability — Session 3 strips, zoom, axis, tooltip (2026-11-09, branch `feature/DEVOCS-219-data-availability`)

Updated file: `src/features/availability/Explorer.tsx`.
ESLint, `tsc --noEmit`, 366/366 tests, `pnpm build` all clean.

- **What is in:** four mission bands (S1/S2/S3/S5P) with folded bars from `framesOf` and `barColor`.
  Entrance animation (900 ms stagger) on load, range change, Custom apply and Reset; `animation: none`
  on all other renders; suppressed by `prefers-reduced-motion` via CSS. Date axis per band with
  `axisTicks` ticks (5 intervals, 4 for ≤3-day windows; `DD/MM` or `DD/MM HH:00` for short windows;
  first/last ticks flush-aligned). "No datatakes in range" empty state.
- **Zoom:** clicking a bar stores its ID in `?pick=`, scales the row's `.track` to 1.9× from the
  bar's `offsetLeft`, fades all other bars (`.tileFaded`), hides the row's axis (`.axisHidden`).
  Click the same bar → zoom out. Escape also zooms out (dropdown closes first if open). Range change,
  Custom apply, Reset all pass `pick: null` and clear zoom. Origin persists per row in local state;
  falls back to `leftPct%` for reloads with pick in URL.
- **Tooltip:** single fixed `<div>` portal on `document.body` (created after mount). Populated on
  bar `mouseenter` and keyboard `focus`; hidden on `mouseleave`, `blur` and scroll. Content: ID,
  Acquisition %, Publication % (via `cardSides`), Start/Stop UTC HH:MM. Position: `clientX+18,
  clientY−h−14`; right-overflow flips to `clientX−w−18`; top-overflow drops to `clientY+20`.
- **Bar buttons:** `aria-label="<id> <status>"`. `tileSelected` ring on the picked bar.
- **Animation state management:** `animating` starts `true` from `useState`; mount effect schedules
  `setAnimating(false)` via `setTimeout` (not synchronously in the effect body — avoids the
  `react-hooks/set-state-in-effect` rule). `navigateWithAnim` sets `animating=true` in event
  handler context and restarts the 900 ms timer. No `animKey` state.
- **`ported: false`** and `noindex` metadata unchanged.
- **What is not in yet:** datatake card (Session 4).
- **Next:** Session 4 — datatake card (inline panel, two SVG rings, metadata table, height animation).

## Data Availability — Session 2 URL state, toolbar, KPIs, mock data (2026-11-09, branch `feature/DEVOCS-219-data-availability`)

New files: `src/features/availability/mock-data.ts`, `src/features/availability/model.ts`,
`src/features/availability/model.test.ts`, `src/features/availability/url-state.ts`,
`src/features/availability/url-state.test.ts`, `src/features/availability/Explorer.tsx`.
Updated: `src/app/availability/page.tsx` (uses Explorer inside `<Suspense>`),
`src/features/availability/availability.module.css` (added `fdropOpen` CSS visibility pattern).
ESLint, `tsc --noEmit`, 366/366 tests, `pnpm build` all clean.

Decisions recorded (see DECISIONS.md 2026-11-09): #1 coverage gaps = satellite-days with no datatake;
#7 URL params confirmed; #14 DELAYED → Processing for now.

- **What is in:** full toolbar (range heading, 1D/7D/30D/Custom buttons, pager ‹›, arrow keys, From/To,
  Mission + Status multi-toggle dropdowns, search, Reset) driven by URL with `history.pushState`; four
  KPIs computed live from mock data; `framesOf`, `axisTicks`, `barColor`, `cardSides`, `kpiStats` as
  pure functions with 70 tests.
- **Dropdown CSS visibility:** `fdropHead[aria-expanded="true"] ~ .fdropBody` selector drives
  `grid-template-rows` animation; `fdropInner` has `visibility: hidden` by default, revealed on open —
  no `inert` on server-rendered elements (avoids React 19 hydration mismatch).
- **Mock data:** `src/features/availability/mock-data.ts` generates 900 datatakes with the same seeded
  RNG and outage windows as the mockup's `mock.ts`. Temporary — replaced in Session 5.
- **URL state:** `src/features/availability/url-state.ts` follows the events/processors pattern;
  `pick` param reserved for the datatake card (Session 4).
- **`ported: false`** and `noindex` metadata unchanged.
- **What is not in yet:** strip bands (Session 3), datatake card and tooltip (Session 4).
- **Next:** Session 3 — strip bands with folded bars, zoom, axis, entrance animation.

## Frontend OOM fix, structured logs, OpenTelemetry (2026-11-04, branch `fix/frontend-oom-observability`)

Cause, fix and measurements: DECISIONS.md, same date. Tests 287, lint and `type-check` clean,
`next build` passes. Checked on the standalone build with a 256 MB heap, a mock backend (228
processor records built from the fixtures) and a local OTLP receiver: JSON log lines, traces and
runtime metrics exported, `traceparent` received by the backend, RSS flat over 600 requests.

- **Not verified:** the deployed container over hours (watch the heap metric or RSS after the
  rollout), and a background revalidation end to end (only measured on the sanitizer directly).
- **Platform side, not in this repo:**
  - set `OTEL_EXPORTER_OTLP_ENDPOINT` (and `OTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=…`)
    on the frontend service, pointing at an OTLP receiver (Alloy `otelcol.receiver.otlp` → Tempo for
    traces, Prometheus/Mimir for metrics). Whether such a receiver exists: `UNKNOWN`.
  - Alloy log pipeline: the Loki entries showed raw Docker JSON (`{"log":"\n",...}`) and one entry
    per line of a V8 crash dump. A `stage.docker {}` (or `loki.source.docker`), a `stage.json` +
    `stage.labels` on `level`/`logger`, and a `stage.multiline` would fix that. The app now emits
    one JSON line per record; Next's own banner lines stay plain text.
- **Console bridge (2026-11-05):** server-side `console.*` is JSON too (ARCHITECTURE.md,
  Observability). Browser `console.*` is not collected; a beacon route for browser errors would go
  with the Web Vitals work below.
- **Found while checking the bridge, not fixed:** in a production build the error a `get*()`
  wrapper catches from its `"use cache"` function is Next's sanitized "Server Components render"
  error (digest only), not the `ApiError`. So `err instanceof ApiError` is false and the degraded
  state is always `kind: "unknown"` ("Could not load"), never "Backend unreachable". Next logs the
  real `ApiError` itself (logger `console`, same `digest`). Unit tests do not see it: they call the
  function without Next's cache layer.
- **Not done:** browser Web Vitals (LCP/INP/CLS per page). Needs a beacon route on the frontend
  that turns them into OTel metrics; worth it once traces are flowing.
- **Backend:** instrumenting FastAPI with OpenTelemetry would join its spans to the frontend's
  traces (the header is already sent).

## Deployment settings: base path, OpenSearch TLS and startup (2026-10-27, branch `feat/deploy-config`)

Backend: `opensearch_config.py` (URL, basic auth, TLS verification, CA bundle), the startup rule and
`/healthz` / `/readyz` (see DECISIONS.md, same date). Frontend: `BASE_PATH` build argument,
`src/lib/asset.ts`. Backend tests 23, frontend tests 277, lint and `type-check` clean. Checked on
local images: the backend stays up with OpenSearch unreachable (`/healthz` 200, `/readyz` and data
routes 503), exits with code 3 on a TLS error, and every route of the frontend answers 200 under
`/sentiboard/frontend` with no URL outside it.

- **Not verified:** a run against a real OpenSearch (templates created, a read-only user refused),
  and a swarm rolling update with a failing new task. The TLS case used a self-signed fake server.
- **`.about-bg` in `src/styles/global.css`** uses `url("/assets/...")` in CSS, which Next cannot
  prefix. No component uses it yet. When the About page is ported, set the image from the component
  with `asset()` (an inline custom property) instead.
- **Frontend `HEALTHCHECK` in the Dockerfile** fetches `/`, which is a 404 under a base path. The
  check accepts anything below 500, so it still passes, but it no longer proves the app is serving
  its pages. A health route inside the base path would fix that.
- **CI** builds one frontend image for dev and prod with `BASE_PATH=/sentiboard/frontend`.

## Home — News bar wired to real data (2026-10-27)

`src/features/home/NewsBar.tsx` created; `src/app/page.tsx` now `async` and renders `<NewsBar>`.

- **`src/features/home/data.ts`:** `getInstantMessages()` — `fetchAll("/instantmessage/")`, `"use cache"`, `cacheLife({stale:300,revalidate:300,expire:3600})`, `cacheTag("instantmessages")`, `ApiError` degraded-state handling. Failed load → `ok:false`, empty `newsItems` passed to `NewsBar` (bar hidden).
- **`src/features/home/adapter.ts`:** `adaptInstantMessages()` — sorts by `publication_date` descending, excludes null-dated records (logged via `console.info`), formats date as `"D Mon YYYY"` and time as `"HH:MM"` in UTC. Exported type `InstantMessage { title, date, time }`.
- **`src/lib/utc-date.ts`:** shared UTC helpers extracted from `events/adapter.ts` (`utcDateStr`, `utcTimeStr`, `pad`) plus new `utcDayMonthYearStr("D Mon YYYY")`. Events adapter updated to import from here.
- **`src/features/home/adapter.test.ts`:** 7 tests — sorting, UTC formatting, month-boundary midnight, null date exclusion, empty input, shape of output.
- **`src/features/home/NewsBar.tsx`:** `"use client"`, bar + ticker + expandable list. CSS visibility (`.listOpen` class) instead of `inert` for the closed list. Double-rAF height animation (same pattern as events). Escape closes + returns focus. `aria-expanded`, `aria-controls="news-list"`. Ticker stops under `prefers-reduced-motion`. Empty `items` → `null` (bar not rendered).
- **`src/features/home/home.module.css`:** bar section added at the top. Bar styles (`.bar/.row/.news/.dot/.count/.chevron`), ticker (`.mask/.track/.item/.sep/.time`, `@keyframes tickerSlide`), list (`.list/.listOpen/.listRow/.listTime/.listText`, `@keyframes sbNewsIn`). Reduced-motion guards for ticker and list.
- **`src/app/page.tsx`:** `async`, awaits `getInstantMessages()`, passes `newsItems` to `<NewsBar>`.
- **`message_type` / `cls`:** `cls` in the mock-up `RtEvent` is **not used in any rendering logic** of the NewsBar (no cls-based className or style in mock-up `Home.tsx`). It does not drive styling. The UI model omits it. The backend `message_type` field has no enum in the OpenAPI schema or index template — actual values in the live index are UNKNOWN from static analysis. Verify with a live backend query when available.
- ESLint, `tsc --noEmit`, 273/273 tests (was 266), `pnpm build` all clean. `/` builds with `Revalidate 5m, Expire 1h`.

## Home — static page built (2026-10-27)

`src/features/home/` created; `src/app/page.tsx` replaced with the static home page.

- **Implemented ref sections:** §4 Hero, §5 Module panels, §6 Narrow screens (Decisions 9/15/22 — clamp padding, title wrap at ≤399 px), §7 FAQ.
- **Not implemented this session:** §2 News bar + §3 News list (next session).
- **`src/features/home/copy.tsx`:** `MODULES` (4 entries, `ReactNode` `long` fields with `<b>` JSX, `ROUTES` paths for `href`) and `FAQ_GROUPS` (6 groups, icon JSX, Q&A with `ReactNode` answers).
- **`src/features/home/home.module.css`:** hero, module panels (`.panelInner` replaces `.px-panel-inner`; global `.px-panel`, `.px-panel-bg`, `.px-panel-veil` reused), FAQ. No news bar styles.
- **`src/features/home/HeroVideo.tsx`:** `"use client"`, no `autoPlay` attribute, `useEffect` drives play/pause and respects `prefers-reduced-motion`; `change` listener syncs on OS setting change.
- **FAQ uses `<details>/<summary>`:** works without JS; no `inert` attribute on server-rendered elements; closed content hidden by native `<details>` behavior; open animation via CSS `.faqItem[open] .faqBody { animation: faqReveal 0.25s ease }`; chevron rotated via `.faqItem[open] .faqChev`.
- **`home.mp4` present:** committed in a008501 at `public/assets/mv/home.mp4`; `HeroVideo.tsx` src matches that path.
- ESLint, `tsc --noEmit`, 266/266 tests, `pnpm build` all clean. `/` builds as a static page (○).

## Home — groundwork laid (2026-10-27)

- `docs/design/home-prototype-ref.md` copied from the mock-up branch.
- `src/components/Reveal.tsx` extracted from `Explorer.tsx` (`"use client"`); Explorer now imports it from there. Behaviour unchanged.
- Six `--home-*` tokens added to `src/styles/tokens.css` (dark block, after `--pr-mis-5P`).
- `public/assets/img/modules/availability.jpg` and `events.jpg` copied from the mock-up branch. `events.jpg` SHA256 verified (`8a446d6c…`).
- `public/assets/mv/home.mp4` committed in a008501 (compressed by the repo owner).
- ESLint, tsc --noEmit, pnpm test (266/266), pnpm build all clean.

## CI — backend on maas-model 3.3.0 (2026-10-26)

- Both CI workflows (`.github/workflows/frontend-ci.yml`, `backend-ci.yml`) install every package
  through the Nexus proxies and push to Nexus. The backend image installs the wheel that
  `python-ci.yml` built, with its dependencies from the Nexus PyPI group.
- The backend needs maas-model 3.3.0 or later (`setup.cfg`: `>=3.3.0.dev0,<4`; `requirements.txt`
  the same). 3.3.0 is the first release with `schema_adapter.ApiList` and `list_documents(size=)`.
  The bound ends in `.dev0` on purpose: the dev index only holds develop builds
  (`3.3.0.post1.devN`), which pip skips as pre-releases unless the bound names one.
- Both workflows read their secrets from OpenBao (`secrets-source: openbao`, role `ci-sentiboard`,
  `ci-sentiboard-release` on a tag), not from GitHub secrets: the repository cannot rely on the
  organisation secrets (the Docker login got `Forbidden`). They run on `containerized` and grant
  `id-token: write`. Each job's `openbao-tools` lists every tool it reads (`nexus`, plus
  `sonarqube`, `dependency-track`, `dockerhub` where used); a tool left out is read from
  `ocs/ci/shared`, which the role cannot read.
- The roles were applied in prod on 2026-10-23 (see the platform repository's deploy runbook).
  Reported by the operator on 2026-10-26: the frontend and the backend pipelines are green on
  `develop`, so the login with `ci-sentiboard`, the Nexus installs and the SonarQube scans work, and
  SonarQube shows 30.1% coverage for the frontend. Not exercised yet: a tag build (the
  `ci-sentiboard-release` role, the prod values, the Docker Hub push), and what the dev image run
  looks like once deployed.
- The frontend CI runs `pnpm test:coverage` and a SonarQube scan (`run-sonarqube`, project key
  `sentiboard-frontend`, `sentiboard-frontend/sonar-project.properties`), through the catalog's
  `node-workflow.yml` (merged into the catalog's `develop` on 2026-10-26, PR #5). 151 tests; the
  low figure is because only four modules have tests.

## Frontend — still to port (2026-10-21)

- Shell, `/processors`, `/events` and `/` (home) are ported. Placeholders ("coming soon", noindex,
  not in the sitemap) remain for `/acquisitions-globe`, `/acquisitions-globe-earth`,
  `/availability`, `/terms-conditions`, `/cookie-notice`. Port each as its own vertical slice
  (AGENTS.md §7), from the prototype at `~/work/SentiBoard/design/react-mockups`. Their final URLs
  and legacy redirects are not decided yet: the placeholders use the prototype's paths; apply the
  308 rule in DECISIONS.md when each is ported (legacy URLs on `origin/main`, e.g.
  `/data-availability`, `/acquisitions-status.html`, `/newsList.html`).
- The Acquisitions pages need Three.js (`ThreeEarth`, `AcquisitionGlobe*`): load with
  `next/dynamic({ ssr: false })` from a client component, as the Processors timeline does.
- **`src/styles/global.css` was copied verbatim** from the prototype and contains the styles of
  **all** prototype pages (home, acquisitions, events, availability, about, examples…). Split it per
  page as the pages are ported, and delete what no page uses.
- Processors: mobile layouts not yet compared with the prototype. No component/browser tests:
  the timeline's scroll-linked reveal and the explorer UI were verified manually in Chrome (see
  features/processors.md); `pnpm test` covers the pure modules and data loading only.
- Test fixtures (`src/features/processors/__fixtures__/processor-records.ts`) are six real
  records captured on 2026-10-22; refresh them by id if the feed's note formats change.
- Adapter edge not handled: a record listing the **same IPF with two different versions**
  (`["S1_L0:1.0", "S1_L0:1.1"]`) would still give two releases with the same id. Not present in
  the feed on 2026-10-22; decide the intended meaning before handling it.

## Frontend — known issues (2026-10-21)

- **Payload doubled by Partial Prefetching.** With `partialPrefetching: true` (create-next-app
  default; the Next docs say to disable it only while migrating, and it becomes mandatory in the
  next major), the `/processors` HTML carries the page data twice: 759 KB raw / 130 KB gzip,
  versus 393 KB / 67 KB with it off (measured locally). Options if it matters: keep it off for now,
  or stop sending every release's notes up front (load the selected release's notes on demand).
- **Cold-cache latency.** The first `/processors` request of a fresh process takes ~7 s: fetch
  plus sanitizing 228 release notes with jsdom. Since 2026-11-04 the sanitizer memoizes by input, so
  later revalidations and cache expiries re-sanitize only new or changed notes. Warm requests
  ~45 ms. The default cache handler is in-memory per process.
- Backend failures render the degraded state with **HTTP 200** (the response cannot change status
  once rendering has started); search engines could index the degraded page during an outage.
- `pnpm memory:check` (AGENTS.md §0) **does not exist: there is no root `package.json`.** The repo
  owner needs to decide the root layout first (AGENTS.md §2: separate repos, submodules or one
  repo). Do not create a root `package.json` until then.

## Events — known issues (2026-10-23)

- **Filter redesign (2026-10-23 rev 2)**: Filters are now multi-select toggles (prototype style).
  URL model changed from `?category=&mission=&satellite=` to `?typesOff=&missionsOff=&satellitesOff=`;
  legacy URLs are converted on parse. Visual check needed: toggle items, "All"/"N/total" counter,
  month-on-own-line when dirty, dropdown z-index (no calendar click-through). 263 tests pass.

- **Visual check pending.** `pnpm lint`, `type-check`, `build` and 221/221 tests all pass. Still needs a
  visual comparison with the prototype in a browser (dark + light themes, mobile at 760 px
  breakpoint). Check: star dots render at correct scale and spacing; tooltip appears on hover;
  zoom shows type icons (.zicon fade-in); DayManifest shows all events expanded with impact dot
  colours; Description collapsible closed by default; datatake rows show right-column status.
- **Cross-month calendar placement fixed (2026-10-23).** `filterEvents` now uses `startDate`
  year/month instead of `months[]`. Events appear on their start month only. `resolveView`
  switches to `startDate` year/month (not `months[0]`). `viewParams` always includes `month`
  when `year` differs from `now` for stable deep links.
- **No-JS.** /events requires JavaScript (DECISIONS.md 2026-10-23). A `<noscript>` message is in
  the static shell. The calendar and drawer stream after `await connection()` via React flight
  scripts; they are not visible without JS.
- **Portal removed; drawer always in DOM.** The `createPortal(…, document.body)` block is gone.
  Open/close is toggled by the `drawerOn` CSS class; `aria-hidden` + `inert` prevent focus/read
  when closed.
- **SSR drawer.** `openDay` is initialised from `data.dayEvents[0].startDate` when events are
  pre-selected via `?event=<id>`. The server renders the drawer open.
- **Deep-link zoom.** A mount `useEffect` in Explorer calls `measureZoom` when
  `openDay !== null && zoom === null`, covering any month. Server renders without the stage (no
  hydration mismatch).
- **Drawer overflow fixed.** `overflow: hidden` on `.drawer`; `drawerBody` scrolls via
  `overflow-y: auto`.
- **`now` in both ExplorerData variants.** `nowYM()` is called once in `EventsContent` and passed
  as `now` on both ok and error variants; Explorer never calls `nowYM()` itself.

## Events — legacy parity, to do at the end

- Datatake list per event: in-place expand ("+N more" / "Show less", max 5 shown) is **done**
  (2026-10-23). Still missing: "View all N datatakes →" link to Data Availability filtered by
  the event (legacy: /data-availability?event_id=<key>). Needs the Availability page's final URL.
- Datatake IDs link to Data Availability (legacy: ?search=<id>&period=prev-quarter); events older
  than 3 months show plain IDs, no links, no "+N more" (Availability only holds the last quarter).
- S1 datatake IDs show the hex suffix: `S1D-38248 (9568)` = parseInt(id.substring(4)).toString(16).
- Legacy deep link /events.html?showDayEvents=DD/MM/YYYY (used by the home page) must open that day.
- Calendar date field: legacy uses occurrence date, then publication date. Confirm what the
  backend exposes; the drawer's day must use the same field.

## Events — backend observations (2026-10-23, live feed, read-only)

**Excluded category counts** (records excluded from the events page — not shown to users):

| Raw category       | Count  |
| ------------------ | ------ |
| Data access        | 10     |
| DD                 | 4      |
| Archive            | 3      |
| MP                 | 2      |
| **Total excluded** | **19** |

Shown types: Acquisition 2797, Production 603, Platform (→ Satellite) 147, Manoeuvre 102,
Calibration 37, Satellite 15. Total shown: 3701 of 3720.

**Records whose satellite resolves to a unit that did not exist on the event's start date:**

| id                                     | start      | impacted_satellite     | first datatake IDs |
| -------------------------------------- | ---------- | ---------------------- | ------------------ |
| `42a36f6a_3a6d_11f1_b2c4_0242ac110002` | 2025-01-01 | Copernicus Sentinel-1D | S1D-4964, S1D-3274 |

S1D launched Nov 2025; this record's start date (2025-01-01) predates the launch. A second
record (`6b1a7282_f5de_11f0_8414_0242ac110002`, start 2025-01-01, impacted_satellite S1A) also
carries an S1D datatake ID (S1D-10489), suggesting a data-entry error. No records with S1C
before Dec 2024 or S2C before Sep 2024 were found in the live feed. The S1D event on 5 Oct 2022
that was expected (noted in the task) does not appear in the current backend; the oldest S1D
record in the feed starts 2025-01-01.

## Backend — pending fixes (reported, not fixed in the backend)

From `~/work/SentiBoard/design/react-mockups/BACKEND-FINDINGS.md` and earlier findings on
`GET /processor/`:

- **500 on null arrays.** Fixed in code on `feat/hinted-templates-generated-schemas`: `target_ipfs`
  and `satellite_units` are `ApiList` (a null reads as `[]`), set by the `array` hint in the
  processor template. maas-model 3.3.0 has `ApiList` and is pinned in `requirements.txt`, so this
  is live once the backend is deployed. Then check that `GET /processor/` returns 200 for the records
  with null lists (`target_ipfs`: 5 records, `satellite_units`: 3 records).
  Checked 2026-11-05: the image `cscocs/sentiboard-backend:2.6.1` (Docker Hub) has maas-model
  3.3.0 (`pip show`), with `ApiList` and `list_documents(size=)`; the generated schemas, routers
  and documents in the repo match maas-model 3.3.0's generators exactly (fastapigen byte for
  byte, pygen apart from the date line). The live `GET /processor/` 200 is still not checked.
- **Literal `"undefined"` versions.** 3 `target_ipfs` values carry the literal `undefined` as the
  version (e.g. `S1_L1L2:undefined`). The adapter treats it as "no version" and falls back to
  `processing_baseline`. The backend developer is fixing it in the migration (`map_release`) on the backend branch (2026-10-22).
- **Version lists in `target_ipfs`.** Record `9b73c7d6_84f9_11f0_8061_0242ac110002` carries a whole
  comma-separated list as the version of each of its 8 targets
  (`S3_OL1:SL1_06.23, OL1_06.19, OL1_RAC_06.17, …`), so those lanes show that list as the baseline
  label (seen 2026-10-22). Each target should carry only its own version (e.g. `S3_OL1:06.19`).
- **Records with no lane.** 2 records have an empty `target_ipfs` and cannot be placed on any
  processor lane; the frontend leaves them out and logs them (seen on 2026-10-21:
  `20700768_e60b_11ee_8ac6_0242ac180002`, `90f0ecc4_6a51_11f1_8bd2_0242ac110002`).
- **Template placeholders in release notes.** 3 Sentinel-3 records still contain `TBD` (2 also
  `Sentinel-n`) and are shown as-is on the public page; one is the current S3 OL1 06.20 / SL1 06.25
  baseline. Ids: `15cc6ca8_b04c_11f1_953a_0242ac110002`, `580963b4_2e97_11f1_a77e_0242ac110002`,
  `65d6a656_2e96_11f1_a9f7_0242ac110002`. Suggested: fill them in; reject or flag `TBD` /
  `Sentinel-n` when notes are written.
- **List endpoints** have no filters, no sorting and no total count; the frontend reads whole lists
  in pages of 1000.
- **Anomaly migration** (resolved 2026-10-22): 3895 rows → 3720 documents = 171 merged duplicate
  pairs (old PDGSANOM-/GSANOM- key rename; completeness and news links kept, nothing lost) + 4
  hidden Dashboard anomalies excluded. The Postgres dump from the Config Tool is not needed for now.
- **Fake datatake IDs in anomaly feed.** ~630 records have ~2085 IDs that are tokenised free text
  ("No", "impact", "on", "acquired", …). Filtered client-side with `isRealDatatakeId = /^S\d/.test`.
  The backend should prevent non-ID tokens from entering `datatakes_completeness`.
- **Null `impacted_satellite` (296 records).** When null, the frontend derives the satellite from
  the datatake IDs (regex `^(S\d[A-Z0-9])`); if they disagree or are all fake, it falls back to
  "Unknown". Ideally the backend populates `impacted_satellite` from the anomaly key.
- **`impacted_satellite` name casing.** Map uses "Copernicus Sentinel-5p" (lowercase 'p') matching
  the live feed. Verify if the backend normalises to title case in future.
- **`publication_date` field absent.** The anomaly schema does not expose a publication date; the
  calendar uses `start` as the primary date. Confirm whether events should be ordered by
  `publication_date` or `start`.
