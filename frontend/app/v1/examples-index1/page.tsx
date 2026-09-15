import type { Metadata } from "next";
import Link from "next/link";
import ExpandableNewsBar from "@/components/ExpandableNewsBar";

export const metadata: Metadata = {
  title: "SentiBoard Index v1 — Copernicus Sentinel Operations",
  description: "Copernicus Sentinel Operations Dashboard Index",
};

const MODULES = [
  {
    href: "/v1/acquisitions",
    title: "Acquisitions Status",
    desc: "Past, current and planned Sentinel acquisitions on an interactive 3D globe."
  },
  {
    href: "/v1/events",
    title: "Events",
    desc: "Calibration activities, manoeuvres and anomalies that could impede data production."
  },
  {
    href: "/v1/availability",
    title: "Data Availability",
    desc: "Real-time list of available collections delivered by the missions, with key metrics."
  },
  {
    href: "/v1/processors",
    title: "Processors",
    desc: "The complete list of Copernicus Sentinel processor releases on an interactive timeline."
  },
];

const FAQ_SECTIONS = [
  {
    title: "General Information",
    items: [
      { q: "What is the SentiBoard?", a: "The Operations Dashboard provides real-time and historical insights into the data availability and the processors baseline." },
      { q: "Who can use the Dashboard?", a: "It is publicly accessible and designed for technical users, scientists, policymakers, and service operators." },
    ],
  },
  {
    title: "Sentinel Missions Monitoring",
    items: [
      { q: "What kind of mission data is displayed?", a: "The dashboard shows operational status of Sentinel satellites including acquisition planning, data availability, and processors baseline." },
      { q: "How frequently is data updated?", a: "Most data is updated daily or in near real-time, depending on the subsystem." },
    ],
  },
  {
    title: "Data & Product Availability",
    items: [
      { q: "What product metrics can I view?", a: "You can access statistics on data availability, completeness, latency, timeliness, and throughput for each Sentinel mission." },
      { q: "Can I see long-term trends?", a: "Yes. You can explore interactive graphs with filtering options by mission, instrument, and product type." },
    ],
  },
  {
    title: "Navigation & Features",
    items: [
      { q: "How do I find specific data?", a: "Use the top navigation menu to access Acquisitions Status, Events, Data Availability, and Processors sections." },
      { q: "Can I export the charts or data?", a: "While there's no dedicated export button, you can use browser-based print/save tools." },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      { q: "Why is some data missing or flatlined?", a: "Gaps may reflect planned maintenance, satellite anomalies, or delays in ground segment reporting." },
      { q: "The dashboard is not loading—what should I do?", a: "First, ensure your browser allows scripts and cookies. Try clearing cache or switching browsers." },
    ],
  },
  {
    title: "Contact & Support",
    items: [
      { q: "How can I report a bug or request help?", a: "For dashboard support, please contact sentiboard@coordination-service.eu." },
    ],
  },
];

export default function ExamplesIndex1Page() {
  return (
    <>
      <ExpandableNewsBar />

      <section style={{
        position: "relative",
        width: "100%",
        minHeight: "500px",
        backgroundColor: "#000",
      }}>
        <video
          autoPlay
          muted
          loop
          playsInline
          width="100%"
          height="100%"
          style={{
            display: "block",
            width: "100%",
            height: "500px",
            objectFit: "cover",
          }}
        >
          <source src="/assets/mv/home.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.35)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "0 40px",
          minHeight: "500px",
        }}>
          <h1 style={{
            color: "#ffffff",
            fontSize: "56px",
            fontWeight: 700,
            margin: "0 0 20px 0",
            letterSpacing: "-0.02em",
            fontFamily: "var(--display)",
            lineHeight: 1.2,
          }}>
            Copernicus <span style={{ color: "#2E7DF6" }}>Sentinel</span>
            <br />
            Operations
            <br />
            Dashboard
          </h1>
          <p style={{
            color: "rgba(255, 255, 255, 0.85)",
            fontSize: "16px",
            margin: "0",
            maxWidth: "650px",
            lineHeight: 1.6,
          }}>
            Real-time mission monitoring — a central point of access for events impacting data availability, real-time data collection insights, and key stats on products delivered.
          </p>
        </div>
      </section>

      <section style={{
        background: "var(--ground)",
        padding: "70px 40px",
      }}>
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}>
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{
              color: "var(--text)",
              fontSize: "32px",
              fontWeight: 700,
              margin: "0 0 12px 0",
              letterSpacing: "-0.01em",
              fontFamily: "var(--display)",
            }}>
              Explore the pages
            </h2>
            <p style={{
              fontFamily: "var(--mono)",
              fontSize: "11px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--muted-2)",
              margin: "0",
            }}>
              Scroll to explore
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
          }}>
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                style={{
                  position: "relative",
                  display: "block",
                  border: "1px solid var(--line-soft)",
                  borderRadius: "16px",
                  background: "linear-gradient(180deg, var(--panel), var(--ground-2))",
                  padding: "28px",
                  textDecoration: "none",
                  color: "inherit",
                  transition: "all 0.25s ease",
                  cursor: "pointer",
                }}
              >
                <h3 style={{
                  color: "var(--text)",
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: "0 0 12px 0",
                  letterSpacing: "-0.01em",
                  fontFamily: "var(--display)",
                }}>
                  {m.title}
                </h3>
                <p style={{
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  margin: "0 0 16px 0",
                }}>
                  {m.desc}
                </p>
                <p style={{
                  fontFamily: "var(--mono)",
                  fontSize: "12px",
                  color: "var(--accent-cyan)",
                  margin: "0",
                }}>
                  Open module →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section style={{
        background: "var(--ground)",
        padding: "70px 40px",
      }} id="faq">
        <div style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}>
          <div style={{ marginBottom: "50px" }}>
            <h2 style={{
              color: "var(--text)",
              fontSize: "32px",
              fontWeight: 700,
              margin: "0 0 12px 0",
              letterSpacing: "-0.01em",
              fontFamily: "var(--display)",
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
            gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))",
            gap: "50px",
          }}>
            {FAQ_SECTIONS.map((section, idx) => (
              <div key={idx}>
                <h4 style={{
                  fontFamily: "var(--mono)",
                  fontSize: "11px",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent-cyan)",
                  margin: "0 0 20px 0",
                }}>
                  {section.title}
                </h4>
                <div>
                  {section.items.map((item, itemIdx) => (
                    <details
                      key={itemIdx}
                      style={{
                        marginBottom: "12px",
                      }}
                    >
                      <summary style={{
                        listStyle: "none",
                        cursor: "pointer",
                        padding: "16px 18px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "16px",
                        fontSize: "15px",
                        fontWeight: 600,
                        color: "var(--text)",
                        border: "1px solid var(--line-soft)",
                        borderRadius: "10px",
                        background: "var(--ground-2)",
                        transition: "background 0.2s",
                      }}>
                        <span>{item.q}</span>
                        <span style={{
                          flex: "0 0 auto",
                          width: "20px",
                          height: "20px",
                          border: "1px solid var(--line)",
                          borderRadius: "5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--muted)",
                          fontSize: "12px",
                          fontWeight: "bold",
                          transition: "all 0.25s",
                        }}>
                          +
                        </span>
                      </summary>
                      <div style={{
                        padding: "16px 18px",
                        color: "var(--muted)",
                        fontSize: "14px",
                        lineHeight: 1.7,
                        background: "var(--ground-2)",
                        marginTop: "2px",
                        borderRadius: "0 0 10px 10px",
                        borderLeft: "1px solid var(--line-soft)",
                        borderRight: "1px solid var(--line-soft)",
                        borderBottom: "1px solid var(--line-soft)",
                      }}>
                        {item.a}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
