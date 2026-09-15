import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const metadata: Metadata = {
  title: "SentiBoard v2 — Copernicus Sentinel Operations",
  description: "Copernicus Sentinel Operations Dashboard",
};

// DEVOCS-219: NotesEsa is the ESA brand face and carries the whole app — body text and headings
// alike. globals.css points both --sans and --display at the --font-display variable declared
// below; the system stack behind them is only the loading fallback. Timestamps, identifiers and
// figures keep --mono, which is not NotesEsa: those are read down a column.
//
// next/font/LOCAL, not next/font/google, deliberately: the google loader downloads the files at
// build time over undici, which ignores HTTP_PROXY/HTTPS_PROXY and hangs on a proxied build host
// (ocs.staging). Committing the woff2 files makes `next build` work with no network at all.
//
// Reach the family through var(--font-display) only. next/font rewrites the family to a hashed
// name (__notesEsa_<hash>), so a literal "NotesEsa" in CSS matches nothing and falls silently
// through to the system stack.

const notesEsa = localFont({
  src: [
    {
      path: "./fonts/NotesEsa.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/NotesEsa-Italic.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/NotesEsa-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/NotesEsa-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

// Root layout stays minimal — just the document shell. The app chrome (Nav, Footer,
// reveal animations) lives in each version's layout (app/v1/layout.tsx), so the
// landing page at "/" and future versions can differ.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={notesEsa.variable}>
      <body>{children}</body>
    </html>
  );
}
