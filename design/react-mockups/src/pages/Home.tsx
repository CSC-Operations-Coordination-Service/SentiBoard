import { Link } from "react-router-dom";
import { ChevronsDown, Check } from "lucide-react";
import { NEWS, REALTIME, MODULES } from "@/data/mock";
import { Pill } from "@/components/ui";

// SpaceX-style hero: full-bleed media, veil, and a glass ops layout over it —
// [ Mission news | headline + video | real-time feed ]. Below, a cinematic
// module scroller reveals each functional area on scroll.
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-grid">
          {/* LEFT — Mission news */}
          <aside className="hpanel">
            <div className="ph"><h3>Mission News</h3><Link className="meta" to="/news">All →</Link></div>
            <div className="pbody">
              {NEWS.map((n, i) => (
                <details className="nitem" key={i} open={i === 0}>
                  <summary>
                    <span className={`nstat ${n.sev}`} aria-hidden="true">
                      {n.sev === "warn" ? "!" : <Check size={12} strokeWidth={3} />}
                    </span>
                    <div className="ntext">
                      <div className="ntitle">{n.title}</div>
                      <div className="nmeta">{n.published}</div>
                    </div>
                  </summary>
                  <div className="nbody">{n.body}</div>
                </details>
              ))}
            </div>
          </aside>

          {/* CENTER — feature video (temporary: apps/static/assets/mv/home.mp4) */}
          <div className="hero-center">
            <div className="hero-cap">
              <video className="hero-cap-video" autoPlay muted loop playsInline>
                <source src="/assets/mv/home.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </section>

      {/* MODULE SCROLLER — full-bleed, sticky-stacking panels (SpaceX-style):
          each panel pins to the viewport and the next image slides up over it, so
          the big images transition seamlessly as you scroll. */}
      <section className="px-scroll">
        <div className="px-intro wrap">
          <span className="px-cue-text">Explore the modules</span>
          <button
            type="button"
            className="px-cue"
            aria-label="Scroll to explore the modules"
            onClick={() => document.getElementById("px-first")?.scrollIntoView({ behavior: "smooth" })}
          >
            <ChevronsDown className="px-cue-ico" size={34} strokeWidth={1.75} />
          </button>
        </div>

        {MODULES.map((m, i) => (
          <section className="px-panel" id={i === 0 ? "px-first" : undefined} key={m.idx}>
            <div className="px-panel-bg" style={{ backgroundImage: `url(${m.img})`, backgroundPosition: m.pos ?? "center" }} />
            <div className="px-panel-veil" />
            <div className="px-panel-inner wrap">
              <h3>{m.title}</h3>
              <div className="px-panel-meta">
              </div>
              <p>{m.desc}</p>
              <Link className="btn primary" to={m.href}>Open module <span className="arrow">→</span></Link>
            </div>
          </section>
        ))}
      </section>
    </>
  );
}
