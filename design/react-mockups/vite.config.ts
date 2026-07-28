import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Mockup app: plain SPA. In the real product, data is delivered via Flask SSR
// (no exposed JSON API) — here we use static mock data purely to show the UI.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 5180, open: false },
});
