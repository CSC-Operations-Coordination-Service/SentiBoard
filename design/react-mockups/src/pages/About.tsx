import { Link } from "react-router-dom";
import { PageHeader, Reveal } from "@/components/ui";
import { ABOUT_INTRO, ABOUT_MODULES, ABOUT_OUTRO, ABOUT_CONTACT_EMAIL } from "@/data/about";

const FAQS: { group: string; items: [string, string][] }[] = [
  {
    group: "General Information", items: [
      ["What is the SentiBoard?", "The Operations Dashboard provides real-time and historical insights into the data availability and the processors baseline. It's intended for users who want an overview of satellite data flows."],
      ["Who can use the Dashboard?", "It is publicly accessible and designed for technical users, scientists, policymakers, and service operators interested in mission performance and service continuity."],
    ]
  },
  {
    group: "Sentinel Missions Monitoring", items: [
      ["What kind of mission data is displayed?", "The dashboard shows the operational status of Sentinel satellites (e.g., Sentinel-1A/B, -2A/B, -3A/B, -5P), including acquisition planning, data availability, and processors baseline."],
      ["How frequently is data updated?", "Most data is updated daily or in near real-time, depending on the subsystem (e.g., acquisitions, ground segment performance, data availability)."],
    ]
  },
  {
    group: "Data & Product Availability", items: [
      ["What product metrics can I view?", "You can access statistics on data availability, completeness, latency, timeliness, and throughput for each Sentinel mission. These metrics help evaluate performance against service-level expectations."],
      ["Can I see long-term trends?", "Yes. You can explore interactive graphs that span days, months, or years, with filtering options by mission, instrument, and product type. The available time span is three months."],
    ]
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
      ["How can I report a bug or request help?", "For dashboard support, including data access and operational issues, please contact us at sentiboard@coordination-service.eu."],
    ]
  },
];

export default function About() {
  return (
    <div className="about-page">
      <div className="about-bg" aria-hidden />
      <PageHeader crumb="About" title="About" />

      <section className="wrap" style={{ paddingTop: 4 }}>
        <p className="ab-variant">
          <span>Layout A · page-header led</span>
          <span>·</span>
          <Link to="/examples/about">See layout B — hero led →</Link>
        </p>
      </section>

      <section className="wrap pad" style={{ paddingBottom: 40 }}>
        <Reveal>
          <p className="lead" style={{ fontSize: 20, color: "var(--text)" }}>{ABOUT_INTRO[0]}</p>
          <p style={{ color: "var(--text-dim)" }}>{ABOUT_INTRO[1]}</p>
          <p style={{ color: "var(--text-dim)" }}>{ABOUT_INTRO[2]}</p>
        </Reveal>
      </section>

      <section className="wrap pad" style={{ paddingTop: 0 }}>
        <Reveal className="about-links">
          {ABOUT_MODULES.map((m) => (
            <Link className="about-link" to={m.href} key={m.href}>
              <div className="al-main">
                <h3>{m.title}</h3>
                <p>{m.desc}</p>
              </div>
              <span className="al-arrow">→</span>
            </Link>
          ))}
        </Reveal>
      </section>

      <section className="wrap pad" style={{ paddingTop: 0, paddingBottom: 40 }}>
        <Reveal>
          <p style={{ color: "var(--text-dim)" }}>{ABOUT_OUTRO}</p>
          <p style={{ color: "var(--text-dim)" }}>
            For any inquiries on the Copernicus Sentinel Operations Dashboard contact{" "}
            <a href={`mailto:${ABOUT_CONTACT_EMAIL}`} style={{ color: "var(--accent-2)" }}>{ABOUT_CONTACT_EMAIL}</a>.
          </p>
        </Reveal>
      </section>

      <section className="wrap pad" id="faq" style={{ paddingTop: 0 }}>
        <Reveal className="section-head"><div><h2>FAQs</h2></div><span className="meta">Click to expand</span></Reveal>
        <Reveal>
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
    </div>
  );
}
