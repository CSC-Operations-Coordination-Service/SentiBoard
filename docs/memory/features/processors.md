State: IMPLEMENTED

# Processors page

Public page listing every Copernicus Sentinel processor release on an interactive timeline, per
mission, with each release's notes. Route `/processors` (legacy `/processors-viewer.html` and
`/processors-viewer` → 308). Data: `GET /processor/`.

Code: `sentiboard-frontend/src/app/processors/`, `sentiboard-frontend/src/features/processors/`.
Ported from the prototype's `src/pages/processors/processors.tsx` and `src/api/` (2026-10-21).

`IMPLEMENTED`, not `VERIFIED`: every criterion below is checked except one (mobile parity).

## How it works

- `data.ts` (server, cached 300 s) → `adapter.ts` (one release per record × target IPF; current
  baseline rule; notes sanitized once per record) → `page.tsx` → `Explorer` (client, server-rendered)
  → `ReleaseTimeline` (client, `ssr: false`). `ReleaseList` is the server-rendered list shown only
  without JavaScript.
- URL params: `mission=s1|s2|s3|s5p` (default s1), `range=1y|2y|all` (all), `baseline=all|current`
  (all), `q=<text>`, `release=<record id>:<IPF>`. A `release` from another mission switches the
  mission; an unknown one is ignored.

## Acceptance criteria

Verified on 2026-10-21 against the local backend (228 records) unless noted.

- [x] Real releases render: Sentinel-1 shows 5 processors / 51 releases, as the prototype does.
- [x] The page HTML (curl, no JavaScript) contains the release list for the selected mission, as
      links to each release (51 for Sentinel-1), with no streamed/hidden content.
- [x] With JavaScript disabled in Chrome: release list, stats, filters, open Description panel; a
      `?release=` link opens the detail pane with its notes.
- [x] Deep links: `?release=…` opens that release (and switches to its mission); `?mission=s5p&range=1y&baseline=current&q=ch4`
      renders that view; invalid params fall back to defaults (HTTP 200).
- [x] Backend unreachable: degraded "Backend unreachable" state with "—" stats, HTTP 200, no crash
      (tested by stopping a local proxy in front of the backend).
- [x] Recovery: the first request after the backend returns shows data (failures are not cached).
- [x] Backend down with a warm cache: cached data keeps being served.
- [x] Release notes are sanitized on the server: rendered notes contain only allowlisted tags and
      no attributes; the client bundle has no jsdom/DOMPurify.
- [x] Visual parity with the prototype at 1440×900 in dark and light, overview and detail:
      measured positions/sizes/colours of nav, hero, stats, filters, satellite image, panes,
      timeline track, markers and footer identical; screenshots identical by eye.
- [x] Clicking a marker opens the detail and puts `?release=` in the URL; Overview clears it;
      theme toggle switches, persists in localStorage, updates its accessible name; no console
      errors or warnings in Chrome (production build).
- [x] Metadata: title, description, keywords as legacy; canonical
      `https://operations.dashboard.copernicus.eu/processors`; Open Graph (site_name, url, en_GB) and
      Twitter (`summary_large_image`, `@sentinelonline_`) tags present.
- [x] `/processors-viewer.html` and `/processors-viewer` answer 308 to `/processors` (query kept).
- [x] Listed in `sitemap.xml` (weekly, 0.7, as legacy).
- [x] Lane reveal, scroll-linked (2026-10-21): each lane's opacity and 15px rise follow the page
      scroll with the prototype's mapping (entry 0% → cover 25%, linear) and reverse on scrolling
      back; a staggered entrance plays on mission change when the timeline is on screen. Measured
      in Chrome on Sentinel-3 (18 lanes), 1440×900, both themes: (a) from the top, scrolled down in
      20px steps to the bottom (1018px) and back: applied opacity/rise matched the formula at all
      102 steps (0 mismatches), every element of a lane in sync, values rise going down and fall
      going back up, no layout shift; at the bottom all lanes p = 1 with no inline style left;
      (b) timeline in view, S3 → S1 → S3: 113 / 355 entrance animations (stagger 0–160 ms /
      0–240 ms, 450 ms), then lanes back on the scroll-linked values (S3 identical to before the
      switch); range 1Y/ALL and zoom in/out start no animation. Reduced motion: nothing applied,
      all lanes visible. No mask, no max-height; year labels static. Details in DECISIONS.md.
- [ ] Mobile layouts compared with the prototype — not done in this slice.
- [x] Automated tests (2026-10-22): `pnpm test` (Vitest), 151 tests, no backend and no network
      (verified by running the suite in a network namespace with no interface up).
      - `adapter.test.ts` (42): `target_ipfs` splitting (`"S1_L1L2:002.84"`, empty version,
        `undefined`/`null`/`none`, no colon, colons in the version); records left out and reported
        (null/empty/blank targets, no date, unknown mission); null/duplicate `satellite_units`;
        fallback to `processing_baseline` and `"—"`; current-baseline rule (one per lane, null end
        date open, none when all ended, future not current, same-day tie → later record, lanes
        independent); unique ids (recurring (ipf, version), id-less records, a target repeated
        within one record, all real fixtures); roster order, the `S3_SM2_HY` alias, unknown IPF
        keys after the roster with generated labels; notes stored once per record; `changesOf`.
      - `url-state.test.ts` (31): every param parsed and serialised, defaults left out, invalid values
        → defaults, Next's `searchParams` record, round trip, encoding, `resolveView` (release from
        another mission switches it; unknown release dropped).
      - `sanitize-html.test.ts` (63): script/style/svg/template dropped with content; form, button,
        `<o:p>`, `<font>` unwrapped with text kept; style/class/id/lang/data-/aria-/on* removed;
        links `target="_blank" rel="noopener noreferrer"`, `javascript:` dropped; lists, paragraphs,
        `<br>`, tables, Jira pre-line, plain-text bullets and `h2.` headings; tidying; `htmlToText` /
        `notesSection`. Six real records captured 2026-10-22 (`__fixtures__/processor-records.ts`:
        Word, Jira pre-line with UI fragments, Jira with links, plain text with `h2.`, `<font>` HTML,
        HTML with UI fragments): allowlisted tags/attributes only, safe links, no text lost (in-order
        character check, only list markers may go), every bullet line becomes a list item.
      - `data.test.ts` (15): success (groups, notes, fetch time; URL, Accept header, timeout signal),
        pagination (offset 0 then 1000), warning for unplaced records; network error, timeout,
        502/503/504 → `unreachable`, 500/404 → `http`, non-JSON 200 → `parse`, a failing later page,
        missing `BACKEND_URL` → `unknown` — each returns the degraded result, never throws.
      - Found and fixed with a failing test first: a target repeated within one record produced
        duplicate release ids (`adapter.ts` now places it once). The feed on 2026-10-22 has no such
        record — the fix is preventive.

## Known issues

See [HANDOFF.md](../HANDOFF.md): backend data issues, payload doubled by Partial Prefetching,
cold-cache latency.
