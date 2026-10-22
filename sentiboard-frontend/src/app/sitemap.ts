import type { MetadataRoute } from "next";
import { ROUTES, siteUrl } from "@/lib/routes";

/** Ported pages only: "coming soon" placeholders are noindex and stay out. Frequencies and
 *  priorities follow the legacy sitemap (apps/__init__.py on main). */
const LEGACY_HINTS: Record<string, Pick<MetadataRoute.Sitemap[number], "changeFrequency" | "priority">> = {
  [ROUTES.processors.path]: { changeFrequency: "weekly", priority: 0.7 },
};

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return Object.values(ROUTES)
    .filter((r) => r.ported)
    .map((r) => ({ url: new URL(r.path, base).href, ...LEGACY_HINTS[r.path] }));
}
