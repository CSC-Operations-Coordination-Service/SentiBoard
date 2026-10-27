/* Page copy, from the prototype (src/data/copy.tsx and processors.tsx), plus the SEO metadata
   carried over from the legacy app (apps/routes/home/routes.py PAGE_METADATA on main). */

export const PROCESSORS_TITLE = "Processors";
export const PROCESSORS_SUBTITLE =
  "The complete list of Copernicus Sentinel processor releases on an interactive timeline.";
export const PROCESSORS_HERO_IMG = "/assets/img/modules/processors.jpg";

export const PROCESSORS_DESCRIPTION =
  "The Processors tab shows the complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline. The " +
  "timeline can be zoomed in / out using the mouse wheel, and dragged to the left / right by moving the mouse while keeping left-hand " +
  "button pressed. By clicking on a coloured box, the details relevant to the selected processor release is displayed in the lower part of " +
  "the screen.";

export const DESCRIPTION = (
  <>
    <p>{PROCESSORS_DESCRIPTION}</p>
    <p>Select a release on the timeline to read its baseline notes.</p>
    <div className="desc-legend">
      <div className="legend-item">
        <span className="dot dot-bl-current" aria-hidden="true" />
        Current baseline
      </div>
      <div className="legend-item">
        <span className="dot dot-bl-superseded" aria-hidden="true" />
        Superseded
      </div>
    </div>
  </>
);

export const SEO = {
  title: "Copernicus Sentinel Processor Releases | Interactive Timeline",
  description:
    "Explore the full history of Copernicus Sentinel processor releases on an interactive timeline. " +
    "Track ESA processing baseline versions for Sentinel-1, -2, -3, and -5P and understand how each update affects satellite data products.",
  keywords: [
    "Copernicus Sentinel processor releases timeline",
    "ESA Sentinel processing baseline versions",
    "Sentinel processor changelog",
    "Copernicus data processing updates",
    "Sentinel-2 processor release history",
    "ESA ground segment processing baseline",
    "Copernicus processor version tracker",
  ],
};
