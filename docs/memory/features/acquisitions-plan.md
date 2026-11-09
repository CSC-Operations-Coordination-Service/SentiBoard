State: PLANNED

# Acquisitions Status — implementation plan

Branch `feature/DEVOCS-219-acquisitions` off `develop`. Two routes, one feature:
`/acquisitions-globe` and `/acquisitions-globe-earth`. Both are "coming soon" placeholders today.

Prototype reference source of truth: `~/work/SentiBoard/design/react-mockups/src/pages/acquisitions/`
(read on 2026-11-09). Do not re-decode the prototype bundle; this file and
`docs/acquisitions-prototype-ref.md` in the mock-up repo hold the extracted values.

Confirmed decisions from `docs/acquisitions-prototype-ref.md §11` (override the prototype where
they differ):

1. Dropdown list opens in flow, pushing the globe down — same as Events.
2. Panel caption contrast: keep the mock-up's brighter values (`--dp-ink-2/-3`, 0.52–0.62) instead
   of the prototype's 0.34/0.42/0.45/0.55.
3. Sim clock start: open at the current UTC time of day (not a fixed timestamp).
4. Satellites with several datatakes: one marker per satellite.
5. **Datatake dropdown is a real filter** (stakeholder requirement): picking one hides every other
   footprint and satellite; the panel opens and the globe flies to it. "All datatakes" is the first
   item; KPIs count all three filters.

---

## Inventory

The mock-up page (`AcquisitionsGlobeEarth.tsx`, 2 079 lines) contains:

**KPI row.** Four figures risen into the header's faded bottom: "Datatakes in view",
"Acquired" (% not Failed), "Published" (mean pct), "Failed acquisitions" (count where pct = 0).
Failed count is red. All four follow the Satellite and Day filters; the Datatake filter
also applies (decision 5). The row is mock-only in the sense that it derives from mock data;
the same formulas apply to real data.

**Filter toolbar.** One centred row: date heading, three in-flow underlined dropdowns
(Satellite, Day of acquisition, Datatake), search field. Each element is 49 px tall so all
hairlines share one edge. The date heading reads the two-day window ("15 – 16 July 2026") or
the chosen day alone ("16 July 2026"). Satellite dropdown: "All satellites" + distinct full
names sorted. Day dropdown: "Any day" item + a Monday-first month calendar; only days with
datatakes (for the current Satellite filter) are buttons; the others are inert spans.
Datatake dropdown (see decision 5): "All datatakes" + datatakes sorted by mission group then
ID, each with a status dot and "pct · status" secondary text. Chevron does **not** rotate on
open (unlike Events). Search: an `<input type="search">` with a magnifier icon; `Enter`
selects the first match. The dropdown is fully mock-only in this slice; real data replaces it.

**Globe stage.** A `<div>` with height `max(520px, min(84vh, 880px))` (responsive; smaller on
≤980/780/560 px). Inside it: the ThreeEarth canvas (transparent, `autoRotate={false}`), the
simulation bar, the zoom controls, the wheel-hint overlay, and the 2-D overlay badges
(station markers and satellite labels projected from 3-D to screen space).

The globe itself draws, in order: footprint fills and outlines (colour by tone, selected one
pulses), station coverage caps and dashed links while in contact, satellite ground-point
dots and trails, plus the selected satellite's ahead-track.

The atmosphere ring (canvas sprite, radial gradient rgba(110,170,255) 0.34 → 0, radii
0.98–1.15 planet) is built once and kept on the rim by scaling to the camera distance.

**Simulation bar.** Absolute-positioned at the bottom of the stage: play/pause (34 px,
`#007c93`), current date + "HH:MM:SSZ" over "SIMULATION TIME", a custom-styled range scrub
with a blue fill track, and a speed pill cycling ×1/×10/×60/×600. The clock advances by
`dt × speed / 60` minutes per rAF tick, capped at 0.25 s dt.

**Zoom controls.** Three frosted 32-px squares top-right of the stage: +, −, ⌖. Each step
calls `rotateTo` (animated flight). ⌖ deselects if something is selected; otherwise resets
to HOME_VIEW.

**Side column and datatake panel.** The globe row is a flex container. When nothing is
selected, `flex-basis: 0` for the side column; selecting expands it to
`max(320px, 25vw)` over 820 ms. The panel content — eyebrow, datatake ID (large), satellite,
status pill with glowing dot, close button, completeness headline with sensing/missing time,
and a grid of record rows — fades in with `acqIn` (640 ms, 380 ms delay). On close the
column shrinks and the panel fades (460 ms); `displayedDtk` is kept mounted during the fade.
On narrow screens (≤980 px) the panel drops below the globe full-width.

**Items that are mock-only.** Swath geometry (lat/lon/swathKm/periodMin per datatake),
ground-station positions, and the datatake fields that have no backend endpoint yet (sensing
start, orbit, mode, downlink station, downlink pass data). These come from `ACQ_DATATAKES`
in the mock. When the backend provides real data, the data layer swaps them in without
touching the UI.

**Things the prototype hides — do not build.** `.simtrack` (tick marks under the clock);
`.globe-overlay` / `.globe-hint` overlays; `.acq-style` imagery/stylised switch; fullscreen
button; production plates (prism SVGs); "Downlink passes" block; ambient auto-rotation of the
Earth group.

---

## Data

### What the page needs

Each datatake: `id`, `sat` (full name, e.g. "Sentinel-2A"), `unit` (short, e.g. "S2A"),
`station` (name), `lat`/`lon` (footprint centre), `swathKm`, `periodMin`, `startIso`
(sensing start UTC), `sensingS` (sensing duration, seconds), `comp` (completeness %),
`cls` ("ok" / "warn" / "crit"), `status` ("Published" / "Processing" / "Failed"), `mode`
(e.g. "IW · DV"), `absOrbit`, `levels` (product types with pct per type for the missing-time
calculation), optionally `kmlLink`.

Ground stations (static): name, lat, lon — five Copernicus core stations.

### Legacy backend

The legacy Flask app on `support/sentiboard-2026-10-09` exposes:

- `GET /api/acquisitions/acquisition-datatakes/<mission>/<satellite>/<day>` — CDS datatakes
  from `cds-cadip-acquisition-pass-status` (OpenSearch), filtered by satellite and day.
  Behind `@internal_only`.
- `GET /api/acquisitions/acquisition-plans/<mission>/<satellite>/<day>` — KML acquisition
  plan. Behind `@internal_only`.
- `GET /api/acquisitions/acquisition-plan-days` — which days have plan coverage.
  Requires login + roles.
- `GET /api/acquisitions/satellite/orbits` — TLE data from Celestrak via `satellite_czml`.
  Requires login + roles.
- `GET /api/acquisitions/stations` — ground station list from cache. Requires login + roles.

The orbit geometry used by the page (sub-satellite point, footprint) is computed entirely
client-side from each datatake's lat/lon/swathKm/periodMin and startIso; no TLE call is
needed for the current mock. The TLE endpoint exists in the legacy app but is not required
for the port as designed.

### New FastAPI backend

Checked `sentiboard-frontend/api/openapi.json` on 2026-11-09: **no acquisitions endpoints
exist**. The backend has not been extended for this page yet.

### Proposal: data layer with mock behind data functions

Follow the pattern of `feature/DEVOCS-219-data-availability`:
`src/features/acquisitions/mock-data.ts` exports the eleven mock datatakes and the five
stations as typed constants; `src/features/acquisitions/data.ts` exports
`getAcquisitions(): Promise<AcquisitionsData>` with `"use cache"` and a TODO comment naming
the future endpoint. The function returns `{ datatakes: AcqDatatake[], stations: Station[] }`.
When the backend adds acquisitions endpoints, only `data.ts` changes.

**Types to define in `src/features/acquisitions/types.ts`:**

```ts
interface AcqDatatake {
  id: string; sat: string; unit: string; station: string;
  lat: number; lon: number; swathKm: number; periodMin: number;
  startIso: string; sensingS: number;
  comp: number; cls: "ok" | "warn" | "crit"; status: string;
  mode: string; absOrbit: string;
  levels: AcqLevel[];
  kmlLink?: { url: string; filename: string };
}
interface AcqLevel { level: "L0" | "L1" | "L2" | "UNKNOWN"; products: AcqProductType[]; }
interface AcqProductType { type: string; pct: number | null; instrument?: string; }
interface Station { name: string; lat: number; lon: number; }
```

The `comp` and `cls` are derived in the adapter from `meanCompleteness(levels)` (unweighted
mean across expected product types), not stored in the mock or the backend record. This
prevents KPI and globe colour from diverging.

The mock carries all eleven datatakes from the prototype mock-up, with sensing starts at
hoursAgo offsets so they always fall in the two-day UTC window (yesterday–today).

---

## Routes

The existing `/acquisitions-globe` and `/acquisitions-globe-earth` routes are "coming soon"
placeholders in `src/app/acquisitions-globe/page.tsx` and
`src/app/acquisitions-globe-earth/page.tsx`.

Both routes share one feature component: `src/features/acquisitions/AcquisitionsGlobe.tsx`.
The component accepts a `look: "imagery" | "stylized"` prop (matching
`AcquisitionsGlobeEarth.tsx` in the mock-up). The route pages pass the appropriate look:

- `/acquisitions-globe` → `look="stylized"` (vector planet: slate land, cyan coastline,
  navy sea)
- `/acquisitions-globe-earth` → `look="imagery"` (day texture + city lights by night,
  terminator from sim clock)

Both pages pass `initialSimTime` (seconds since midnight UTC, computed at render time by the
server) as a prop, so the client's `useState` initialiser can hydrate without a
`window`-call in render.

**Legacy redirects (308):** the legacy app served the acquisitions page at
`/acquisitions-status.html` (confirmed from HANDOFF.md). Verify the bare `/acquisitions-status`
form also exists on `origin/main` before adding it; apply the general rule from DECISIONS.md
when each route is ported. Add both to `next.config.ts` `redirects()`.

---

## Three.js in Next.js

**Dependency.** `three` is NOT in `sentiboard-frontend/package.json` today (confirmed by
inspecting the file on 2026-11-09). Both `three` and `@types/three` must be added before
Slice 2. The mock-up uses `^0.155.0`; use the same version unless a newer patch is needed.
Approve before Slice 2 starts.

**Client-only loading.** `ThreeEarth` is a React component that runs `new THREE.WebGLRenderer`
in a `useEffect`. It must never run during SSR. The pattern already used for processors:
```ts
const ThreeEarth = dynamic(() => import("@/features/acquisitions/ThreeEarth"), { ssr: false });
```
The wrapping client component (`AcquisitionsGlobe.tsx`) is `"use client"` and imports
`ThreeEarth` via `dynamic`. The page component (`app/acquisitions-globe/page.tsx`) is a
Server Component; it fetches `initialSimTime` and passes it as a plain number prop.

**SSR and hydration.** `AcquisitionsGlobe.tsx` is `"use client"`. It calls no `window` or
`document` at the top level. The simulation time is seeded from `initialSimTime` (a prop):
```ts
const [simTime, setSimTime] = useState(props.initialSimTime);
```
The fallback `<div>` rendered while ThreeEarth loads is static; no hydration mismatch.

**Textures and topology.** Copy the textures and topology files used by `applyDayNightEarth`
and `applyStylizedEarth` from the mock-up's `public/` into
`sentiboard-frontend/public/assets/globe/`. Reference them via `asset()` (the `src/lib/asset.ts`
helper, which prepends `NEXT_PUBLIC_BASE_PATH`), never with a bare `/` path.

**WebGL cleanup on unmount and route switch.** ThreeEarth's `useEffect` already returns a
cleanup. The `handleSceneReady` callback also returns a cleanup (geometry/material dispose,
event listener removal, ResizeObserver disconnect). `AcquisitionsGlobe.tsx` must call
`dayNightRef.current?.dispose()` in its own `useEffect` cleanup so the texture is released
when the user navigates away.

**Pausing the animation loop.** The mock uses `stageVisibleRef` driven by an
`IntersectionObserver` on the stage `<div>`. When the stage is off-screen the per-frame
render (`renderer.render(scene, camera)`) is skipped; the rAF still fires to advance the
clock, so the time stays current when the stage comes back. Under `prefers-reduced-motion`
the clock still advances (time is not animation); only the planet and orbit visuals must not
play entrance animations.

**Production-only bug in the mock-up.** The mock populated `prepMapRef` only inside a
`useEffect([todayMs])`. React Strict Mode invokes effects twice; on the first invocation
`handleSceneReady` (called from ThreeEarth's own mount effect) ran before `prepMapRef` was
populated, so the globe had no geometry in the first render. In development Strict Mode
re-ran the effect and the map appeared on the second pass, hiding the bug. In production
(no double-invoke) the globe was empty until the next render.

The mock fixed this by populating the map in a `useState` **lazy initialiser** (which runs
synchronously during render, before any effect):
```ts
const [_prepMapState] = useState<Map<string, PreparedDatatake>>(
  () => new Map(ACQ_DATATAKES.map((dt) => [dt.id, prepDatatake(dt, todayMs)]))
);
const prepMapRef = useRef(_prepMapState);
```
The `useEffect` only replaces the map if `todayMs` ever changes (page reload at midnight).
**Port this exact pattern.** Do not revert to a plain `useEffect` for the initial map build.

---

## How AGENTS.md and DECISIONS.md rules apply

**`asset()`** — every texture, topology file, acquisition image and the `acquisitions.jpg`
module card image is referenced via `asset()`. The `--home-*` or `--pr-*` token values used
for colours in CSS are fine; for Three.js materials see the colour-token section below.

**`log.ts`** — `console.warn` calls inside `handleSceneReady` (e.g. the missing alpha channel
warning) must be replaced with `import log from "@/lib/log"` and `log.warn(...)` in
production code.

**No API call at build time** — the page component calls `await connection()` before
`getAcquisitions()`, inside a `<Suspense>` boundary, exactly as the home page does for
`NewsBarContent`. The static shell (PageHeader, KPI skeletons) prerenders without the backend.

**Data functions stay pure "use cache"** — `getAcquisitions()` is a `"use cache"` function;
it calls `connection()` and `fetch(...)`. It never imports `ThreeEarth` or accesses `window`.

**Hydration** — `initialSimTime` is the only server-side value passed as a prop to the client
component. The client does not call `Date.now()` or `new Date()` during render; it uses the
prop. The ThreeEarth canvas replaces a `<div>` placeholder with `next/dynamic`, so there is
no server-rendered HTML to reconcile against the Three.js output.

**URL as single source of truth for filters** — `satellite`, `day`, and `datatake` are URL
search params. The client component reads them with `useSearchParams()` and writes with
`history.pushState` (no `router.push`, no server round-trip). No filter is in React `useState`
except as a local mirror that is kept in sync with the URL. This matches the Events and
Processors pattern and means filters survive Back/Forward navigation.

**ViewLink where a link can work without JS** — the datatake filter can be a plain
`<a href="?datatake=S2A-48201-1">` on the no-JS path. The panel close is a link to
`?datatake=` (empty). Both links are real `<a>` tags hidden by CSS when JS is active,
replaced by click handlers that call `history.pushState`.

**Colour tokens and `color-mix`** — the CSS module uses `var(--...)` tokens everywhere. Three.js
materials need actual colour values (hex). The pattern to use in `handleSceneReady` (which
runs client-side only):
```ts
const style = getComputedStyle(document.documentElement);
const readHex = (token: string) => style.getPropertyValue(token).trim();
```
Map the prototype's hard-coded colours to tokens where they exist in `tokens.css`; leave
them as literals for the globe-specific values that have no token (`#007c93` play button,
`#2fc6dc` cyan hairlines, `rgba(110,170,255)` atmosphere) and document the mapping in a
comment.

---

## Risks and open questions

**`three` not in the frontend.** Both `three` and `@types/three` must be installed. Recommend
pinning to `0.155.0` (the mock-up's version) to match the mock's API surface exactly rather
than pulling a newer semver. Approve before Slice 2.

**No backend acquisitions endpoint yet.** The FastAPI backend has no `/datatake/` or
equivalent acquisitions endpoint (confirmed from `api/openapi.json` on 2026-11-09). Slice 1
lands mock data behind `data.ts`; the wire-up is a future slice not in this plan. The same
pattern was used for data-availability. Recommend opening a tracking issue in the backend
backlog and noting the endpoint contract in the data layer's TODO comment.

**Legacy authentication on acquisitions endpoints.** The legacy endpoints
`/api/acquisitions/acquisition-datatakes` and `/api/acquisitions/satellite/orbits` are behind
`@login_required` and role guards. The new backend will need the same auth rules. This plan
does not change that; note it for whoever designs the backend endpoint.

**Orbit geometry vs. TLE.** The page computes orbits from lat/lon/swathKm/periodMin stored
per datatake, not from live TLE data. The result is a plausiblised ground track (the mock
uses a fixed inclination of 98.6° for all missions). This is faithful to the prototype. If
real orbits from TLE are ever required, they are a backend concern; the UI will accept new
fields per datatake without changing its rendering logic.

**`inert` on dropdown bodies in the mock-up.** The mock uses a `ref` callback to set `.inert`
imperatively (`ref={(el) => { if (el) el.inert = openDropdown !== "sat"; }}`). The Events
page removed `inert` after a React 19 hydration mismatch (DECISIONS.md 2026-10-26). The
acquisitions dropdowns are `"use client"` and state-driven (`openDropdown` starts as
`useState(null)`), so both sides agree — the same mismatch cannot occur. Use the mock's `inert`
pattern. If a hydration warning does appear, replace with the CSS `visibility: hidden` pattern
from Events.

**`navigator.platform` deprecation.** The mock reads `navigator.platform` for the "⌘ / Ctrl"
wheel hint. This attribute is deprecated; use `navigator.userAgentData?.platform` with a
fallback to `navigator.platform` for older browsers, or test against `navigator.userAgent`
for `Mac|iPhone|iPad`. Recommend the userAgentData approach with graceful fallback.

**Footprint geometry for wide swaths (S3, S5P).** The mock applies slerp subdivision
(4–8 steps across-track) for swaths > 500 km so the fill meshes hug the sphere. Verify that
S3 (1 270 km) and S5P (2 600 km) render without visible planar artefacts on a 1-metre display.
If artefacts appear, increase `slerpSteps`.

**Legacy URL `acquisitions-status.html`.** The bare form (`/acquisitions-status`) must also be
checked against `origin/main` before adding it to `next.config.ts`. Confirm with
`git show origin/main:apps/routes/home/<file>.py | grep acquisitions` or the Flask route list.

---

## Slices

### Slice 1 — Data layer and route shells

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/types.ts       (new)
sentiboard-frontend/src/features/acquisitions/mock-data.ts   (new)
sentiboard-frontend/src/features/acquisitions/adapter.ts     (new)
sentiboard-frontend/src/features/acquisitions/data.ts        (new)
sentiboard-frontend/src/app/acquisitions-globe/page.tsx      (replace stub)
sentiboard-frontend/src/app/acquisitions-globe-earth/page.tsx (replace stub)
next.config.ts                                               (add 308 redirects)
docs/memory/features/acquisitions.md                         (create)
docs/memory/STATE.md                                         (update)
```

**What "done" means:**
- `types.ts` exports `AcqDatatake`, `AcqLevel`, `AcqProductType`, `Station`,
  `AcquisitionsData`.
- `mock-data.ts` exports the eleven mock datatakes (all sensing starts as `hoursAgo(n)` so
  they never go stale) and the five stations. `comp` and `cls` are derived by the adapter,
  not stored.
- `adapter.ts` exports `adaptAcquisitions(raw): AcquisitionsData` with `meanCompleteness`,
  `expectedTypes`, and `missingSeconds` helpers.
- `data.ts` exports `getAcquisitions(): Promise<AcquisitionsData>` with `"use cache"`,
  `cacheLife`, `connection()`, and a `// TODO: replace with GET /datatake/ once backend
  adds the endpoint` comment returning the adapted mock data.
- Both route pages replace their stub with a minimal Server Component: they call
  `getAcquisitions()` inside a `<Suspense>`, compute `initialSimTime`, and render a
  `<ComingSoon>` or a placeholder `<div>` for now (the globe component is added in Slice 2).
- `next.config.ts` adds 308 redirects for `/acquisitions-status.html` (and
  `/acquisitions-status` if confirmed present on `origin/main`).
- `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass.

**What to test in the browser:**
- Both routes answer 200 without an error (the mock data resolves immediately).
- `/acquisitions-status.html` redirects to `/acquisitions-globe` (or the chosen canonical).
- No runtime errors in the console.

---

### Slice 2 — Globe engine (client-only, both looks, no data yet)

**Files touched:**

```
sentiboard-frontend/package.json                                      (add three, @types/three)
sentiboard-frontend/src/features/acquisitions/ThreeEarth.tsx          (new — copy & adapt from mock-up)
sentiboard-frontend/src/features/acquisitions/dayNightEarth.ts        (new — copy & adapt)
sentiboard-frontend/src/features/acquisitions/stylizedEarth.ts        (new — copy & adapt)
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx   (new — globe shell, no data yet)
sentiboard-frontend/src/app/acquisitions-globe/page.tsx               (wire in AcquisitionsGlobe look="stylized")
sentiboard-frontend/src/app/acquisitions-globe-earth/page.tsx         (wire in AcquisitionsGlobe look="imagery")
sentiboard-frontend/src/features/acquisitions/acq-globe.module.css    (new — copy from mock-up)
public/assets/globe/                                                   (new — textures and topology files)
```

**What "done" means:**
- `three` and `@types/three` at version 0.155.0 installed and in `package.json`.
- `ThreeEarth.tsx` adapted to Next.js: no default export through `next/dynamic` inside this
  file; the component itself is the export, and the calling page does
  `dynamic(() => import(".../AcquisitionsGlobe"), { ssr: false })` on the wrapper.
- `AcquisitionsGlobe.tsx` is `"use client"`. It renders `ThreeEarth` with `transparent`,
  `autoRotate={false}`, and `onReady`. The globe stage height CSS matches the reference.
  The atmosphere sprite and camera `applyView` are wired. Both `look` values switch the
  material in `handleSceneReady`. No datatakes or stations yet.
- The zoom controls (+, −, ⌖) and the drag/wheel/keyboard handlers are wired. `rotateTo`
  flies to `HOME_VIEW` on ⌖.
- The `globeZoomed` mask toggles at `zoom > 1.3`.
- Textures referenced via `asset()`.
- `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass.

**What to test in the browser:**
- Both routes show the globe (imagery and stylised).
- Drag rotates the view; Ctrl+scroll zooms; arrow keys and +/−/0 work.
- The atmosphere ring hugs the rim at all zoom levels.
- The zoomed oval mask appears at zoom > 1.3.
- Zoom controls fly the camera; ⌖ resets.
- WebGL canvas is transparent (starfield shows around the planet).
- Navigating away and back does not leak a WebGL context (check DevTools → Application →
  WebGL contexts, or look for the "Too many active WebGL contexts" warning).

---

### Slice 3 — Datatakes on the globe and the simulation clock

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/acqGeometry.ts    (new — copy from mock-up verbatim)
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx  (extend with datatakes + sim)
sentiboard-frontend/src/features/acquisitions/acq-globe.module.css   (extend with simbar CSS)
```

**What "done" means:**
- `acqGeometry.ts` is a verbatim port from the mock-up (`prepDatatake`, `subPoint`,
  `buildFootprint`, `dest`, `bearing`). It has no browser dependency and can be unit-tested.
- Footprint fills and outlines are built from real orbital mechanics and placed in the scene.
- Satellite ground-point dots and trails animate with the simulation clock.
- Selected satellite shows the trail at 70% opacity and the dashed ahead-track.
- Station coverage caps and dashed links appear when a satellite is within 22°.
- The simulation bar (play/pause, time display, scrub, speed pill) is functional.
  `initialSimTime` seeds `useState`; the clock advances in the rAF loop.
- Pausing works: `isPlaying=false` freezes the clock; scrubbing jumps to any time.
- Off-screen: `IntersectionObserver` skips the render call when the stage is off-screen.
- The `prepMapRef` is seeded via a `useState` lazy initialiser (not a `useEffect`).
- `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass.

**What to test in the browser:**
- Eleven footprints appear on the globe at plausible positions.
- Satellite dots move as the clock advances at ×60.
- Scrubbing the clock moves the satellites.
- Pause stops motion; play resumes.
- Speed pill cycles ×1 / ×10 / ×60 / ×600.
- Station antennas appear; the cyan coverage circle and dashed link appear when a satellite
  passes within 22°.
- Scrolling the page so the globe is below the viewport pauses the rAF render (verify with
  DevTools Performance → GPU activity).
- Navigating to another route and back does not accumulate geometry (no console warnings).

---

### Slice 4 — Filter toolbar and KPIs, synced with the URL

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/url-state.ts    (new)
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx   (extend with toolbar + KPIs)
sentiboard-frontend/src/features/acquisitions/url-state.test.ts  (new)
```

**What "done" means:**
- `url-state.ts` parses and serialises `?satellite=`, `?day=`, `?datatake=` from/to URL
  search params. `resolveFilters(searchParams)` returns a `Filters` object with defaults.
  `filterDatatakes(datatakes, filters)` returns the visible set for globe drawing and KPIs.
- The toolbar is rendered server-side (the date heading, dropdown heads) and enhanced
  client-side (the open/close animation, the calendar, the selection). URL mutations use
  `history.pushState` (no router round-trip).
- KPIs are computed from `filteredDatatakes` on each render: total, acquired %, published %,
  failed count. Failed count is red (`kpiCrit` class).
- Satellite filter: picking a value calls `pushState` and re-renders; the globe hides
  non-matching footprints and satellites.
- Day filter: the calendar only enables buttons for dates that have datatakes (for the
  current Satellite filter). The date heading updates.
- Datatake filter (decision 5): picking from the list calls `handleSelectDatatake`, sets the
  filter, and flies the globe to that footprint. "All datatakes" clears.
- Search narrows the Datatake list only; typing opens the Datatake dropdown. `Enter` selects
  the first visible item.
- Escape closes the open dropdown, then (if none) deselects.
- `url-state.test.ts`: round-trip, defaults, invalid values → defaults, `resolveFilters`,
  `filterDatatakes` with each filter combination.
- `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass.

**What to test in the browser:**
- Picking a satellite hides other footprints and satellites; the KPI "Datatakes in view"
  updates.
- Picking a day hides datatakes from other days; the heading shows "16 July 2026".
- Picking "Any day" restores all.
- The month calendar only highlights days with data for the current Satellite filter.
- Picking a datatake (decision 5) hides all other footprints, opens the side column (Slice 5),
  and flies the globe.
- Search typing opens the Datatake dropdown and narrows its list.
- Deep link `?satellite=Sentinel-2A&day=2026-07-16` renders the correct state.
- Back/Forward navigation restores filters.

---

### Slice 5 — Datatake panel, side column, fly-to and zoom controls

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/DatatakePanel.tsx  (new — extracted from main component)
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx   (integrate panel + selection)
sentiboard-frontend/src/features/acquisitions/acq-globe.module.css    (extend with panel + side CSS)
```

**What "done" means:**
- `DatatakePanel.tsx` is `"use client"`, renders the full panel layout from the mock-up:
  eyebrow, ID, satellite, pill, close; completeness headline; sensing/missing time;
  record `<dl>` rows. `missingSeconds` from the adapter drives the missing-time display.
  Relative orbit and downlink fields read from a `DTK_DETAILS` table (same as mock-up);
  unknown fields fall back to "NA".
- Side column transition: `flex-basis` and `margin-left` animate over 820 ms;
  `opacity` and `translateX` follow with delay; `displayedDtk` stays mounted during fade.
- Click on a footprint mesh selects it (and sets the datatake filter); click on the selected
  one deselects; click on empty globe deselects.
- Deselect: flies back to `HOME_VIEW` zoom 1.
- Fly-to: `rotateTo(dt.lon, dt.lat, fitZoom(prep))`. When switching from one datatake to
  another while `zoom > 1.6`: out to 1.2 first, then in after 520 ms.
- Keyboard: `[` / `]` cycles visible datatakes, `Enter` plays/pauses, `Escape` closes
  dropdown or deselects.
- Zoom controls fly via `rotateTo` (not instant jumps).
- `prefers-reduced-motion`: `dtkPanel` animation suppressed; side column transition
  suppressed.
- `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass.

**What to test in the browser:**
- Clicking a footprint opens the panel, narrows the globe to that datatake, flies to it.
- The ID, completeness, sensing time, missing time, and all record rows render correctly for
  each of the eleven mock datatakes.
- Closing with ×, the ⌖ button, Escape, or clicking another footprint/empty globe works.
- Side column animate opens (820 ms) and closes (460 ms fade).
- Keyboard [ and ] cycle through visible datatakes with flight.
- On narrow screens (≤980 px) the panel drops below the globe and takes full width.
- Under `prefers-reduced-motion`, the panel appears instantly and the column jumps.

---

### Slice 6 — Check-only audit

No code changes. Read the following against the reference and prototype ref, and report
findings as a list of deviations with their fix:

- KPI formulas (§2 — acquired, published, failed).
- Filter toolbar — hairline position, chevron, caption hover cyan, item `.off` dimming.
- Day calendar — `leadBlanks` formula, button vs span for days without data, cyan frame.
- Globe — camera position at HOME_VIEW, 4% upward offset, `zoom > 1.3` mask.
- Footprints — fill opacity 0.24 unselected, 0.14 when another is selected, 0.34–0.52
  pulsed selected; outline colour and width; stroke 0.9/1.0 unselected/selected.
- Stations — 22° contact threshold, dashed link, cap fill opacity 6%.
- Satellites — trail 31 points × 0.8 min step, opacity 28%/70%; ahead-track selected only.
- Simulation bar — `#007c93` button, Noto Sans, track fill gradient, thumb, speed 1/10/60/600.
- Side column — `max(320px, 25vw)`, 12 px margin, 820 ms timing.
- Panel — typography values from §10 verbatim; pill colours Published/Processing/Failed.
- Interaction — wheel hint; drag 0.25°/px ÷ zoom; Ctrl+scroll zoom 0.7–8; keyboard mapping.
- Responsive — 980/780/560 breakpoints from the CSS reference.
- `prefers-reduced-motion` — no animation on panel, no transition on side column.
- Legacy redirects — 308 confirmed with curl.
- SEO — `<title>`, description, canonical, Open Graph, Twitter (match legacy
  `/acquisitions-status.html` metadata).
- Sitemap — entry added with correct changefreq and priority.
- `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass.
- No console errors or warnings in Chrome (production build).

---

*Written 2026-11-09. Update this file when each slice is started or completed.*
