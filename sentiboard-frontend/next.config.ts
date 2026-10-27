import type { NextConfig } from "next";

// Sub-path the site is served under, e.g. "/sentiboard/frontend" behind an ingress that does not
// strip it. Unset = served at "/". Next inlines it at build time (links, assets, redirects), so it
// is a Docker build argument (BASE_PATH), not a runtime variable.
const basePath = process.env.BASE_PATH ?? "";
if (basePath && !/^\/[^/]+(\/[^/]+)*$/.test(basePath)) {
  throw new Error(`BASE_PATH must start with "/" and not end with one, got "${basePath}"`);
}

const nextConfig: NextConfig = {
  basePath,
  // For src/lib/asset.ts: raw <img src> and <source src> get no base path from Next.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Self-contained server bundle for the production Docker image (Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Legacy URLs → clean URLs, permanently (308). Rule: every legacy page URL gets one
  // (docs/memory/DECISIONS.md). Query strings are passed through.
  async redirects() {
    return [
      { source: "/processors-viewer.html", destination: "/processors", permanent: true },
      { source: "/processors-viewer", destination: "/processors", permanent: true },
      { source: "/events.html", destination: "/events", permanent: true },
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/index", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
