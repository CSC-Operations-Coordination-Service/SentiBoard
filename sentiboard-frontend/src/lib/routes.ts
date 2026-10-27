/* Every page of the app, in one place: the nav, the footer, the sitemap and the "coming soon"
   placeholders all read from here. A page moves from `comingSoon` to ported by replacing its
   placeholder route with the real one and flipping `ported` (which also puts it in the sitemap). */

export interface PageRoute {
  path: string;
  title: string;
  /** Ported to Next.js. Unported paths render the "coming soon" placeholder (noindex). */
  ported: boolean;
}

export const ROUTES = {
  home: { path: "/", title: "SentiBoard", ported: true },
  acquisitionsGlobe: { path: "/acquisitions-globe", title: "Acquisitions - Globe", ported: false },
  acquisitionsEarth: { path: "/acquisitions-globe-earth", title: "Acquisitions - Earth", ported: false },
  events: { path: "/events", title: "Events", ported: true },
  availability: { path: "/availability", title: "Data Availability", ported: false },
  processors: { path: "/processors", title: "Processors", ported: true },
  terms: { path: "/terms-conditions", title: "Terms & Conditions", ported: false },
  cookies: { path: "/cookie-notice", title: "Cookie Notice", ported: false },
} satisfies Record<string, PageRoute>;

export const SITE_NAME = "Copernicus Dashboard";

/** Public origin, for canonical URLs, the sitemap and robots. Server-side only. */
export function siteUrl(): URL {
  return new URL(process.env.SITE_URL || "https://operations.dashboard.copernicus.eu");
}
