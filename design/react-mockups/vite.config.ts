import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Mockup app: plain SPA. Pages wired through src/api read the FastAPI backend; the rest still
// use static mock data. In dev, /api is proxied to the backend with the prefix stripped, so
// /api/processor/ reaches http://localhost:8000/processor/ (same origin, no CORS). The app's
// base URL for API calls is VITE_API_BASE_URL (see .env.example); a deployed build needs its
// own /api route, since this proxy only exists in the dev server.
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
  server: {
    port: 5180,
    open: false,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        // Backend down: answer 502 Bad Gateway, as a real gateway would, instead of Vite's
        // default bare 500 — so the client can tell "unreachable" from a backend error.
        configure: (proxy) => {
          proxy.on("error", (_err, _req, res) => {
            if ("writeHead" in res && !res.headersSent) {
              res.writeHead(502, { "Content-Type": "text/plain" }).end("Backend unreachable");
            }
          });
        },
      },
    },
  },
});
