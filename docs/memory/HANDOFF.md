# Handoff

Open work and known issues, newest first. Remove an item when it is resolved.

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

- Shell, `/processors` and `/events` are ported. Placeholders ("coming soon", noindex, not in the
  sitemap) remain for `/` (home), `/acquisitions-globe`, `/acquisitions-globe-earth`,
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
- **Cold-cache latency.** The first request after the cache expires (`expire` 3600 s, or a fresh
  process) takes ~7 s: fetch plus sanitizing 228 release notes with jsdom. Warm requests ~45 ms.
  The default cache handler is in-memory per process.
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
