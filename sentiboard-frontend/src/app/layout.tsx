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

/* Runs before first paint: applies the saved theme (dark by default) so the page never flashes the
   wrong one, and marks <html> with .js so CSS can tell the JavaScript and no-JavaScript layouts
   apart (src/styles/shell.css). Same key as the theme toggle: localStorage "sb-theme". */
const PRE_PAINT = `(function(){var d=document.documentElement;d.classList.add("js");try{var t=localStorage.getItem("sb-theme");if(t!=="light"&&t!=="dark")t="dark";d.setAttribute("data-theme",t);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The pre-paint script changes data-theme and class before React hydrates.
    <html lang="en" data-theme="dark" className={notoSans.variable} suppressHydrationWarning>
      <head>
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
