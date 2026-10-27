# sentiboard-frontend

The Sentiboard web UI: Next.js (App Router, Cache Components), TypeScript, pnpm. All data comes
from the FastAPI backend over HTTP (`BACKEND_URL`, server-only). Rules: [`../AGENTS.md`](../AGENTS.md).
State and decisions: [`../docs/memory/INDEX.md`](../docs/memory/INDEX.md).

## Setup

```sh
corepack enable pnpm        # pnpm version is pinned in package.json ("packageManager")
pnpm install                # also generates src/lib/api/schema.d.ts (postinstall → gen:api)
cp .env.sample .env.local   # then adjust BACKEND_URL
```

## Commands

| Task | Command |
| --- | --- |
| Dev server | `pnpm dev` |
| Production build / server | `pnpm build`, then `pnpm start` |
| Lint | `pnpm lint` |
| Type-check | `pnpm type-check` |
| Tests (no backend or network needed) | `pnpm test`, or `pnpm test:watch` while developing; `pnpm test:coverage` writes `coverage/lcov.info`, the report SonarQube reads |
| API types from the committed contract | `pnpm gen:api` |
| Refresh the contract from a running backend, then regenerate | `pnpm gen:api:refresh` |

`api/openapi.json` is the committed copy of the backend contract; `src/lib/api/schema.d.ts` is
generated from it and not committed.

## Layout

```
src/app/                 routes (processors/ is the only ported page; the rest are "coming soon")
src/components/          app shell: Nav, Footer, ThemeToggle, Partners, PageHeader, SpaceBackdrop
src/features/processors/ the Processors page: data (server), adapter (server), explorer, timeline
src/lib/api/             typed backend client (server-only)
src/lib/sanitize-html.ts release-notes sanitizer (server-only, jsdom + DOMPurify)
src/styles/              the prototype's stylesheets (verbatim) + shell.css (port additions)
```
