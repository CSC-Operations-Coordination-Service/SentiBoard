# Handoff

Open work and known issues, newest first. Remove an item when it is resolved.

## Frontend — still to port (2026-10-21)

- Only the shell and `/processors` are ported. Placeholders ("coming soon", noindex, not in the
  sitemap) remain for `/` (home), `/acquisitions-globe`, `/acquisitions-globe-earth`, `/events`,
  `/availability`, `/terms-conditions`, `/cookie-notice`. Port each as its own vertical slice
  (AGENTS.md §7), from the prototype at `~/work/SentiBoard/design/react-mockups`. Their final URLs
  and legacy redirects are not decided yet: the placeholders use the prototype's paths; apply the
  308 rule in DECISIONS.md when each is ported (legacy URLs on `origin/main`, e.g. `/events`,
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

## Backend — pending fixes (reported, not fixed in the backend)

From `~/work/SentiBoard/design/react-mockups/BACKEND-FINDINGS.md` and earlier findings on
`GET /processor/`:

- **500 on null arrays.** `GET /processor/` returns HTTP 500 when `target_ipfs` (5 records) or
  `satellite_units` (3 records) is null. The backend developer approved the local validator patch
  and is committing it on the backend branch (2026-10-22).
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
