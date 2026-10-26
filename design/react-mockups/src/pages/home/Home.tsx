import { useState } from "react";
import React from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/ui";
import { REALTIME, MODULES } from "@/data/mock";
import "@/styles/examples.css";

const FAQ_GROUPS: {
  icon: React.ReactNode;
  title: string;
  items: { q: string; a: React.ReactNode }[];
}[] = [
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    title: "General Information",
    items: [
      {
        q: "What is the SentiBoard?",
        a: "A central point of access for events impacting data availability, real-time data collection insights and key statistics on the products delivered by the Copernicus Sentinel missions.",
      },
      {
        q: "Who operates the dashboard?",
        a: "It is operated by the CSC Operations Coordination Service, as part of the ongoing transformation of the Copernicus Ground Segment.",
      },
    ],
  },
  {
    icon: (
      <>
        <path d="M4 13l7-7M8 17l7-7" />
        <rect
          x="2"
          y="9"
          width="5"
          height="5"
          rx="1"
          transform="rotate(-45 4.5 11.5)"
        />
        <rect
          x="17"
          y="9"
          width="5"
          height="5"
          rx="1"
          transform="rotate(-45 19.5 11.5)"
        />
        <path d="M14 18l4 4" />
      </>
    ),
    title: "Sentinel Missions Monitoring",
    items: [
      {
        q: "Which missions are covered?",
        a: "Sentinel-1, Sentinel-2, Sentinel-3 and Sentinel-5P, including every satellite currently in operations or in commissioning.",
      },
      {
        q: "Can I see planned acquisitions?",
        a: "Yes. The Acquisitions Status globe shows past, current and planned acquisitions; by default the real-time sensing scenario is displayed.",
      },
    ],
  },
  {
    icon: (
      <>
        <ellipse cx="12" cy="6" rx="8" ry="3" />
        <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    title: "Data & Product Availability",
    items: [
      {
        q: "How is availability calculated?",
        a: "As published volume over expected sensing, computed per product type and aggregated by processing level.",
      },
      {
        q: "A product I need is missing. Why?",
        a: "Check the Events page first: a calibration activity, manoeuvre or ground-segment issue in the same window usually explains the gap.",
      },
    ],
  },
  {
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M15.5 8.5l-2 5-5 2 2-5z" />
      </>
    ),
    title: "Navigation & Features",
    items: [
      {
        q: "How do I use the processor timeline?",
        a: "Zoom in and out with the mouse wheel and drag left or right keeping the left button pressed. Clicking a coloured box opens the details of that release.",
      },
      {
        q: "Can I filter by mission?",
        a: "Every module carries its own filters: mission, satellite, day of acquisition and datatake, applied in cascade.",
      },
    ],
  },
  {
    icon: (
      <>
        <path d="M14.7 6.3a4 4 0 0 0 5 5L21 14l-7 7-4-4 7-7z" />
        <path d="M9 15l-5 5" />
      </>
    ),
    title: "Troubleshooting",
    items: [
      {
        q: "The 3D globe does not render.",
        a: "The globe needs WebGL. Update your browser or enable hardware acceleration, then reload the page.",
      },
      {
        q: "Figures look out of date.",
        a: "A cached page is the usual cause. Force a reload; if the timestamp in the header stays behind, report it to the contact address below.",
      },
    ],
  },
  {
    icon: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </>
    ),
    title: "Contact & Support",
    items: [
      {
        q: "How do I report an anomaly?",
        a: (
          <>
            Write to{" "}
            <a href="mailto:sentiboard@coordination-service.eu?subject=SentiBoard%20anomaly%20report">
              sentiboard@coordination-service.eu
            </a>{" "}
            with the mission, the datatake identifier and the time window
            involved.
          </>
        ),
      },
      {
        q: "Can I request a new feature?",
        a: "Yes. Feature requests are collected and reviewed with the Copernicus Ground Segment evolution plan.",
      },
    ],
  },
];

export default function Home() {
  const live = [...REALTIME, ...REALTIME];
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const [newsOpen, setNewsOpen] = useState(false);

  return (
    <>
      <div
        style={{
          position: "fixed",
          top: "56px",
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          background: "var(--ground)",
          zIndex: 45,
        }}
      >
        <div
          style={{
            height: "68px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid rgba(255,255,255,.08)",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setNewsOpen(!newsOpen)}
            style={{
              flex: "none",
              display: "flex",
              alignItems: "center",
              gap: "11px",
              height: "100%",
              padding: "0 24px",
              position: "relative",
              zIndex: 2,
              background: "var(--ground)",
              border: "none",
              borderRight: "1px solid rgba(255,255,255,.14)",
              fontFamily: "var(--mono)",
              fontSize: "12px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "#3DDC84 !important",
              cursor: "pointer",
            }}
          >
            <i
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#3DDC84",
                boxShadow: "0 0 11px #3DDC84",
              }}
            />
            <span style={{ color: "#3DDC84" }}>News</span>
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: "11px",
                color: "#3DDC84",
              }}
            >
              {REALTIME.length}
            </span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              style={{
                transition: "transform 720ms cubic-bezier(.65,0,.25,1)",
                transform: newsOpen ? "rotate(180deg)" : "rotate(0deg)",
                color: "#3DDC84",
              }}
            >
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>
          <div
            style={{
              flex: "1 1 auto",
              minWidth: "0",
              height: "100%",
              display: "flex",
              alignItems: "center",
              flexWrap: "nowrap",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "nowrap",
                width: "max-content",
                whiteSpace: "nowrap",
                animation: "slide 68s linear infinite",
              }}
            >
              {live.map((e, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "12px",
                    flex: "0 0 auto",
                    padding: "0 4px",
                    fontSize: "16px",
                    color: "var(--text)",
                    opacity: 0.92,
                  }}
                >
                  <span>{e.title}</span>
                  <span className="nt-sep" />
                  <time
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: "13px",
                      letterSpacing: ".04em",
                      color: "var(--muted)",
                      flex: "0 0 auto",
                    }}
                  >
                    {e.date} {e.time}
                  </time>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div
          style={{
            maxHeight: newsOpen ? "400px" : "0",
            overflow: "hidden",
            opacity: newsOpen ? 1 : 0,
            transition:
              "max-height 720ms cubic-bezier(.65,0,.25,1), opacity 720ms cubic-bezier(.65,0,.25,1)",
            background: "rgba(6,12,16,.94)",
            backdropFilter: "blur(10px)",
            borderTop: newsOpen
              ? "1px solid rgba(255,255,255,.10)"
              : "1px solid rgba(255,255,255,0)",
            zIndex: 1,
            pointerEvents: newsOpen ? "auto" : "none",
          }}
        >
          <ul style={{ margin: 0, padding: "6px 0 12px", listStyle: "none" }}>
            {REALTIME.slice(0, 5).map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "18px",
                  padding: "13px 26px",
                  borderBottom:
                    idx < 4 ? "1px solid rgba(255,255,255,.06)" : "none",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text)",
                }}
              >
                <time
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10.5px",
                    letterSpacing: ".04em",
                    color: "var(--text-dim)",
                    paddingTop: "2px",
                  }}
                >
                  {item.date} {item.time}
                </time>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          paddingTop: "calc(56px + 68px)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          overflow: "hidden",
          background: "#000",
        }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        >
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div style={{ maxWidth: "600px", padding: "0 28px" }}>
            <h1
              style={{
                fontSize: "56px",
                fontWeight: 700,
                margin: "0 0 16px",
                color: "#fff",
                letterSpacing: "-.02em",
              }}
            >
              Copernicus <span style={{ color: "#29c3d6" }}>Sentinel</span>{" "}
              Operations Dashboard
            </h1>
            <p
              style={{
                fontSize: "16px",
                margin: "0",
                color: "rgba(255,255,255,0.8)",
                lineHeight: 1.6,
              }}
            >
              Real-time mission monitoring — a central point of access for
              events impacting data availability, real-time data collection
              insights, and key stats on products delivered.
            </p>
          </div>
        </div>
      </section>

      <div style={{ position: "relative", zIndex: 1 }}>
        {MODULES.map((m, i) => (
          <Reveal
            key={m.idx}
            as="section"
            className="px-panel"
            style={{
              position: "sticky",
              top: 0,
              height: "100vh",
              overflow: "hidden",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: i % 2 === 0 ? "flex-start" : "flex-end",
            }}
          >
            <div
              className="px-panel-bg"
              style={{
                backgroundImage: `url(${m.img})`,
                backgroundPosition: m.pos ?? "center",
              }}
            />
            <div className="px-panel-veil" />
            <div
              className="px-panel-inner wrap"
              style={{
                maxWidth: "640px",
                textAlign: i % 2 === 0 ? "left" : "right",
                marginLeft: i % 2 === 0 ? "0" : "auto",
                marginRight: i % 2 === 0 ? "auto" : "0",
                paddingLeft: i % 2 === 0 ? "56px" : "28px",
                paddingRight: i % 2 === 0 ? "28px" : "56px",
              }}
            >
              <div className="copy">
                <span
                  style={{
                    display: "block",
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: "#36d0e0",
                    marginBottom: "14px",
                  }}
                ></span>
                <h2
                  style={{
                    margin: "0 0 15px",
                    fontSize: "clamp(30px, 3.6vw, 46px)",
                    fontWeight: 700,
                    letterSpacing: "-.025em",
                    lineHeight: 1.08,
                    color: "#fff",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.title}
                </h2>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: "15px",
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,.92)",
                  }}
                >
                  {m.desc}
                </p>
                <p
                  style={{
                    fontSize: "13px",
                    lineHeight: 1.72,
                    color: "rgba(255,255,255,.74)",
                    marginBottom: "30px",
                  }}
                  dangerouslySetInnerHTML={{ __html: m.long }}
                />
                <Link
                  to={m.href}
                  style={{
                    display: "inline-block",
                    fontFamily: "var(--mono)",
                    fontSize: "clamp(19px, 1.7vw, 26px)",
                    letterSpacing: "-.01em",
                    color: "#fff",
                    textDecoration: "none",
                  }}
                >
                  Open module →
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <section className="faq-sec" id="faq">
        <div className="faq-in">
          <header className="faq-head">
            <h2>FAQs</h2>
            <p>
              Find answers to the most common questions about the dashboard.
            </p>
          </header>

          <div className="faq-list">
            {FAQ_GROUPS.map((section, idx) => {
              const isOpen = !!openSections[idx];
              return (
                <div key={idx} className={`faq-item${isOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenSections({ ...openSections, [idx]: !isOpen })
                    }
                  >
                    <span className="faq-ico">
                      <svg
                        width="17"
                        height="17"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {section.icon}
                      </svg>
                    </span>
                    <span className="faq-title">{section.title}</span>
                    <svg
                      className="faq-chev"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      aria-hidden="true"
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="faq-body">
                      {section.items.map((item, itemIdx) => (
                        <div className="faq-qa" key={itemIdx}>
                          <p className="faq-question">{item.q}</p>
                          <p className="faq-answer">{item.a}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="faq-contact">
            For any inquiries on the Copernicus Sentinel Operations Dashboard
            contact{" "}
            <a href="mailto:sentiboard@coordination-service.eu">
              sentiboard@coordination-service.eu
            </a>
          </p>
        </div>
      </section>

      {/* Chatbot Widget */}
      {/* <ChatbotWidget /> */}
    </>
  );
}
