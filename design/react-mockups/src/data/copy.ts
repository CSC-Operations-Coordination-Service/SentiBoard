/* Page copy carried over verbatim from the production dashboard, so a proposal never drifts from
   what the live page actually tells users. The Data Availability description is the one behind the
   "Description" accordion in apps/templates/home/data-availability.html — every version of the
   page (the real one and the proposals) shows it the same way: a short line always visible and the
   full text in a panel that can be collapsed. Rendered by <PageDescription>, which starts it open.

   The descriptions below with no production counterpart — Events, Acquisitions, Processors — are
   for pages that are new in v2, so they describe the proposal's own controls rather than restating
   copy from a page that does not exist yet. */

import Events from "@/pages/Events";

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
  "This view shows the events occurred on a given date and the possible impact on user products completeness. " +
  "Events are categorized according to the following issue types: " +
  " - Acquisition: issue occurring during the reception of the data at the ground station " +
  "- Calibration: issue occurred during sensor calibration " +
  "- Manoeuvre: issue occurred during the execution of a manoeuvre " +
  "- Production: issue occurred during data processing " +
  "- Satellite: issue due to instrument unavailability " +
  "When an occurrence is clicked, the bottom panel shows a list of potentially impacted datatakes, determined by their " +
  "sensing times, along with further details about the event. The impact on datatake completeness is represented by the " +
  "right-side coloured circle. The 'green' colour indicates that the total completeness is spared; 'orange' is used in " +
  "case of medium impact; the 'red' colour is used when the datatake is lost. " +
  "Events can be filtered by mission, event type, satellite name (e.g., 'Sentinel-1A'), or by entering a category of interest in the search box.";

/* Events — the mission swimlanes (the /examples/events-swimlanes proposal). The top level is the
   fleet rather than time, so the description leads with the row and says what "active" means: the
   Events feed has no open/closed field, and the badge must not be read as one. */
export const EVENTS_SWIMLANES_DESCRIPTION =
  "This view shows the events occurred on a given date and the possible impact on user products completeness. " +
  "Events are categorized according to the following issue types: " +
  " - Acquisition: issue occurring during the reception of the data at the ground station " +
  "- Calibration: issue occurred during sensor calibration " +
  "- Manoeuvre: issue occurred during the execution of a manoeuvre " +
  "- Production: issue occurred during data processing " +
  "- Satellite: issue due to instrument unavailability " +
  "When an occurrence is clicked, the bottom panel shows a list of potentially impacted datatakes, determined by their " +
  "sensing times, along with further details about the event. The impact on datatake completeness is represented by the " +
  "right-side coloured circle. The 'green' colour indicates that the total completeness is spared; 'orange' is used in " +
  "case of medium impact; the 'red' colour is used when the datatake is lost. " +
  "Events can be filtered by mission, event type, satellite name (e.g., 'Sentinel-1A'), or by entering a category of interest in the search box.";

/* Events — the calendar on the current page, kept as-is for comparison against the proposals. */
export const EVENTS_LIST_DESCRIPTION =
  "This view shows the events occurred on a given date and the possible impact on user products completeness. " +
  "Events are categorized according to the following issue types: " +
  " - Acquisition: issue occurring during the reception of the data at the ground station " +
  "- Calibration: issue occurred during sensor calibration " +
  "- Manoeuvre: issue occurred during the execution of a manoeuvre " +
  "- Production: issue occurred during data processing " +
  "- Satellite: issue due to instrument unavailability " +
  "When an occurrence is clicked, the bottom panel shows a list of potentially impacted datatakes, determined by their " +
  "sensing times, along with further details about the event. The impact on datatake completeness is represented by the " +
  "right-side coloured circle. The 'green' colour indicates that the total completeness is spared; 'orange' is used in " +
  "case of medium impact; the 'red' colour is used when the datatake is lost. " +
  "Events can be filtered by mission, event type, satellite name (e.g., 'Sentinel-1A'), or by entering a category of interest in the search box.";

/* Acquisitions — shared by the current globe page and the demand-driven proposal, since both
   answer the same question with the same controls. */
export const ACQUISITIONS_DESCRIPTION =
  "This view shows the scheduled Acquisition Plans, on an interactive " +
  "3D globe. By default, the view shows the real-time position of the Copernicus Sentinels satellite; " +
  "however, by selecting a datatake from the top-right dropdown menu, the simulation time is shifted to " +
  "the beginning of the selected acquisition. Datatakes can be filtered by selecting the satellite and " +
  "the acquisition date. By clicking on the  icon, it is possible to inspect the published products " +
  "relevant to the selected datatake.entinel acquisitions on a 3D globe.  ";

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
