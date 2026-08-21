import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ABOUT_INTRO, ABOUT_MODULES, ABOUT_OUTRO, ABOUT_CONTACT_EMAIL } from "@/data/about";
import { ABOUT_FAQS } from "@/data/about-faqs";
import s from "./dossier.module.css";

/* About PROPOSAL D — "Mission Dossier". An ALTERNATIVE to /about (layout A) and /examples/about
   (layout B), both untouched, and a different answer from proposal C (systems briefing).

   A renders the four module descriptions as an arrow list, B as a 2x2 card grid, C as a numbered
   definition list. All three compress them: the descriptions are the substance of the About text —
   the sentences after the colon that ABOUT_INTRO[2] ends on — and all three treatments turn them
   into something to scan past. This one gives each module a full screen with its own imagery.

   The page is therefore paged, not scrolled: one full-height panel per canonical chunk, advanced
   horizontally. Seven panels — intro, the four modules, programme context, FAQs.

   Mechanics, and why each is what it is:

     · CSS scroll-snap on a horizontal flex track. The panels are real scroll children, so a
       trackpad swipe, a shift-wheel, a drag on the scrollbar and the chapter strip all drive the
       same one state, and none of it needs a scroll library;
     · the active panel is read back from scrollLeft rather than tracked as React state on click.
       Snap can be driven by input the component never sees (native swipe, keyboard scroll), and
       state set on click alone silently desynchronises from what is on screen;
     · arrow keys / Home / End move a panel at a time, because a horizontal pager that only
       responds to swipe is unusable on a desktop without a touchpad;
     · the same px-scroll sticky-panel language as the index (Home.tsx), rotated to the horizontal
       axis — a proven pattern here rather than new machinery.

   Under 900px, or with prefers-reduced-motion set, the track degrades to ordinary vertical
   sections: snap is switched off in CSS, the panels stack, and the chapter strip becomes a plain
   anchor list. Nothing is keyed to a viewport width in JS.

   Text is verbatim from data/about.ts and data/about-faqs.ts. Colour comes entirely from the
   shared tokens, so it follows the global dark/light switch. */

// One entry per panel. `art` is the backdrop bled to the right edge; the four module panels take
// the module imagery the rest of the app already uses for them, so a panel looks like the page it
// points at. The three text panels take Sentinel scenes from the same folder.
type Panel = {
  id: string;
  kind: "intro" | "module" | "outro" | "faq";
  eyebrow: string;
  title: string;
  art: string;
  moduleIndex?: number;
};

const MOD_ART = [
  "/assets/img/modules/acquisitions.jpg",
  "/assets/img/modules/events.jpg",
  "/assets/img/modules/availability.jpg",
  "/assets/img/modules/processors.jpg",
];

const PANELS: Panel[] = [
  { id: "intro", kind: "intro", eyebrow: "Overview", title: "Copernicus", art: "/assets/img/news/scene1.jpg" },
  ...ABOUT_MODULES.map((m, i) => ({
    id: m.href.replace("/", ""),
    kind: "module" as const,
    eyebrow: `Module ${String(i + 1).padStart(2, "0")}`,
    title: m.title,
    art: MOD_ART[i],
    moduleIndex: i,
  })),
  { id: "programme", kind: "outro", eyebrow: "Programme", title: "Ground Segment", art: "/assets/img/news/scene3.jpg" },
  { id: "faqs", kind: "faq", eyebrow: "Reference", title: "FAQs", art: "/assets/img/news/scene4.jpg" },
];

export default function AboutDossier() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = PANELS.length;

  /* Active panel derived from scrollLeft, not from clicks — see the header note. Rounding to the
     nearest panel width is what makes a half-completed swipe resolve to the panel snap will
     actually land on. Guarded for the stacked (vertical) layout, where scrollLeft stays 0 and the
     counter should simply stay on the first panel rather than jitter. */
  const syncFromScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setActive(Math.max(0, Math.min(total - 1, i)));
  }, [total]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    syncFromScroll();
    el.addEventListener("scroll", syncFromScroll, { passive: true });
    window.addEventListener("resize", syncFromScroll);
    return () => {
      el.removeEventListener("scroll", syncFromScroll);
      window.removeEventListener("resize", syncFromScroll);
    };
  }, [syncFromScroll]);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    // In the stacked layout there is nothing to scroll horizontally, so fall back to
    // bringing the panel itself into view.
    if (el.scrollWidth <= el.clientWidth) {
      document.getElementById(PANELS[clamped].id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActive(clamped);
      return;
    }
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }, [total]);

  // Keyboard paging. Scoped to the track (it holds focus via tabIndex) so the arrow keys still
  // work normally everywhere else on the page.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = {
      ArrowRight: active + 1, ArrowDown: active + 1,
      ArrowLeft: active - 1, ArrowUp: active - 1,
      Home: 0, End: total - 1,
    };
    const next = map[e.key];
    if (next === undefined) return;
    e.preventDefault();
    goTo(next);
  };

  const pct = useMemo(() => ((active + 1) / total) * 100, [active, total]);

  return (
    <div className={s.page}>
      {/* ---------- the paged track ---------- */}
      <div
        className={s.track}
        ref={trackRef}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label="About — dossier panels"
      >
        {PANELS.map((p, i) => (
          <section className={s.panel} id={p.id} key={p.id} aria-label={p.title}>
            <div className={s.art} style={{ backgroundImage: `url(${p.art})` }} aria-hidden />
            <div className={s.veil} aria-hidden />

            <div className={s.body}>
              <div className={s.eyebrow}>
                <span className={s.eyebrowN}>{String(i + 1).padStart(2, "0")}</span>
                {p.eyebrow}
              </div>

              {/* --- intro: the canonical opening text, verbatim --- */}
              {p.kind === "intro" && (
                <>
                  <h1 className={s.h1}>The Copernicus Sentinel Operations Dashboard</h1>
                  <div className={s.prose}>
                    <p className={s.lead}>{ABOUT_INTRO[0]}</p>
                    <p>{ABOUT_INTRO[1]}</p>
                    <p>{ABOUT_INTRO[2]}</p>
                  </div>
                </>
              )}

              {/* --- one module per panel, its full description at full size --- */}
              {p.kind === "module" && p.moduleIndex !== undefined && (
                <>
                  <h2 className={s.h2}>{ABOUT_MODULES[p.moduleIndex].title}</h2>
                  <div className={s.prose}>
                    <p className={s.lead}>{ABOUT_MODULES[p.moduleIndex].desc}</p>
                  </div>
                  <Link className={s.cta} to={ABOUT_MODULES[p.moduleIndex].href}>
                    Open module <span aria-hidden>→</span>
                  </Link>
                </>
              )}

              {/* --- closing paragraph + contact, still canonical text --- */}
              {p.kind === "outro" && (
                <>
                  <h2 className={s.h2}>Programme context</h2>
                  <div className={s.prose}>
                    <p className={s.lead}>{ABOUT_OUTRO}</p>
                    <p>
                      For any inquiries on the Copernicus Sentinel Operations Dashboard contact{" "}
                      <a className={s.mail} href={`mailto:${ABOUT_CONTACT_EMAIL}`}>{ABOUT_CONTACT_EMAIL}</a>.
                    </p>
                  </div>
                </>
              )}

              {/* --- FAQs: the one panel that scrolls internally, because eleven answers cannot
                      fit a viewport at a readable size --- */}
              {p.kind === "faq" && (
                <>
                  <h2 className={s.h2}>FAQs</h2>
                  <div className={s.faqScroll}>
                    {ABOUT_FAQS.map((g) => (
                      <div className={s.faqGroup} key={g.group}>
                        <h3 className={s.faqGroupTitle}>{g.group}</h3>
                        {g.items.map(([q, a], k) => (
                          <details className={s.faq} key={k}>
                            <summary>{q}<span className={s.chev} aria-hidden>+</span></summary>
                            <p className={s.ans}>{a}</p>
                          </details>
                        ))}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* ---------- fixed chapter strip + counter ---------- */}
      <div className={s.hud}>
        <div className={s.progress} aria-hidden>
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className={s.hudRow}>
          <button
            type="button"
            className={s.arrow}
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Previous panel"
          >←</button>

          <div className={s.chapters}>
            {PANELS.map((p, i) => (
              <button
                type="button"
                key={p.id}
                className={i === active ? `${s.chapter} ${s.chapterOn}` : s.chapter}
                onClick={() => goTo(i)}
                aria-current={i === active ? "true" : undefined}
              >
                <span className={s.chapterN}>{String(i + 1).padStart(2, "0")}</span>
                <span className={s.chapterLabel}>{p.kind === "module" ? p.title : p.eyebrow}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className={s.arrow}
            onClick={() => goTo(active + 1)}
            disabled={active === total - 1}
            aria-label="Next panel"
          >→</button>

          <div className={s.counter} aria-live="polite">
            {String(active + 1).padStart(2, "0")} <span>/</span> {String(total).padStart(2, "0")}
          </div>
        </div>
      </div>

      <span className="ex-badge">Proposal D · Mission dossier</span>
    </div>
  );
}
