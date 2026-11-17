State: IN_PROGRESS

# Acquisitions Status page

Branch `feature/DEVOCS-219-acquisitions` off `develop`. See
[acquisitions-plan.md](acquisitions-plan.md) for the full implementation plan and
slice-by-slice breakdown.

## Routes

| URL | Look | Redirect target? |
|-----|------|-----------------|
| `/acquisitions-globe-earth` | imagery (day texture + terminator) | yes — legacy redirects here |
| `/acquisitions-globe` | stylised (slate land, cyan coast) | canonical → `/acquisitions-globe-earth` |

Legacy redirects (308): `/acquisitions-status.html` and `/acquisitions-status` → `/acquisitions-globe-earth`.

Both routes: `ported: false`, `robots: { index: false }`. Sitemap hints set (daily, 0.9) —
appear when `ported` is flipped in Slice 7.

## Slice 1 — done (2026-11-09)

### Session 1a — data layer

New shared libs:
- `src/lib/missions.ts` — MissionId, MISSION_ORDER/DISPLAY/ID_OF, SATELLITES_OF, ALL_SATELLITES, DAY_MS, fmtDate, fmtDateTime, kpiFmt
- `src/lib/url-params.ts` — ParamSource, reader(), parseOffSet()

New feature files in `src/features/acquisitions/`:
- `types.ts`, `mock-data.ts` (11 raw specs — removed Slice 7), `adapter.ts`, `model.ts`, `data.ts`, `url-state.ts`
- `model.test.ts`, `adapter.test.ts`, `url-state.test.ts`

Updated: `availability/model.ts` (re-exports from @/lib/missions), `availability/url-state.ts` (imports from @/lib/url-params).

### Session 1b — route shells

New feature files:
- `src/features/acquisitions/copy.ts` — SEO, ACQ_HERO_IMG, ACQ_TITLE, ACQ_SUBTITLE
- `src/features/acquisitions/acq-globe.module.css` — `.page`, `.empty` (Slice 2 extends)

Updated app files:
- `src/app/acquisitions-globe-earth/page.tsx` — PPR page with full metadata and Suspense
- `src/app/acquisitions-globe/page.tsx` — same; canonical → `/acquisitions-globe-earth`
- `next.config.ts` — 308 redirects for `/acquisitions-status(.html)`
- `src/app/sitemap.ts` — LEGACY_HINTS for both acquisitions routes

## Code path (Slice 1 shell — superseded, see Real data)

```
GET /acquisitions-globe-earth
  → AcquisitionsContent (Server Component, inside <Suspense>)
      → connection()   (opts into request-time rendering)
      → fmtDate(now)   → dayKey
      → getAcquisitions(dayKey)   [src/features/acquisitions/data.ts, "use cache"]
          → getMockData(dayKey)   → adaptAcquisitions(raw, dayKey)
      → empty-state or section placeholder (Slice 2 wires AcquisitionsGlobe here)
```

## Real data (2026-11-17, branch `feature/DEVOCS-219-acquisitions-backend`)

```
GET /acquisitions-globe-earth
  → AcquisitionsContent (after connection(): nowMs, dayKey)
      → getAcquisitions(dayKey)          [data.ts, "use cache" 300 s, never throws]
          → GET /datatake/?date_from=<day-1>&date_to=<day+1>     (fetchAll, pages of 1000)
          → GET /acquisition-pass/?…&date_to=<day+1 +12 h>       (failure: stations left blank)
          → GET /orbit/                                          (failure: degraded page)
          → buildDatatakes(records, passes, orbits)  [adapter.ts: SGP4 centre + period, swath,
                                                      station, status label, levels, pubPct]
      → adaptAcquisitions(raw, nowMs)    [comp = PUB %, tone, hide not-yet-started]
      → <AcquisitionsGlobe data notice?>  (notice = "Backend unreachable — …" on failure)
```

New: `orbit.ts` (+ test), `data.test.ts`; rewritten `adapter.ts` (+ test). `model.ts`
`failedCount` = status Failed. `DatatakePanel.tsx`: "Partial" pill, Inuvik code INS.
Rules: DECISIONS.md 2026-11-17. Backend routes: ARCHITECTURE.md § Backend.
Verified: 559/559 tests, lint, type-check, build; headless Chromium against the backend on a seeded
OpenSearch (footprints, satellites, panel with real fields, degraded path unit-tested). Real `cds-*`
data: not yet (HANDOFF.md).

## Open

- Check against real `cds-*` data, then flip `ported` (HANDOFF.md).
