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
- List endpoints take `offset`/`limit` (limit ≤ 1000) and return a bare array, no total count. The
  frontend reads whole lists page by page (`src/lib/api/paginate.ts`, `fetchAll(path, filters?)`).
  The generated CRUD lists have no filters; the MAAS-CDS routes take a required time window
  (`date_from`/`date_to`, ISO 8601, at most 31 days) and a few term filters.
- **Generic backend, page-specific frontend (2026-11-17, DECISIONS.md).** Backend routes return
  generic resources; shaping for one page happens in that page's server-side adapter.

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
- **Sanitizer memory.** `sanitize-html.ts` memoizes its results by input (LRU, 2000 entries) and
  creates no `Range`; the processors loader runs `prepareNotes()` (one event-loop turn per record)
  before the synchronous adapter. Reason: jsdom pins every Range/NodeIterator through a `WeakRef`
  until the synchronous job ends (DECISIONS.md 2026-11-04).

### Observability

- **Logs.** Server code logs through `src/lib/log.ts` (`logger("processors").warn(msg, fields)`),
  not `console.*`: one JSON line per record in production (`time`, `level`, `logger`, `msg`,
  `trace_id`/`span_id` when tracing, `err` with ApiError `kind`/`url`/`status`). Client components
  keep `console.*` (browser). `onRequestError` in `src/instrumentation.ts` logs every error Next
  catches, with the route. One `server starting` line per start carries `heap_limit_mb`.
- **Console bridge.** In JSON format, `installConsoleBridge()` (called from `register()`) routes
  every server-side `console.log/info/debug/warn/error` — stray calls, libraries, Next's own
  messages — through the logger as `logger: "console"`: level from the method, first `Error` under
  `err` (stack on the same line), colours and Next's `⨯ ⚠ ✓` prefix stripped, blank lines dropped,
  messages cut at 32,000 chars. The saved console methods live on `globalThis`
  (`Symbol.for("sentiboard.log.originalConsole")`), because Next gives `instrumentation.ts` and the
  pages separate copies of `log.ts`. Next's startup banner is printed before `register()` and stays
  plain text. Verified 2026-11-05 on the standalone build.
- **OpenTelemetry.** `src/instrumentation.node.ts` starts the Node SDK only when
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set: Next's spans (one root span per request, render and backend
  fetch children) and runtime metrics (`@opentelemetry/instrumentation-runtime-node`: heap per V8
  space, GC, event-loop delay). `client.ts` injects `traceparent` into backend calls (Next's fetch
  span does not), so an instrumented backend joins the trace. Verified 2026-11-04 against a local
  OTLP receiver: traces and metrics arrive (protobuf), the backend receives `traceparent`.

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

`BACKEND_URL`, `SITE_URL`, `ALLOW_INDEXING`, `LOG_LEVEL`, `LOG_FORMAT`, the standard `OTEL_*`
variables (`OTEL_EXPORTER_OTLP_ENDPOINT` turns telemetry on), and `CHATBOT_ENABLED`, `CHATBOT_URL`,
`CHATBOT_TIMEOUT_MS` (assistant). Nothing is exposed through `NEXT_PUBLIC_*`.

### Assistant (chatbot)

```
ChatWidget (client, root layout) ──Server Action──▶ sendChatMessage (src/features/chat/actions.ts)
   │ page context from window.location                 │ flag + input validation
   ▼ buildPageContext (page-context.ts, pure)          ▼ postChat (src/lib/chatbot/client.ts, server-only)
                                                        ──HTTP POST /chat──▶ chatbot (CHATBOT_URL)
```

- Contract: `api/chatbot-openapi.json` → `src/lib/chatbot/schema.d.ts` (`pnpm gen:api`, refresh with
  `pnpm gen:chatbot:refresh`). The chatbot is stateless: the widget sends the conversation (last 20
  messages) on every question.
- `ChatMount` (`await connection()`, in `<Suspense fallback={null}>` in `app/layout.tsx`) renders the
  widget only when `CHATBOT_ENABLED=true` and `CHATBOT_URL` is set; decided per request.
- The widget renders only after hydration (absent without JavaScript), sits at `z-index: 9500`
  (below the events drawer), and stops every keydown inside it from reaching the pages'
  document/window shortcut handlers (the globe's `[`/`]`/Enter would fire while typing).
- Errors reuse `ApiError` (`service: "Chatbot"`). Logs: `logger("chat")` with request id, model,
  tokens, duration, never message text. Decision: DECISIONS.md 2026-11-13.

## Backend

FastAPI, Python ≥ 3.11, OpenSearch as the only store (DECISIONS.md 2026-10-23). Flat layout,
packaged by `setup.cfg` (every top-level package must be listed in `[options.packages.find]`, or
the production image, which installs the wheel, misses it).

| Path | What |
|---|---|
| `main.py` | app, lifespan (index setup with retry), probes, OpenSearch-down → 503 handler |
| `routers/`, `schemas/`, `documents/` | **generated** CRUD for Sentiboard's own indices (maas-model-fastapigen); do not hand-edit `routers/__init__.py` |
| `domain/` | pure rules and entities: datatake completeness/status (`datatake.py`), TLE parsing (`orbit.py`), passes, ports (`ports.py`) |
| `application/` | use cases (`acquisitions.py`): window check, list datatakes/passes/orbits |
| `infrastructure/` | `cds_opensearch.py` (read-only `cds-*` queries, scroll scan), `celestrak.py` (TLE fetch, in-memory cache, last-good fallback) |
| `interface/` | hand-written routes, response schemas, FastAPI dependencies (overridden in tests) |

- **MAAS-CDS indices read** (read-only, AGENTS.md §3.3): `cds-completeness-{s1,s2}-*-dd-das` (one
  doc per datatake, products as `<type>_local_percentage`), `cds-completeness-splitted-{s3,s5}-*-dd-das`
  (one doc per product, grouped by `datatake_id`), `cds-cadip-acquisition-pass-status*` (data lives
  in partitioned indices behind an alias of the bare name). Note: the MAAS `cds-completeness-*`
  template pattern also matches the `splitted` indices, hence the explicit mission patterns.
  Names are `cds-completeness[-splitted]-{mission}-{unit}-{service_type}-{service_id}`; every
  mission is read from `cds-completeness*`, service **`dd-das`** only (as the legacy app). The S1/S2
  `-prip-<unit>-<company>` indices (same datatakes measured at the production service) are not
  read: they would count each datatake twice. Checked against the production index list
  2026-11-17 (an empty `cds-completeness-splitted-{mission}-{satellite_unit}-…` index with literal
  placeholders exists there: ignored).
- **OpenSearch account** (`sentiboard-backend`, csc-ocs-ansible `scripts/opensearch-accounts/accounts.yml`):
  `read` on `cds-*` **plus the cluster-level `indices:data/read/scroll` and `…/scroll/clear`** that
  the scroll scan of `/datatake/` needs.
- **Outbound HTTP:** only Celestrak (`CELESTRAK_TLE_URL`), stdlib `urllib`, 10 s timeout.
- **Event loop:** hand-written routes are sync `def`, so FastAPI runs the blocking clients in its
  threadpool.
- **Tests:** `python -m pytest` from `sentiboard-backend/`; no OpenSearch or network (fakes via
  `app.dependency_overrides`, mocked client). maas-model comes from the Nexus index.
