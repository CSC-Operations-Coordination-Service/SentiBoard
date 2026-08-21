import { Link } from "react-router-dom";
import { Globe2, CalendarClock, Database, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/ui";
import FeatureCard, { type Feature } from "@/components/FeatureCard";
import { ABOUT_INTRO, ABOUT_MODULES, ABOUT_OUTRO, ABOUT_CONTACT_EMAIL } from "@/data/about";
import "@/styles/examples.css";

/* About page PROPOSAL — an alternative to the real /about (which is untouched).
   The first section carries the FULL canonical About text (src/data/about.ts).
   Because that text already describes the four modules, we don't add a separate
   "pages" section — instead the four module descriptions ARE rendered as image
   cards, so the card grid is the module part of the mandatory text, not a repeat. */

// visual dressing for each module card, keyed by href (text stays in about.ts)
const MODULE_ART: Record<string, { Icon: LucideIcon; img: string }> = {
  "/acquisitions": { Icon: Globe2, img: "/assets/img/modules/acquisitions.jpg" },
  "/events": { Icon: CalendarClock, img: "/assets/img/modules/events.jpg" },
  "/availability": { Icon: Database, img: "/assets/img/modules/availability.jpg" },
  "/processors": { Icon: Cpu, img: "/assets/img/modules/processors.jpg" },
};

const FEATURES: Feature[] = ABOUT_MODULES.map((m) => ({
  href: m.href, title: m.title, desc: m.desc, ...MODULE_ART[m.href],
}));

const FAQS: { group: string; items: [string, string][] }[] = [
  {
    group: "General Information", items: [
      ["What is the SentiBoard?", "The Operations Dashboard provides real-time and historical insights into data availability and the processor baseline. It's intended for users who want an overview of satellite data flows."],
      ["Who can use the Dashboard?", "It is publicly accessible and designed for technical users, scientists, policymakers, and service operators interested in mission performance and service continuity."],
    ],
  },
  {
    group: "Sentinel Missions Monitoring", items: [
      ["What kind of mission data is displayed?", "The dashboard shows the operational status of Sentinel satellites (e.g., Sentinel-1A/B, -2A/B, -3A/B, -5P), including acquisition planning, data availability, and processors baseline."],
      ["How frequently is data updated?", "Most data is updated daily or in near real-time, depending on the subsystem (e.g., acquisitions, ground segment performance, data availability)."],
    ]
  },
  {
    group: "Data & Product Availability", items: [
      ["What product metrics can I view?", "Statistics on availability, completeness, latency, timeliness, and throughput for each Sentinel mission — enough to evaluate performance against service-level expectations."],
      ["How frequently is data updated?", "Most data is updated daily or in near real-time, depending on the subsystem (acquisitions, ground-segment performance, data availability)."],
    ],
  },
  {
    group: "Navigation & Features", items: [
      ["How do I find specific data?", "To locate specific data, use the top navigation menu of the dashboard. The Acquisitions Status section presents past, current, and planned Copernicus Sentinel acquisitions on an interactive 3D globe. Events provides recent information about activities that may affect data production, such as manoeuvres or anomalies. In Data Availability, you'll find real-time access to delivered data collections, including Detail Data Availability and Global Data Availability views. These help users browse and assess products according to their research needs. Finally, the Processors tab features an interactive timeline of Sentinel processor releases, allowing detailed inspection of each version. This timeline works in conjunction with the left-hand panel, where you can filter the data by mission (e.g., Sentinel-2). As you explore the timeline and filtered data, hovering over the graphs reveals tooltips with precise values and timestamps, providing a seamless, detailed view of processor updates."],
      ["Can I export the charts or data?", "While there's no dedicated export button, screenshots and browser-based print/save tools can be used. For bulk or raw data, refer to the Data Space Ecosystem."],
    ]
  },
  {
    group: "Troubleshooting", items: [
      ["Why is some data missing or flatlined?", "Gaps may reflect planned maintenance, satellite anomalies, or delays in ground segment reporting. These are often documented in the Sentinel news feed."],
      ["The dashboard is not loading—what should I do?", "First, ensure your browser allows scripts and cookies. If problems persist, try clearing your cache or switching to another browser. There is no login requirement for general access."],
    ]
  },
  {
    group: "Contact & Support", items: [
      ["How can I report a bug or request help?", `For dashboard support, including data access and operational issues, contact us at ${ABOUT_CONTACT_EMAIL}.`],
    ],
  },
];

export default function AboutRedesign() {
  return (
    <>
      {/* ---------- FIRST SECTION: canonical About text (intro) ---------- */}
      <section className="ab-hero">
        <div className="ab-hero-bg" aria-hidden />
        <div className="wrap pad">
          <h1>The Copernicus Sentinel Operations Dashboard</h1>
          <p className="ab-hero-sub">{ABOUT_INTRO[0]}</p>
        </div>
      </section>

      <section className="wrap pad" style={{ paddingTop: 0 }}>
        <Reveal className="ab-intro">
          <p>{ABOUT_INTRO[1]}</p>
          <p>{ABOUT_INTRO[2]}</p>
        </Reveal>
      </section>

      {/* the four modules — these ARE the module descriptions from the text above,
          rendered as cards rather than a bulleted list */}
      <section className="wrap pad" style={{ paddingTop: 0 }}>
        <Reveal className="ab-features">
          {FEATURES.map((f) => <FeatureCard f={f} key={f.href} />)}
        </Reveal>
      </section>

      {/* closing paragraph + contact — still part of the canonical text */}
      <section className="wrap pad" style={{ paddingTop: 0 }}>
        <Reveal className="ab-intro">
          <p>{ABOUT_OUTRO}</p>
          <p className="ab-contact">
            For any inquiries on the Copernicus Sentinel Operations Dashboard contact{" "}
            <a href={`mailto:${ABOUT_CONTACT_EMAIL}`}>{ABOUT_CONTACT_EMAIL}</a>.
          </p>
        </Reveal>
      </section>

      {/* ---------- FAQs ---------- */}
      <section className="wrap pad" id="ab-faq" style={{ paddingTop: 0 }}>
        <Reveal className="section-head"><div><h2>FAQs</h2></div><span className="meta">Click to expand</span></Reveal>
        <Reveal className="ab-faqs">
          {FAQS.map((g) => (
            <div className="faq-group" key={g.group}>
              <div className="gtitle">{g.group}</div>
              {g.items.map(([q, a], i) => (
                <details className="faq" key={i}>
                  <summary>{q}<span className="chev">+</span></summary>
                  <div className="ans">{a}</div>
                </details>
              ))}
            </div>
          ))}
        </Reveal>
      </section>

      <span className="ex-badge">Proposal · About redesign</span>
    </>
  );
}
