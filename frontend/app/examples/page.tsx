import type { Metadata } from "next";
import Link from "next/link";

// DEVOCS-219 — gallery index for design mock-ups. Deliberately outside app/v1, so these pages
// carry no production chrome and can never be mistaken for the shipping app; the nav in
// components/Nav.tsx stays clean. New proposals get a row in MOCKUPS below.

export const metadata: Metadata = {
  title: "Mock-ups — SentiBoard v2",
  description: "Design proposals. Not the production pages.",
};

const MOCKUPS = [
  {
    href: "/examples/data-availability",
    idx: "01",
    title: "Data Availability",
    desc: "Datatake table with sortable columns, mission/satellite/date/ID filters and three donut breakdowns (mission share, acquisition status, sensor mode). Carries a dark/light toggle the production app does not have.",
    replaces: "/v1/availability",
  },
  {
    href: "/examples/data-availability-spacex",
    idx: "03",
    title: "Data Availability · Telemetry console",
    desc: "The same page read as a launch console: hairline rules instead of panels, 2px radii, monospace for every identifier, timestamp and figure. Live UTC clock and datatake counters in the header, three SVG donut metrics, a filter bar, and a compact table whose rows open full telemetry — sensing window, orbit, footprint corners and the raw metadata record. Carries its own light/dark toggle.",
    replaces: "/v1/availability",
  },
  {
    href: "/examples/events",
    idx: "02",
    title: "Events · Mission manifest — filters + day drawer",
    desc: "Month grid on the full width, one dot per event and a completeness stripe on days that lost data. Selecting a day opens the Day Manifest drawer: that day's occurrences in time order, each expanding into the datatakes it impacted, with sensing windows and completeness status.",
    replaces: "/v1/events",
  },
];

export default function ExamplesIndex() {
  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/v1">
              <svg viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>{" "}
              Home
            </Link>
            <span className="sep">/</span>
            <span className="cur">Mock-ups</span>
          </nav>
          <h1>Design mock-ups</h1>
          <p>
            Proposals under review. Every page here runs on locally generated mock data and is not wired to any
            backend — the shipping pages live under <code>/v1</code>.
          </p>
        </div>
      </div>

      <section className="wrap pad">
        <div className="about-modules">
          {MOCKUPS.map((m) => (
            <Link key={m.href} href={m.href} className="card">
              <span className="idx">{m.idx}</span>
              <h3>{m.title}</h3>
              <p>{m.desc}</p>
              <p style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent-cyan)" }}>
                proposal for {m.replaces} →
              </p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
