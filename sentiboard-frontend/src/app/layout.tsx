import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Partners from "@/components/Partners";
import { siteUrl } from "@/lib/routes";
// The prototype's stylesheets, verbatim (global.css imports tokens.css), then the port's additions.
import "@/styles/global.css";
import "@/styles/page-header.css";
import "@/styles/footer.css";
import "@/styles/shell.css";

const notoSans = localFont({
  src: "../fonts/NotoSans-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-noto-sans",
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: "SentiBoard — Copernicus Sentinel Operations Dashboard",
  description: "Real-time Copernicus Sentinel ground-segment operations dashboard.",
};

export const viewport: Viewport = {
  themeColor: "#006B7C",
};

/* Runs before first paint: marks <html> with .js so CSS can tell the JavaScript and no-JavaScript
   layouts apart (src/styles/shell.css). Dark-only mode — data-theme="dark" is already in the HTML;
   we clear any stored light choice so it can never flash on reload. To restore the toggle, reinstate
   the localStorage read here and bring back <ThemeToggle /> in Nav.tsx. */
const PRE_PAINT = `(function(){var d=document.documentElement;d.classList.add("js");try{localStorage.removeItem("sb-theme");}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth" className={notoSans.variable} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark" />
        <script dangerouslySetInnerHTML={{ __html: PRE_PAINT }} />
      </head>
      <body>
        <Nav partners={<Partners compact />} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
