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

| param | values | default |
|---|---|---|
| `year` | integer ≥ 2014 | current UTC year |
| `month` | 1–12 | current UTC month |
| `mission` | s1\|s2\|s3\|s5p | "" (all) |
| `satellite` | code e.g. S1A | "" (all) |
| `category` | comma-separated EventCategory codes | "" (all) |
| `q` | free text | "" |
| `event` | anomaly id | null |

Legacy param: `?showDayEvents=YYYY-MM-DD` → normalised to `?year=…&month=…`.

## Navigation model

- Filter / month changes: `history.pushState` + local React state (instant, no server round-trip).
- Event selection: `router.push` (triggers RSC re-render → new `selectedEvent` prop for the drawer).

## Acceptance criteria

- [ ] Calendar renders for any month with event dots from real backend data
- [ ] Both dark and light themes work (CSS custom properties on `:root[data-theme]`)
- [ ] Clicking a day dot opens the drawer with full event detail
- [x] `?event=<id>` renders the day's events in the HTML; selected event is highlighted
- [x] Event selection: resolveView switches to the event's start month; cross-month events appear in start month only
- [ ] `?showDayEvents=YYYY-MM-DD` opens the correct month
- [ ] `/events.html` → `/events` 308 redirect passes query string
- [ ] `/events` is in the sitemap (not noindex)
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass ✓ (2026-10-22)

## Architecture notes (2026-10-22)

- **Prerender split**: `EventsPage` is the static shell (PageHeader + EventsDescription). `EventsContent` is wrapped in `<Suspense>` and opts into dynamic rendering via `await connection()`. This prevents the "Blocking Route" error from `new Date()` in `parseView`. `/events` builds as `◐ (Partial Prerender)`.
- **`now` threading**: `nowYM()` is called once in `EventsContent` and passed as `now` on both the `ok` and `error` variants of `ExplorerData`. Explorer never calls `nowYM()` itself.
- **Drawer rendering**: the drawer `<aside>` is in-place (no portal), always in the DOM. Open/close is the `drawerOn` CSS class; `aria-hidden` + `inert` when closed. On SSR with `?event=<id>`, `openDay` is initialised from `data.dayEvents[0].startDate`. `overflow: hidden` on `.drawer` clips content; `drawerBody` scrolls via `overflow-y: auto`.
- **DayManifest**: the drawer shows all events of the selected day, each in a `<details><summary>` collapsible section (native, no JS for open/close). The URL-selected event starts `open` and scrolls into view. `ziOccSelected` CSS class adds a signal-colour left accent. `ziOcc summary` removes the browser disclosure triangle via `list-style: none` and `display: grid` on `.ziTop`.
- **Deep-link zoom**: `zoom` starts null (needs DOM). A mount `useEffect` calls `measureZoom` when `openDay !== null && zoom === null` — covers any month. Server renders without the stage; client sets it after hydration (no mismatch). The existing "fly-in" effect then animates `zoomOn`.
- **Platform→Satellite**: all backend `Platform` anomalies are mapped to `Satellite` in `adapter.ts:mapCategory`. No separate Platform type in `EventCategory`, `CATEGORIES`, filter chips, icons or description text.
- **Calendar marks**: each day cell shows one dot/icon per event *type* (no count badge). The `+N` overflow badge remains for days with more than `MARKS_SHOWN` (4) distinct types. An event appears only in its **start month** — cross-month events are not repeated in later months; `filterEvents` checks `startDate` year/month, not `months[]`.
- **URL stability**: `viewParams` always emits `month` when `year` differs from `now`, so a link made this month means the same thing next month. `resolveView` switches to the event's `startDate` year/month when `?event=` is present and the URL month doesn't match.

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
