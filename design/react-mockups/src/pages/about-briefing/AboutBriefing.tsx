import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Globe2, CalendarClock, Database, Cpu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ABOUT_INTRO, ABOUT_MODULES, ABOUT_OUTRO, ABOUT_CONTACT_EMAIL } from "@/data/about";
import { ABOUT_FAQS } from "@/data/about-faqs";
import s from "./briefing.module.css";

/* About PROPOSAL C — "Systems Briefing". An ALTERNATIVE to /about (layout A, page-header led)
   and /examples/about (layout B, hero led). Both of those are untouched.

   A and B are the same shape underneath: a big entrance, then the four modules as cards or an
   arrow list, then the FAQ answers folded away behind eleven <details>. That shape suits a first
   visit. It does not suit the reader this page actually gets — someone arriving with one specific
   question ("how often is it updated?", "can I export?"), who today has to open accordions one at
   a time because the answers are not in the DOM to be found with the browser's own search.

   So this is the reference-manual reading of the same text:

     · a sticky mono index rail, scroll-spy lit, so position in the document is always visible and
       every section is one click away — the pattern the Processors and telemetry pages already use
       for their own controls;
     · the canonical prose in ONE measured column (~68ch), the width at which 15.5px copy stays
       readable, rather than spanning the full 1320px wrap;
     · the four module descriptions as a numbered definition list (01-04, hairline-ruled, no
       imagery) — B already does the picture-card treatment, and repeating it would make C a
       restyle rather than a different answer;
     · every FAQ answer rendered OPEN and flat. No accordion. The whole page is one continuous
       document, so Ctrl/Cmd-F reaches all of it.

   Text is verbatim from data/about.ts and data/about-faqs.ts — the layout differs, the wording
   never does. Colour comes entirely from the shared tokens, so it follows the global dark/light
   switch with no palette of its own. */

// Rail entries. `id` doubles as the scroll-spy target and the anchor href, so adding a section
// means adding one row here plus one <section> carrying the same id — nothing else.
const SECTIONS = [
  { id: "overview", n: "01", label: "Overview" },
  { id: "modules", n: "02", label: "The four modules" },
  { id: "programme", n: "03", label: "Programme context" },
  { id: "faqs", n: "04", label: "FAQs" },
] as const;

// Icons for each module, matching the about page design
const MODULE_ICONS: Record<string, LucideIcon> = {
  "/acquisitions": Globe2,
  "/events": CalendarClock,
  "/availability": Database,
  "/processors": Cpu,
};

/** Lights the rail entry for whichever section currently owns the reading position.
 *
 *  Picks the LAST section whose top has passed the reading line (a third of the way down the
 *  viewport) rather than whichever section intersects — with sections of wildly different heights
 *  (Overview is three paragraphs, FAQs is eleven answers) several are on screen at once, and
 *  "topmost intersecting" flickers between them on every scroll tick. Falls back to the first
 *  entry above the line so the rail is never blank at the top of the page. */
function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const onScroll = () => {
      const line = window.innerHeight / 3;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [ids]);
  return active;
}

export default function AboutBriefing() {
  const ids = useMemo(() => SECTIONS.map((x) => x.id), []);
  const active = useScrollSpy(ids);

  // Answer count for the rail's FAQ row — derived, so it cannot drift from the data.
  const faqCount = useMemo(
    () => ABOUT_FAQS.reduce((n, g) => n + g.items.length, 0),
    []
  );

  return (
    <>
      <PageHeader crumb="About" title="About" />

      <div className={"wrap pad " + s.shell}>
        {/* ---------- sticky index rail ---------- */}
        <aside className={s.rail} aria-label="On this page">
          <div className={s.railHead}>Contents</div>
          <nav className={s.railNav}>
            {SECTIONS.map((x) => (
              <a
                key={x.id}
                href={`#${x.id}`}
                className={x.id === active ? s.railOn : undefined}
                aria-current={x.id === active ? "true" : undefined}
              >
                <span className={s.railN}>{x.n}</span>
                <span className={s.railLabel}>{x.label}</span>
                {x.id === "modules" && <span className={s.railCount}>{ABOUT_MODULES.length}</span>}
                {x.id === "faqs" && <span className={s.railCount}>{faqCount}</span>}
              </a>
            ))}
          </nav>
          <div className={s.railFoot}>
            <a href={`mailto:${ABOUT_CONTACT_EMAIL}`}>{ABOUT_CONTACT_EMAIL}</a>
          </div>
        </aside>

        {/* ---------- one measured document column ---------- */}
        <div className={s.doc}>
          {/* 01 — canonical intro, verbatim */}
          <section id="overview" className={s.sec}>
            <h2 className={s.h2}>Overview</h2>
            <p className={s.lead}>{ABOUT_INTRO[0]}</p>
            <p className={s.p}>{ABOUT_INTRO[1]}</p>
            <p className={s.p}>{ABOUT_INTRO[2]}</p>
          </section>

          {/* 02 — the four modules AS the numbered continuation of that text (it ends on a colon) */}
          <section id="modules" className={s.sec}>
            <h2 className={s.h2}>The four modules</h2>
            <dl className={s.defs}>
              {ABOUT_MODULES.map((m) => {
                const Icon = MODULE_ICONS[m.href];
                return (
                  <div className={s.def} key={m.href}>
                    <dt>
                      {Icon && <Icon className={s.defN} size={16} strokeWidth={1.5} aria-hidden />}
                      <Link to={m.href} className={s.defTitle}>
                        {m.title}<span className={s.defArrow} aria-hidden>→</span>
                      </Link>
                    </dt>
                    <dd>{m.desc}</dd>
                  </div>
                );
              })}
            </dl>
          </section>

          {/* 03 — closing paragraph + contact, still canonical text */}
          <section id="programme" className={s.sec}>
            <h2 className={s.h2}>Programme context</h2>
            <p className={s.p}>{ABOUT_OUTRO}</p>
            <p className={s.p}>
              For any inquiries on the Copernicus Sentinel Operations Dashboard contact{" "}
              <a className={s.mail} href={`mailto:${ABOUT_CONTACT_EMAIL}`}>{ABOUT_CONTACT_EMAIL}</a>.
            </p>
          </section>

          {/* 04 — every answer open and in the DOM, so browser search reaches it */}
          <section id="faqs" className={s.sec}>
            <h2 className={s.h2}>FAQs</h2>
            {ABOUT_FAQS.map((g) => (
              <div className={s.qGroup} key={g.group}>
                <h3 className={s.qGroupTitle}>{g.group}</h3>
                {g.items.map(([q, a], i) => (
                  <div className={s.qa} key={i}>
                    <div className={s.q}>{q}</div>
                    <p className={s.a}>{a}</p>
                  </div>
                ))}
              </div>
            ))}
          </section>
        </div>
      </div>

    </>
  );
}
