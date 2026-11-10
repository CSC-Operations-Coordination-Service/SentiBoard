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

## Code path (Slice 1 shell)

```
GET /acquisitions-globe-earth
  → AcquisitionsContent (Server Component, inside <Suspense>)
      → connection()   (opts into request-time rendering)
      → fmtDate(now)   → dayKey
      → getAcquisitions(dayKey)   [src/features/acquisitions/data.ts, "use cache"]
          → getMockData(dayKey)   → adaptAcquisitions(raw, dayKey)
      → empty-state or section placeholder (Slice 2 wires AcquisitionsGlobe here)
```

## Open

- Slice 2: add ThreeEarth, day/night and stylised materials, zoom controls.
- Slice 7: remove mock-data.ts; decide future-start datatake display (see HANDOFF.md).
