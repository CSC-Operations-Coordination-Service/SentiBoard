import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/routes";

/** Ported from the legacy robots.txt (apps/__init__.py on main): everything allowed in production,
 *  everything disallowed elsewhere. ALLOW_INDEXING=true marks production; it defaults to off so a
 *  staging or local deployment is never indexed by accident. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.ALLOW_INDEXING !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
