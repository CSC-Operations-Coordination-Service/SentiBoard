/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone — a self-contained server.js plus only the node_modules
  // it actually needs. The production image copies that instead of the whole
  // 269 MB node_modules tree. Affects `next build` output only; `next dev` is
  // unchanged, so local development behaves exactly as before.
  output: "standalone",
};

export default nextConfig;
