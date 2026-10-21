# AGENTS.md — Sentiboard

Read this before changing anything. It covers the rules that the code and the ESLint config don't spell out, and it links to the detailed docs instead of repeating them. When this file and the code disagree, the code wins. Fix this file in the same change.

## 0. Agent memory protocol

Shared, Git-versioned memory lives in [`docs/memory/`](docs/memory/INDEX.md). Code and tests determine actual behaviour; memory describes the verified state. Mark anything unverified `UNKNOWN`, never invent details.

**Before a task:** read `docs/memory/INDEX.md`, then `STATE.md`; `ARCHITECTURE.md` if you touch a boundary; the affected `features/*.md` and `HANDOFF.md` when resuming. Inspect the code before trusting the docs, and check `git status` so you keep other agents' unrelated changes.

**During:** follow the documented architecture, and record significant decisions in `DECISIONS.md`. Never mark a feature complete without checking its acceptance criteria.

**Before finishing:** update the affected feature files, `STATE.md` and `ARCHITECTURE.md` if they changed, and `DECISIONS.md` for significant decisions. Record incomplete work and known issues in `HANDOFF.md`. Commit memory changes with the code. Run `pnpm memory:check` when memory files or this section change. A task is not finished until memory is updated, or you state that no update was needed.

Feature states: `PLANNED`, `IN_PROGRESS`, `BLOCKED`, `IMPLEMENTED`, `VERIFIED`, `DEPRECATED`. Each `features/*.md` starts with a `State:` line and is listed in `INDEX.md`. Keep stable knowledge out of temporary task notes.

## 1. What Sentiboard is

Sentiboard is the public Copernicus Sentinel operations dashboard: datatake completeness, publication and timeliness statistics, an events/anomalies calendar, news, and authenticated reporting pages. It replaces a Flask monolith (Jinja templates, routes, business logic and data access in one process) with two separately deployed applications.

## 2. Layout: two applications

| Path | What | Stack |
| --- | --- | --- |
| [`sentiboard-frontend/`](sentiboard-frontend/) | Web UI. Renders pages, owns SEO and routing. | Next.js (App Router), TypeScript, pnpm |
| [`sentiboard-backend/`](sentiboard-backend/) | HTTP API. The **only** component that talks to data stores. | FastAPI, Python |
| [`docs/memory/`](docs/memory/INDEX.md) | Shared agent memory for both applications. | Markdown |

Each application is meant to be its own Git repository. This root holds the cross-cutting docs and this file. Whether the two apps are nested repos, submodules, or sibling clones is `UNKNOWN` until the code lands; record the answer in `ARCHITECTURE.md` and update this section.

Commit to the repository that owns the file you changed. A change that spans both apps is two commits in two repos. Link them in both commit messages and in `HANDOFF.md` until both have merged.

## 3. Hard boundaries

These rules hold across both repos. Breaking one needs a `DECISIONS.md` entry first.

1. **The frontend never touches a database.** No OpenSearch, SQL or cache client in `sentiboard-frontend/`. Every piece of data comes from the backend over HTTP.
2. **The backend is the only data gateway.** It queries the data stores, applies the business rules and returns JSON shaped for the UI. It renders no HTML.
3. **`cds-*` OpenSearch indices are read-only.** The external MAAS-CDS platform produces them. Sentiboard never writes, reindexes or changes mappings on them, and does not depend on the `maas-cds` Python package.
4. **Sentiboard's own data** (users, roles, anomaly mirror, news, messages) lives in the backend's relational store. The frontend reaches it only through the API as well.
5. **Secrets stay server-side.** No credentials, internal hostnames or tokens in `NEXT_PUBLIC_*` variables or in client bundles.
6. **Behaviour parity with the legacy app** unless a `DECISIONS.md` entry says otherwise. That covers computed numbers (completeness, timeliness thresholds, statuses), public URLs and SEO metadata.

## 4. Backend rules (`sentiboard-backend/`)

- **Layering, dependencies point inward:** `interface` (FastAPI routers, request/response schemas) → `application` (use cases) → `domain` (entities, pure services, repository ports) ← `infrastructure` (OpenSearch, SQL, HTTP clients, cache).
- **`domain` is pure.** No imports from FastAPI, Pydantic settings, OpenSearch, SQLAlchemy or `httpx`. Business calculations, for example completeness or status classification, are pure functions here, unit-tested without I/O.
- **Data access sits behind ports.** A use case depends on a repository interface defined in `domain`. The OpenSearch or SQL implementation lives in `infrastructure` and is wired in through FastAPI dependencies.
- **Do not block the event loop.** Run blocking clients (synchronous OpenSearch, SQL) in a threadpool or use their async variants.
- **Routers stay thin.** Validate input, call one use case, map the result to a response schema. No query DSL and no business rules in routers.
- **Auth:** the backend validates OIDC JWTs and reads roles from the token. Do not roll your own sessions. Provider and claim names: `UNKNOWN` until implemented. Record them in `ARCHITECTURE.md`.
- **Configuration** comes from environment variables loaded through one settings object. Keep `.env.sample` up to date with every new variable.
- **Every endpoint gets tests:** unit tests for domain services and use cases, plus an API test through the router. Tests that need a live data store must skip cleanly when it is unreachable.

## 5. Frontend rules (`sentiboard-frontend/`)

- **Server Components by default.** Fetch backend data on the server, with the backend base URL from a server-only env variable. Add `"use client"` only for interactivity, and keep client components small.
- **Browser-only libraries** (charts, timelines, maps) are imported inside `useEffect` or with `next/dynamic` with `ssr: false`, so that they never run during SSR.
- **Pages must work without JavaScript** for their primary content. Interactive widgets enhance an SSR baseline.
- **Filter, pagination and selection state lives in the URL** (search params), so that views can be shared and deep-linked.
- **SEO is a hard requirement.** Each public page defines its metadata (title, description, canonical, Open Graph, Twitter) through the Next.js Metadata API. Keep `sitemap`, `robots` and structured data in sync when you add or rename a route. Permanently moved legacy URLs get a 301/308 redirect, never a 404.
- **Backend types:** build request/response types from the backend's OpenAPI schema. Do not hand-write duplicates that drift. Generation tooling: `UNKNOWN`.

## 6. API contract and cross-repo changes

- The backend's generated OpenAPI schema is the contract. Path prefix and versioning scheme: `UNKNOWN`. Record them in `ARCHITECTURE.md`.
- **Additive changes first.** Add the new field or endpoint in the backend, deploy, switch the frontend over, then remove the old one. Never ship a backend change that breaks the deployed frontend.
- An endpoint that needs a frontend change is not finished until the frontend uses it, or until `HANDOFF.md` records the pending frontend work.
- Error responses use one consistent JSON shape. The frontend shows a degraded state for backend failures, not a crash.

## 7. Porting from the legacy Flask app

The legacy monolith is no longer in the working tree but stays in Git history. Read it from `main`:

```sh
git show main:apps/elastic/modules/datatakes.py     # OpenSearch queries + completeness logic
git ls-tree -r --name-only main apps/               # everything else
```

Useful entry points on `main`: `apps/routes/` (pages and endpoints), `apps/elastic/modules/` (OpenSearch query DSL and calculations), `apps/models/` (SQL models), `apps/templates/` (markup and SEO tags to reproduce), `apps/cache/` (what was precomputed and how often).

Port **one vertical slice at a time** (backend endpoint, frontend page, tests, memory entry), and verify it end to end against real data before you start the next. Port calculations faithfully into `domain` first, with tests that pin the legacy results. Refactor afterwards.

## 8. Commands

`UNKNOWN`. Neither application has code yet. When you add tooling, fill in this table with commands you have run successfully, and nothing else.

| Task | Backend | Frontend |
| --- | --- | --- |
| Install | `UNKNOWN` | `UNKNOWN` |
| Dev server | `UNKNOWN` | `UNKNOWN` |
| Lint / format | `UNKNOWN` | `UNKNOWN` |
| Type-check | `UNKNOWN` | `UNKNOWN` |
| Tests | `UNKNOWN` | `UNKNOWN` |
| Local data stores | `UNKNOWN` | — |

Before you report a task as done, run lint, type-check and tests for every repo you touched. Report failures as failures.

## 9. Git

- Default branch `main`, integration branch `develop`. Branch off `develop` and open PRs against it.
- Do not commit generated artefacts, local databases, `.env` files or `node_modules`/`.venv`.
- Leave other agents' uncommitted changes alone. Stage only the files your task touched.
