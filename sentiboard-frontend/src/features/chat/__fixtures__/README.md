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

## responses.ts

Raw assistant response strings derived from the examples in
`docs/design/chatbot-integration-guide.md` §3. Used as fixtures for `parse-response.test.ts`.
