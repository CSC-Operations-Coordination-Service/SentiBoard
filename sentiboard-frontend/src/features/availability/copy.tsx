import { asset } from "@/lib/asset";

export const AVAILABILITY_HERO_IMG = asset(
  "/assets/img/modules/availability.jpg",
);

export const AVAILABILITY_SUBTITLE =
  "Real-time list of available collections delivered by the missions, with key metrics.";

export const AVAILABILITY_DESCRIPTION = (
  <>
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
    <p className="callout-line">
      Please note: the selected &ldquo;from&rdquo;&ndash;&ldquo;to&rdquo; time
      range applies to the start date of the datatakes.
    </p>
    <div className="completeness-section">
      <p className="completeness-title">Completeness</p>
      <div className="desc-legend">
        <span className="legend-item">
          <i className="dot dot-planned" aria-hidden="true" />
          Planned
        </span>
        <span className="legend-item">
          <i className="dot dot-processing" aria-hidden="true" />
          Processing
        </span>
        <span className="legend-item">
          <i className="dot dot-acquired" aria-hidden="true" />
          Acquired
        </span>
        <span className="legend-item">
          <i className="dot dot-partial" aria-hidden="true" />
          Partial
        </span>
        <span className="legend-item">
          <i className="dot dot-unavailable" aria-hidden="true" />
          Unavailable
        </span>
      </div>
    </div>
  </>
);
