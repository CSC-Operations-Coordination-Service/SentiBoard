// Page copy carried over verbatim from the production dashboard, so this frontend never drifts
// from what the live page tells users. The Data Availability description is the one behind the
// "Description" accordion in apps/templates/home/data-availability.html — every version of the
// page shows it the same way: a short line always visible and the full text in a panel that can be
// collapsed. Rendered by components/PageDescription.tsx, which starts the panel open.
//
// EVENTS_DESCRIPTION has no production counterpart — the Events page is new in v2 — so it
// describes the proposal's own controls rather than restating copy from a page that does not
// exist yet.

export const AVAILABILITY_SUMMARY =
  "All datatakes from the past three months, including those scheduled up to 23:59:59 of the following day — refreshed hourly.";

export const AVAILABILITY_DESCRIPTION =
  "This page displays all datatakes from the past three months, including those scheduled up to 23:59:59 of the following day. " +
  "For each datatake, key information is shown—such as the acquisition platform, sensor mode, acquisition status, and total " +
  "publication completeness (expressed as a percentage)—with updates refreshed hourly. You can filter the records by mission " +
  "and, optionally, by satellite. Alternatively, filtering by satellite alone is also possible. For Sentinel-5P, the satellite " +
  "selector is disabled, as only one satellite is available. Additional filters include a custom date range (aligned with the " +
  "time filter selected at the top of the page), as well as direct searches by datatake ID. Please note: the selected " +
  '"from"-"to" time range applies to the start date of the datatakes.';

export const EVENTS_DESCRIPTION =
  "This view shows the events occurred on a given date and the possible impact on user products completeness. Events are categorized according to the following issue types:\n" +
  "- Acquisition: issue occurring during the reception of the data at the ground station\n" +
  "- Calibration: issue occurred during sensor calibration\n" +
  "- Manoeuvre: issue occurred during the execution of a manoeuvre\n" +
  "- Production: issue occurred during data processing\n" +
  "- Satellite: issue due to instrument unavailability\n" +
  "When an occurrence is clicked, the bottom panel shows a list of potentially impacted datatakes, determined by their sensing times, along with further details about the event. The impact on datatake completeness is represented by the right-side coloured circle. The \"green\" colour indicates that the total completeness is spared; \"orange\" is used in case of medium impact; the \"red\" colour is used when the datatake is lost.\n" +
  "Events can be filtered by mission, event type, satellite name (e.g., 'Sentinel-1A'), or by entering a category of interest in the search box.";
