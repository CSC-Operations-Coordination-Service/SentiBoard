import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Reveal } from "@/components/ui";
import { REALTIME, MODULES } from "@/data/mock";
import "@/styles/examples.css";
import styles from './home.module.css';

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

  const videoRef  = useRef<HTMLVideoElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const raf1Ref   = useRef(0);
  const raf2Ref   = useRef(0);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isOpenRef = useRef(false);

  function setNews(open: boolean) {
    cancelAnimationFrame(raf1Ref.current);
    cancelAnimationFrame(raf2Ref.current);
    clearTimeout(timerRef.current);
    const el = listRef.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (open) {
      isOpenRef.current = true;
      setNewsOpen(true);
      const max = window.innerHeight - 140;
      if (reduced) {
        const natural = el.scrollHeight;
        const h = Math.min(natural, max);
        el.style.height = `${h}px`;
        el.style.opacity = '1';
        el.style.overflow = 'hidden';
        el.style.overflowY = natural > max ? 'auto' : 'hidden';
        return;
      }
      el.style.cssText = 'height:0px;opacity:0;overflow:hidden;transition:none';
      raf1Ref.current = requestAnimationFrame(() => {
        raf2Ref.current = requestAnimationFrame(() => {
          const natural = el.scrollHeight;
          const h = Math.min(natural, max);
          el.style.overflowY = natural > max ? 'auto' : 'hidden';
          el.style.transition = 'height 520ms cubic-bezier(.2,.7,.2,1),opacity 360ms ease';
          el.style.height = `${h}px`;
          el.style.opacity = '1';
        });
      });
    } else {
      isOpenRef.current = false;
      setNewsOpen(false);
      if (reduced) {
        el.style.cssText = '';
        return;
      }
      const h = el.offsetHeight;
      el.style.cssText = `height:${h}px;opacity:1;overflow:hidden;transition:none`;
      raf1Ref.current = requestAnimationFrame(() => {
        raf2Ref.current = requestAnimationFrame(() => {
          el.style.transition = 'height 520ms cubic-bezier(.2,.7,.2,1),opacity 360ms ease';
          el.style.height = '0px';
          el.style.opacity = '0';
          timerRef.current = setTimeout(() => {
            if (!isOpenRef.current) el.style.cssText = '';
          }, 540);
        });
      });
    }
  }

  useEffect(() => {
    if (!newsOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setNews(false); btnRef.current?.focus(); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [newsOpen]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    function apply() {
      if (!videoRef.current) return;
      if (mq.matches) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(raf1Ref.current);
      cancelAnimationFrame(raf2Ref.current);
      clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.row}>
          <button
            ref={btnRef}
            onClick={() => setNews(!isOpenRef.current)}
            className={styles.news}
            aria-expanded={newsOpen}
            aria-controls="news-list"
          >
            <i className={styles.dot} />
            <span>News</span>
            <span className={styles.count}>{REALTIME.length}</span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className={newsOpen ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
            >
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>
          <div className={styles.mask}>
            <div
              className={styles.track}
              style={{ "--ticker-dur": `${13.6 * REALTIME.length}s` } as React.CSSProperties}
            >
              {live.map((e, i) => (
                <span key={i} className={styles.item}>
                  <span>{e.title}</span>
                  <span className={styles.sep} />
                  <time className={styles.time}>
                    {e.date} {e.time}
                  </time>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div
          ref={listRef}
          id="news-list"
          className={newsOpen ? `${styles.list} ${styles.listOpen}` : styles.list}
          aria-hidden={!newsOpen ? true : undefined}
          {...(!newsOpen && { inert: "" as unknown as boolean })}
        >
          {REALTIME.map((item, k) => (
            <div
              key={k}
              className={styles.listRow}
              style={{ "--k": k } as React.CSSProperties}
            >
              <time className={styles.listTime}>{item.date} {item.time}</time>
              <span className={styles.listText}>{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      <section className={styles.hero}>
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          aria-hidden="true"
          className={styles.heroVideo}
        >
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div className={styles.heroOverlay}>
          <div className={styles.heroCopy}>
            <h1>
              Copernicus <span>Sentinel</span>{" "}
              Operations Dashboard
            </h1>
            <p>
              Real-time mission monitoring — a central point of access for
              events impacting data availability, real-time data collection
              insights, and key stats on products delivered.
            </p>
          </div>
        </div>
      </section>

      <div className={styles.panels}>
        {MODULES.map((m, i) => (
          <Reveal
            key={m.idx}
            as="section"
            className={`px-panel ${i % 2 === 0 ? styles.panelLeft : styles.panelRight}`}
          >
            <div
              className="px-panel-bg"
              style={{
                backgroundImage: `url(${m.img})`,
                backgroundPosition: m.pos ?? "center",
              }}
            />
            <div className="px-panel-veil" />
            <div className={styles.panelInner}>
              <h2 className={styles.panelTitle}>{m.title}</h2>
              <p className={styles.panelLead}>{m.desc}</p>
              <p
                className={styles.panelLong}
                dangerouslySetInnerHTML={{ __html: m.long }}
              />
              <Link to={m.href} className={styles.panelLink}>
                Open module →
              </Link>
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
