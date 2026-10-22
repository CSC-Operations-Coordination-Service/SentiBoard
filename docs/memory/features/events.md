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
- `selectedEvent: EventDetail | null` — full record for the URL-selected event (`?event=<id>`),
  rendered server-side so the drawer works without JavaScript.

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
- [ ] `?event=<id>` renders a pre-selected event in the HTML (works without JS)
- [ ] Cross-month event: resolveView switches to the event's first month
- [ ] `?showDayEvents=YYYY-MM-DD` opens the correct month
- [ ] `/events.html` → `/events` 308 redirect passes query string
- [ ] `/events` is in the sitemap (not noindex)
- [ ] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass ✓ (2026-10-22)

## Architecture notes (2026-10-22)

- **Prerender split**: `EventsPage` is the static shell (PageHeader + EventsDescription). `EventsContent` is wrapped in `<Suspense>` and opts into dynamic rendering via `await connection()`. This prevents the "Blocking Route" error from `new Date()` in `parseView`. `/events` builds as `◐ (Partial Prerender)`.
- **`nowYM` flow**: computed once in `EventsContent` (dynamic context), passed as `now` prop to `Explorer` via `ExplorerData`. `Explorer` uses it for the initial `parseView` call so server and client agree on the default month.
- **Hydration fix**: portal for the zoom stage and drawer is gated on `panelDay !== null`. Both server and first client render agree (panelDay starts null); the portal only mounts after the user opens a day (post-hydration).
- **Platform→Satellite**: all backend `Platform` anomalies are mapped to `Satellite` in `adapter.ts:mapCategory`. No separate Platform type in `EventCategory`, `CATEGORIES`, filter chips, icons or description text.
- **Calendar marks**: each day cell shows one dot/icon per event *type* (no count badge). The `+N` overflow badge remains for days with more than `MARKS_SHOWN` (4) distinct types.

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
