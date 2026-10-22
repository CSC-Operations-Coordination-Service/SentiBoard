# Architecture

Rules live in [`AGENTS.md`](../../AGENTS.md) §3–§6; this file records how they are implemented.

## Repository layout

- `sentiboard-frontend/` and `sentiboard-backend/` are currently **plain directories in this one Git
  repository** (no nested `.git`, no submodules). Whether they become separate repositories is
  still `UNKNOWN` (AGENTS.md §2) — a decision for the repo owner.
- No root `package.json`; each app has its own tooling.

## API contract (observed)

- Contract: the backend's OpenAPI schema; committed copy at `sentiboard-frontend/api/openapi.json`.
- Paths have **no prefix and no version segment** (`/processor/`, `/anomaly/`, `/news/`,
  `/instantmessage/`, `/health`), as of the schema on 2026-10-21. Whether that is final: `UNKNOWN`.
- List endpoints take `offset`/`limit` (limit ≤ 1000) and return a bare array: no filters, no
  sorting, no total count. The frontend reads whole lists page by page (`src/lib/api/paginate.ts`).

## Frontend (`sentiboard-frontend/`)

### Data flow

```
backend ──HTTP──▶ src/lib/api/client.ts (server-only, BACKEND_URL, 10 s timeout, ApiError kinds)
                  src/lib/api/paginate.ts (fetchAll: pages of 1000 until a short page)
             ──▶ features/<page>/data.ts ("use cache" + cacheLife, server-only; never throws)
             ──▶ features/<page>/adapter.ts (backend shape → UI model; sanitizes HTML; server-only)
             ──▶ app/<route>/page.tsx (Server Component) ──props──▶ client components
```

- **Server-only boundary.** `client.ts`, `paginate.ts`, `sanitize-html.ts`, the adapter and the data
  module import `"server-only"`; importing them from a client component fails the build (verified).
  The client bundle contains no jsdom, DOMPurify, sanitizer, `BACKEND_URL` or backend host (scanned
  `.next/static` after `pnpm build`, 2026-10-21).
- **Types** come from `api/openapi.json` via `openapi-typescript` into `src/lib/api/schema.d.ts`
  (generated on `pnpm install`, not committed). `GetPath`/`GetResponse`/`GetQuery` derive request and
  response types from it; nothing is hand-written.
- **Caching.** Backend data is cached with `"use cache"` + `cacheLife({ stale: 300, revalidate: 300,
  expire: 3600 })`. The cached function throws on failure, so a failure is never cached; the
  uncached wrapper turns it into a degraded result. Default in-memory cache handler (per process).
- **Degraded state.** Backend failures render the page's own "Backend unreachable" / "Could not load"
  block with HTTP 200; `error.tsx` is the last resort for unexpected errors.

### Rendering

- Server Components by default; client components: `Nav`, `ThemeToggle`, `PageHeader`, and the
  page's interactive part (Processors: `Explorer`).
- Browser-only code loads with `next/dynamic({ ssr: false })` from inside a client component
  (required by Next.js): the Processors timeline and the WebGL `SpaceBackdrop`.
- `/processors` renders as **one complete HTML document** (no streamed Suspense boundary,
  `export const instant = false`), so its content works without JavaScript — see DECISIONS.md.
- Placeholder pages and the 404 are static.

### URL state

- Filter and selection state lives in search params, parsed and serialised by one module per page
  (`features/processors/url-state.ts`); defaults are omitted, invalid values fall back to defaults.
- With JavaScript, controls update the URL with `history.pushState` (selection) / `replaceState`
  (filters, search); Next keeps `useSearchParams` in sync with no server round trip. Without
  JavaScript the same controls are plain links and a GET form.

### Theme, fonts, styles

- Theme: `<html data-theme>` + `localStorage["sb-theme"]` (dark default), applied by an inline
  pre-paint script in `app/layout.tsx`, which also adds `html.js`. Theme-dependent markup (toggle
  label, partner logos) is rendered for both themes and selected by CSS (`src/styles/shell.css`).
- Font: `NotoSans-Variable.woff2` via `next/font/local` (`--font-noto-sans`, first in `--font-sans`).
- Styles: the prototype's `tokens.css`, `global.css`, `page-header.css`, `footer.css` and
  `processors.module.css` copied verbatim (minus the `@font-face`); port-specific rules only in
  `src/styles/shell.css` and `features/processors/explorer.module.css`.

### Routes and SEO

- Single list of routes: `src/lib/routes.ts` (nav, footer, sitemap and placeholders read it).
- Metadata per page through the Metadata API; canonical from `metadataBase` (`SITE_URL`).
- Legacy URLs: 308 redirects in `next.config.ts` (rule in DECISIONS.md).

### Environment (all server-only; `.env.sample`)

`BACKEND_URL`, `SITE_URL`, `ALLOW_INDEXING`. Nothing is exposed through `NEXT_PUBLIC_*`.

## Backend

`UNKNOWN` in this repo — not checked in yet.
