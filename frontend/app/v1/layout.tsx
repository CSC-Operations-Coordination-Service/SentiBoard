import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import RevealInit from "@/components/RevealInit";

// Layout for the v1 version of the app — carries the shared chrome (nav, footer,
// scroll-reveal). Future versions get their own layout under app/v2, app/v3, …
export default function V1Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      {children}
      <Footer />
      <RevealInit />
    </>
  );
}
