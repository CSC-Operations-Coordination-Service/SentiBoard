# State

Last updated: 2026-10-21 (branch `feature/DEVOCS-219-frontend`, uncommitted at time of writing).

## Frontend (`sentiboard-frontend/`)

- Scaffolded with `create-next-app` 16.4.2: Next.js 16.4.2 (App Router, Turbopack, Cache Components
  and Partial Prefetching on), React 19.3.0, TypeScript 5.9, ESLint 9, pnpm 12.14.0 (via corepack).
- **First vertical slice ported** from the Vite prototype (`~/work/SentiBoard/design/react-mockups`):
  - App shell: nav, footer, dark/light theme without a flash, Noto Sans via `next/font/local`, the
    prototype's global styles (verbatim).
  - Processors page at `/processors` with real backend data — see [features/processors.md](features/processors.md).
  - Legacy `/processors-viewer.html` and `/processors-viewer` redirect there with 308.
  - `sitemap.xml` (ported pages only), `robots.txt` (disallow-all unless `ALLOW_INDEXING=true`).
- Every other page (home, acquisitions ×2, events, data availability, terms, cookie notice) is a
  "coming soon" placeholder (noindex, not in the sitemap).
- Verified on 2026-10-21: `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm build` pass;
  `pnpm dev` and `pnpm start` serve the pages; behaviour checks listed in the feature file.
- Automated tests: `pnpm test` (Vitest, 151 tests for the Processors slice: adapter, URL state,
  sanitizer, data loading), runnable with no backend and no network.

## Backend (`sentiboard-backend/`)

- Not in this repo yet (`sentiboard-backend/` holds only an empty `.gitignore`). A FastAPI backend runs
  separately at `http://localhost:8000`; its contract is committed at
  `sentiboard-frontend/api/openapi.json` (matched the live `/openapi.json` on 2026-10-21).

## Memory tooling

- `pnpm memory:check` does **not** exist: there is no root `package.json` (see HANDOFF.md).
