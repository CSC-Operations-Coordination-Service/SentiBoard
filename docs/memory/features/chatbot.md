State: IMPLEMENTED

# Assistant (chatbot widget)

Branch `feature/chatbot-widget` off `develop` (2026-11-13). Decision: DECISIONS.md 2026-11-13.
Floating assistant on every page, answered by the SERCO OpenSearch Chatbot (v0.1.5, contract in
`sentiboard-frontend/api/chatbot-openapi.json`).

## Switching it on

| Variable | Meaning |
| --- | --- |
| `CHATBOT_ENABLED` | `true` (exactly) shows the widget and lets the action answer; anything else = off |
| `CHATBOT_URL` | chatbot base URL, server-only; flag without URL = off (one warning logged) |
| `CHATBOT_TIMEOUT_MS` | wait per answer, default 60000 |

Read per request: change the environment and restart, no rebuild.

## Code path

```
ChatMount (src/features/chat/ChatMount.tsx)        [server, connection(), Suspense in app/layout.tsx]
  → ChatWidget (src/features/chat/ChatWidget.tsx)  [client; renders after hydration]
      buildPageContext (page-context.ts)           [pure: URL → SentiBoardContext]
  → sendChatMessage (actions.ts)                   ["use server"; flag + validation, never throws]
  → postChat (src/lib/chatbot/client.ts)           [server-only; POST /chat, ApiError kinds]
```

Limits (`src/features/chat/limits.ts`): last 20 messages sent, at most 40 accepted, 4000 chars per
message, context ≤ 8 KB.

## Context sent with every message

`page_id` = `ROUTES` key (`null` off-route). `filters` always: `url`, `path` (base path stripped),
`page_title`, `now` (ISO UTC), `time_zone`; then the page's **effective** view from its own
URL-state parser, missions normalised to `S1|S2|S3|S5P`:

| Page | filters | selection |
| --- | --- | --- |
| processors | mission, range, baseline, search | `release` |
| events | year, month, categories_off, missions_off, satellites_off, search | `event` |
| acquisitions (both) | satellite (`all`), mission, day (today UTC by default) | `datatake` |
| availability | range_days (`custom`), offset_days, from/to, missions_off, statuses_off, search | `datatake` |
| others | — | — |

Read from `window.location` at send time, so filter changes via `pushState` are included.

## Acceptance (verified 2026-11-13)

- [x] Flag off → no widget; action returns `disabled` (unit test; Chromium: no launcher).
- [x] Flag on → launcher bottom-right; panel opens with focus in the input; Enter sends,
      Shift+Enter new line; Escape closes and returns focus to the launcher.
- [x] Real answer from the live chatbot on `/events?missionsOff=s1&year=2026&month=10&event=…`
      (named page, month, excluded S1, event) and `/acquisitions-globe-earth?satellite=S2A`.
- [x] Keys typed in the widget do not trigger page shortcuts (URL unchanged after `[`, `]`, Escape
      with an event selected).
- [x] Mobile (390 px): full-width bottom sheet, opaque.
- [x] Client bundle contains neither `CHATBOT_URL` nor the chatbot host.
- [x] Server log: request id, model, tokens, duration; no message text.
- [x] 69 unit tests (page-context, client, config, action). Lint, type-check, build clean.
- [ ] No component tests (no DOM test setup in the repo; see DECISIONS.md test strategy).

Re-verified 2026-11-16 (`pnpm start` build, headless Chromium, live chatbot `gpt-oss-120b`):
lint, type-check, build, 537/537 tests; real answers in 3–6 s on `/events` (Oct 2026, S1 off),
`/availability` (30-day window) and `/acquisitions-globe?satellite=S2A` (S2A, today); `[`, `]`,
Escape typed in the input left the URL unchanged; 390 px panel full width, opaque once its open
animation ends; flag off → no launcher, and a replayed Server Action call returns `disabled`
without reaching the chatbot; no chatbot host in `.next/static`; no message text in server logs.

Open items: HANDOFF.md.

## Answer parsing

Modules in `sentiboard-frontend/src/features/chat/` (moved from `src/features/chatbot/`):

| File | Purpose |
| --- | --- |
| `types.ts` | Marker types (6 forms), Segment, EventCalendarPayload and related types |
| `marker-syntax.ts` | Finds marker candidates, parses attribute bodies — the only file that knows the `<tag ... />` delimiter form |
| `parse-response.ts` | `parseResponse(raw): Segment[]` — validates markers, builds ordered segment list |
| `event-calendar.ts` | `parseEventCalendar(json): ParseEventCalendarResult` — schema validator, no external deps |
| `marker-syntax.test.ts` | Syntax layer tests (findMarkerCandidates, parseAttributes) |
| `parse-response.test.ts` | Full parse pipeline tests |
| `event-calendar.test.ts` | Payload validator tests |
| `__fixtures__/` | Schema JSON (with $ref fix), sample payload, response string fixtures |

Not yet wired into ChatWidget. Remaining work: UI components for each marker type, Markdown
rendering, KaTeX for `$…$` / `$$…$$`. Marker delimiter is under discussion — only `marker-syntax.ts`
needs updating if it changes.

Decisions: DECISIONS.md 2026-11-13 entries on hand-written types, source-order segment rendering,
and TEXT_ATTR_MAX_LEN.
