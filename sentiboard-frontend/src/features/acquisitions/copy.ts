import { asset } from "@/lib/asset";

/** Shared SEO metadata, hero image and copy for both Acquisitions routes. */
export const SEO = {
  title: "Sentinel Acquisition Plans & Real-Time Status | Copernicus Dashboard",
  description:
    "Recent Sentinel satellite datatakes on an interactive 3D globe. " +
    "Filter by satellite, day and datatake to explore acquisition status. " +
    "Part of the official ESA Copernicus Sentinel Operations Dashboard.",
} as const;

export const ACQ_HERO_IMG = asset("/assets/img/modules/acquisitions.jpg");
export const ACQ_TITLE = "Acquisitions Status";
export const ACQ_SUBTITLE = "Real-time Sentinel datatakes on an interactive 3D globe";
