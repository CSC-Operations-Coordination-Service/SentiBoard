# Chatbot UI Integration - Implementation Status

**Status:** ON HOLD (2026-10-20)  
**Branch:** `feature/226_Chatbot_UI_integration`  
**Partner:** SentiBoard Chatbot Backend API team

---

## What's Done

### Mock Mode Infrastructure
- ✅ Mock chatbot API client with dual-mode operation (mock/real via `CHATBOT_MOCK` env var)
- ✅ Comprehensive fixture set covering all 6 widget types
- ✅ Mock response routing based on keywords (anomalies → event calendar, completeness → KPI+table+temporal plot, etc.)
- ✅ Artifact fetch latency simulation (2-3s for /chat, 1s for artifacts)

### Widget Rendering
- ✅ All 6 widget types implemented: tabular, temporal-plot, count-histogram, event-calendar, kpi (direct + artifact-backed), LaTeX
- ✅ No inline scripts; mount functions deferred until after DOM insertion
- ✅ Event calendar full schema support: occurred_at, criticality, status, affected_systems, datatake_ids, collapsible descriptions
- ✅ Plotly.js for temporal plots and histograms
- ✅ KaTeX for block ($$…$$) and inline ($…$) LaTeX rendering
- ✅ CSS layout: column flex, no horizontal scroll, proper widget sizing

### Session Management
- ✅ Slim ChatSessionState (session_id only, no message history)
- ✅ Flask session cookie stays <4KB to prevent silent session_id loss
- ✅ Session ID persists across messages without backend history
- ✅ "New conversation" button clears session and resets UI

### Error Handling
- ✅ 404 handling with retry logic: clear session_id, retry without it
- ✅ Removed "expired" terminology, replaced with "no longer available"
- ✅ 15s timeout for artifact fetch (GET /chat/data)
- ✅ 360s timeout for chat (POST /chat)

### Deployment Ready
- ✅ Artifact timeout tuned to partner spec
- ✅ gunicorn-cfg.py: gthread worker_class with 8 threads
- ✅ CACHE_TYPE: RedisCache (if available) or SimpleCache

---

## How to Run Mock Mode

```bash
# Start Flask with mock mode enabled
CHATBOT_MOCK=1 DEBUG=True flask run --port 5005
```

**Test queries and expected outputs:**
- `"tell me about anomalies"` → Event calendar widget (7 events with criticality, status, systems)
- `"how is completeness trending"` → KPI card + tabular completeness data + temporal plot (S1A vs S1C)
- `"what's the formula for X"` → LaTeX block rendering
- `"something broken"` → Malformed marker (fail-closed rendering)

**Session persistence:** Session ID is returned in responses and persists across messages within a conversation.

---

## Open Points (Not Implemented)

### High Priority - Partner API Integration
1. **Real backend API testing** — Currently using mock fixtures; integration with actual Chatbot Backend API pending partner availability
2. **Artifact-backed KPI schema** — KPI type with artifact_id reference not fully tested
3. **Authentication between SentiBoard and Agent API** — No auth flow implemented for backend calls

### Medium Priority - User Experience
4. **Loading states** — No elapsed time counter or "still working" message after 20s wait
5. **Interleaved prose/markers** — Currently separate rendering blocks (prose then widgets then LaTeX)
6. **LaTeX inside prose** — Currently LaTeX is extracted into separate `latex_blocks` section
7. **Event calendar unique IDs** — Using Math.random() instead of deterministic per-instance IDs
8. **Expand button for window resize** — No button to widen chatbot window or Plotly resize handler

### Low Priority - UI Polish
9. **Hide model name** — Always shown in footer; should hide unless DEBUG=on
10. **Event calendar grid view resize** — Expand button needed for window resize

### Infrastructure
11. **gthread worker staging test** — Added gthread to gunicorn-cfg.py but not tested under load
12. **Thread-safety audit** — Found mutable globals in datatakes.py (_completeness_cache) and routes.py (_cache) that need locking or Redis backend
13. **nginx WAF proxy timeout** — 10-common-proxy.conf.template has proxy_read_timeout 300s (below partner's 360s requirement for /chat). Need /chat-specific override to ~400s in 20-{staging,production}-sentiboard.conf.template. Also check if HAProxy (timeout server 300s) is in the request path.
14. **gthread in docker-compose** — gunicorn-cfg.py has gthread worker_class + threads=8, but need to verify stacks/apps/sentiboard/docker-compose.yml starts gunicorn with those settings (may need CMD override or env vars)

### Documentation & Partner Sync
15. **$ref typo in event_calendar schema** — Partner spec has typo in JSON Schema $ref that should be documented in partner communication
16. **Environment URLs** — Dev/staging/prod URLs for real backend not configured
17. **User scoping & retention** — How conversations associate with users/sessions not finalized with partner

---

## Testing Checklist

- [x] Mock mode activates with `CHATBOT_MOCK=1`
- [x] All 6 widget types render without errors
- [x] Session ID persists across messages
- [x] "New conversation" button clears session and resets UI
- [x] Event calendar fixture validates against schema
- [x] Plotly charts render and update on window resize
- [x] KaTeX renders block and inline math
- [x] 404 handling clears session and retries
- [ ] Real backend API integration (blocked on partner)
- [ ] gthread concurrency under load (pending staging test)

---

## Technical Debt

- Replace `Math.random()` with UUID or counter-based IDs for event calendar (unique per instance)
- Add thread locks to `_completeness_cache` mutations in datatakes.py
- Migrate remaining mutable globals to Redis-backed caching or thread-safe structures
- Move LaTeX extraction to prose rendering (inline rendering, not separate section)

---

## Next Steps (Awaiting Partner)

1. Real backend API endpoint details and authentication flow
2. Clarification on artifact schema for KPI values
3. Test environment URLs (dev/staging/prod)
4. Review and confirm $ref typo in event calendar schema
