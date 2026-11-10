State: IN_PROGRESS

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

### Data layer — mock data in feature branch, not on develop

**Decision (2026-11-09, rev 2026-11-09-b):** `mock-data.ts` ships in the feature branch
(Slices 1–6) so the globe is checkable in the browser throughout development. It is **removed
in Slice 7** before the PR merges to `develop`; no mock data ever lands on `develop`.

`mock-data.ts` holds the eleven mock-up datatakes as `startOffsetS` offsets (seconds before
NOW, matching the mock-up's `hoursAgo` function) and the five Copernicus core stations.
`getMockData(dayKey)` returns the raw specs unchanged — it never calls `Date.now()` and is
safe to cache. Resolution happens in the page component (outside `"use cache"`) via
`resolveMockTimes(rawSpecs, nowMs, dayMs)`, which computes
`startIso = new Date(nowMs - startOffsetS * 1000).toISOString()` and filters to keep only
datatakes where `minutesFromMidnight(startIso, dayMs) >= 0` (i.e., on today, not yesterday —
equivalent to the mock-up's day filter at AcquisitionsGlobeEarth.tsx line 676). This keeps
footprints visible at any time of day: for the Day filter in Slice 4, `minutesFromMidnight >= 0`
is the base gate that ensures only today's acquisitions are ever passed to the globe; the Day
dropdown then further narrows to a specific date. `getAcquisitions(dayKey)` returns
`{ rawSpecs, stations }`; the page calls `resolveMockTimes` then `adaptAcquisitions`.

After Slice 7: `getAcquisitions(dayKey)` is replaced with the real `"use cache"` fetch (if
the backend endpoint exists) or with the empty stub `{ datatakes: [], stations: [] }` (if
it does not). In the empty-stub case the page shows the empty-state message ("Acquisition
data is not available yet.") — identical to the data-availability precedent.

Test files define their own inline fixture helpers (`mkAcq(overrides)`) rather than
importing from `mock-data.ts`. No `__fixtures__/` directory.

**New shared files in `src/lib/` (Slice 1 creates these; availability is updated to import
from them):**

| File | Contents |
|------|----------|
| `src/lib/missions.ts` | `MissionId`, `MISSION_ORDER`, `MISSION_DISPLAY`, `MISSION_ID_OF`, `SATELLITES_OF`, `ALL_SATELLITES`, `DAY_MS`, `fmtDate`, `fmtDateTime`, `kpiFmt` |
| `src/lib/url-params.ts` | `ParamSource` type, `reader()`, `parseOffSet()` |

`src/features/availability/model.ts` is updated to import and **re-export** everything it
previously defined from `src/lib/missions.ts`, so its existing consumers (and its tests) need
no changes. `src/features/availability/url-state.ts` imports `ParamSource`, `reader`,
`parseOffSet` from `src/lib/url-params.ts`.

**Acquisitions imports only from `@/lib`, never from `src/features/availability/`.**

**Files in `src/features/acquisitions/`:**

| File | Role |
|------|------|
| `types.ts` | `AcqDatatake`, `AcqLevel`, `AcqProductType`, `Station`, `AcquisitionsData` |
| `mock-data.ts` | 11 mock datatakes as `startOffsetS` offsets + 5 stations. Dev only — removed Slice 7. |
| `model.ts` | Pure helpers: `computeAcqWindow`, `meanCompleteness`, `missingSeconds`, `kpiStats` |
| `model.test.ts` | Tests for model helpers — inline `mkAcq()` fixture |
| `adapter.ts` | `adaptAcquisitions(raw, dayKey): AcquisitionsData` |
| `adapter.test.ts` | Adapter round-trip and edge cases — inline fixtures only |
| `data.ts` | `getAcquisitions(dayKey)` — calls mock-data in Slices 1–6; replaced in Slice 7 |
| `url-state.ts` | `parseAcqView`, `acqViewParams`, `acqViewHref`, `DEFAULT_ACQ_VIEW` |
| `url-state.test.ts` | Round-trip, defaults, invalid values |

**Testing pattern** — follow `src/features/availability/model.test.ts`: one `mkAcq()`
factory at the top of the file (`Partial<AcqDatatake> & Pick<..., required fields>`),
tests grouped by function in `describe` blocks. Availability's url-state.test.ts is the
pattern for url-state.test.ts.

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
mean across expected product types), not stored in any raw data. This prevents KPI and globe
colour from diverging.

**`getAcquisitions()` is a pure `"use cache"` function.** It never calls `connection()`.
The page component calls `await connection()` first (inside a `<Suspense>` boundary), then
calls `getAcquisitions(dayKey)`. This keeps the data function stateless and unit-testable.

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

**Server-to-client time handoff.** The page component calls `await connection()` inside a
`<Suspense>` boundary, then calls `getAcquisitions(dayKey)`. It passes `nowMs` — the full
UTC millisecond timestamp at render time (`Date.now()`) — as a prop to `AcquisitionsGlobe`.
The client derives the sim clock's initial time-of-day from `nowMs % 86_400_000` (decision 3)
and can also use `nowMs` to anchor the data window. The client does not call `Date.now()`
during render.

**Legacy redirects (308):** the legacy app served the acquisitions page at
`/acquisitions-status.html`. Verify the bare `/acquisitions-status` form against
`support/sentiboard-2026-10-09` before adding it; apply the general rule from DECISIONS.md
when each route is ported. Add both confirmed paths to `sentiboard-frontend/next.config.ts`
`redirects()`. Both redirect to `/acquisitions-globe-earth`.

---

## Three.js in Next.js

**Dependency.** `three` is NOT in `sentiboard-frontend/package.json` today (confirmed by
inspecting the file on 2026-11-09). Both `three` and `@types/three` must be added before
Slice 2. Pin to `0.155.x` (the mock-up's version) to match the mock's API surface exactly.
Approved; proceed at Slice 2.

**Client-only loading.** `ThreeEarth` is a React component that runs `new THREE.WebGLRenderer`
in a `useEffect`. It must never run during SSR. `AcquisitionsGlobe.tsx` is `"use client"`
and imports `ThreeEarth` with `next/dynamic`:

```ts
// inside AcquisitionsGlobe.tsx ("use client")
import dynamic from "next/dynamic";
const ThreeEarth = dynamic(() => import("./ThreeEarth"), { ssr: false });
```

The route page components (`app/acquisitions-globe/page.tsx`, etc.) are Server Components;
they import `AcquisitionsGlobe` normally (no `dynamic` on the page). This matches the pattern
already in use for Processors: `Explorer.tsx` (`"use client"`) wraps `ReleaseTimeline` and
`SpaceBackdrop` with `dynamic({ ssr: false })`; the route page imports `Explorer` as a plain
Server Component import.

**SSR and hydration.** `AcquisitionsGlobe.tsx` is `"use client"`. It calls no `window` or
`document` at the top level. The simulation time is seeded from `nowMs` (a prop):

```ts
const [simMs, setSimMs] = useState(() => nowMs % 86_400_000); // time of day in ms
```

The fallback `<div>` rendered while ThreeEarth loads is static; no hydration mismatch.

**Textures and topology.** Copy the textures and topology files used by `applyDayNightEarth`
and `applyStylizedEarth` from the mock-up's `public/` into
`sentiboard-frontend/public/assets/globe/`. Reference them via `asset()` (the `src/lib/asset.ts`
helper, which prepends `NEXT_PUBLIC_BASE_PATH`), never with a bare `/` path.

**WebGL cleanup on unmount and route switch.** ThreeEarth's `useEffect` already returns a
cleanup. The parent `AcquisitionsGlobe.tsx` must also call `renderer.forceContextLoss()` in
its `useEffect` cleanup so the GPU context is released immediately when the user navigates
away, before the GC can collect the renderer. `dayNightRef.current?.dispose()` releases the
texture at the same time.

**Scene and data ordering — parent effect with useMemo.**

`onReady` only stores the Three.js scene handle in state:

```ts
const [scene, setScene] = useState<THREE.Scene | null>(null);
const handleReady = useCallback((s: THREE.Scene) => setScene(s), []);
```

`prepared` is derived synchronously from the datatakes and the current `nowMs`:

```ts
const prepared = useMemo(
  () => new Map(datatakes.map((dt) => [dt.id, prepDatatake(dt, nowMs)])),
  [datatakes, nowMs]
);
```

A single parent `useEffect` depending on `[scene, prepared]` builds and updates footprints,
satellites, and stations. Filter changes go through the same effect and update Three.js
objects in place — they never recreate the renderer:

```ts
useEffect(() => {
  if (!scene) return;
  buildOrUpdateFootprints(scene, prepared, filters);
  buildOrUpdateSatellites(scene, prepared);
  buildOrUpdateStations(scene, stations);
}, [scene, prepared, filters, stations]);
```

This removes the child-effect-before-parent-effect race that plagued the mock-up's
`prepMapRef` approach. In the mock, `handleSceneReady` (called from ThreeEarth's own mount
effect, a child effect) ran and tried to place geometry before the parent component's
`useEffect([todayMs])` had populated `prepMapRef`. React guarantees that **child effects run
before parent effects** in the same commit; so in the mock's design the child (ThreeEarth's
`onReady` callback) always fired into an empty ref. The lazy-useState workaround hid this by
pre-filling the ref synchronously during render. The parent-effect design avoids the problem
entirely: `scene` enters state via `setScene`, and the parent effect that uses `scene` only
runs after the child (ThreeEarth) has committed and called `onReady` — by which point
`prepared` (a `useMemo`) is already up-to-date.

**Pausing the animation loop.** The mock uses `stageVisibleRef` driven by an
`IntersectionObserver` on the stage `<div>`. When the stage is off-screen the per-frame
render (`renderer.render(scene, camera)`) is skipped; the rAF still fires to advance the
clock, so the time stays current when the stage comes back. Under `prefers-reduced-motion`
the clock still advances (time is not animation); only the planet and orbit visuals must not
play entrance animations.

**Reduced motion — fly-to and zoom.** Under `prefers-reduced-motion: reduce`, calls to
`rotateTo` and the zoom-step buttons must jump to the target instantly (no tween). The
`rotateTo` function checks `window.matchMedia("(prefers-reduced-motion: reduce)").matches`
and skips the flight interpolation if true, setting the camera position directly. Panel and
side-column CSS transitions are suppressed as already written (`@media (prefers-reduced-motion)
{ .sideCol { transition: none } .dtkPanel { animation: none } }`).

---

## How AGENTS.md and DECISIONS.md rules apply

**`asset()`** — every texture, topology file, acquisition image and the `acquisitions.jpg`
module card image is referenced via `asset()`. The `--home-*` or `--pr-*` token values used
for colours in CSS are fine; for Three.js materials see the colour-token section below.

**`log.ts`** — `console.warn` calls inside `handleSceneReady` (e.g. the missing alpha channel
warning) must be replaced with `import log from "@/lib/log"` and `log.warn(...)` in
production code.

**No API call at build time** — the page component calls `await connection()` inside a
`<Suspense>` boundary before calling `getAcquisitions(dayKey)`. The static shell (PageHeader,
KPI skeletons) prerenders without the backend. `getAcquisitions()` is a pure `"use cache"`
function; it never calls `connection()` or accesses `window`.

**Hydration** — `nowMs` is the only server-side value passed as a prop to the client
component. The client does not call `Date.now()` or `new Date()` during render; it uses the
prop. The ThreeEarth canvas replaces a `<div>` placeholder with `next/dynamic`, so there is
no server-rendered HTML to reconcile against the Three.js output.

**URL as single source of truth for filters** — `satellite`, `day`, and `datatake` are URL
search params. The client component reads them with `useSearchParams()` and writes with
`history.pushState` (no `router.push`, no server round-trip). No filter is in React `useState`
except as a local mirror that is kept in sync with the URL. This matches the availability
pattern. `url-state.ts` imports `ParamSource`, `reader()`, and `parseOffSet()` from
`@/lib/url-params`; `parseAcqView` / `acqViewParams` / `acqViewHref` follow the same call
contract as `parseView` / `viewParams` / `viewHref` in availability.

**Satellite param is single-select** — `satellite=<unit>` (e.g. `satellite=S2A`) or absent
("All satellites"). This matches the mock-up dropdown. The param stores the selected unit
directly; there is no "off" convention here (that convention applies to multi-select params
only, as in availability).

**No `inert` on dropdown bodies** — use the CSS visibility pattern from Events
(DECISIONS.md 2026-10-26): `.fdropInner` gets `visibility: hidden` when the dropdown is
closed. The Events page removed `inert` after a React 19 hydration mismatch (server rendered
`inert=""` on all three bodies, client expected it absent). Closed lists are excluded from the
focus order and the screen-reader virtual cursor by `visibility: hidden` on their inner
container.

**Client-only portal guard** — the tooltip (wheel-hint overlay and any screen-space label
portal) uses `useSyncExternalStore` to avoid server rendering: `subscribe` is a no-op,
`getSnapshot: () => true`, `getServerSnapshot: () => false`. Never use
`typeof document !== "undefined"` or `typeof window !== "undefined"` checks in render path
(DECISIONS.md 2026-11-09).

**Colour tokens and `color-mix`** — the CSS module uses `var(--...)` tokens everywhere.
Three.js materials need actual colour values (hex or rgb). The pattern to use in
`handleSceneReady` (which runs client-side only):

```ts
const style = getComputedStyle(document.documentElement);
const readHex = (token: string) => style.getPropertyValue(token).trim();
```

Pass `readHex("--token-name")` to `new THREE.Color(...)` only for tokens that resolve to a
hex (`#rrggbb`) or plain `rgb(r, g, b)` value. Do **not** pass `color-mix()` expressions or
`var()` references to `THREE.Color` — they will produce `NaN` channels. For the globe-specific
values that have no matching token, leave them as documented literals: `#007c93` (play button),
`#2fc6dc` (cyan hairlines), `rgba(110,170,255)` (atmosphere).

---

## Risks and open questions

**`three` not in the frontend.** Both `three` and `@types/three` must be installed. Pin to
`0.155.x` (the mock-up's version). Approved; proceed at Slice 2.

**No backend acquisitions endpoint yet.** The FastAPI backend has no `/datatake/` or
equivalent acquisitions endpoint (confirmed from `api/openapi.json` on 2026-11-09).
`getAcquisitions()` returns an empty stub; the page renders an empty state. This matches the
data-availability precedent (DECISIONS.md 2026-11-09). Session 5 replaces the stub with the
real API call. Recommend opening a tracking issue in the backend backlog and noting the
endpoint contract in the data layer's TODO comment.

**Legacy authentication on acquisitions endpoints.** The legacy endpoints
`/api/acquisitions/acquisition-datatakes` and `/api/acquisitions/satellite/orbits` are behind
`@login_required` and role guards. The new backend will need the same auth rules. This plan
does not change that; note it for whoever designs the backend endpoint.

**Orbit geometry vs. TLE.** The page computes orbits from lat/lon/swathKm/periodMin stored
per datatake, not from live TLE data. The result is a plausiblised ground track (the mock
uses a fixed inclination of 98.6° for all missions). This is faithful to the prototype. If
real orbits from TLE are ever required, they are a backend concern; the UI will accept new
fields per datatake without changing its rendering logic.

**`navigator.platform` deprecation.** The mock reads `navigator.platform` for the "⌘ / Ctrl"
wheel hint. Use `navigator.userAgentData?.platform` with a fallback to `navigator.platform`
for older browsers.

**Footprint geometry for wide swaths (S3, S5P).** The mock applies slerp subdivision
(4–8 steps across-track) for swaths > 500 km so the fill meshes hug the sphere. Verify that
S3 (1 270 km) and S5P (2 600 km) render without visible planar artefacts on a 1-metre display.
If artefacts appear, increase `slerpSteps`.

**Legacy URL `acquisitions-status.html`.** Verify both the `.html` form and the bare
`/acquisitions-status` form against `support/sentiboard-2026-10-09` with
`git show support/sentiboard-2026-10-09:<path>` or `grep` over the Flask route list before
adding either to `next.config.ts`. Do not use `origin/main` for this check.

---

## Slices

### Slice 1 — Data layer and route shells

**Files touched:**

Session 1a — data layer only (this session):
```
sentiboard-frontend/src/lib/missions.ts                          (new)
sentiboard-frontend/src/lib/url-params.ts                        (new)
sentiboard-frontend/src/features/availability/model.ts           (re-export from @/lib/missions)
sentiboard-frontend/src/features/availability/url-state.ts       (import from @/lib/url-params)
sentiboard-frontend/src/features/acquisitions/types.ts           (new)
sentiboard-frontend/src/features/acquisitions/mock-data.ts       (new — dev only, removed Slice 7)
sentiboard-frontend/src/features/acquisitions/model.ts           (new)
sentiboard-frontend/src/features/acquisitions/model.test.ts      (new)
sentiboard-frontend/src/features/acquisitions/adapter.ts         (new)
sentiboard-frontend/src/features/acquisitions/adapter.test.ts    (new)
sentiboard-frontend/src/features/acquisitions/data.ts            (new)
sentiboard-frontend/src/features/acquisitions/url-state.ts       (new)
sentiboard-frontend/src/features/acquisitions/url-state.test.ts  (new)
docs/memory/STATE.md                                             (update)
```

Session 1b — route shells (next session):
```
sentiboard-frontend/src/app/acquisitions-globe/page.tsx       (replace stub)
sentiboard-frontend/src/app/acquisitions-globe-earth/page.tsx (replace stub)
sentiboard-frontend/next.config.ts                            (add 308 redirects)
sentiboard-frontend/src/app/sitemap.ts                        (add acquisitions-globe entries)
docs/memory/features/acquisitions.md                          (create)
docs/memory/STATE.md                                          (update)
```

**What "done" means:**

- `types.ts` exports `AcqDatatake`, `AcqLevel`, `AcqProductType`, `Station`,
  `AcquisitionsData`.
- `src/lib/missions.ts` exports `MissionId`, `MISSION_ORDER`, `MISSION_DISPLAY`,
  `MISSION_ID_OF`, `SATELLITES_OF`, `ALL_SATELLITES`, `DAY_MS`, `fmtDate`, `fmtDateTime`,
  `kpiFmt`. `src/features/availability/model.ts` is updated to import and re-export these
  so its tests need no changes.
- `src/lib/url-params.ts` exports `ParamSource`, `reader`, `parseOffSet`. Availability's
  `url-state.ts` is updated to import from there.
- `model.ts` exports pure helpers: `computeAcqWindow(now: Date)` (returns yesterday UTC
  start and today UTC end), `meanCompleteness(levels)`, `missingSeconds(levels, sensingS)`,
  `kpiStats(datatakes)`. Imports from `@/lib/missions`, never from availability.
- `model.test.ts` defines `mkAcq(overrides: Partial<AcqDatatake> & Pick<..., required>)`
  as a local fixture factory. Covers `meanCompleteness`, `missingSeconds`, `kpiStats`,
  `computeAcqWindow`. Follows the structure of
  `src/features/availability/model.test.ts`.
- `mock-data.ts` exports `getMockData(dayKey: string): { datatakes: RawAcqDatatake[]; stations: Station[] }`.
  The 11 datatakes are stored as `startOffsetS` offsets (seconds before midnight of dayKey);
  `getMockData` resolves them to `startIso` strings against `dayKey + "T00:00:00Z"`. Never
  calls `Date.now()`. The 5 stations are the Copernicus core stations from the mock-up
  (`mock.ts` STATIONS constant).
- `adapter.ts` exports `adaptAcquisitions(raw, dayKey): AcquisitionsData`. Derives `comp`
  as `Math.round(meanCompleteness(levels) * 10) / 10` and `cls` by the mock-up rule
  (`mock.ts:591`): `comp >= 95 → "ok"`, `comp > 0 → "warn"`, `comp === 0 → "crit"`.
- `adapter.test.ts` covers round-trip and edge cases (null pct, UNKNOWN level) using inline
  fixture objects — no `mock-data.ts` import.
- `data.ts` exports `getAcquisitions(dayKey: string): Promise<AcquisitionsData>` with
  `"use cache"`. In Slices 1–6 it calls `getMockData(dayKey)` and pipes through
  `adaptAcquisitions(raw, dayKey)`. Deterministic for the same `dayKey`; never calls
  `Date.now()` or `connection()`. Has a `// TODO (Slice 7): replace with the real acquisitions
  endpoint — name TBD with the backend team` comment.
- `url-state.ts` exports `parseAcqView`, `acqViewParams`, `acqViewHref`,
  `DEFAULT_ACQ_VIEW`. Imports `ParamSource`, `reader`, `parseOffSet` from `@/lib/url-params`.
  Params:
  - `satellite=<unit>` or absent ("All satellites") — single-select, stores the unit directly
  - `day=YYYY-MM-DD` or absent ("Any day")
  - `datatake=<id>` or absent ("All datatakes")
  Follows the same call contract (`parseAcqView(src: ParamSource): AcqView`,
  `acqViewHref(view: AcqView): string`). No "off" convention — there are no multi-select params.
- `url-state.test.ts` covers round-trip, defaults, invalid values → defaults,
  `parseAcqView`, `acqViewParams` for each param. Follows the structure of
  `src/features/availability/url-state.test.ts`.
- Both route pages replace their stub with a minimal Server Component: they call
  `await connection()` inside a `<Suspense>` boundary, compute `dayKey` and `nowMs`, call
  `getAcquisitions(dayKey)`, and render an empty-state message ("Acquisition data is not
  available yet.") when `datatakes` is empty. `nowMs` is passed as a prop to the client
  shell. `ported: false` and `noindex` metadata are set.
- Both pages include full `<head>` metadata: `<title>`, `<meta name="description">`,
  canonical `<link>`, Open Graph (`og:title`, `og:description`, `og:url`, `og:image`), and
  Twitter card tags — copied from the legacy `/acquisitions-status.html` source.
- `next.config.ts` adds 308 redirects for `/acquisitions-status.html` (and
  `/acquisitions-status` if confirmed present on `support/sentiboard-2026-10-09`), both
  pointing to `/acquisitions-globe-earth`. Verified against
  `git show support/sentiboard-2026-10-09:<flask-route-file>`.
- `sitemap.ts` gains entries for `/acquisitions-globe` and `/acquisitions-globe-earth`.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.

**What to test in the browser:**
- Both routes answer 200 without an error (empty state renders immediately).
- `/acquisitions-status.html` redirects 308 to `/acquisitions-globe-earth`.
- Empty-state message is visible; no runtime errors in the console.

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
sentiboard-frontend/public/assets/globe/                              (new — textures and topology files)
```

**What "done" means:**
- `three` and `@types/three` at `0.155.x` installed and in `package.json`.
- `ThreeEarth.tsx` adapted to Next.js: the component exports itself directly. It is NOT
  wrapped in `dynamic` inside this file.
- `AcquisitionsGlobe.tsx` is `"use client"`. It imports `ThreeEarth` with
  `dynamic(() => import("./ThreeEarth"), { ssr: false })`. The route page components import
  `AcquisitionsGlobe` as a normal (non-dynamic) import — this is the same pattern as
  Processors, where `Explorer.tsx` (`"use client"`) wraps `ReleaseTimeline` and `SpaceBackdrop`
  with `dynamic({ ssr: false })` and the route page imports `Explorer` normally.
- `AcquisitionsGlobe.tsx` renders `ThreeEarth` with `transparent`, `autoRotate={false}`,
  and `onReady`. `onReady` stores the scene handle in state (`setScene`). The globe stage
  height CSS matches the reference. The atmosphere sprite and camera `applyView` are wired.
  Both `look` values switch the material in `handleSceneReady`. No datatakes or stations yet.
- The zoom controls (+, −, ⌖) and the drag/wheel/keyboard handlers are wired. `rotateTo`
  flies to `HOME_VIEW` on ⌖. Under `prefers-reduced-motion`, `rotateTo` jumps instantly.
- The `globeZoomed` mask toggles at `zoom > 1.3`.
- Textures referenced via `asset()`.
- Cleanup: `renderer.forceContextLoss()` and `dayNightRef.current?.dispose()` called on
  unmount.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.

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
sentiboard-frontend/src/features/acquisitions/acqGeometry.ts          (new — copy from mock-up verbatim)
sentiboard-frontend/src/features/acquisitions/acqGeometry.test.ts     (new)
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx   (extend with datatakes + sim)
sentiboard-frontend/src/features/acquisitions/acq-globe.module.css    (extend with simbar CSS)
```

**What "done" means:**
- `acqGeometry.ts` is a verbatim port from the mock-up (`prepDatatake`, `subPoint`,
  `buildFootprint`, `dest`, `bearing`). It has no browser dependency and can be unit-tested.
- `acqGeometry.test.ts` covers: `subPoint` for known lat/lon/heading/distance pairs,
  `buildFootprint` vertex count and closure, `prepDatatake` output shape. Inline fixture
  data only — no mock-data.ts.
- `prepared` is `useMemo(() => new Map(datatakes.map(...)), [datatakes, nowMs])`. A single
  parent `useEffect([scene, prepared, filters, stations])` calls `buildOrUpdateFootprints`,
  `buildOrUpdateSatellites`, `buildOrUpdateStations`. Filter changes update objects in place
  through the same effect without recreating the renderer.
- Footprint fills and outlines are built from real orbital mechanics and placed in the scene.
- Satellite ground-point dots and trails animate with the simulation clock.
- Selected satellite shows the trail at 70% opacity and the dashed ahead-track.
- Station coverage caps and dashed links appear when a satellite is within 22°.
- The simulation bar (play/pause, time display, scrub, speed pill) is functional.
  `nowMs % 86_400_000` seeds the initial time-of-day; the clock advances in the rAF loop.
- Pausing works: `isPlaying=false` freezes the clock; scrubbing jumps to any time.
- Off-screen: `IntersectionObserver` skips the render call when the stage is off-screen.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.

**What to test in the browser:**
- Globe renders (empty datatakes list means no footprints — that is correct at this point).
- Drag rotates; Ctrl+scroll zooms; simulation bar advances the clock.
- Speed pill cycles ×1 / ×10 / ×60 / ×600.
- Scrolling the page so the globe is below the viewport pauses the rAF render (verify with
  DevTools Performance → GPU activity).
- Navigating to another route and back does not accumulate geometry (no console warnings).
  *(Full geometry tests come in Session 5 when real data is wired in.)*

---

### Slice 4 — Filter toolbar and KPIs, synced with the URL

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx   (extend with toolbar + KPIs)
```

(`url-state.ts` and its test are already created in Slice 1.)

**What "done" means:**
- Dropdown bodies use the CSS visibility pattern (DECISIONS.md 2026-10-26): `.fdropInner`
  carries `visibility: hidden` when closed. No `inert` attribute anywhere in this component.
- The toolbar is rendered server-side (the date heading, dropdown heads) and enhanced
  client-side (the open/close animation, the calendar, the selection). URL mutations use
  `history.pushState` (no router round-trip), following `parseAcqView` / `acqViewHref` from
  `url-state.ts`.
- KPIs are computed from `filteredDatatakes` on each render via `kpiStats()` from
  `model.ts`: total, acquired %, published %, failed count. Failed count is red
  (`kpiCrit` class). KPIs show 0 / "—" when datatakes is empty (empty state).
- Satellite filter: picking a value calls `pushState` and re-renders; the globe hides
  non-matching footprints and satellites.
- Day filter: the calendar only enables buttons for dates that have datatakes (for the
  current Satellite filter). The date heading updates.
- Datatake filter (decision 5): picking from the list calls `handleSelectDatatake`, sets the
  filter, and flies the globe to that footprint. "All datatakes" clears.
- Search narrows the Datatake list only; typing opens the Datatake dropdown. `Enter` selects
  the first visible item.
- Escape closes the open dropdown, then (if none) deselects.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.

**What to test in the browser:**
- Toolbar renders correctly; dropdowns open and close.
- Deep link `?satellite=Sentinel-2A&day=2026-07-16` renders the correct state.
- Back/Forward navigation restores filters.
- KPIs show 0 / "—" with empty datatakes (no crash).

---

### Slice 5 — Datatake panel, side column, fly-to and zoom controls

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/DatatakePanel.tsx       (new — extracted from main component)
sentiboard-frontend/src/features/acquisitions/AcquisitionsGlobe.tsx   (integrate panel + selection)
sentiboard-frontend/src/features/acquisitions/acq-globe.module.css    (extend with panel + side CSS)
```

**What "done" means:**
- `DatatakePanel.tsx` is `"use client"`, renders the full panel layout from the mock-up:
  eyebrow, ID, satellite, pill, close; completeness headline; sensing/missing time;
  record `<dl>` rows. `missingSeconds` from `model.ts` drives the missing-time display.
  Relative orbit and downlink fields read from a `DTK_DETAILS` table (same as mock-up);
  unknown fields fall back to "NA".
- Side column transition: `flex-basis` and `margin-left` animate over 820 ms;
  `opacity` and `translateX` follow with delay; `displayedDtk` stays mounted during fade.
- Click on a footprint mesh selects it (and sets the datatake filter); click on the selected
  one deselects; click on empty globe deselects.
- Deselect: flies back to `HOME_VIEW` zoom 1.
- Fly-to: `rotateTo(dt.lon, dt.lat, fitZoom(prep))`. When switching from one datatake to
  another while `zoom > 1.6`: out to 1.2 first, then in after 520 ms.
- Under `prefers-reduced-motion: reduce`, `rotateTo` and zoom-step calls jump to the target
  instantly (no tween). Panel animation and side-column transition are suppressed.
- Keyboard: `[` / `]` cycles visible datatakes, `Enter` plays/pauses, `Escape` closes
  dropdown or deselects.
- Zoom controls fly via `rotateTo` (not instant jumps), except under `prefers-reduced-motion`.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.

**What to test in the browser:**
- Side column opens and closes (the panel will show empty / "NA" fields with no real data).
- Keyboard [ and ] cycle (no-op with empty datatakes list).
- Under `prefers-reduced-motion`, fly-to jumps instantly, panel appears instantly, column
  jumps.

---

### Slice 6 — Check-only audit (on mock data)

No code changes. Read the following against the reference and prototype ref, and report
findings as a list of deviations with their fix. At this point the globe runs on mock data
(the eleven ACQ_SPECS datatakes), so visual checks are meaningful.

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
- `prefers-reduced-motion` — no tween on fly-to/zoom; no animation on panel; no transition
  on side column.
- Legacy redirects — 308 confirmed with curl.
- SEO — `<title>`, description, canonical, Open Graph, Twitter (match legacy
  `/acquisitions-status.html` metadata).
- Sitemap — entry added with correct changefreq and priority.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.
- No console errors or warnings in Chrome (production build).

---

### Slice 7 — Remove mock data; wire real endpoint (BLOCKED on backend)

**Files touched:**

```
sentiboard-frontend/src/features/acquisitions/mock-data.ts   (delete)
sentiboard-frontend/src/features/acquisitions/data.ts        (replace mock call with real fetch, or empty stub)
```

**Preconditions:** this slice can begin at any time, but the real-data branch requires the
backend to expose an acquisitions endpoint and `api/openapi.json` to be updated. If the
endpoint does not exist yet, replace the mock call with the empty stub
(`{ datatakes: [], stations: [] }`) and ship; the page will show the empty-state message.

**What "done" means:**
- `mock-data.ts` is deleted.
- If the backend endpoint exists: `getAcquisitions(dayKey)` calls it and returns adapted data;
  footprints, satellites and stations render from real data; `ported: false` and `noindex`
  metadata are removed.
- If the backend endpoint does not exist yet: `getAcquisitions(dayKey)` returns the empty stub;
  the page shows the empty-state message; `ported: false` and `noindex` remain.
- No mock data on `develop` in either case.
- `pnpm exec eslint src`, `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build` all pass.

**What to test in the browser (real-data variant):**
- Footprints appear on the globe; satellite dots move as the clock advances.
- KPIs reflect real data.
- All filter combinations work correctly.
- No console errors or warnings in Chrome (production build).

---

*Written 2026-11-09. Updated 2026-11-09 (session 1a corrections). Update this file when each slice is started or completed.*
