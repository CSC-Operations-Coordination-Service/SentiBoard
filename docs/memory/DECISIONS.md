# Decisions

Newest last. Each entry: context, decision, consequences. Add an entry before breaking a rule in
AGENTS.md §3.

## 2026-10-21 — Clean URLs; every legacy URL gets a permanent 308 redirect

**Context.** Legacy pages were served as `/<name>.html` (often also `/<name>`), e.g.
`/processors-viewer.html`. AGENTS.md §3.6 requires parity of public URLs unless recorded here.
**Decision.** New pages use clean URLs without `.html` (`/processors`). **General rule for all
future pages:** each legacy URL of a ported page (both the `.html` and the bare form, when legacy
served both) gets a permanent **308** redirect to the new URL in `next.config.ts` `redirects()`.
Query strings pass through. Canonicals, sitemap and Open Graph URLs use the new URL.
**Consequences.** Old links and search results keep working; search engines transfer the URL.
Applied so far: `/processors-viewer.html`, `/processors-viewer` → `/processors`.

## 2026-10-21 — Backend types: openapi-typescript from a committed contract copy

**Decision.** `sentiboard-frontend/api/openapi.json` is a committed copy of the backend contract;
`openapi-typescript` (7.13) generates `src/lib/api/schema.d.ts` from it (`pnpm gen:api`, also run by
`postinstall`). `pnpm gen:api:refresh` downloads `/openapi.json` from `BACKEND_URL` (default
`http://localhost:8000`) first. The generated file is not committed (AGENTS.md §9: no generated
artefacts); contract changes show up as diffs of `openapi.json`.
**Consequences.** A contract change is a deliberate commit; type errors surface in `pnpm type-check`.

## 2026-10-21 — Current-baseline rule lives in the Processors adapter

**Context.** The feed has no status field. It rarely closes superseded releases with a
`validity_end_date`: per the prototype adapter's own note (2026-10-21), 155 of 228 records had no
end date and S3_OL1 alone had 21 open releases, so "no end date" would mark most of a lane current.
**Decision.** On each processor lane (one IPF key), the current baseline is the release valid at
`now` (`validity_start_date ≤ now` and `validity_end_date` null or after `now`) that came into force
most recently; none if no release is valid. Implemented once, in
`features/processors/adapter.ts` → `currentBaselineIndex`; nothing else decides it. `now` is the
time the data was fetched (cached up to 300 s).
**Consequences.** Should the backend ever expose a status, replace the rule there, not in UI code.

## 2026-10-21 — Release notes are sanitized on the server only

**Context.** `release_notes` is raw HTML pasted from Word, Confluence and Jira (inline styles,
`<o:p>`, Jira UI fragments).
**Decision.** `src/lib/sanitize-html.ts` (the prototype's sanitizer, unchanged in logic) runs on the
server on one jsdom window: structure recovered from `white-space: pre` and plain text, then
DOMPurify with an allowlist of content tags and only `href`, `title`, `start`, `colspan`, `rowspan`
(links get `target="_blank" rel="noopener noreferrer"`), then empty shells removed. The module and
everything importing it import `"server-only"`. The adapter sends the browser sanitized HTML, once
per feed record, and a precomputed tooltip line.
**Consequences.** jsdom/DOMPurify never reach a client bundle (build fails if imported client-side;
bundle scanned). Sanitizing is server CPU: ~7 s on a cold cache for 228 records (see HANDOFF.md).

## 2026-10-21 — Server/client split and URL state

**Decision.** Pages are Server Components that fetch through server-only modules and pass plain
data to small client components. Interactive state lives in the URL (one parse/serialise module
per page); client components change it with `history.pushState`/`replaceState` (no server round
trip). Every control is also a plain link or GET form, so pages work without JavaScript; the server
renders a no-JS fallback for browser-only widgets (Processors: the release list), hidden via
`html.js`. Browser-only libraries load with `next/dynamic({ ssr: false })` inside client components.

## 2026-10-21 — Processors data cached 300 s

**Decision.** `GET /processor/` (fetched, adapted and sanitized) is cached with `"use cache"` +
`cacheLife({ stale: 300, revalidate: 300, expire: 3600 })` and tag `processors`.
**Consequences.** **A new release may take up to 5 minutes to appear** (stale-while-revalidate: the
first request after 300 s still gets the old data and triggers the refresh). Failures are never
cached. The legacy app cached the upstream feed for 1 hour.

## 2026-10-21 — Pages whose primary content must work without JavaScript render as one document

**Context.** With Cache Components, request-time data normally streams in behind a `<Suspense>`
fallback. Streamed content arrives in a hidden element that an inline script swaps in, so without
JavaScript the visitor stays on the fallback (only HTML-limited bots get a complete document).
**Decision.** `/processors` awaits its (cached) data at the top of the page, with no Suspense
boundary, and sets `export const instant = false` to opt out of the static-shell check. The HTML
response is complete. No `loading.tsx` for that route (it would reintroduce a streaming boundary).
**Consequences.** Time to first byte equals data time: ~45 ms warm, ~7 s on a cold cache (measured
locally, 2026-10-21). Revisit if a page's data cannot be cached.

## 2026-10-21 — Theme without a flash

**Decision.** `localStorage["sb-theme"]` + `<html data-theme>` (dark default), applied by an inline
script in `<head>` before first paint (same key as the prototype). Server HTML is identical for both
themes: theme-dependent markup is rendered twice and selected by CSS. No theme cookie, so pages stay
cacheable.

## 2026-10-21 — Timeline lane reveal: scroll-linked in JavaScript (the prototype's view() mapping)

**Context.** The prototype revealed lanes with a scroll-linked animation (commits 37782d3 /
b342a73): keyframes opacity 0 → 1 and translateY(15px) → 0, `animation: rowReveal auto linear
both; animation-timeline: view(); animation-range: entry 0% cover 25%` — opacity and rise follow
the scroll position continuously and reverse when scrolling back. A later permanent fade with a
height cap (974756b) hid real lanes and was removed.
**Why not view() itself.** The lane elements sit inside scroll containers that never scroll
vertically (`.tlTrack` overflow hidden, `.tlScroll` overflow-x auto, `.procpane` and `.container`
overflow-x hidden), so a view timeline measures against one of those, not the page. Measured in
Chrome: a `view()` animation on a lane stayed at the same progress (0.868) at page scroll 0, 400,
800 and 1200px — with `fill: both` it would leave lanes part-faded or hidden.
**Decision.** The same mapping is computed in JavaScript (`ReleaseTimeline.tsx`): a passive
scroll/resize listener (plus a ResizeObserver on the page), batched per animation frame, reads the
chart's untransformed box and sets, per lane, progress
`p = clamp((vh − laneTop) / (0.25 · (vh + laneHeight)), 0, 1)` — 0 when the lane's top reaches the
bottom of the window ("entry 0%"), 1 at "cover 25%" — as inline `translate: 0 15px·(1−p)` and
`filter: opacity(p)` on the lane's elements (name, hairline, stems, markers, version labels). These
compose with the elements' own `transform` and `opacity` states and do not affect layout. At p = 1
both properties are removed. No React state, no re-render on scroll.

- **Accepted consequence (chosen by the repo owner over "complete when fully inside"):** as in the
  prototype, a lane reaches full visibility about a quarter of the window above its bottom edge,
  so lanes in the bottom ~25% of the window are part-faded while they sit there.
- **Safety net:** if the page cannot scroll far enough for a lane to reach `cover 25%`, its range
  ends at the maximum scroll instead, so no lane can stay part-faded.
- **Mission change with the timeline on screen:** a staggered entrance (450 ms per lane, ≤ 40 ms
  apart, within 240 ms) via the Web Animations API with only a "from" keyframe, so each lane
  animates from hidden to its current scroll-linked state and scroll-linking carries on when it
  ends. Not on first render, never on zoom or range changes.
- **Reduced motion:** nothing is applied and nothing animates. No mask, fade or height cap may be
  reintroduced to produce the effect.

## 2026-10-22 — Events page: compact EventCard[] to client, EventDetail[] per day on demand

**Context.** The anomaly feed has 3720 records; passing every full EventDetail (with text and
datatakes) to the client would be ~2–4 MB raw. The calendar needs all events for instant
client-side filtering; the drawer shows all events of the selected day, each fully expanded
(DayManifest layout), so every EventDetail for that day is needed.
**Decision.** Server converts every record to a compact `EventCard` (no text, no datatakes) and
passes the full array to the client as `cards`. The server also returns `dayEvents: EventDetail[]`
— all events that share a `startDate` with the URL-selected event — sorted by `startTime`, plus
`selectedEventId: string | null` to identify which one to highlight and scroll into view. Selecting
a day calls `router.push` with the day's first event id (RSC re-render); the server returns that
day's full event list. Filter / month changes use `history.pushState` (instant client-side, no
round-trip).
**Consequences.** Opening a day incurs an RSC round-trip (~45 ms warm). Days with many events
(rare) are all returned; the payload is bounded by the number of events per day, which in practice
is 2–6 records.

## 2026-10-22 — Events text: parse to TextSegment[], never dangerouslySetInnerHTML

**Context.** The `text` field contains raw Confluence markup (`{code:java}`, `{noformat}`), XML
snippets, Java stack traces, and Windows line endings — not sanitised HTML.
**Decision.** `parseTextSegments(text)` in `adapter.ts` extracts code blocks via regex and splits
the rest on `\r?\n`, producing `TextSegment[]` (`text | br | code`). The client renders these as
React elements (`<span>`, `<br/>`, `<pre><code>`) — no dangerouslySetInnerHTML at any point.
**Consequences.** Markup artefacts like `{code:xml}` are displayed verbatim if the closing tag
is absent. The parsed shape is stable for the test suite.

## 2026-10-23 — /events drops the no-JS requirement

**Context.** The 2026-10-21 "Server/client split" decision states pages should work without
JavaScript. For `/processors` this is satisfied by awaiting data at the top level (no Suspense).
For `/events`, the Explorer streams after `await connection()` inside a `<Suspense>` boundary to
achieve Partial Prerender (PPR). The streamed content is delivered via `self.__next_f.push(…)`
scripts; browsers without JS receive only the static shell (PageHeader + EventsDescription) and
see nothing in the `<template id="B:0">` Suspense placeholder.
**Decision.** The no-JS requirement is dropped for `/events`. Awaiting data at the top level would
give up PPR and significantly slow TTFB (~45 ms warm → blocked by network for all visitors, not
just those with JS disabled). A `<noscript>` message is added to the static shell so users without
JS see an explanation rather than a blank page.
**Consequences.** `/events` requires JavaScript. The no-JS fallback claim in the 2026-10-22
EventCard decision is removed.

## 2026-10-23 — Events: only five event types shown

**Context.** The legacy app showed Data access and Archive anomalies under the "All" filter but
hid them from the category legend. Unknown categories (e.g., DD, MP) appeared in "All" with no
label or icon.
**Decision.** The events page shows exactly five types: Acquisition, Calibration, Manoeuvre,
Production, Satellite. The backend feed's "Platform" category maps to Satellite (already done).
A feed value of "Satellite" is also valid. Every other category — Data access, Archive, DD, MP,
any unknown value, empty or null — is excluded before records become EventCards. The whitelist
lives once, in `adapter.ts:mapCategory`. On the live backend (2026-10-23): 2797 Acquisition,
603 Production, 147 Platform (→ Satellite), 102 Manoeuvre, 37 Calibration, 15 Satellite shown;
10 Data access, 4 DD, 3 Archive, 2 MP (total 19) excluded. Excluded records are logged once per
load, grouped by category, via `console.info`. Old URLs with `?category=Other` (or any excluded
type) silently fall back to all categories.
**Consequences.** Category chips, icons, colours and description text have no "Other" entry.
Metrics (Events / Datatakes / Lost / Satellites) count only the shown events.

## 2026-10-23 — Events: datatake completeness is the mean of non-null levels

**Context.** Two completeness representations were in flight: the drawer rows computed a "best"
(minimum) completeness level, while `isFullyRecovered` checked each level individually. This gave
inconsistent status classifications and a "Lost datatakes" metric that counted any level < 100 %
(matching no legacy metric).
**Decision.** One rule, applied everywhere from a single location (`event-types.tsx`):

- `meanCompleteness(dt)` returns the arithmetic mean of the non-null levels (L0, L1, L2), or
  `null` when all are null.
- `classifyDatatake(dt)` classifies one datatake: ACQUIRED (mean ≥ 90), PARTIAL (10 ≤ mean < 90),
  LOST (mean < 10), NO DATA (null mean). Status and colour come from `STATUS_COLOR`/`STATUS_LABEL`.
- `classifyImpact(datatakes)` classifies an event: lost if any LOST, partial if any PARTIAL,
  acquired if all acquired, noData if all noData or empty. Used for the occurrence dot.
- `isFullyRecovered(datatakes)` in `adapter.ts` uses `classifyDatatake`: at least one datatake
  with data, and every datatake with data is ACQUIRED.
- "Lost datatakes" metric counts datatakes with LOST status (mean < 10 %).
  All four call sites (drawer row, impact dot, fully-recovered filter, metrics) import from
  `event-types.tsx`; nothing computes completeness or status locally.
  **Consequences.** A datatake with e.g. L0 = 100, L1 = 80, L2 = null has mean 90 → ACQUIRED and
  counts as fully recovered. This differs from a per-level threshold. The mean better reflects
  overall throughput rather than the worst single processing level.

## 2026-10-23 — Events: fully-recovered events hidden before EventCards

**Context.** The legacy app excluded events where every datatake had a `fullRecover` flag set by
the server. The new frontend receives raw completeness levels (L0, L1, L2) with no server-side
flag. Some events shown to users (e.g. "[S1C PRIP] several out of timeliness…") had 98 datatakes
all ACQUIRED at 100 %, with 0 unavailable — visually indistinguishable from resolved, and
inconsistent with the legacy hide behaviour.
**Decision.** `isFullyRecovered(datatakes)` in `adapter.ts` returns `true` when at least one real
(non-`noData`) datatake exists and every real datatake has all non-null levels ≥ 90 %. Events that
pass this check are excluded from `adaptEvents()` before `EventCard[]` or `dayEvents` are built —
the calendar, drawer and all metrics never see them. Events with zero datatakes or with only noData
datatakes are _not_ considered fully recovered and are kept. The excluded count is logged once per
load via `console.info("[events] excluded N fully-recovered events (all datatakes ≥ 90 %)")`.
**Threshold rationale.** 90 % matches the threshold used by `classifyImpact` / `classifyDatatake`
to classify a datatake as "spared" (ACQUIRED). An event is fully recovered when all its datatakes
are in the spared band.
**Consequences.** Fully-recovered events disappear from every surface (calendar dots, drawer list,
metrics). The filter runs server-side in the adapter; the client is unaware of excluded records.

## 2026-10-22 — Frontend tests: Vitest in plain Node, real fixtures, no network

**Decision.** `sentiboard-frontend` tests run with Vitest (`pnpm test`, config `vitest.config.mts`),
test files next to the modules (`*.test.ts`), in the plain Node environment: the sanitizer builds
its own jsdom window, and tests that inspect HTML parse it with jsdom. `server-only` is aliased to
its own `empty.js` (what Next resolves on the server), so modules keep their guard. `next/cache` is
mocked and `fetch` stubbed per test; tests never reach a backend or the network. Real release notes
come from a committed fixture of six records captured from the backend (provenance in the file),
not from live calls.
**Consequences.** Tests cover pure modules and data loading; rendering and browser behaviour are
not under automated test (see HANDOFF.md).

## 2026-10-26 — Processors Session 2: CSS, KPIs, toolbar, satellite, page join

Applied MOCK's `processors.module.css` with the following deviations from the prototype reference:

**Kept for now (Session 3a will update when ReleaseTimeline is ported):**

- `.tip` / `.tipBelow` / `@keyframes tipIn` — REAL's `ReleaseTimeline` positions the tooltip with
  `transform:translate(-50%,-100%)` and uses `animation:tipIn` for its entrance, not the MOCK's
  `opacity:0 + .tipOn` toggle. Replacing the rule would hide every tooltip until `tipOn` is added
  to the timeline component.
- `.ttWide` — used by `ReleaseTimeline` for the "Changes" row in the tooltip; not present in MOCK.

**Tokens added to `tokens.css`** (dark + light):
`--pr-current`, `--pr-past`, `--pr-current-text`, `--pr-mis-1/2/3/5P` (dark only).
Values match the MOCK exactly.

**`page-header.css`:** added `.dot-bl-current` and `.dot-bl-superseded` using the new tokens.

**Satellite images:** copied `s1/s2/s3/s5p.webp` from the mock branch into
`public/assets/img/satellites/`; REAL's `.png` variants (`s1_/s2_/s3_/s5_`) are left in place
(nothing references them now).

**`FilterDropdown`:** kept `<details>/<summary>` for the no-JS fallback. Applied MOCK's `fdrop*`
CSS classes. Open/close animation uses `details[open] .fdropBody { grid-template-rows: 1fr }`
instead of a JS-toggled class, so it works with and without JS. Closing animation is instant
(native `<details>`) rather than 420 ms — acceptable for now.

**Escape handler:** single handler in `Explorer` (the own handler in `FilterDropdown` is removed).
On Escape: closes the first open `<details>` and refocuses its `<summary>`; else closes the
detail pane.

**`Reveal`:** implemented as a local function in `Explorer.tsx` using `IntersectionObserver` and
the existing global `.reveal` / `.reveal.in` CSS classes, since no shared `Reveal` component
exists in REAL.

**KPI counters:** changed to MOCK's counters block (`b.counterV` over `span.counterK`) wrapped in
`Reveal`. Formulas: last year = `r.ms > (now − 365 d)`, latest = year of `max(r.ms ≤ now)`.

**`SpaceBackdrop`:** changed to `page={2}` (Processors window); removed `paused` prop and sky
strip; `turn` (orbit rotation) is out of scope for this session.

## 2026-10-26 — Real-data Session 3a: Decisions 13–17 applied to REAL; scroll-linked lane reveal removed

### Decisions 13, 14, 15 (chart, names, axis)

Applied as specified in the prototype ref §16:

- **Decision 13 (§6.1):** `buildAxis()` returns `minWidth: Math.max(600, Math.round(100 + 6 * months))`
  instead of the hardcoded 600. Width follows the animated window each frame.
- **Decision 14 (§6.3):** `laneName()` in `model.ts` now also strips a leading `MSI ` or `TROPOMI `
  prefix after the mission prefix: `"S2 MSI L1" → "L1"`, `"S5P TROPOMI L2" → "L2"`.
- **Decision 15 (§6.4):** `leadRoom` removed from `buildAxis()`; the first year in view is always
  labelled. "2013" may overprint "2014" in All at the far-left scroll edge — accepted.

### Decision 6 (§3.4) — searchText precomputed in the adapter

**Context.** The prototype computes the search haystack client-side in a `useMemo` per render.
**Decision.** `searchText` is precomputed in `adapter.ts` once per release and added to
`ReleaseRecord`. Content: `[label, sub, baseline, processingBaseline, year, notesText].join(" ").toLowerCase()`.
`ReleaseTimeline` uses it for all-words AND search (`every word is a substring of searchText`).
**Consequence.** Moves CPU from client (per render) to server (once per cache invalidation).
Payload grows by roughly the sum of searchText strings (~4–6 KB raw uncompressed across all releases;
much less after GZip, since the words are repeated across records).

### Decision 17 (§8) — tooltip: always-mounted portal with §8 placement and fade

Applied as specified in the prototype ref §16 Decision 17:

- Always-mounted portal (`createPortal` is always rendered; `tipOn` state controls `opacity`).
- `.tip { opacity:0; transform:translateY(4px); transition:opacity 0.18s ease,transform 0.18s ease }` + `.tipOn { opacity:1; transform:none }`.
- `useLayoutEffect([tip])` places the card using real `offsetWidth`/`offsetHeight` after content renders, then fires rAF to add `tipOn=true`.
- `skyTop = .nav getBoundingClientRect().bottom + 8`; `skyBot = innerHeight − 12`.
- Full §8 above → below → beside algorithm; position set via `el.style.left/top`.
- `hideTip` cancels any pending rAF and sets `tipOn=false`.
- Page-scroll hide via `window.addEventListener("scroll", hide, true)` (capture phase).
- Chart-scroll, mouseleave, blur and click all call `hideTip`.
- `.ttWide` removed from Changes row — Changes is now inline in the 2-column grid.
- `@media(prefers-reduced-motion:reduce){ .tip{transition:none} }`.
- **Deviation from Decision 17:** `verOf(r)` used for the Version row in the tooltip when `baseline === "—"`, showing `Mon YYYY` instead of "—".

### Scroll-linked lane reveal — removed (overrides 2026-10-21 decision)

**Context.** The 2026-10-21 DECISIONS.md entry implemented a JavaScript scroll-linked reveal in
`ReleaseTimeline.tsx` as a substitute for `animation-timeline: view()` (which cannot work inside
the chart's scroll containers).
**Decision.** The scroll-linked reveal is removed as of Real-data Session 3a. The MOCK (Session 4) does not
include it: the prototype ref specifies a horizon mask (§21 / Decision 21, applied in Session 6b)
instead. The horizon mask already masks content below the planet line; adding a per-lane reveal on
top would produce a double-masking effect.
**What was removed from ReleaseTimeline.tsx:**

- Constants: `LANE_RISE_PX`, `LANE_RANGE_COVER`, `LANE_IN_MS`, `LANE_IN_SPREAD_MS`,
  `LANE_IN_STEP_MS`, `LANE_IN_EASING`
- `reducedMotion()` helper function
- `paintLane()` function
- Refs: `chartRef`, `lanesRef`, `paintedRef`, `geomRef`, `paintRef`
- `shownMission` ref and the mission-change staggered entrance `useLayoutEffect`
- Two `useLayoutEffect` hooks (paintRef setup and element re-collection per render)
- One `useEffect` (scroll/resize listeners driving paintRef)
- `data-lane-row` attributes on all lane elements
  **Consequence.** Lanes no longer fade in as they scroll into view. The horizon mask (already in
  place) provides the only scroll-linked visual boundary.
