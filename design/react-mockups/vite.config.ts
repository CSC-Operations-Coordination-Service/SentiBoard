import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Mockup app: plain SPA. In the real product, data is delivered via Flask SSR
// (no exposed JSON API) — here we use static mock data purely to show the UI.
export default defineConfig({
  // Where the app will be served from. "/" (the default) suits local dev and a
  // dedicated host/port. Set VITE_BASE at build time to deploy under a path, e.g.
  // VITE_BASE=/mockups/ for https://host/mockups/ — index.html then requests
  // /mockups/assets/... instead of /assets/..., and main.tsx feeds the same value to
  // react-router as its basename. Must end with a slash.
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5180, open: false },
});
