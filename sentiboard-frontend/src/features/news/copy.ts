/* Page copy and SEO metadata for the News page. */

import { asset } from "@/lib/asset";

export const NEWS_TITLE = "News";
export const NEWS_SUBTITLE =
  "Operational announcements and status updates for the Copernicus Sentinel constellation.";

/** Reuses the events hero — no news-specific image is committed. */
export const NEWS_HERO_IMG = asset("/assets/img/modules/news_bck.jpg");

export const SEO = {
  title: "Copernicus Sentinel News | Operations Updates",
  description:
    "Latest operational news and status updates for the Copernicus Sentinel satellite constellation. " +
    "Browse announcements sorted newest first.",
  keywords: [
    "Copernicus Sentinel news",
    "Sentinel operations updates",
    "Copernicus satellite status",
    "Sentinel-1 news",
    "Sentinel-2 news",
    "Copernicus dashboard news",
  ],
};
