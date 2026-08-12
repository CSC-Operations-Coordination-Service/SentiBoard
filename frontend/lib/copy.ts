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
  "This page logs the events that could impede data production — calibration activities, satellite " +
  "manoeuvres, platform anomalies and ground-segment issues — against the month in which they " +
  "occurred. Each dot in a day cell is one event, and a coloured stripe marks a day on which " +
  "publication completeness was degraded or lost. Filter the month by mission, by satellite, by " +
  "event type, or search by event title, satellite or datatake ID. Select any day to open its Day " +
  "Manifest, which lists that day's events in time order; expanding an event reveals the datatakes " +
  "it impacted, with their sensing windows and completeness status.";
