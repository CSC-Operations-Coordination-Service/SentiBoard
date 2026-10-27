# Data Availability page — implementation plan

Drafted 2026-10-27. Branch: `feature/DEVOCS-219-data-availability`.
Read alongside `docs/memory/features/home.md` (the most recent ported page) and the confirmed
decisions in `design/react-mockups/docs/data-availability-prototype-ref.md §11`.

---

## Critical blocker: no datatake API endpoint exists

The current OpenAPI contract (`sentiboard-frontend/api/openapi.json`) exposes five paths:
`/anomaly/`, `/instantmessage/`, `/news/`, `/processor/`, `/health`. There is no datatake endpoint.
**The page cannot be wired to real data until the backend adds one.**

The page's only live dependency is a `GET /datatake/` (or equivalent) endpoint that serves records
from the read-only `cds-*` OpenSearch indices. Every other piece of the page is pure client-side
logic driven by that payload.

This plan describes the full frontend port. Sessions 1–4 build the page with mock data from
`design/react-mockups/src/pages/data_availability/mock.ts`. Session 5 replaces mock data with the
real endpoint once the backend ships it. Session 6 wires the Events-page datatake links. Session 7
handles SEO, the ported flag, the sitemap, redirects and docs.

---

## Gap summary: mock-up vs. real app, block by block

### Route and shell

The placeholder is at `src/app/availability/page.tsx` (3 lines: `ComingSoon` + metadata).
`src/lib/routes.ts:16` sets `path: "/availability"`, `ported: false`. No other availability files
exist in the real frontend. The mock-up component is
`design/react-mockups/src/pages/data_availability/data-availability.tsx` (1035 lines).

### PageHeader / hero

Mock-up · `PageHeader title="Data Availability"` with the module image at
`/assets/img/modules/availability.jpg` and `AVAILABILITY_DESCRIPTION` (defined in the mockup's
`src/data/copy.ts`, but the Description text is recorded in the prototype ref §9 verbatim — that
text is already the production SentiBoard copy, not invented).

Real app · `availability.jpg` is already committed at
`sentiboard-frontend/public/assets/img/modules/availability.jpg` (239 KB — no copy needed;
committed during the home page groundwork, October 2026). `PageHeader` is in
`src/components/PageHeader.tsx`. `AVAILABILITY_DESCRIPTION` does not exist yet in the real frontend;
it will live in `src/features/availability/copy.tsx`. The description copy plus its "Completeness"
legend is confirmed (prototype ref Decision 10, §9).

Suggested fix: create `src/features/availability/copy.tsx` with the verbatim §9 text and the five
status-colour legend entries. Pass it to `PageHeader`.

### SpaceBackdrop

Mock-up · `<SpaceBackdrop page={1} paused={motion.paused} />`.

Real app · `SpaceBackdrop` is in `src/components/SpaceBackdrop.tsx`. `page={1}` means the
Processors window (per the 2026-10-26 Processors Session 2 decision). The correct `page` value
for the Data Availability window is not recorded; check `SpaceBackdrop`'s prop definition against
the prototype HTML before wiring.

### KPIs (counters block)

Mock-up · Four counters: `Datatakes in range`, `Mean completeness`, `Coverage gaps`,
`Datatakes lost`. Rendered by the mock inside `<Reveal className={s.counters}>`.
`counterV.crit` colours "Datatakes lost" in `#E8514B`.

Real app · No KPI block. The confirmed computations (prototype ref §2, Decisions 4/13):

- `Datatakes in range` — count of matching (in-window + filters + search) records.
- `Mean completeness` — arithmetic mean of `completeness` for records where status is not
  Planned or Processing; `"—"` when none exist (Decision 13).
- `Coverage gaps` — **open (Decisions for Ana #1)**: prototype counts satellite-days with zero
  matching datatakes; mock's `isGap` counts Partial + Unavailable records. Choose before Session 2.
- `Datatakes lost` — count of Unavailable records. Coloured `#E8514B`.
- KPIs update on window/filter/search changes but **do not follow the picked bar**.
- Count-up animation: prototype ref §2 specifies 620 ms ease-out from the previous value. Add it
  only if Acquisitions/Events KPIs have it (they do not as of 2026-10-27) — see Decisions for
  Ana #9.

Suggested fix: port the four counters as a pure computation block in `Explorer.tsx` (client
component); derive from the `matching` array that the strips already use.

### Filter toolbar

Mock-up · One centred wrapping flex row. Controls in order: range heading, 1D/7D/30D/CUSTOM
buttons, pager ‹ dates ›, From/To (Custom only), Mission dropdown, Status dropdown, search input,
Reset button.

Real app · No filter toolbar. Differences from current placeholder (none; it is Coming Soon):

- **Range heading** — `"Last 24 hours"` / `"Last 7 days"` / `"Last 30 days"` / `"Custom range"`;
  `clamp(17px, 1.7vw, 22px)`, `font-weight: 700`, `text-transform: uppercase`, 6 px right margin.
  Mock-up uses a React state string; the real app must store `rangeId` + `offset` in the URL.
- **Range buttons** — 1D / 7D / 30D / CUSTOM. Active = white with 2 px cyan underline. Hover:
  no change (the !important `.72` opacity wins in the prototype; replicate it).
- **Pager** — ‹ (disabled at data start) · date range label · › (disabled at offset 0 or Custom).
  Step = one day, staying on the preset (Decision 3). ← / → arrow keys do the same, disabled
  when the datatake card is open (add an input-focus guard the prototype lacks). Label text:
  `YYYY-MM-DD → YYYY-MM-DD`.
- **Pager label click** — switches to Custom, shows From/To pre-filled, opens the From picker.
- **From / To** — visible only in Custom, on the shared 49 px hairline (Decision 7). `<input
type="date">` with a separate calendar-icon button (`showPicker()`). Min/max from the data
  boundary. If From > To, swap on change. Prototype ref §3.3 has the full CSS.
- **Mission dropdown** — multi-toggle, no "All". Items: `Sentinel-1`, `Sentinel-2`, `Sentinel-3`,
  `Sentinel-5P`. Plain names, no dot (prototype ref §3.4 `#fMissions .fitem { i display:none }`).
  Value text: empty when all on, `N/4` otherwise.
- **Status dropdown** — multi-toggle, no "All". Items with status dots: Planned `#7A8696`,
  Processing `#5B9BE8`, Acquired `#3FCF7F`, Partial `#F0A63A`, Unavailable `#E8514B`.
  Value text: empty when all on, `N/5` otherwise.
- **Dropdown behaviour** — one open at a time; Escape or click outside closes it (Decision 5
  confirmed: shared dropdown behaviour wins over the prototype's several-open-at-once).
  List opens **in flow** (pushes page down), no absolute overlay.
  The CSS uses `inert` on the closed body — watch for the React 19 hydration mismatch pattern
  documented in DECISIONS.md 2026-10-26 "Filter dropdowns: replaced inert with CSS visibility".
  Use `visibility: hidden` on the closed inner, not `inert` on the body div.
- **Search** — substring match on datatake ID, case-insensitive. Placeholder `"Datatake ID"`.
  `min-width: 210px`. No focus-state hairline change.
- **Reset** — always enabled; sets 30D / offset 0 / all missions on / all statuses on / search
  cleared / closes card. Hover: no change.

URL state: `rangeId` (1|7|30|null), `offset`, `customFrom`, `customTo`, `missionsOff` (CSV),
`statusesOff` (CSV), `q` (search), `pick` (picked datatake id). Model after
`src/features/processors/url-state.ts` and `src/features/events/url-state.ts`.

### Strips (bands)

Mock-up · One `div.row-band` per active mission, in order S1 / S2 / S3 / S5P. Each band is
`height: var(--bandh)` = `clamp(74px, 16.5vh, 190px)`, `margin-bottom: 10px`, relative. The label
is at `top: 66%, translateY(-50%)`, the strip `.cov-cells` also at `66%` and `46%` tall, the axis
at `90%`. The strip has `left: 60px; right: 4px`.

Real app · No bands. All the absolute-positioning geometry is new CSS. The prototype ref §6.1
has exact values; port verbatim. The mockup's CSS module has 954 lines; the global
`data-availability.css` (521 lines) is dead weight from the older `DataAvailability.tsx` proposal —
do not port it.

- **Folding** — `framesOf(list)` from `mock.ts`: at most 96 bars per strip, grouped oldest-first,
  each group's worst (lowest finalized completeness; Planned/Processing rank 101) shown.
  Bar centre: `((k + 0.5) / n) * 100 %`. Bar width CSS: `--tw: (76 / n) %`.
- **Bar colours** — `barColor` from `mock.ts`: Planned `#7A8696`, Processing `#5B9BE8`,
  completeness bands `[{≥90,'#12E874'},{≥80,'#46B96A'},{≥50,'#FFD01E'},{≥30,'#F0A63A'},
{≥1,'#E8200F'}]`, missing (`pct=0` / Unavailable) `#8B98A6` (Decision 15 reverted: grey, no
  hatching).
- **Entrance animation** — on load, range change, Custom apply, Reset only (`animKey` counter).
  Delay per bar: `min(420, rowIndex × 45 + barIndex × 2.4)` ms. On other renders
  (`animation: none` on `.tile`). Keep the keyframe with `translateX(-50%)` so bars do not jump.
- **Zoom** — click a bar: strip scales to 1.9 from the bar's centre (`transformOrigin`), axis
  fades out (`.zoomed`), every other bar in every row → `.faded` (opacity 0.45). Click same bar /
  Escape / × / range change / Reset: zoom out (700 ms `cubic-bezier(.8,0,.8,.3)`). Click another
  bar: card swaps content, zoom moves. Headroom: the 43 % above the strip absorbs the 1.9×
  growth (prototype ref Decision 8 — keep the `overflow-x: clip` on the lane, vertical unclipped).
- **Axis** — `top: 90%` in the band; `border-top: 1px solid rgba(255,255,255,0.22)`. Tick
  labels with two `text-shadow`. `axisTicks` from `mock.ts`: 5 intervals (4 for ≤3 day windows),
  `DD/MM` (+ ` HH:00` for short windows). First/last tick CSS: flush left/right.
- **Empty strip** — `"No datatakes in range"` in `.cov-none`.

### Hover tooltip

Mock-up · A single fixed `<div>` portal (`createPortal(…, document.body)`) populated on bar
`mouseenter`, hidden on `mouseleave` and `scroll`. Position: `clientX + 18, clientY − h − 14`;
right-overflow: `clientX − w − 18`; top-overflow: `clientY + 20`. Content: `ID`, Acquisition +
Publication `pct%` (or `"—"`), Start + Stop (UTC HH:MM). CSS: `position:fixed; z-index:55;
min-width:226px; border-radius:14px; backdrop-filter:blur(9px)`.

Real app · `tipOn` / `display:block` pattern (no React state for `on` class — use the portal +
class approach from the mockup, or the `opacity`/`translateY` tip pattern from Processors).
Prototype ref §6.5 has exact HTML and CSS. Port faithfully.

### Datatake card (inline panel)

Mock-up · `DatatakeCard` mounts under the picked band's `div.mapRowContainer`. Phase: `open`
(560ms height + 400ms opacity delayed 120ms), `swap` (instant), `close` (560ms close + unmount
after 620ms). Uses double-rAF + `scrollHeight` imperatively (same pattern as `NewsBar.tsx` and
events drawer).

Real app · No card. Differences (prototype ref §10 "Card type" / §7):

- **Two rings** (Acquisition, Publication) — inline SVG, `viewBox 0 0 70 70`, `r 27`, track
  `rgba(255,255,255,0.14)` w9, arc in side colour w9, `strokeDasharray`. No draw-in animation
  (Decision 15 area). Centre: `COMPLETENESS` label + `pct.toFixed(2)%` (or `"—"`).
- **Publication** — derived from `pct` and `status` by `cardSides()` in the mockup; mirrors the
  prototype ref §4 semantics. Processing → `ACQUIRED` badge but grey ring. Unavailable → pub = 0,
  badge `MISSING`, grey.
- **Sensor mode row** — open (Decisions for Ana #2): prototype ref Decision 9 removes it; real data
  has `instrument_mode`; the Description text mentions it. Confirm with Ana before Session 4.
- **Metadata rows**: `Data take ID`, `Platform` (satellite), `Sensor mode` (if Ana #2 → keep),
  `Start date`, `Stop date`, `Acquisition` (badge), `Publication` (badge).
- **Card contrast** — open (Decisions for Ana #3): prototype ref Decision 11 recommends keeping
  brighter ink ramp (`--card-ink-2 .78` etc.) rather than the absolute `#6B7686`/`#4E5866`. All
  sizes, weights, spacing and borders from §7.

---

## Data gaps

**Primary gap: no datatake endpoint.** The backend has no endpoint that exposes CDS datatake data.
The Sentiboard backend currently reads from four Sentiboard-owned OpenSearch indices (anomaly, news,
instantmessage, processor). Datatake data lives in the read-only `cds-*` indices managed by
MAAS-CDS (AGENTS.md §3.3: read-only). The backend must add a new `GET /datatake/` endpoint (or
similar) that queries those indices.

The real CDS index field names are confirmed by reading `apps/elastic/modules/datatakes.py` and `apps/routes/home/routes.py` on `origin/main`. The document identifier is `datatake_id`, which is stored both as the OpenSearch `_id` and in `_source.datatake_id`. Satellite is `satellite_unit` (e.g. `S1A`, `S2B`, `S3A`, `S5P`); mission is derived from its first two characters. Timing is `observation_time_start` and `observation_time_stop`, both in `"%Y-%m-%dT%H:%M:%S.%fZ"` format. Instrument mode is `instrument_mode` for S1/S2 (a direct index field); for S3 and S5P it is derived from `product_type[5:8]` by the query layer.

Completeness is not a flat field in the index. For S1 and S2 the index stores per-product `*_local_percentage` fields (e.g. one per polarisation or product sub-type); the query layer averages them into `L0_`, `L1_`, and `L2_` keys. For S3 and S5P the index stores a `percentage` field per product record, grouped by `product_level`, averaged into the same `L0_`/`L1_`/`L2_` keys. These per-level averages are then passed to `_calc_datatake_completeness_status()`, which produces the `ACQ` and `PUB` objects that the frontend consumes. Status and percentage must therefore be computed by the backend endpoint, not by the frontend adapter.

`_calc_datatake_completeness_status()` works as follows. If `now ≤ observation_time_stop`, both ACQ and PUB are PLANNED with percentage 0. If elapsed time since stop is less than a mission-specific `time_threshold` (hours), ACQ is ACQUIRED (if percentage > 90%) or PROCESSING; PUB is PUBLISHED or PROCESSING. If elapsed is less than `time_threshold × 1.2` and percentage is below 90%, both are DELAYED. Otherwise: ≥ 90% → ACQUIRED / PUBLISHED; 10–90% → PARTIAL; < 10% → UNAVAILABLE. ACQ percentage = `L0_` (falling back to `L1_` then `L2_`). PUB percentage = arithmetic mean of all levels present. ACQ status vocabulary: PLANNED, PROCESSING, ACQUIRED, PARTIAL, DELAYED, UNAVAILABLE. PUB status vocabulary: PLANNED, PROCESSING, PUBLISHED, PARTIAL, DELAYED, UNAVAILABLE. The mockup uses five values (Planned, Processing, Acquired, Partial, Unavailable); DELAYED and PUBLISHED are real statuses the adapter must map or pass through.

The legacy route serves a lightweight list: each record carries `id`, `platform` (`satellite_unit`), `start_time`/`observation_time_start`, `stop_time`/`observation_time_stop`, `acquisition_status`, `publication_status`, and a `raw` dict that includes the full `completeness_status` object. Only the first record is enriched for SSR; the rest are lightweight. Card detail is loaded on click via a separate POST to `/data-availability/enrich` (`enrich_datatake_modal`), which calls `datatakes_cache.load_datatake_details(datatake_id)` then `enrich_datatake()`, returning the per-product `completeness_list`, `instrument_mode`, timing, and CAMS ticket metadata. The new backend endpoint should replicate this list + enrich-on-click pattern.

**Required query parameters**: `date_from`, `date_to` (ISO date), optionally `mission` (multi),
`satellite_unit` (multi). Stakeholders now want the full history available in the range picker, not
just three months. Without server-side date filtering the frontend cannot fetch this page — an
unbounded history across S1/S2/S3/S5P would be an unacceptably large payload. How to bound a single view is Decisions for Ana #11. The §9 description
text, which currently references the three-month window, must also be updated (see Decisions for
Ana #13).

**Secondary gap: KPI formula for Coverage gaps.** The prototype counts satellite-days (one per
satellite per calendar day) that have no matching datatake — a "hole in the schedule". The current
mock instead counts `isGap` (Partial + Unavailable records). The final definition belongs to the
backend developer or Ana; it changes the adapter, not the UI.

**Publication completeness — resolved.** The legacy code computes it: the PUB percentage is the
mean of the L0/L1/L2 levels present (see `_calc_datatake_completeness_status()` above). The backend
endpoint should return it already computed; `cardSides()` stays only for the mock data.

---

## Decisions for Ana

1. **Coverage gaps KPI formula.** Prototype: satellite-days with no datatake. Mock's `isGap`:
   count of Partial + Unavailable records. Which number is operationally meaningful for the ops
   team? This determines the adapter and the backend query.

2. **Sensor mode row in the card** (prototype ref Decision 9). The prototype removes it; the
   Description copy mentions it; the real data has it. Keep or remove?

3. **Card contrast** (prototype ref Decision 11). Prototype uses `#6B7686`/`#4E5866` ink;
   current code and the recommended approach keep the brighter `rgba(255,255,255,.78)` ramp.
   Confirm which to use.

4. **Processing completeness in the card** (prototype ref Decision 6). Prototype: acquisition ring
   shows `"—"` and grey `#7A8696`, badge reads `ACQUIRED`. Current mock shows a simulated partial
   value. Follow the prototype (recommended, keeps one rule for Planned and Processing).

5. **Chart library.** No new dependency is needed. The two rings are inline SVG (straightforward
   `strokeDasharray` arcs). The bars are `<button>` elements coloured by CSS custom property. If
   at any point a chart library is wanted, this is the decision point; currently the answer is no.

6. **Legacy URLs.** From `HANDOFF.md` and the events page's legacy deep-link notes, the legacy
   URL is `/data-availability` (and presumably `/data-availability.html`). Events linked to it as
   `/data-availability?event_id=<key>` and `/data-availability?search=<id>&period=prev-quarter`.
   The new page URL is `/availability`. Confirm:
   a. Both `/data-availability.html` and `/data-availability` → `/availability` (308)?
   b. What should `?event_id=<key>` and `?search=<id>` map to in the new URL? Suggested:
   `?event_id=` → drop (event filter not in the new page); `?search=<id>` → `?q=<id>`.

7. **URL search params naming.** Proposed: `?range=1|7|30|custom`, `?from=YYYY-MM-DD`,
   `?to=YYYY-MM-DD`, `?offset=N`, `?missionsOff=S1,S2`, `?statusesOff=Planned,Processing`,
   `?q=<id>`, `?pick=<datatake-id>`. Confirm before Session 2 so it is stable across sessions.

8. **`SpaceBackdrop page` value.** The mock uses `page={1}` (Processors window). Verify which
   value gives the Data Availability background; check with the prototype HTML if in doubt.

9. **KPI count-up animation.** The prototype ref §2 specifies a 620 ms ease-out count-up. Events
   and Acquisitions pages do not have this. Match the other pages (omit the animation for
   consistency) or add it here alone?

10. **Backend endpoint name and filter parameters.** The API contract must be agreed and committed
    to `sentiboard-frontend/api/openapi.json` before Session 5 can start.

11. **Full-history range bound.** Stakeholders want the full available history, not just three
    months. A single view must still be bounded to keep payloads manageable. Decide whether to cap
    the Custom range picker at a maximum span (e.g. one year enforced client-side), or have the
    backend fold records to at most 96 bars per mission per date range server-side regardless of
    the requested span. This affects the Custom picker min/max, `framesOf`, and the backend query
    contract — confirm before Session 2.

12. **Full history: access roles.** The legacy page restricted the "previous quarter" window to
    authenticated users with roles `admin`, `ecuser`, or `esauser`; the default 7-day view was
    public. With full history now the stated goal, decide whether the entire history is publicly
    accessible or whether windows beyond some threshold (e.g. beyond 30 days) require
    authentication. This determines whether the backend query gate checks the session role and
    whether the toolbar needs a login prompt for longer ranges.

13. **§9 description copy update.** The current §9 description text (committed in the prototype
    ref) references the three-month window. It must be revised to reflect full-history access.
    Confirm the new wording before Session 7, where it feeds both the `PageHeader` subtitle and the
    SEO metadata.

14. **DELAYED status.** The legacy logic produces a DELAYED status (data arrived late, percentage
    still below 90%) that the mockup's five statuses do not include. Decide whether it gets its own
    colour and Status-filter entry, or is folded into Processing. Confirm before Session 2.

---

## Reusable pieces

The following already exist in the real app and should be imported directly, not duplicated:

- `src/components/SpaceBackdrop.tsx` — starfield backdrop.
- `src/components/PageHeader.tsx` — hero with title, subtitle, description, image.
- `src/components/Reveal.tsx` — scroll-linked fade-in (used for KPI counters and the strips block).
- `src/lib/utc-date.ts` — `utcDateStr`, `utcTimeStr`, `pad`, `utcDayMonthYearStr`.
- `src/lib/api/paginate.ts` — `fetchAll` helper (for the data loader once the endpoint exists).
- `FilterDropdown` pattern — inert-free CSS-visibility `<details>/<summary>` or the in-flow
  grid-template-rows pattern from the events Explorer. Port the data-availability variant
  separately (its semantics differ: multi-toggle, no "All").
- `src/styles/tokens.css` — add `--bandh`, `--da-*` tokens if needed rather than hardcoding.

The following must be newly created per-page in `src/features/availability/`:

- `copy.tsx` — `AVAILABILITY_DESCRIPTION` (§9 text), status-colour legend.
- `url-state.ts` — parse and serialise URL search params for range/offset/custom/missions/
  statuses/search/pick.
- `model.ts` — `Datatake` type, `framesOf`, `axisTicks`, `barColor`, `BANDS`, `cardSides`.
  These are pure functions from `mock.ts` and the prototype ref; no browser API, fully testable.
- `adapter.ts` — maps raw backend records to `Datatake[]`; classifies status; derives satellite
  and mission. Runs server-side only (`"server-only"`). Uses `src/lib/utc-date.ts`.
- `data.ts` — `getDatatakes(from, to)`, purely `"use cache"`, `cacheLife`, `cacheTag("datatakes")`.
  `connection()` is called by the async server component, not here. Cache duration: description says
  "refreshed hourly" → `stale: 3600, revalidate: 3600, expire: 86400`.
- `Explorer.tsx` — `"use client"`. All interactive state + strips + card + tooltip.
- `availability.module.css` — ported from the mockup's CSS module; trim dead code.

---

## Volume estimate

The figures below are estimates. Before finalising the backend endpoint design, read the legacy Flask
app's data availability query at `apps/elastic/modules/datatakes.py` on `origin/main` — it will
show real record counts, whether the legacy app paginated or used aggregations, and what size payload
the page handled in production.

The mockup generates 900 datatakes over 93 days = ~9.7 / day across four missions. Real Sentinel
missions produce far more: a single S1 pass can yield 10–30 datatakes, and S2 runs near-continuous
coverage. A rough lower bound for the default 31-day (30D) window is 5,000–20,000 records;
with full history the total is unbounded — the backend date range is the only bound that matters. Check the legacy app first — the real number may be larger or
the legacy app may have already solved this with aggregation rather than raw records.

This means:

- **Server-side date filtering is mandatory.** The frontend cannot fetch all records and filter
  client-side. The backend endpoint must accept `date_from` / `date_to` query parameters.
- **Page-by-page fetch or a compact summary endpoint.** If the backend returns raw records
  (one JSON object per datatake), a 31-day window may be a 1–5 MB payload. The `fetchAll`
  paging pattern (1000 records per page) works but requires 5–20 round-trips. The backend team
  should consider whether to return compact records (id, satellite, status, completeness, start)
  without full metadata, loading the card's full detail on demand via `GET /datatake/{id}`.
- **Caching is essential.** The `use cache` / `cacheLife` pattern (Events: per-day RSC re-render
  for full detail; Processors: all records warm in ~45 ms) applies. Cache the full window at the
  selected parameters; the toolbar's filter/search operate client-side on the cached payload.
  Mission filtering could be server-side (fewer records) or client-side (one cache key); given the
  volume, server-side mission filtering is preferred.
- **The typical view** (30D, all missions on) would need to fetch all records for that window.
  With client-side mission/status/search filtering, the server returns everything for the date
  window and the client filters. That is the pattern used in Events (3720 records, all in memory).

---

## Session split

Each session is one Claude Code run. Sessions are ordered so that the page is incrementally
functional after each one.

### Session 1 — Static shell and CSS

Files: `src/app/availability/page.tsx` (replace placeholder with real page),
`src/features/availability/copy.tsx`, `src/features/availability/availability.module.css`
(ported from mockup's `availability.module.css`, dead code removed), any new tokens in
`src/styles/tokens.css` (`--bandh` and `--da-*`).

Goal: the page renders the PageHeader, SpaceBackdrop, the counters block (static zeros), and the
toolbar shell (range heading + 1D/7D/30D/CUSTOM buttons, no pager or dropdowns yet). All CSS
classes present. `ported` stays `false`. No data fetch.

Prerequisite: Decisions for Ana #5 (no chart library), #8 (SpaceBackdrop page).

### Session 2 — URL state, toolbar, KPI computations, mock data

Files: `src/features/availability/url-state.ts`, `src/features/availability/model.ts`,
`Explorer.tsx` (initial version, client component), page.tsx wired to Explorer.

Goal: all toolbar controls work (range, pager ← →, From/To, Mission, Status, search, Reset) with
URL state. KPIs compute correctly from mock data. `framesOf`, `axisTicks`, `barColor`, `cardSides`
all in `model.ts` with tests. The filter dropdowns use CSS-visibility (no `inert` on server-rendered
elements). Decisions for Ana #1 (Coverage gaps formula) must be resolved before this session.

Prerequisite: Decisions for Ana #1 (Coverage gaps), #7 (URL param names).

### Session 3 — Strips, zoom, axis, entrance animation

Files: continuation of `Explorer.tsx`, `availability.module.css` (band geometry section).

Goal: four mission bands render with real folded bars from mock data. Bar colours correct.
Entrance animation on load and range changes. Zoom (click bar → 1.9× scale, axis fades, other bars
fade). Click same bar → zoom out. Escape → zoom out. ← / → keys move pager when no card open.
Hover tooltip portal with position logic.

### Session 4 — Datatake card (inline panel)

Files: `DatatakeCard` in `Explorer.tsx` (or a separate `DatatakeCard.tsx`).

Goal: clicking a bar opens the inline panel below the band. Two rings (SVG, no draw-in animation).
Metadata table (ID, Platform, Sensor mode if Ana #2 → keep, Start, Stop, Acquisition badge,
Publication badge). Height-grow open animation; height-shrink close; swap on bar change. Reduced
motion: instant open/close. Card closes on Escape, Reset, range/pager change.

Prerequisite: Decisions for Ana #2 (sensor mode row), #3 (card contrast), #4 (Processing card).

### Session 5 — Real data wiring (requires backend endpoint)

Files: `src/features/availability/adapter.ts`, `src/features/availability/data.ts`.

Goal: replace mock data with the real backend. `getDatatakes(from, to, missions?)` in `data.ts`
is purely `"use cache"` with `cacheLife({ stale:3600, revalidate:3600, expire:86400 })` and
`cacheTag` — a cached function cannot contain request-time calls, so `connection()` does not go
here. Instead, a thin async server component in `page.tsx` (call it `AvailabilityContent`, mirroring
`NewsBarContent` from the home page) calls `await connection()` and then `getDatatakes()`, and is
wrapped in `<Suspense>` (PPR pattern; Explorer is `"use client"` and streams inside it). Adapter
maps raw records to `Datatake[]`, derives `mission` from `satellite_unit`, classifies `status`,
formats dates. Degraded state when backend is unreachable.

Prerequisite: `openapi.json` updated with the datatake endpoint contract; `pnpm gen:api` run.

### Session 6 — Events links wired (after Session 5)

Files: `src/features/events/Explorer.tsx`.

Goal: wire the two events-page links that HANDOFF.md lists as pending:

- "View all N datatakes →" per occurrence → `ROUTES.availability + ?q=<first-datatake-id>` (or
  no query if there is no equivalent; confirm the final URL scheme first).
- Individual datatake ID links: S1 IDs `S\d[A-Z0-9]-\d+` and others link to
  `/availability?q=<id>` regardless of how far back they fall.

### Session 7 — SEO, ported flag, sitemap, redirects, docs

Files: `src/lib/routes.ts` (flip `ported: true`), `next.config.ts` (add redirects),
`src/app/availability/page.tsx` (metadata export), `docs/memory/features/data-availability.md`
(new feature file), `STATE.md`, `HANDOFF.md`, `DECISIONS.md`.

Goal:

- `ported: true` on `ROUTES.availability` puts the page in the sitemap.
- Redirects (308): `/data-availability.html` → `/availability`, `/data-availability` →
  `/availability`. Confirm whether these are the right legacy URLs (see Decision 6 for Ana).
- SEO metadata: title, description, canonical, OG, Twitter. Port the legacy `PAGE_METADATA`
  entry for `data-availability.html` from the Flask app (in git history on `origin/main` or
  the `apps/routes/` path). If not accessible, derive from the page description.
- Sitemap entry: `changeFrequency: "hourly"` (data "refreshed hourly" per the Description copy),
  `priority: 0.9` (suggest; check legacy `apps/__init__.py` sitemap for the actual value).
- Create `docs/memory/features/data-availability.md` following the `home.md` template.
- Update `STATE.md` to record the fourth ported vertical slice.
- Resolve the HANDOFF.md entry "Events — legacy parity, to do at the end" (the datatake links
  and the `/data-availability?event_id=` redirect).

---

## Files to read before starting each session

Before Session 1: this file, `home.md`, `processors.module.css` (for CSS token patterns),
`tokens.css`, `src/components/PageHeader.tsx`.

Before Session 2: `src/features/processors/url-state.ts`, `src/features/events/url-state.ts`,
`src/features/events/Explorer.tsx` (dropdown visibility pattern), `model.ts` (this session creates
it; use events `model.ts` as the shape reference).

Before Session 3: `src/features/processors/ReleaseTimeline.tsx` (scroll + zoom animation patterns),
`src/features/events/Explorer.tsx` (tooltip portal).

Before Session 4: `src/features/home/NewsBar.tsx` (double-rAF height animation), the events
drawer (same pattern for open/close/swap).

Before Session 5: `src/lib/api/paginate.ts`, `src/features/events/adapter.ts`, `src/features/events/data.ts`, `sentiboard-frontend/api/openapi.json` (must be updated by then).

Before Session 7: `src/lib/routes.ts`, `sentiboard-frontend/next.config.ts`,
`docs/memory/features/home.md` (SEO and sitemap pattern), `STATE.md`, `HANDOFF.md`.
