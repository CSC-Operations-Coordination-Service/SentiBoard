/// <reference types="vite/client" />
// Declares Vite's client-side globals to TypeScript — notably `import.meta.env`,
// which main.tsx reads (BASE_URL) to set react-router's basename. Part of the standard
// Vite scaffolding; it was missing here, so `tsc -b` failed as soon as anything
// touched import.meta.env.
