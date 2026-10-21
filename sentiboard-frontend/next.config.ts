import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Legacy URLs → clean URLs, permanently (308). Rule: every legacy page URL gets one
  // (docs/memory/DECISIONS.md). Query strings are passed through.
  async redirects() {
    return [
      { source: "/processors-viewer.html", destination: "/processors", permanent: true },
      { source: "/processors-viewer", destination: "/processors", permanent: true },
    ];
  },
};

export default nextConfig;
