# Events Kanban — data gap

**DEVOCS-219 · 2026-08-20 · blocking finding, `events-kanban` not built**

## The ask

Build `/examples/events-kanban`: three columns — **Active**, **Scheduled**, **Resolved** — grouping
events by status rather than by time, with the instruction to check first whether the Events data
model has a reliable status field and to flag it rather than derive a fake one.

## Verdict

**It does not.** The Events data model has no lifecycle status of any kind — not
active/scheduled/resolved, not open/closed, not a JIRA status or resolution. Two of the three
columns cannot be populated from anything the data carries, and the third could only be filled by
inventing a rule. Same shape as the Processors Viewer gap: the view is reasonable, the field behind
it does not exist.

Kanban is therefore **not built**. The finding stands on its own: the gap is in the data model, not
in the mock-ups, so it applies to any status-grouped Events view, whoever builds it.

The concept that *was* built alongside this finding, `/examples/events-swimlanes`, is one of the
three final Events concepts. Its "N active" badge is a completeness reading, not a lifecycle one —
see [What I did instead](#what-i-did-instead).

## What the data actually is

Events on the dashboard are **JIRA ground-segment anomalies** (`GSANOM-*`), ingested from
Elasticsearch into one table.

**The table has fifteen columns and none of them is a status**
(`apps/models/anomalies.py:61-78`):

```
id · key · title · text · publicationDate · category · impactedSatellite · impactedItem
start · end · environment · datatakes_completeness · newsLink · newsTitle · modifyDate
```

Confirmed against the shipping database rather than read from the model alone —
`PRAGMA table_info(anomalies)` on `apps/db/db.sqlite3` returns exactly those fifteen columns over
2,472 rows.

**The ingestor reads seven fields from upstream and no status is among them**
(`apps/ingestion/anomalies_ingestor.py:37-79`): `origin`, `key`, `occurence_date`, `created`,
`updated`, `title`, `description`, `datatake_ids`. If the upstream JIRA issue has a status or a
resolution, this code never asks for it, so it is not merely unpersisted — it is not fetched.

**`category` is the only classification, and it is a kind, not a state.** Its six distinct values
in the database are `Acquisition`, `Calibration`, `Manoeuvre`, `Production`, `Platform`,
`Data access` — the event-type axis the calendar already colours by.

## Why each column fails

### "Scheduled" — nothing to put in it

The feed is retrospective. `publicationDate` is the upstream `occurence_date`
(`anomalies_ingestor.py:57-59`) — when the anomaly *happened*. There is no forward-looking planned-
events source in this table, and the data agrees: **0 of 2,472 rows have a `publicationDate` later
than today**, and the latest is `2026-08-18 17:37`, two days back. An anomaly is recorded because it
already occurred, so a "Scheduled" column would be permanently empty — or filled with something
that isn't a scheduled event.

### "Resolved" — the obvious field means something else

The tempting derivation is `end < now`. It does not hold: `end` is not a resolution date, it is the
upstream JIRA **`updated`** timestamp (`anomalies_ingestor.py:63-65`). It moves whenever anyone
touches the issue, for any reason, and it says nothing about whether the underlying problem was
fixed.

It also cannot discriminate, because it is always in the past and always populated: **all 2,472 rows
have a non-null `end`, and `end > start` in all 2,472**. So `end < now` classifies the entire
dataset as "Resolved" and leaves "Active" empty — which is not a status, it is a constant dressed as
one.

### "Active" — only a completeness reading is available

The one "is this still a problem" signal in the data is `overall_status` ∈ `ok` / `partial` /
`failed` / `unknown`, computed in `apps/utils/events_utils.py:422-433` purely from datatake
completeness against two thresholds (`THRESHOLD_RECOVERED = 90.0`, `THRESHOLD_PARTIAL = 10.0`,
`events_utils.py:26-28`). That is a statement about **data recovery**, not about workflow: an
anomaly whose datatakes never came back reads `failed` forever, whether or not anyone is still
working on it.

The Next.js consumer confirms nothing more is available downstream —
`getCalendarEvents` (`frontend/lib/data.ts:911-956`) maps only day, category, time, satellite and
datatakes off each event. No status is read, because there is none to read.

## What I did instead

The swimlanes concept needed the same signal for its "N active" badge, so it uses the honest one and
says so on the page: **active = datatake completeness still degraded, lost or in progress**, with
the definition on the badge's tooltip and spelled out in the page footnote and its Description
panel. The single definition lives in `ACTIVE_DEFINITION` in
`design/react-mockups/src/data/events-mock.ts` so no view can quietly drift into implying a
lifecycle. No page claims an event is open in a tracker.

## Options, if a board is still wanted

1. **Drop the concept.** Compare the three that stand on real fields.
2. **Re-axis the board onto completeness** — columns `Recovered` / `Partial` / `Lost`, from
   `overall_status`. This is buildable today and needs no new data, but it is a *completeness* board,
   not a workflow board: it answers "did the data come back", not "is anyone on it". Worth saying
   plainly that this is a different question from the one the kanban was asked for.
3. **Get the field.** Extend the ingestor to pull the JIRA issue `status` (and `resolutiondate`) into
   two new `anomalies` columns, then build the board as specified. This is a backend change with an
   ingestion backfill, not a mock-up change, and it needs confirmation that the upstream Elastic
   documents carry those fields at all — this analysis establishes that our ingestor does not request
   them, not that they are absent upstream.

My recommendation is **(1) or (3)**, depending on whether a workflow board is worth a backend
change. (2) is technically easy but risks shipping a board people read as a work queue when it is
not one.
