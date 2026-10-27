# Home page

Status: **IMPLEMENTED** (branch `feature/DEVOCS-219-home`, 2026-10-27)

## Route

`/` — static page + live news bar from `GET /instantmessage/`.

Legacy redirects: `/index.html` → `/` and `/index` → `/` (308, `next.config.ts`).

## Code path

```
GET /instantmessage/
  → fetchAll (src/lib/api/paginate.ts)
  → adaptInstantMessages (src/features/home/adapter.ts)   [server-only]
  → loadInstantMessages / getInstantMessages (src/features/home/data.ts)  [server-only, cache 300 s]
  → HomePage (src/app/page.tsx)                            [async server component]
  → NewsBar (src/features/home/NewsBar.tsx)                [client component]
```

Static sections (no data):
- `HeroVideo` (`src/features/home/HeroVideo.tsx`) — `"use client"`, `useEffect`-driven play/pause,
  respects `prefers-reduced-motion`.
- Module panels from `MODULES` in `src/features/home/copy.tsx` (4 entries, `<Reveal>` scroll fade-in).
- FAQ from `FAQ_GROUPS` in `copy.tsx` (6 groups, `<details>/<summary>`, works without JS).

## News bar

- `MAX_NEWS = 5` — the bar shows at most 5 messages.
- `adaptInstantMessages` sorts all records by `publication_date` descending and takes the first 5.
  The `/instantmessage/` endpoint supports only `offset`/`limit` with no sort parameter, so the
  frontend fetches all records (via `fetchAll`) and sorts client-side.
- Records with a null `publication_date` are excluded and logged via `console.info`.
- Failed load → `ok: false`, empty `newsItems`, bar not rendered.
- `NewsBar` is `"use client"`: ticker animation, expandable list, Escape handler, focus management.

## Assets

- `public/assets/mv/home.mp4` — hero background video (committed in a008501).
- `public/assets/img/modules/availability.jpg` — Availability module panel image.
- `public/assets/img/modules/events.jpg` — Events module panel image (mock-up's `events.jpg`,
  SHA256 `8a446d6c…`; the prototype reference used a different image — owner's choice, see DECISIONS.md).

## Metadata (SEO)

- Title: `"Copernicus Sentinel Operations Dashboard | Real-Time Satellite Monitoring"`
- Description: ported from legacy `PAGE_METADATA["index.html"]` (`apps/routes/home/routes.py` on `origin/main`).
- No `robots: noindex` — page is fully indexed.
- Canonical: `/`.
- Sitemap: `changeFrequency: "daily"`, `priority: 1.0` (from legacy sitemap in `apps/__init__.py`).

## Acceptance criteria

- [x] Hero video autoplays (respects `prefers-reduced-motion`)
- [x] Module panels scroll-reveal with `<Reveal>`
- [x] FAQ accordion works without JavaScript (`<details>/<summary>`)
- [x] News bar renders live instant messages (up to 5, sorted by publication date)
- [x] News bar hidden when backend is unreachable
- [x] `/index.html` and `/index` redirect 308 to `/`
- [x] `/` is in the sitemap (daily, priority 1.0)
- [x] Full SEO metadata (title, description, canonical, OG, Twitter), no noindex
- [x] `pnpm lint`, `pnpm type-check`, `pnpm build`, `pnpm test` all pass (2026-10-27)

## Architecture notes

- `src/features/home/copy.tsx` — `MODULES` (4 entries, ReactNode `long` fields with JSX `<b>`, `ROUTES` hrefs) and `FAQ_GROUPS` (6 groups, icon JSX, Q&A with ReactNode answers).
- `src/features/home/home.module.css` — hero, module panels (`.panelInner`; global `.px-panel`, `.px-panel-bg`, `.px-panel-veil` reused), FAQ, news bar.
- `src/features/home/adapter.ts` — `adaptInstantMessages()`, `MAX_NEWS = 5`, exported type `InstantMessage { title, date, time }`.
- `src/features/home/adapter.test.ts` — 7 tests (sorting, UTC formatting, month-boundary midnight, null date exclusion, empty input, shape of output).
- `src/lib/utc-date.ts` — shared UTC helpers (`utcDateStr`, `utcTimeStr`, `pad`, `utcDayMonthYearStr`) extracted from the events adapter; both home and events adapters import from here.
- `NewsBar` uses CSS visibility (`.listOpen` class) rather than `inert` for the closed list (avoids the React 19 hydration mismatch seen in the events filter dropdowns). Double-rAF height animation. Ticker stops under `prefers-reduced-motion`.
