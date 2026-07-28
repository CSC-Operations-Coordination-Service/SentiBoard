import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentiBoard v2 — Copernicus Sentinel Operations",
  description: "Copernicus Sentinel Operations Dashboard",
};

// DEVOCS-219: Space Grotesk (condensed technical grotesk) carries headlines and the big version
// numbers; Inter carries body and labels. Version strings and UTC timestamps use --mono, set in
// globals.css.
//
// These are next/font/LOCAL, not next/font/google, deliberately: the google loader downloads the
// files at build time over undici, which ignores HTTP_PROXY/HTTPS_PROXY. On a proxied build host
// (ocs.staging) that hangs or fails. Committing the woff2 files makes `next build` work with no
// network at all. Both are variable fonts, so one file covers the whole weight range.
//
// To update a face: fetch the latin src url from
// https://fonts.googleapis.com/css2?family=Inter:wght@100..900 (send a modern browser User-Agent,
// otherwise Google returns ttf), replace the file, and keep the weight range in sync.
const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-sans",
  display: "swap",
});
const grotesk = localFont({
  src: "./fonts/space-grotesk-latin-var.woff2",
  weight: "300 700",
  style: "normal",
  variable: "--font-display",
  display: "swap",
});

// Root layout stays minimal — just the document shell. The app chrome (Nav, Footer,
// reveal animations) lives in each version's layout (app/v1/layout.tsx), so the
// landing page at "/" and future versions can differ.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
