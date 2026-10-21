/// <reference types="vite/client" />
// Declares Vite's client-side globals to TypeScript — notably `import.meta.env`,
// which main.tsx reads (BASE_URL) to set react-router's basename. Part of the standard
// Vite scaffolding; it was missing here, so `tsc -b` failed as soon as anything
// touched import.meta.env.

interface ImportMetaEnv {
  /** Base URL for backend calls; "/api" (the default) goes through the dev proxy. */
  readonly VITE_API_BASE_URL?: string;
  /** "true" makes src/api return mock fixtures instead of calling the backend. */
  readonly VITE_USE_MOCKS?: string;
}
