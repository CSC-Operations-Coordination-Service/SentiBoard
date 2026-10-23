# Events & Anomalies page

Status: **COMPLETE** (branch `feature/DEVOCS-219-events`, 2026-10-22; visual check pending)

## Route

`/events` — real data from `GET /anomaly/` (3720 records as of 2026-10-22).

Legacy redirect: `/events.html` → `/events` (308, `next.config.ts`).

## Code path

```
GET /anomaly/
  → fetchAll (src/lib/api/paginate.ts)
  → adaptEvents (src/features/events/adapter.ts)   [server-only]
  → loadEvents / getEvents (src/features/events/data.ts)  [server-only, cache 300 s]
  → EventsPage (src/app/events/page.tsx)            [server component, instant=false]
  → Explorer (src/features/events/Explorer.tsx)     [client component]
```

Supporting modules:
- `model.ts` — EventCard / EventDetail / TextSegment types
- `url-state.ts` — parse/viewParams/filterEvents/calendarCells (pure, no Next deps)
- `copy.tsx` — SEO metadata + `EventsDescription` collapsible panel (7 categories, prototype wording)
- `events.module.css` — calendar grid, zodiac, zoom stage, drawer (ported verbatim from prototype)

## Data passed to client

- `cards: EventCard[]` — compact shape (no text, no datatakes) for all ~3720 events; used for
  instant client-side filtering and month navigation.
- `dayEvents: EventDetail[]` — full records for every event that shares a `startDate` with the
  URL-selected event, sorted by `startTime`. Empty when no event is in the URL.
- `selectedEventId: string | null` — id of the URL-selected event; the drawer scrolls it into
  view and opens its section.

## URL params

Multi-select toggles: every item starts ON; the URL stores what is OFF, so the default URL stays clean.

| param | values | default |
|---|---|---|
| `year` | integer ≥ 2014 | current UTC year |
| `month` | 1–12 | current UTC month |
| `typesOff` | comma-separated EventCategory codes that are OFF | "" (all on) |
| `missionsOff` | comma-separated MissionId codes that are OFF | "" (all on) |
| `satellitesOff` | comma-separated satellite codes that are OFF | "" (all on) |
| `q` | free text | "" |
| `event` | anomaly id | null |

Legacy params (read-only, never written, converted on parse):
- `?showDayEvents=YYYY-MM-DD` → normalised to `?year=…&month=…`
- `?mission=s1` → `missionsOff=s2,s3,s5p`
- `?mission=s1&satellite=S1A` → `missionsOff=s2,s3,s5p&satellitesOff=S1B,S1C,S1D`
- `?category=Acquisition,Production` → `typesOff=Manoeuvre,Calibration,Satellite`

## Navigation model

- Filter / month changes: `history.pushState` + local React state (instant, no server round-trip).
- Event selection: `router.push` (triggers RSC re-render → new `selectedEvent` prop for the drawer).

## Acceptance criteria

- [ ] Calendar renders for any month with event dots from real backend data
- [ ] Both dark and light themes work (CSS custom properties on `:root[data-theme]`)
- [ ] Clicking a day dot opens the drawer with full event detail
- [x] `?event=<id>` renders the day's events in the HTML; selected event is highlighted
- [x] Event selection: resolveView switches to the event's start month; events appear only in their start month
- [ ] `?showDayEvents=YYYY-MM-DD` opens the correct month
- [ ] `/events.html` → `/events` 308 redirect passes query string
- [ ] `/events` is in the sitemap (not noindex)
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass ✓ (2026-10-22)

## Architecture notes (2026-10-23 rev 3)

- **Prerender split**: `EventsPage` is the static shell (PageHeader + EventsDescription). `EventsContent` is wrapped in `<Suspense>` and opts into dynamic rendering via `await connection()`. This prevents the "Blocking Route" error from `new Date()` in `parseView`. `/events` builds as `◐ (Partial Prerender)`.
- **`now` threading**: `nowYM()` is called once in `EventsContent` and passed as `now` on both the `ok` and `error` variants of `ExplorerData`. Explorer never calls `nowYM()` itself.
- **Drawer rendering**: the drawer `<aside>` is in-place (no portal), always in the DOM. Open/close is the `drawerOn` CSS class; `aria-hidden` + `inert` when closed. On SSR with `?event=<id>`, `openDay` is initialised from `data.dayEvents[0].startDate`. `overflow: hidden` on `.drawer` clips content; `drawerBody` scrolls via `overflow-y: auto`.
- **DayManifest**: the drawer shows all events of the selected day, each in a `<details><summary>` collapsible section (native, no JS for open/close). The URL-selected event starts `open` and scrolls into view. `ziOccSelected` CSS class adds a signal-colour left accent. `ziOcc summary` removes the browser disclosure triangle via `list-style: none` and `display: grid` on `.ziTop`.
- **Deep-link zoom**: `zoom` starts null (needs DOM). A mount `useEffect` calls `measureZoom` when `openDay !== null && zoom === null` — covers any month. Server renders without the stage; client sets it after hydration (no mismatch). The existing "fly-in" effect then animates `zoomOn`.
- **Category whitelist (2026-10-23)**: only five types shown — Acquisition, Calibration, Manoeuvre, Production, Satellite. `adapter.ts:mapCategory` trims the raw value and returns null for everything else (Data access, Archive, DD, MP, unknown, empty). Excluded records are logged once per load via `console.info`, grouped by category. Old URLs with `?category=Other` (or any excluded type) are silently converted to all-on. Metrics count only shown events.
- **Platform→Satellite**: backend `Platform` maps to `Satellite`; feed value `Satellite` is also accepted directly. No separate Platform or Other type anywhere in the UI model.
- **Constellation of the month (2026-10-23 rev 3)**: `CONSTELLATIONS[month-1]` (12 entries, points as fractions of 380×300 box, straight edges). SVG `viewBox="0 -44 380 344"`. Stars: halo r=9 `var(--con-halo)` opacity 0.16 + core r=3.2 `var(--con-core)`. Lines: `var(--con-line-color)` opacity 0.45, `pathLength=1`, non-scaling-stroke. Name centred at (190, −20). Dark: halo=#BFE6F2, core=#F2F8FF, lines=#8FD4E4. Light: halo=#155B80, core=#0C3A5E, lines=#1B6B90 (CSS vars on `.zodiac`). Animation: stars pop in 120 ms apart (conPop); lines start at 1400 ms + 110 ms each, loop every 5 s (conCycle); name loops with conName (5 s delay, then 5 s loop). Keyed on `view.month` to restart when the month changes. Reduced motion: everything shown, nothing animates. Position: `position: absolute` at ≥1400px; `left: calc(2.848% − (100vw − 100%)/4); transform: translate(−50%, −50%); top: 50%; width: clamp(120px, calc(36vw − 31.9%), 380px)` — centres the figure halfway between viewport left and the grid's left edge without JS. Below 1400px: static, centred above the grid.
- **Earth spacer (2026-10-23 rev 3)**: `<div style={{ height: "clamp(150px, 20vh, 300px)" }}/>` inside `.inner` after `.calRow`. `.calRow` already has `padding-bottom: clamp(20px, 2.6vw, 38px)`. Together these keep the calendar clear of the Earth/horizon image.
- **Calendar marks (2026-10-23)**: one SVG "star" dot per event TYPE per day (not per event). Three Acquisition events on the same day produce one Acquisition dot. Three concentric circles in the type colour (prototype pattern). Positioned at 60% of cell height, spaced 27% of cell width apart. Max 4 type dots shown, then `+N` (N = hidden type count). Types ordered by the canonical CATEGORIES array for consistent positions. Dots are the only click targets — the rest of the cell has no pointer cursor or hover border. Each dot is a `<button>` with ≥34px hit area; aria-label: `"Acquisition, 3 events: title 1, title 2, title 3"`. Clicking a grouped dot opens the day with the first event of that type pre-selected. Hover/focus shows a tooltip: icon + type header ("TYPE · N events" or "TYPE · SAT" for n=1), up to 3 event titles each with satellite, "+N more" if there are more. Type icon appears to the right of the dot in zoomed view (`.zicon` fade-in after fly-in). Clicking the selected day's dot in zoom calls `close()`. `byDayByType: Map<number, {category, events[]}[]>` computed from `byDay` — one group per type per day.
- **Type colours and icons (2026-10-23)**: shared in `event-types.tsx` — exact prototype values. Colours: Acquisition #A7B1BE, Calibration #4FC9CB, Manoeuvre #EFA73C, Production #B45CF2, Satellite #F2772B. Icons: 16×16 viewBox SVG paths, stroke 1.3 round caps, rendered via `CategoryIcon` component (dangerouslySetInnerHTML on hardcoded static strings — no user input).
- **Drawer / zoom view (2026-10-23)**: `<details>/<summary>` replaced by plain `<div>` — all occurrences always expanded. Selected at full opacity, others at 0.42 (0.8 on hover). Clicking a dimmed occurrence calls `selectEventId`. "Description" is a native `<details>` inside each occurrence (closed by default). `.ziDot` uses impact colour (ACQUIRED #3FCF7F / PARTIAL #F0A63A / LOST #E8514B). Datatake rows have a right column with ACQUIRED/PARTIAL/LOST label + completeness %. Eyebrow changed to "Selected day".
- **URL stability**: `viewParams` always emits `month` when `year` differs from `now`, so a link made this month means the same thing next month. `resolveView` switches to the event's `startDate` year/month when `?event=` is present and the URL month doesn't match.
- **Filter model (2026-10-23 rev 2)**: Multi-select toggles — every item starts ON; URL stores what is OFF (`typesOff`, `missionsOff`, `satellitesOff`). No "All" item in lists; header shows "All" or "N/total". Satellite list shows only satellites of ON missions; its count is over those. Legacy `?category=`, `?mission=`, `?satellite=` params are converted on parse, never emitted. `EventsView` no longer has `mission`/`satellite`/`categories` fields.
- **Filter z-index (2026-10-23 rev 2)**: `.fdropBody` is `position:absolute` (doesn't push siblings). While any dropdown is open, a fixed `.fdropOverlay` (z:98) sits above the calendar (z:0) and below the `.fdrop` elements (z:99 via `position:relative; z-index:99` on `.fdrop`). Clicking outside closes the dropdown without the click reaching calendar dots.
- **Month on own line (2026-10-23 rev 2)**: When any filter is active (dirty), `.monthBarDirty .monthNav { flex-basis: 100% }` wraps the month nav to its own row above the three filter dropdowns + search.
- **Datatake expand (2026-10-23 rev 2)**: Drawer shows at most 5 datatakes per event, then "+N more" / "Show less" button that expands/collapses the rest in place. State is per-event in `DayManifest` via `expandedDtk: Set<string>`. The "→ Data Availability" link is a later legacy-parity item (see HANDOFF.md).

## Known backend issues (anomaly feed)

- **Fake datatake IDs.** ~630 records have ~2085 IDs that are split free-text tokens ("No",
  "impact", "on"). Fixed client-side: `isRealDatatakeId(id) = /^S\d/.test(id)`.
- **S1B after March 2022.** Sentinel-1B stopped transmitting in March 2022, but acquisition events
  referencing S1B appear in later months. Not filtered — historical record is legitimate.
- **Unknown satellite (null + no datatakes).** 296 records have `impacted_satellite = null`. If
  all real datatake IDs agree on one satellite code, it is derived; otherwise "Unknown" (no mission).
  "Unknown" events are excluded when a specific mission filter is active.
- **`impacted_satellite` long-name casing.** The map uses "Copernicus Sentinel-5p" (lowercase 'p')
  to match what the feed returns; verify if the backend normalises it.
