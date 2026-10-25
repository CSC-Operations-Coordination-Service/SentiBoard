/* Page copy carried over verbatim from the production dashboard, so a proposal never drifts from
   what the live page actually tells users. The Data Availability description is the one behind the
   "Description" accordion in apps/templates/home/data-availability.html — every version of the
   page (the real one and the proposals) shows it the same way: a short line always visible and the
   full text in a panel that can be collapsed. Rendered by <PageDescription>, which starts it open.

   The descriptions below with no production counterpart — Events, Acquisitions, Processors — are
   for pages that are new in v2, so they describe the proposal's own controls rather than restating
   copy from a page that does not exist yet. */

import Events from "@/pages/Events";
import React from "react";

export const AVAILABILITY_SUMMARY = "";

export const AVAILABILITY_DESCRIPTION = (
  <div className="availability-description">
    <p>
      This page displays all datatakes from the past three months, including
      those scheduled up to 23:59:59 of the following day. For each datatake,
      key information is shown—such as the acquisition platform, sensor mode,
      acquisition status, and total publication completeness (expressed as a
      percentage)—with updates refreshed hourly.
    </p>

    <p>
      You can filter the records by mission and, optionally, by satellite.
      Alternatively, filtering by satellite alone is also possible. For
      Sentinel-5P, the satellite selector is disabled, as only one satellite is
      available. Additional filters include a custom date range (aligned with
      the time filter selected at the top of the page), as well as direct
      searches by datatake ID.
    </p>

    <div className="callout-line">
      <strong>Please note:</strong> the selected “from”–“to” time range applies
      to the start date of the datatakes.
    </div>

    <div className="completeness-section">
      <h4 className="completeness-title">COMPLETENESS</h4>
      <div className="desc-legend" id="descLegend">
        <div className="legend-item">
          <span className="dot dot-planned"></span> PLANNED
        </div>
        <div className="legend-item">
          <span className="dot dot-processing"></span> PROCESSING
        </div>
        <div className="legend-item">
          <span className="dot dot-acquired"></span> ACQUIRED
        </div>
        <div className="legend-item">
          <span className="dot dot-partial"></span> PARTIAL
        </div>
        <div className="legend-item">
          <span className="dot dot-unavailable"></span> UNAVAILABLE
        </div>
      </div>
    </div>
  </div>
);
/* Events — the "Mission Manifest" calendar proposal: month grid plus the Day Manifest drawer. */
export const EVENTS_DESCRIPTION =
  "This view shows the events occurred on a given date and the possible impact on user products completeness. Events are categorized according to the following issue types:\n" +
  "- Acquisition: issue occurring during the reception of the data at the ground station\n" +
  "- Calibration: issue occurred during sensor calibration\n" +
  "- Manoeuvre: issue occurred during the execution of a manoeuvre\n" +
  "- Production: issue occurred during data processing\n" +
  "- Satellite: issue due to instrument unavailability\n" +
  "Clicking a star flies into that day and lists the datatakes it potentially impacted, determined " +
  "by their sensing times, along with further details about the event. The impact on datatake completeness " +
  "is given by the coloured dot beside each datatake: green when the total completeness is spared, orange in " +
  "case of medium impact, red when the datatake is lost.\n";

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
export const ACQUISITIONS_DESCRIPTION = (
  <p>
    The <b>Acquisitions Status</b> view displays the past, current and future
    Copernicus Sentinels' acquisition on an interactive, 3D globe. Through this
    view, users can either inspect the status of a past acquisition, or learn
    about the planned acquisitions for the mission of interest. By default, the
    real-time sensing scenario is displayed.
  </p>
);
/* Processors — the release timeline. */
export const PROCESSORS_DESCRIPTION =
  "The Processors tab shows the complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline. The " +
  "timeline can be zoomed in / out using the mouse wheel, and dragged to the left / right by moving the mouse while keeping left-hand " +
  "button pressed. By clicking on a coloured box, the details relevant to the selected processor release is displayed in the lower part of " +
  "the screen.";

/* Processors — the version matrix proposal. Describes its own controls rather than the timeline's,
   since the two read the same releases in deliberately different ways. */
export const PROCESSORS_MATRIX_DESCRIPTION =
  "This view shows the complete list of the releases of the Copernicus Sentinels processors, " +
  "on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged" +
  " to the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a " +
  "colored box, the details relevant to the selected processor release is displayed in the lower part of the screen.";

/* Processors — the release log proposal. The notes are this view's content rather than a detail
   panel's payload, so the description leads with them. */
export const PROCESSORS_LOG_DESCRIPTION =
  "This view shows the complete list of the releases of the Copernicus Sentinels processors, " +
  "on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged" +
  " to the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a " +
  "colored box, the details relevant to the selected processor release is displayed in the lower part of the screen.";

/* Processors — the version compare proposal. A task view rather than a browsing one, so the
   description explains the two picks rather than what the page lists. */
export const PROCESSORS_COMPARE_DESCRIPTION =
  "This view shows the complete list of the releases of the Copernicus Sentinels processors, " +
  "on an interactive timeline. The timeline can be zoomed in / out using the mouse wheel, and dragged" +
  " to the left / right by moving the mouse while keeping left-hand button pressed. By clicking on a " +
  "colored box, the details relevant to the selected processor release is displayed in the lower part of the screen.";
