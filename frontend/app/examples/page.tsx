import type { Metadata } from "next";
import Link from "next/link";
import ExpandableNewsBar from "@/components/ExpandableNewsBar";

export const metadata: Metadata = {
  title: "SentiBoard — Copernicus Sentinel Operations",
  description: "Copernicus Sentinel Operations Dashboard",
};

const MODULES = [
  { href: "/v1/acquisitions", title: "Acquisitions Status", desc: "Past, current and planned Sentinel acquisitions on an interactive 3D globe." },
  { href: "/v1/events", title: "Events", desc: "Calibration activities, manoeuvres and anomalies that could impede data production." },
  { href: "/v1/availability", title: "Data Availability", desc: "Real-time list of available collections delivered by the missions, with key metrics." },
  { href: "/v1/processors", title: "Processors", desc: "The complete list of Copernicus Sentinel processor releases on an interactive timeline." },
];

const FAQ_SECTIONS = [
  {
    title: "General Information",
    items: [
      { q: "What is the SentiBoard?", a: "The Operations Dashboard provides real-time and historical insights into the data availability and the processors baseline. It's intended for users who want an overview of satellite data flows." },
      { q: "Who can use the Dashboard?", a: "It is publicly accessible and designed for technical users, scientists, policymakers, and service operators interested in mission performance and service continuity." },
    ],
  },
  {
    title: "Sentinel Missions Monitoring",
    items: [
      { q: "What kind of mission data is displayed?", a: "The dashboard shows the operational status of Sentinel satellites (e.g., Sentinel-1A/B, -2A/B, -3A/B, -5P), including acquisition planning, data availability, and processors baseline." },
      { q: "How frequently is data updated?", a: "Most data is updated daily or in near real-time, depending on the subsystem (e.g., acquisitions, ground segment performance, data availability)." },
    ],
  },
  {
    title: "Data & Product Availability",
    items: [
      { q: "What product metrics can I view?", a: "You can access statistics on data availability, completeness, latency, timeliness, and throughput for each Sentinel mission." },
      { q: "Can I see long-term trends?", a: "Yes. You can explore interactive graphs that span days, months, or years, with filtering options by mission, instrument, and product type." },
    ],
  },
  {
    title: "Navigation & Features",
    items: [
      { q: "How do I find specific data?", a: "Use the top navigation menu of the dashboard to access the Acquisitions Status, Events, Data Availability, and Processors sections." },
      { q: "Can I export the charts or data?", a: "While there's no dedicated export button, screenshots and browser-based print/save tools can be used." },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      { q: "Why is some data missing or flatlined?", a: "Gaps may reflect planned maintenance, satellite anomalies, or delays in ground segment reporting." },
      { q: "The dashboard is not loading—what should I do?", a: "First, ensure your browser allows scripts and cookies. If problems persist, try clearing your cache or switching to another browser." },
    ],
  },
  {
    title: "Contact & Support",
    items: [
      { q: "How can I report a bug or request help?", a: "For dashboard support, including data access and operational issues, please contact sentiboard@coordination-service.eu." },
    ],
  },
];

export default function ExamplesIndex() {
  return (
    <>
      <ExpandableNewsBar />

      <section style={{
        position: "relative",
        width: "100%",
        height: "480px",
        overflow: "hidden",
        background: "#000",
      }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        >
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: "600px", padding: "0 28px" }}>
            <h1 style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: "700",
              margin: "0 0 16px",
              color: "#fff",
              letterSpacing: "-.02em",
            }}>
              Copernicus <span style={{ color: "#2E7DF6" }}>Sentinel</span> Operations Dashboard
            </h1>
            <p style={{
              fontSize: "16px",
              margin: "0",
              color: "rgba(255,255,255,0.8)",
              lineHeight: 1.6,
            }}>
              Real-time mission monitoring — a central point of access for events impacting data availability, real-time data collection insights, and key stats on products delivered.
            </p>
          </div>
        </div>
      </section>

      <section style={{ padding: "56px 0", background: "var(--ground)" }}>
        <div className="wrap">
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{
              fontSize: "clamp(20px, 3vw, 26px)",
              fontWeight: "700",
              margin: "0 0 8px",
              letterSpacing: "-.01em",
            }}>
              Explore the pages
            </h2>
            <p style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              color: "var(--muted-2)",
              letterSpacing: ".08em",
              margin: "0",
              textTransform: "uppercase",
            }}>
              Scroll to explore
            </p>
          </div>

          <div className="about-modules">
            {MODULES.map((m) => (
              <Link key={m.href} href={m.href} className="card reveal">
                <h3 style={{ fontSize: "18px", margin: "0 0 8px" }}>{m.title}</h3>
                <p style={{ fontSize: "13px", lineHeight: 1.6, margin: "0", color: "var(--muted)" }}>{m.desc}</p>
                <p style={{ marginTop: "14px", fontFamily: "var(--mono)", fontSize: "12px", color: "var(--accent-cyan)" }}>
                  Open module →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: "56px 0", background: "var(--ground)" }} id="faq">
        <div className="wrap">
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{
              fontSize: "clamp(20px, 3vw, 26px)",
              fontWeight: "700",
              margin: "0 0 8px",
              letterSpacing: "-.01em",
            }}>
              FAQs
            </h2>
            <p style={{
              color: "var(--muted)",
              fontSize: "15px",
              margin: "0",
            }}>
              Find answers to the most common questions about the dashboard.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(500px, 1fr))",
            gap: "40px",
          }}>
            {FAQ_SECTIONS.map((section, idx) => (
              <div key={idx}>
                <div className="gtitle" style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--accent-cyan)",
                  marginBottom: "12px",
                }}>
                  {section.title}
                </div>
                {section.items.map((item, itemIdx) => (
                  <details key={itemIdx} className="faq">
                    <summary>
                      {item.q}
                      <span className="chev">+</span>
                    </summary>
                    <div className="ans">{item.a}</div>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
