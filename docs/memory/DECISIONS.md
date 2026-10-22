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
