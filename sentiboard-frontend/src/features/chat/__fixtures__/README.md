# Chatbot test fixtures

## event-calendar-schema.json

Partner's JSON schema for `EventCalendarDataResponse`, copied verbatim from
`docs/design/chatbot-event-calendar-schema.txt` with **one fix**:

- `"items": { "ref":"#/defs/Event" }` → `"items": { "$ref":"#/$defs/Event" }`

Both the missing `$` prefix on the key name (`ref` → `$ref`) and the missing `$` prefix
in the target path (`#/defs/` → `#/$defs/`) were corrected. The original `.txt` file is
the authoritative source; this fixture reflects the partner's intent, not the literal text.

## event-calendar-sample.json

Partner's sample payload, copied verbatim from `docs/design/chatbot-event-calendar-schema.txt`.
No changes.

## chatbot-sample-temporal.json

Copied from `docs/design/chatbot-sample-temporal.json`. The `rows` array (raw individual
datatakes, not used by any chart code) was trimmed from **3771 to 5 entries** to keep the
fixture under 25 KB. The `temporal_rows` array (29 daily buckets, the only data the chart
reads) is complete and unmodified.

## chatbot-sample-histogram.json

Copied from `docs/design/chatbot-sample-histogram.json`. Unmodified.

## responses.ts

Raw assistant response strings derived from the examples in
`docs/design/chatbot-integration-guide.md` §3. Used as fixtures for `parse-response.test.ts`.
