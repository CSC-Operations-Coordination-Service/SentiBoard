# UI Integration Guide

Status: living integration contract
Last adapted: 2026-10-06

This guide describes the implemented FastAPI and Streamlit integration. It is a
living contract, not a frozen public API. Here we will describe the API endpoints, explaining their inputs and outputs, and detailing how they should be used. We will also describe the usage of XML syntax that needs to be parsed by the UI.

## 2. Chat API

`POST /chat` is a non-streaming request/response endpoint.

### Request: `ChatRequest`

| Field          | Type             | Client responsibility                                                            |
| -------------- | ---------------- | -------------------------------------------------------------------------------- |
| `message`    | non-empty string | Required user message.                                                           |
| `session_id` | UUID or omitted  | Omit for a new conversation; submit the preceding response's ID for a follow-up. |

Unknown request fields are rejected. An unknown session returns HTTP 404; clear
the local conversation state and invite the user to start a new chat.

For a genuinely new conversation, the client must omit `session_id`. The backend
creates the session and returns its generated UUID in `ChatResponse`. If a client
sends `session_id`, including with its first message, the backend treats it as an
existing conversation: it appends the message and uses prior context when that
session exists; otherwise it returns HTTP 404. A client-provided UUID never
creates a new session.

### Response: `ChatResponse`

| Field           | Type                           | Client responsibility                                                                                     |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `response`    | string                         | Preserve as the raw assistant message; parse it before rendering Markdown.                                |
| `model_name`  | string                         | Optional diagnostic display.                                                                              |
| `session_id`  | UUID                           | Persist for the next request and artifact retrieval.                                                      |
| `thread_id`   | string                         | Opaque identifier; do not derive client behaviour from it.                                                |
| `tool_calls`  | `ChatToolCall[]`             | Diagnostic payload. Streamlit exposes it in an expander; a normal user UI may hide it.                    |
| `token_usage` | `ChatTokenUsage` or `null` | Optional aggregate`input_tokens`, `output_tokens`, and per-invocation `steps` with nullable counts. |

A `ChatToolCall` contains `tool`, `args`, and `output`. Render structured
arguments/results as JSON and plain-text results as text, rather than passing
arbitrary text to a JSON viewer. Show an in-flight loading state, not a
token-by-token typing effect.

### Reload a conversation: `GET /chat/sessions/{session_id}`

Returns the complete persisted user/assistant message history for one known
session, in chronological `ordinal` order. It is intended for restoring a
conversation after the browser tab, local Streamlit state, or application has
been restarted.

| Field | Type | Client responsibility |
| --- | --- | --- |
| `session_id` | UUID | Store as the active conversation ID for follow-up `/chat` and artifact requests. |
| `created_at` | datetime | Optional display metadata. |
| `updated_at` | datetime | Optional display metadata. |
| `messages` | `ChatHistoryMessage[]` | Replace the local conversation history with the ordered messages. |

Each `ChatHistoryMessage` has `ordinal`, `role` (`user` or `assistant`),
`content`, and `created_at`. The endpoint returns HTTP 404 when the supplied
session does not exist.

The current API does not associate sessions with an authenticated user. Treat a
session UUID as sensitive: anyone who knows a valid ID can reload that
conversation or continue it through `POST /chat`.

The Streamlit client exposes this through **Reload a conversation**: paste a
session UUID and select **Reload conversation**. It validates the UUID locally,
fetches the history, validates every returned role/content pair, then replaces
local chat state only after the complete payload is valid. A failed reload leaves
the current local conversation unchanged.

## 3. Assistant output format

`response` is Markdown plus zero or more self-closing XML-like references to
session-owned data. References are internal transport syntax: every valid
reference accompanies a complete written answer and must not be shown raw after
successful parsing.

The supported tag names are exact and case-sensitive:

| Marker                            | Required attributes                              | Optional attributes                                                             | Streamlit output                                                                           |
| --------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `<kpi ... />` (direct)          | `label`, `value`                             | `color`, `delta`                                                            | Metric cards, grouped horizontally.                                                        |
| `<kpi ... />` (artifact-backed) | `data_id`                                      | `title`                                                                       | Availability-summary KPI cards from the artifact.                                          |
| `<tabular ... />`               | `data_id`                                      | `title`, `sort_column`, `sort_order`                                      | Reduced table, supplied aggregate overview, and CSV download.                              |
| `<temporal-plot ... />`         | `data_id`, `date_column`, `numeric_column` | `categorical_column`, `title`, `event_data_id`, `context_event_data_id` | Plotly line-and-marker chart with optional CAMS overlays.                                  |
| `<count-histogram ... />`       | `data_id`, `count_column`                    | `date_column`, `category_column`, `title`                                 | Plotly count chart. At least one of`date_column` or `category_column` must be present. |
| `<event-calendar ... />`        | `data_id`                                      | `title`                                                                       | Selectable month-grid calendar and ticket detail.                                          |

Examples use placeholders only. Every artifact-backed production marker must use
an ID returned by the current conversation's tools; a direct KPI has no
`data_id`, but its label and value must still be grounded in the current result:

```text
<kpi label="Completeness" value="98.5%" color="green" delta="up 1.2 points" />
<kpi data_id="artifact_ABC123" title="Availability overview" />
<tabular data_id="artifact_ABC123" title="Partial datatakes" sort_column="completeness_percentage" sort_order="asc" />
<temporal-plot data_id="artifact_ABC123" date_column="bucket_start" numeric_column="mean_completeness_percentage" categorical_column="mission" title="Completeness trend" event_data_id="artifact_DEF456" context_event_data_id="artifact_GHI789" />
<count-histogram data_id="artifact_ABC123" date_column="bucket_start" category_column="mission" count_column="record_count" title="Datatake counts" />
<event-calendar data_id="artifact_ABC123" title="CAMS events" />
```

`data_id` matches `artifact_[A-Za-z0-9]+`. Column names match
`[A-Za-z][A-Za-z0-9_]{0,63}`. `sort_order` is `asc` or `desc`, and direct KPI
`color` is `green`, `orange`, `red`, `blue`, or `gray`. Text attributes are
length-bounded and cannot contain a double quote. Attribute order is arbitrary,
but an attribute cannot be repeated and every pair must be separated by exactly
one space.

### Visual semantics

- A reference supplements, never replaces, a written answer.
- CSV downloads contain only the displayed reduced rows and columns; they never
  link to satellite products or source files.
- Use temporal plots for measured numeric trends (for example, completeness
  percentage), and count histograms for "how many" records or events.
- `event_data_id` is a directly linked anomaly artifact. It renders as prominent
  red markers and vertical lines.
- `context_event_data_id` is same-period context only. It renders as lighter
  ticks and must not be presented as a confirmed cause.

## 4. Streamlit parser and rendering pipeline

`dashboard/tabular_protocol.py` owns the conservative marker parsers.
`render_chat_content` calls their public extractors in this order:

1. `extract_tabular_references`
2. `extract_temporal_plot_references`
3. `extract_event_calendar_references`
4. `extract_count_histogram_references`
5. `extract_kpi_references`

For its marker type, each extractor identifies a tag boundary and parses the full
attribute body into `name="value"` pairs without assuming attribute order. It
rejects unknown or duplicate attributes, missing required attributes,
unsupported enum values, invalid IDs or column names, malformed spacing, and
malformed quoted attributes.

Parsing fails visibly: an invalid candidate remains in the Markdown, is not
fetched, and is not rendered as a visualization. A valid marker is removed before
`st.markdown` renders the prose and becomes a typed reference. This exposes
malformed model output while preventing an arbitrary data fetch or guessed chart.

The implementation then renders valid references by type: KPI cards, tables,
temporal plots, count histograms, then calendars. It does not preserve a
marker’s literal location inside the prose. The raw unmodified assistant message
remains in session state for history rendering.

Artifact-backed KPI references are returned before direct KPI references
regardless of their source order; direct KPI cards are rendered together. Other
reference types retain their relative order within that type.

Before drawing a widget, Streamlit validates the returned payload:

- temporal plots require the requested date, numeric, and optional category
  columns; usable dates and numeric values must parse;
- count histograms require the requested count and optional category/date
  columns; count values must be numeric;
- event overlays require `occurred_at` and `title`;
- calendar events require `key` and a parseable `occurred_at`.

Invalid or empty data produces a readable warning or empty state instead of a
chart built from inferred data.

## 5. Fetching session-owned visual data

Every artifact-backed reference is resolved through:

```text
GET /chat/data/{data_id}?session_id={session_id}
```

The required session ID must belong to the same conversation. Unknown, stale, or
cross-session IDs return HTTP 404.

| Response                      | Used by                                             | Fields                                                                                             |
| ----------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `TabularDataResponse`       | Artifact KPI, table, temporal plot, count histogram | `data_id`, `title`, `description`, `columns`, `rows`, `temporal_rows`, `aggregation` |
| `EventCalendarDataResponse` | Event calendar and temporal event overlays          | `data_id`, `title`, `description`, `events`                                                |

A temporal-plot artifact puts plotted data in `temporal_rows`, leaves `rows`
empty, and includes metadata in `aggregation.temporal_plot`. A count-histogram
artifact uses `rows`, leaves `temporal_rows` empty, and includes metadata in
`aggregation.count_histogram`. Availability/table artifacts use `rows` and can
include `aggregation.summary` and `aggregation.groups`, used for the overview
and artifact-backed KPI cards.

Fetch only when a message is being rendered; do not bulk-fetch history. Show a
data-unavailable message on fetch failure and offer to rerun the question.

## 6. Reference flow

1. The user writes a question or selects a starter prompt.
2. The client posts it and the current session ID to `/chat`.
3. It stores the returned session ID and raw assistant response.
4. It removes only valid supported markers from the rendered Markdown.
5. It fetches each resulting artifact through `/chat/data/{data_id}` with that
   session ID.
6. It validates the payload required by the widget and renders the result.
7. Follow-ups use the same session ID; a new chat omits it.

To restore a previous chat, the client calls `GET /chat/sessions/{session_id}`
with a pasted or otherwise retained session ID, replaces its local message list
with the returned ordered messages, and continues follow-ups using that returned
`session_id`.

`streamlit_app.py` and `dashboard/tabular_protocol.py` are the reference client
implementation.
