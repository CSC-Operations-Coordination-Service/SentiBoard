# State

Last updated: 2026-10-27 (branch `feature/DEVOCS-219-home`).

## Frontend (`sentiboard-frontend/`)

- Scaffolded with `create-next-app` 16.4.2: Next.js 16.4.2 (App Router, Turbopack, Cache Components
  and Partial Prefetching on), React 19.3.0, TypeScript 5.9, ESLint 9, pnpm 12.14.0 (via corepack).
- **First vertical slice ported** from the Vite prototype (`~/work/SentiBoard/design/react-mockups`):
  - App shell: nav, footer, dark/light theme without a flash, Noto Sans via `next/font/local`, the
    prototype's global styles (verbatim).
  - Processors page at `/processors` with real backend data — see [features/processors.md](features/processors.md).
  - Legacy `/processors-viewer.html` and `/processors-viewer` redirect there with 308.
  - `sitemap.xml` (ported pages only), `robots.txt` (disallow-all unless `ALLOW_INDEXING=true`).
- **Second vertical slice ported** (2026-10-22, branch `feature/DEVOCS-219-events`):
  - Events & Anomalies page at `/events` with real backend data — see [features/events.md](features/events.md).
  - Legacy `/events.html` redirects there with 308.
- **Third vertical slice ported** (2026-10-27, branch `feature/DEVOCS-219-home`):
  - Home page at `/` — hero video, module panels, FAQ, live news bar — see [features/home.md](features/home.md).
  - Legacy `/index.html` and `/index` redirect there with 308.
- Remaining pages (acquisitions ×2, data availability, terms, cookie notice) are
  "coming soon" placeholders (noindex, not in the sitemap).
- Verified on 2026-10-21: `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm build` pass;
  `pnpm dev` and `pnpm start` serve the pages; behaviour checks listed in the feature file.
- Automated tests: `pnpm test` (Vitest, 273 tests as of 2026-10-27), runnable with no backend and no network.

## Backend (`sentiboard-backend/`)

- Not in this repo yet (`sentiboard-backend/` holds only an empty `.gitignore`). A FastAPI backend runs
  separately at `http://localhost:8000`; its contract is committed at
  `sentiboard-frontend/api/openapi.json` (matched the live `/openapi.json` on 2026-10-21).

## Memory tooling

- `pnpm memory:check` does **not** exist: there is no root `package.json` (see HANDOFF.md).
