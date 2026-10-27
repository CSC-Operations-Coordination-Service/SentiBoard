import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import HeroVideo from "@/features/home/HeroVideo";
import { MODULES, FAQ_GROUPS } from "@/features/home/copy";
import s from "@/features/home/home.module.css";

// Not ported yet (ROUTES.home.ported = false; docs/memory/HANDOFF.md).
export const metadata: Metadata = {
  title: "SentiBoard",
  robots: { index: false, follow: true },
};

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className={s.hero}>
        <HeroVideo />
        <div className={s.heroOverlay}>
          <div className={s.heroCopy}>
            <h1>
              Copernicus <span>Sentinel</span> Operations Dashboard
            </h1>
            <p>
              Real-time mission monitoring — a central point of access for events impacting data
              availability, real-time data collection insights, and key stats on products delivered.
            </p>
          </div>
        </div>
      </section>

      {/* Module panels — sticky stacked cards */}
      <div className={s.panels}>
        {MODULES.map((m, i) => (
          <Reveal
            key={m.href}
            as="section"
            className={`px-panel ${i % 2 === 0 ? s.panelLeft : s.panelRight}`}
          >
            <div
              className="px-panel-bg"
              style={{
                backgroundImage: `url(${m.img})`,
                backgroundPosition: m.pos ?? "center",
              }}
            />
            <div className="px-panel-veil" />
            <div className={s.panelInner}>
              <h2 className={s.panelTitle}>{m.title}</h2>
              <p className={s.panelLead}>{m.desc}</p>
              <p className={s.panelLong}>{m.long}</p>
              <Link href={m.href} className={s.panelLink}>
                Open module →
              </Link>
            </div>
          </Reveal>
        ))}
      </div>

      {/* FAQ — <details>/<summary> so it works without JS */}
      <section className={s.faqSec}>
        <div className={s.faqIn}>
          <header className={s.faqHead}>
            <h2>FAQs</h2>
            <p>Find answers to the most common questions about the dashboard.</p>
          </header>
          <div className={s.faqList}>
            {FAQ_GROUPS.map((group, idx) => (
              <details key={idx} className={s.faqItem}>
                <summary className={s.faqQ}>
                  <span className={s.faqIco}>
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {group.icon}
                    </svg>
                  </span>
                  <span className={s.faqTitle}>{group.title}</span>
                  <svg
                    className={s.faqChev}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </summary>
                <div className={s.faqBody}>
                  {group.items.map((item, itemIdx) => (
                    <div className={s.faqQa} key={itemIdx}>
                      <p className={s.faqQuestion}>{item.q}</p>
                      <p className={s.faqAnswer}>{item.a}</p>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
          <p className={s.faqContact}>
            For any inquiries on the Copernicus Sentinel Operations Dashboard contact{" "}
            <a href="mailto:sentiboard@coordination-service.eu">
              sentiboard@coordination-service.eu
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
