# Chatbot UI Mock Mode

While the partner develops the Chatbot Backend API, use **mock mode** to test the full integration locally with realistic fixtures.

## Quick Start

### 1. Start Flask with Mock Mode Enabled

```bash
cd /home/adelvallecla/work/SentiBoard

# Activate venv if needed
source venv/bin/activate

# Run with mock mode enabled
CHATBOT_MOCK=1 DEBUG=True python run.py
```

**Expected output:**
```
[MOCK] Loaded mock responses
[MOCK] Loaded 4 artifact fixtures
 * Running on http://127.0.0.1:5000
```

### 2. Open the Dashboard

Open your browser to **http://127.0.0.1:5000/** (or your configured Flask port).

### 3. Test the Chatbot Widget

Look for the **chat icon** (💬) in the bottom-right corner.

Click it to open the floating chatbot widget.

## Try These Queries

### Event Calendar (Anomalies/Events/Tickets)
**Keywords:** `anomal`, `calendar`, `event`, `ticket` (case-insensitive)

Type: `"Show me the anomalies from June-July 2026"`

**Expected:** Full event calendar widget with:
- Calendar view + List view tabs
- Events grouped by date
- Criticality levels (Blocking → red, Critical → orange, Routine → gray)
- Undated events in separate group
- Status badges (Open, Closed, Delegated, etc.)
- Affected systems and datatake IDs
- Collapsible long descriptions

**Other examples that trigger this:**
- "List calendar events"
- "Show me all tickets"
- "What events occurred?"

### Completeness Metrics (KPI/Table/Chart)
**Keywords:** `completeness`, `complete` (case-insensitive, but checked after formula keywords)

Type: `"What was the completeness trend for Sentinel-1?"`

**Expected:**
- Direct KPI card (showing 97.9%, green, +0.8pp)
- Tabular data (sortable)
- Temporal plot with multi-series (S1A vs S1C lines)

**Other examples that trigger this:**
- "Is data completeness improving?"
- "Show me complete data for last week"

### Formulas & Calculations (LaTeX)
**Keywords:** `formula`, `calculat`, `computed` (case-insensitive, checked first)

Type: `"How is completeness calculated?"`

**Expected:** Prose with LaTeX:
- Block math ($$...$$ on own lines)
- Inline math ($...$)

**Note:** Checked BEFORE "completeness" keyword, so questions about HOW completeness is calculated get the formula answer, not the metric values.

**Other examples that trigger this:**
- "What's the formula for availability?"
- "How is this computed?"
- "Show me the calculation"

### Malformed Markers
**Keywords:** `broken`, `malformed` (case-insensitive)

Type: `"Show me broken markers"`

**Expected:** Malformed marker is silently dropped, only prose shown.

### Default Fallback
**Keywords:** anything not matching above

**Expected:** Generic helpful response

## Keyword Routing Reference

Mock mode routes user queries to canned responses based on keyword matching. **All matching is case-insensitive.**

### Routing Priority (checked in order)

1. **Formulas & Calculations** — `formula`, `calculat`, `computed`
   - Returns LaTeX math formulas and prose
   - Checked first to catch "How is X calculated?" questions

2. **Event Calendar** — `anomal`, `calendar`, `event`, `ticket`
   - Returns event calendar with criticality, status, dates

3. **Completeness Metrics** — `completeness`, `complete`
   - Returns KPI card, table, and temporal plot

4. **Malformed Markers** — `broken`, `malformed`
   - Returns prose only (bad marker is dropped silently)

5. **Default** — anything else
   - Returns generic helpful response

### Examples by Response Type

| Query | Keywords Match | Response |
|-------|---|---|
| "Show me the anomalies from June-July 2026" | anomal | Event Calendar |
| "What was the completeness trend for Sentinel-1?" | completeness | Completeness (KPI/table/plot) |
| "How is completeness calculated?" | calculat (checked before completeness) | Formula (LaTeX) |
| "Show me broken markers" | broken | Malformed Markers |
| "What's the status?" | (no match) | Default |

## Latency Simulation

- **Chat API:** 2-3 second delay (simulates real ~1-3s latency)
- **Artifact fetch:** 1 second delay per item

You'll see a loading state during these delays.

## What Gets Mocked?

### ✅ Mocked (Fixtures)
- **POST /chat** → Returns canned responses based on keyword matching
- **GET /chat/data/{data_id}** → Serves pre-built artifact JSONs
- Event calendar (full schema with criticality, occurred_at, status, etc.)
- Tabular data (daily completeness by satellite)
- Temporal plot (multi-series: S1A vs S1C)
- Count histogram (events per week by category)

### ❌ NOT Mocked (Real)
- Flask backend (real routes, session management)
- Marker extraction & validation (real Python + JS)
- Widget rendering (real JS)
- Markdown + LaTeX rendering (real KaTeX)
- CSS styling

## Files Involved

### Backend
- `apps/utils/chatbot_client.py` — Client with `CHATBOT_MOCK` mode
- `apps/routes/home/routes.py` — Updated to use ChatbotAPIClient

### Frontend
- `apps/templates/includes/chatbot_widget.html` — Widget template
- `apps/static/assets/js/chatbot/chatbot-widget.js` — Main controller
- `apps/static/assets/js/chatbot/event-calendar-renderer.js` — NEW: Event calendar with full schema
- `apps/static/assets/js/chatbot/widget-renderer.js` — Updated event calendar rendering
- `apps/static/assets/css/chatbot-widget.css` — Styles + NEW event calendar styles

### Test Fixtures
- `test/fixtures/chatbot/event_calendar_full.json` — 7 events with varied edge cases
- `test/fixtures/chatbot/tabular_completeness.json` — Daily completeness data
- `test/fixtures/chatbot/temporal_plot_completeness.json` — Time series with multi-series
- `test/fixtures/chatbot/count_histogram_events.json` — Event count by week/category
- `test/fixtures/chatbot/mock_responses.json` — Canned chat responses

## Switching to Real Backend

Once the partner deploys the Chatbot Backend API:

1. **Disable mock mode:**
   ```bash
   # Don't set CHATBOT_MOCK=1
   DEBUG=True python run.py
   ```

2. **Configure the API URL:**
   ```bash
   CHATBOT_API_URL="https://chatbot-backend.example.com" \
   DEBUG=True python run.py
   ```

The `ChatbotAPIClient` will automatically switch to real mode and call the actual API.

**All other code is identical** — no changes to routes, templates, or JS.

## Troubleshooting

### Mock mode not loading
- Check: `export CHATBOT_MOCK=1` before running
- Check Flask logs for `[MOCK] Loaded` messages

### Fixtures not found
- Verify path: `test/fixtures/chatbot/` exists
- Check Flask working directory: `pwd` should be `/home/adelvallecla/work/SentiBoard`

### Event calendar not rendering
- Make sure `event-calendar-renderer.js` is loaded (check browser DevTools > Network)
- Check browser console for JS errors

### Styling issues
- Hard-refresh browser: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Check `apps/static/assets/css/chatbot-widget.css` is loaded

## Notes

- **Session ID:** Regenerated for each new conversation; you can continue a conversation by keeping the window open
- **No persistence:** Mock data is in-memory; refreshing the page loses history
- **No auth:** Mocked endpoints skip actual API calls, but Flask login still required for page access
