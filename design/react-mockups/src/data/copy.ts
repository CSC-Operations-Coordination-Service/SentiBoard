/* Page copy carried over verbatim from the production dashboard, so a proposal never drifts from
   what the live page actually tells users. The Data Availability description is the one behind the
   "Description" accordion in apps/templates/home/data-availability.html — every version of the
   page (the real one and the proposals) shows it the same way: a short line always visible and the
   full text in a panel that can be collapsed. Rendered by <PageDescription>, which starts it open.

   The descriptions below with no production counterpart — Events, Acquisitions, Processors — are
   for pages that are new in v2, so they describe the proposal's own controls rather than restating
   copy from a page that does not exist yet. */

export const AVAILABILITY_SUMMARY =
  "";

export const AVAILABILITY_DESCRIPTION =
  "This page displays all datatakes from the past three months, including those scheduled up to 23:59:59 of the following day. " +
  "For each datatake, key information is shown—such as the acquisition platform, sensor mode, acquisition status, and total " +
  "publication completeness (expressed as a percentage)—with updates refreshed hourly. You can filter the records by mission " +
  "and, optionally, by satellite. Alternatively, filtering by satellite alone is also possible. For Sentinel-5P, the satellite " +
  "selector is disabled, as only one satellite is available. Additional filters include a custom date range (aligned with the " +
  "time filter selected at the top of the page), as well as direct searches by datatake ID. Please note: the selected " +
  '"from"-"to" time range applies to the start date of the datatakes.';

/* Events — the "Mission Manifest" calendar proposal: month grid plus the Day Manifest drawer. */
export const EVENTS_DESCRIPTION =
  "This page logs the events that could impede data production — calibration activities, satellite " +
  "manoeuvres, platform anomalies and ground-segment issues — against the month in which they " +
  "occurred. Each icon in a day cell is one event, drawn with that event type's glyph — the same " +
  "icons as the event type filters — and a coloured stripe marks a day on which " +
  "publication completeness was degraded or lost. Filter the month by mission, by satellite, by " +
  "event type, or search by event title, satellite or datatake ID. Select any day to open its Day " +
  "Manifest, which lists that day's events in time order; expanding an event reveals the datatakes " +
  "it impacted, with their sensing windows and completeness status.";

/* Events — the mission swimlanes (the /examples/events-swimlanes proposal). The top level is the
   fleet rather than time, so the description leads with the row and says what "active" means: the
   Events feed has no open/closed field, and the badge must not be read as one. */
export const EVENTS_SWIMLANES_DESCRIPTION =
  "This page groups the month's events by mission rather than by date. Each row is one mission, and " +
  "states — before it is opened — how many events it had, how many distinct datatakes those events " +
  "affected, which event types occurred, and how many of them still have data missing. Open a row " +
  "to list that mission's events in date order, then expand an event to see the datatakes it " +
  "impacted, with their sensing windows and completeness status. \"Active\" counts events whose " +
  "datatake completeness is still degraded, lost or in progress: the events feed carries no " +
  "open/closed state, so this is derived from completeness rather than read from a status field.";

/* Events — the calendar on the current page, kept as-is for comparison against the proposals. */
export const EVENTS_LIST_DESCRIPTION =
  "This page shows the events of the past three months that could impede data production, on a " +
  "month calendar. Use the event type filters to show only the categories you are interested in; " +
  "the calendar and the event count update together. Select an event in the calendar to read its " +
  "details, including how far it affected data production and which products it impacted.";

/* Acquisitions — shared by the current globe page and the demand-driven proposal, since both
   answer the same question with the same controls. */
export const ACQUISITIONS_DESCRIPTION =
  "This page shows Copernicus Sentinel acquisitions on a 3D globe.  " +
  "Filter by satellite and acquisition status to explore current and past missions. " +
  "Drag to rotate and scroll to zoom. ";

/* Processors — the release timeline. */
export const PROCESSORS_DESCRIPTION =
  "This page lists every release of the Copernicus Sentinel processors on an interactive timeline. " +
  "Filter by mission to show only the processors you are interested in. Zoom in and out with the " +
  "mouse wheel, drag left and right to move through time, and select a coloured box to display the " +
  "details of that processor release.";

/* Processors — the version matrix proposal. Describes its own controls rather than the timeline's,
   since the two read the same releases in deliberately different ways. */
export const PROCESSORS_MATRIX_DESCRIPTION =
  "This page lists every release of the Copernicus Sentinel processors as a comparison grid. Each " +
  "row is a processor; each column is a baseline version in sequence, with the newest release of " +
  "every row in the last column — so reading that column downwards gives the current state of the " +
  "whole constellation, and the columns to its left are one, two or three baselines back. Each cell " +
  "shows the baseline version and the date it was released; a filled marker is the baseline " +
  "currently in force, and a hollow one has been replaced by a later release. Filter by mission to " +
  'narrow the rows, or switch on "Current versions only" to collapse the grid to a single column ' +
  "showing the most recent release per processor and how long it has been in force. Select any cell " +
  "to read that release's date, the period it covered, what it replaced, its release notes and the " +
  "satellites it applies to.";

/* Processors — the release log proposal. The notes are this view's content rather than a detail
   panel's payload, so the description leads with them. */
export const PROCESSORS_LOG_DESCRIPTION =
  "This page lists every release of the Copernicus Sentinel processors as a feed, most recent " +
  "first, with each entry's release notes shown in full rather than summarised or hidden. Each " +
  "entry carries the processor it applies to, its baseline version, the date it was released, the " +
  "release notes themselves and the satellites affected. Switch the grouping between by date, which " +
  "buckets releases into the month they landed in and reads as a changelog for the whole " +
  "constellation, and by processor, which reads as a release history per product. Narrow the feed by " +
  "mission, by release-date range, or by searching — the search covers the release notes, the " +
  "processor and its products, the baseline version, the mission and the satellites, and matches " +
  "inside the notes are marked in place. All three narrow the feed together. Releases that the feed " +
  "carries no notes for are listed with that stated.";

/* Processors — the version compare proposal. A task view rather than a browsing one, so the
   description explains the two picks rather than what the page lists. */
export const PROCESSORS_COMPARE_DESCRIPTION =
  "This page compares two baselines of one Copernicus Sentinel processor. Choose the processor, " +
  "then the earlier and later baselines to compare; the later list only offers releases that came " +
  'after the earlier one, so the comparison always reads forwards in time. "Compare to current" ' +
  "sets the later side to the most recently released baseline. The summary states how far apart the " +
  "two releases are, how many baselines the jump covers and which ones it skips over, and how the " +
  "satellite coverage differs. Below it the release notes sit side by side, compared paragraph by " +
  "paragraph: a line only the earlier baseline carried is marked with a minus, a line the later one " +
  "added is marked with a plus, and a line both restate is dimmed rather than flagged as a change.";
