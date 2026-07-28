"use client";
import { useEffect } from "react";

// Adds `.in` to `.reveal` elements as they scroll into view (same behaviour as the
// mockup's app.js). A MutationObserver re-scans whenever the DOM changes, so content
// swapped in by client-side navigation (e.g. changing the Events month via ?month=)
// gets revealed too — usePathname() alone misses query-only navigations.
export default function RevealInit() {
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.12 },
    );
    const scan = () => document.querySelectorAll(".reveal:not(.in)").forEach((el) => io.observe(el));

    scan(); // initial content
    const mo = new MutationObserver(scan); // re-scan when navigation swaps in new nodes
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);
  return null;
}
