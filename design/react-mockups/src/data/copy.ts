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
  "occurred. Each dot in a day cell is one event, and a coloured stripe marks a day on which " +
  "publication completeness was degraded or lost. Filter the month by mission, by satellite, by " +
  "event type, or search by event title, satellite or datatake ID. Select any day to open its Day " +
  "Manifest, which lists that day's events in time order; expanding an event reveals the datatakes " +
  "it impacted, with their sensing windows and completeness status.";

/* Events log — the month grid with the side panel (the /examples/events-log* proposals). */
export const EVENTS_LOG_DESCRIPTION =
  "This page logs the events that could impede data production — planned calibration activities, " +
  "manoeuvres and anomalies — against the month in which they occurred, together with the products " +
  "they impact. Narrow the month down with the mission, event type and completeness status " +
  "filters. Select a day in the grid to list its occurrences in the side panel, then expand any " +
  "occurrence to see the datatakes it affected and how complete each one is.";

/* Events — the calendar on the current page, kept as-is for comparison against the proposals. */
export const EVENTS_LIST_DESCRIPTION =
  "This page shows the events of the past three months that could impede data production, on a " +
  "month calendar. Use the event type filters to show only the categories you are interested in; " +
  "the calendar and the event count update together. Select an event in the calendar to read its " +
  "details, including how far it affected data production and which products it impacted.";

/* Acquisitions — shared by the current globe page and the demand-driven proposal, since both
   answer the same question with the same controls. */
export const ACQUISITIONS_DESCRIPTION =
  "This page shows past, current and future Copernicus Sentinel acquisitions on an interactive 3D " +
  "globe. By default the real-time sensing scenario is displayed. Filter by satellite and by " +
  "acquisition status to focus the globe on a single mission, inspect a past acquisition to see " +
  "how it completed, or explore what is planned ahead. Drag to rotate the globe and scroll to zoom.";

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
