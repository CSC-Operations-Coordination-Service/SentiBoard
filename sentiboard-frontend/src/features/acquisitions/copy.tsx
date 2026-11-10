import { asset } from "@/lib/asset";

/** Collapsible description panel content, verbatim from the mock-up
 *  (design/react-mockups/src/data/copy.tsx lines 109-117). */
export function AcquisitionsDescription() {
  return (
    <p>
      The <b>Acquisitions Status</b> view displays the past, current and future
      Copernicus Sentinels&rsquo; acquisition on an interactive, 3D globe.
      Through this view, users can either inspect the status of a past
      acquisition, or learn about the planned acquisitions for the mission of
      interest. By default, the real-time sensing scenario is displayed.
    </p>
  );
}

export const SEO = {
  title: "Sentinel Acquisition Plans & Real-Time Status | Copernicus Dashboard",
  description:
    "Recent Sentinel satellite datatakes on an interactive 3D globe. " +
    "Filter by satellite, day and datatake to explore acquisition status. " +
    "Part of the official ESA Copernicus Sentinel Operations Dashboard.",
} as const;

export const ACQ_HERO_IMG = asset("/assets/img/modules/acquisitions.jpg");
export const ACQ_TITLE = "Acquisitions Status";
export const ACQ_SUBTITLE =
  "Past, current and planned Sentinel acquisitions on an interactive 3D globe.";
