import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": src("./src"),
      // The modules under test import "server-only", which throws outside a React Server
      // environment. Next resolves it to this same empty file on the server; the build-time
      // guard against client imports is unaffected.
      "server-only": src("./node_modules/server-only/empty.js"),
    },
  },
  test: {
    // Plain Node: no browser DOM. The sanitizer creates its own jsdom window, and the tests that
    // inspect HTML parse it with jsdom themselves.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // No backend, no network: fetch is stubbed per test, and any call left unstubbed fails.
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      // lcov is what SonarQube reads (sonar-project.properties); the summary is for the CI log.
      reporter: ["text-summary", "lcov"],
      // Every source file, tested or not, so an untested module lowers the figure instead of
      // missing from it. The rest is not code under test: the tests, their fixtures, the
      // generated API types, and the stylesheets and fonts.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.ts", "src/**/__fixtures__/**", "src/lib/api/schema.d.ts"],
    },
  },
});
