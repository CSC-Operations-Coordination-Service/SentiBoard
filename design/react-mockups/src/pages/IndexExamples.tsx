import { useEffect, useState } from "react";
import React from "react";
import { Link } from "react-router-dom";
import { Radio, Camera, Waves, Wind } from "lucide-react";
import { PageHeader, Pill, Reveal } from "@/components/ui";
import { NEWS, REALTIME, MODULES } from "@/data/mock";
import { useTheme } from "@/theme";
import "@/styles/examples.css";

/* Index-page PROPOSAL examples — ALTERNATIVES to the real Home page (untouched).
   Plain React + CSS (no Next.js yet, but portable to it). Routes under /examples. */

/* The four dashboard pages, and the picture each one shows in the scrolling gallery. The two
   arrays are indexed together by COLS below, so they must stay in the same order.

   This is separate from CARD_ART further down, which gives every PROPOSAL card its own distinct
   image. These four are the real pages, and they keep the four module pictures. */
const MOD_IMG = [
  "/assets/img/modules/acquisitions.jpg",
  "/assets/img/modules/availability.jpg",
  "/assets/img/modules/events.jpg",
  "/assets/img/modules/processors.jpg",
];

const PAGE_BY_IMG = [
  { href: "/acquisitions", title: "Acquisitions Status", desc: "Interactive 3D globe" },
  { href: "/availability", title: "Data Availability", desc: "Collections & completeness" },
  { href: "/events", title: "Events", desc: "Calibration, manoeuvres, anomalies" },
  { href: "/processors", title: "Processors", desc: "Release timeline" },
];

// Real Copernicus Sentinel-2 scenes (NOT the blue-marble globe).
const SCENES = ["/assets/img/news/scene1.jpg", "/assets/img/news/scene2.jpg", "/assets/img/news/scene3.jpg", "/assets/img/news/scene4.jpg"];

/* Card art for the proposal gallery. Every card gets its OWN image — before this the sixteen
   cards shared six pictures between them (processors.jpg alone was on four), so the grid read as
   a repeating pattern rather than as sixteen distinct destinations.
 *
 * The six concept pages that carry a header backdrop show THAT image on their card, so the card
 * previews what the page actually looks like when you open it. The remaining ten have no
 * backdrop of their own, so they take a leftover picture from the same folder.
 *
 * Keep these unique. If two cards ever share a value the gallery is back to looking patterned. */
const ESA = (f: string) => `/assets/img/modules/${f}`;
const CARD_ART = {
  // index proposals
  fleet: SCENES[0],
  gallery: SCENES[1],
  reveal: SCENES[2],
  // about — these pages' own backdrops sit outside this folder (nebula.jpg) or are built from
  // the module set itself (the dossier), so all three take leftovers
  aboutHero: ESA("Earth_Crater.jpg"),
  aboutBriefing: ESA("Earth_Australia.jpg"),
  aboutDossier: ESA("Earth_Moon.jpg"),
  // events concepts — same image as each page's own header backdrop
  eventsSwimlanes: ESA("Earth_rainforests.jpg"),
  eventsSpacex: ESA("Ice_Greenland.jpg"),
  eventsManifest: ESA("Tibetan_Plateau.jpg"),
  // acquisitions
  acquisitionsGlobe: "/assets/img/modules/acquisitions.jpg",
  acquisitionsLadder: "/assets/img/modules/availability.jpg",
  // data availability concepts — again matching each page's backdrop
  coverageTimeline: ESA("Protecting_Atlantic.jpg"),
  availabilitySpacex: ESA("FLEX_Sentinel-3.jpg"),
  availabilityFiltered: ESA("Tierra_Fuego_S1D.jpg"),
  // processors — no backdrops on these pages, so leftovers from the same set
  versionMatrix: "/assets/img/modules/processors.jpg",
  releaseLog: ESA("Landing_asteroid.jpg"),
  versionCompare: ESA("Hera_onboard_computer.jpg"),
} as const;

const HERO_EYEBROW = "Copernicus · EOF-CSC · Real-time operations";
const HERO_SUB = "Real-time mission monitoring — a central point of access for events impacting data availability, real-time data collection insights, and key stats on products delivered.";
const sevVar = (cls: string) => `var(--${cls === "ok" ? "ok" : cls === "warn" ? "warn" : cls === "crit" ? "crit" : "info"})`;

function HeroText({ className = "" }: { className?: string }) {
  return (
    <div className={"c-hero " + className}>
      <h1>Copernicus Sentinel Operations Dashboard</h1>
      <p className="lead-sub">{HERO_SUB}</p>
    </div>
  );
}

// real-time events marquee — status-coloured bar (matching the news status palette),
// with date + time before each event.
function LiveMarquee() {
  const live = [...REALTIME, ...REALTIME];
  return (
    <><span className="nt-lab live"><i />News</span>
      <div className="nt-live-mask"><div className="nt-live-track">
        {live.map((e, i) => (
          <span className="nt-item" key={i}>
            <b style={{ background: sevVar(e.cls) }} />
            <span className="dt">{e.date}</span>
            <span className="ts">{e.time}</span>
            <span style={{ marginLeft: "2px" }}>{e.text}</span>

          </span>
        ))}
      </div></div></>
  );
}

// ================= VARIANT A — video + overlaid ticker + fleet + page cards =================
const FLEET = [
  { icon: Radio, name: "Sentinel-1", inst: "C-band SAR", color: "#36d0e0", status: "nominal" as const, label: "Nominal", desc: "All-weather, day-and-night radar imaging of land and ocean surfaces." },
  { icon: Camera, name: "Sentinel-2", inst: "MSI · Optical", color: "#34d399", status: "nominal" as const, label: "Nominal", desc: "High-resolution multispectral imagery for land and vegetation monitoring." },
  { icon: Waves, name: "Sentinel-3", inst: "OLCI / SLSTR", color: "#f5b544", status: "degraded" as const, label: "Degraded", desc: "Ocean and land colour, surface temperature and sea-surface topography." },
  { icon: Wind, name: "Sentinel-5P", inst: "TROPOMI", color: "#4ea8ff", status: "nominal" as const, label: "Nominal", desc: "Atmospheric composition and air-quality monitoring across the globe." },
];

// Light-mode-only imagery for the page cards: the dark night-Earth (acquisitions) and
// server-room (processors) shots wash out badly on a white background, so in light mode
// we swap them for bright Sentinel scenes that coordinate with the light theme.
const PAGECARD_IMG_LIGHT: Record<string, string> = {
  "/acquisitions": SCENES[0], // glacier — bright
  "/processors": SCENES[2],   // sea ice — near-white
};

export function IndexFleet() {
  const { theme } = useTheme();
  useEffect(() => {
    const items = document.querySelectorAll(".anim-in");
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.2 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <>
      {/* video hero — real-time events ticker along the BOTTOM (news bar removed) */}
      <section className="vhero">
        <video autoPlay muted loop playsInline>
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div className="vhero-cap">
          <h1>Copernicus <span className="hl">Sentinel</span> Operations Dashboard</h1>
          <p>{HERO_SUB}</p>
        </div>
        <div className="vhero-bar bottom"><LiveMarquee /></div>
      </section>
      <section className="wrap pad" style={{ paddingTop: 0 }}>
        <div className="pagecards">
          {MODULES.map((m) => (
            <Link className="pagecard anim-in" to={m.href} key={m.href}>
              <img src={(theme === "light" && PAGECARD_IMG_LIGHT[m.href]) || m.img} alt="" />
              <div className="veil" />
              <div className="cap"><h3>{m.title}</h3><p>{m.desc}</p><span className="go">Open <span className="arrow">→</span></span></div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

// ================= VARIANT B — console first (no video) + linkable diagonal gallery =================
const COLS = [
  [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
  [2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  [1, 0, 3, 2, 1, 0, 3, 2, 1, 0],
];

export function IndexGallery() {
  return (
    <>
      {/* first section: news + real-time events integrated together, over the Earth video */}
      <section className="vsection">
        <video autoPlay muted loop playsInline>
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div className="wrap pad">
          {/* news timeline on the left, hero text on the right, at the same level */}
          <div className="hero-split news-left">
            <NewsTimeline />
            <HeroText />
          </div>
        </div>
      </section>

      {/* diagonal infinite gallery — every tile links to a dashboard page (hover to pause + read) */}
      <section className="ex-gallery">
        <div className="eg-stage">
          {COLS.map((col, ci) => (
            <div className={"eg-col" + (ci % 2 ? " rev" : "")} key={ci}>
              {col.map((idx, i) => {
                const p = PAGE_BY_IMG[idx];
                return (
                  <Link className="eg-tile" to={p.href} key={i} title={p.title}>
                    <img src={MOD_IMG[idx]} alt="" loading="lazy" />
                    <span className="eg-cap"><h4>{p.title}</h4><p>{p.desc}</p><span className="go">Open →</span></span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// News spotlight — one full advisory (title + body + severity + date) front-and-centre,
// auto-rotating through the NEWS feed with progress dots. Surfaces the richer advisory
// copy that the marquee (A) and console/rail treatments don't. Pauses on hover and honours
// prefers-reduced-motion.
const NEWS_SEV = {
  ok: { label: "Nominal", cls: "ok" },
  warn: { label: "Warning", cls: "warn" },
  crit: { label: "Critical", cls: "crit" },
  info: { label: "Notice", cls: "info" },
} as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${+d} ${MONTHS[+m - 1]} ${y}`;
};

function NewsSpotlight() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % NEWS.length), 5500);
    return () => window.clearInterval(id);
  }, [paused]);

  const item = NEWS[active];
  const sev = NEWS_SEV[item.sev] ?? NEWS_SEV.info;
  return (
    <div className="ed-spot" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="h"><span className="live"><i />News</span><span className="count">{active + 1} / {NEWS.length}</span></div>
      <div className={"spot-card " + sev.cls} key={active}>
        <div className="spot-top">
          <span className={"sev " + sev.cls}><b />{sev.label}</span>
          <span className="date">{fmtDate(item.published)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.body}</p>
      </div>
      <div className="spot-dots">
        {NEWS.map((_, i) => (
          <button key={i} className={i === active ? "on" : ""} aria-label={`News ${i + 1}`} aria-current={i === active} onClick={() => setActive(i)} />
        ))}
      </div>
    </div>
  );
}

// News mission-log timeline — the real-time feed as a connected vertical spine with
// severity-coloured nodes and a mono time gutter. A different take from variant B's flat
// console panel: same content, presented as a chronological operations log.
function NewsTimeline() {
  return (
    <div className="ed-timeline">
      <div className="h"><span className="live"><i />News</span></div>
      <ol className="tl-list">
        {REALTIME.map((e, i) => {
          // expandable only when there's body copy beyond the headline (so we don't
          // show all text on load — first item open, the rest collapsed like the index)
          const hasBody = !!e.text && e.text !== e.title;
          return (
            <li className={"tl-item " + e.cls} key={i}>
              <span className="tl-node" />
              {hasBody ? (
                <details className="tl-details" open={i === 0}>
                  <summary>
                    <div className="tl-meta"><span className="ts">{e.time}</span><span className="dt">{e.date}</span></div>
                    <div className="tl-title">{e.title}</div>
                  </summary>
                  <p className="tl-text">{e.text}</p>
                </details>
              ) : (
                <div className="tl-static">
                  <div className="tl-meta"><span className="ts">{e.time}</span><span className="dt">{e.date}</span></div>
                  <div className="tl-title">{e.title}</div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ================= COMBINED — fleet video + gallery news box + gallery carousel =================
export function IndexFleetGallery() {
  return (
    <>
      {/* video hero from fleet page */}
      <section className="vhero">
        <video autoPlay muted loop playsInline>
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div className="vhero-cap">
          <h1>Copernicus <span className="hl">Sentinel</span> Operations Dashboard</h1>
          <p>{HERO_SUB}</p>
        </div>
        <div className="vhero-bar bottom"><LiveMarquee /></div>
      </section>

      {/* page carousel gallery from gallery page */}
      <section className="ex-gallery">
        <div className="eg-stage">
          {COLS.map((col, ci) => (
            <div className={"eg-col" + (ci % 2 ? " rev" : "")} key={ci}>
              {col.map((idx, i) => {
                const p = PAGE_BY_IMG[idx];
                return (
                  <Link className="eg-tile" to={p.href} key={i} title={p.title}>
                    <img src={MOD_IMG[idx]} alt="" loading="lazy" />
                    <span className="eg-cap"><h4>{p.title}</h4><p>{p.desc}</p><span className="go">Open →</span></span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ================= VARIANT C — editorial first (no video, hero text here) + reveal rows =================
export function IndexReveal() {
  useEffect(() => {
    const items = document.querySelectorAll(".rv-item");
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in"); }),
      { threshold: 0.35 }
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const strip = [...SCENES, ...SCENES];
  return (
    <>
      {/* first section: hero text + editorial (auto-scrolling Sentinel scenes) + live rail, over the Earth video */}
      <section className="vsection">
        <video autoPlay muted loop playsInline>
          <source src="/assets/mv/home.mp4" type="video/mp4" />
        </video>
        <div className="wrap pad">
          {/* hero text on the left, rotating news spotlight on the right, at the same level */}
          <div className="hero-split">
            <HeroText />
            <NewsSpotlight />
          </div>
        </div>
      </section>

      {/* scroll-reveal rows over a themed backdrop: galaxy (dark) / clear (light) */}
      <section className="rv-scene">
        <div className="wrap pad" style={{ paddingTop: 0 }}>
          <div className="section-head"><div><h2>Explore the pages</h2></div><span className="meta">Scroll to reveal</span></div>
          {MODULES.map((m, i) => (
            <Link className={"rv-item" + (i % 2 ? " alt" : "")} to={m.href} key={m.href}>
              <div className="rv-media"><img src={m.img} alt={m.title} /></div>
              <div className="rv-txt">
                <h2>{m.title}</h2>
                <p>{m.desc}</p>
                <span className="al-arrow">Open module →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

// ================= landing =================
const CARDS = [
  { to: "/examples/index1", img: SCENES[3], title: "a) index_with_about", desc: " Removing the 'About' page and including tabs description and FAQ section directly on the Home page" },
  /*{ to: "/examples/fleet", img: CARD_ART.fleet, title: "a) Ticker over video - fleet", desc: "Video hero with news scrolling on top and live events along the bottom → Sentinel fleet → image page-cards." },
  { to: "/examples/gallery", img: CARD_ART.gallery, title: "b) Console - linkable gallery", desc: "News + real-time console as the first section (no globe) → diagonal gallery where every image links to a page." },
  { to: "/examples/reveal", img: CARD_ART.reveal, title: "c) Editorial - reveal", desc: "Editorial first section (auto-scrolling Sentinel scenes + news + live rail, no globe) → pages revealed on scroll." },*/
];

// Proposals for pages other than the index — same idea, grouped separately so
// it stays clear which real page each one is an alternative to.
// Lettered from "b)" because layout A is the live /about page, which the nav already
// reaches — the gallery carries only the alternatives, and each page self-labels with the
// same letter ("Layout B · hero led"), so restarting at "a)" here would contradict them.
const ABOUT_CARDS = [
  {
    to: "/examples/about", img: CARD_ART.aboutHero, title: "a) About · hero led",
    desc: "The About section has a full-bleed hero, image cards for modules, and unchanged FAQ groups.",
  },
  {
    to: "/examples/about-briefing", img: CARD_ART.aboutBriefing, title: "b) About · systems briefing",
    desc: "The reference manual has a sticky index, a single-column layout, numbered modules, and all FAQs open for easy access.",
  },
  {
    to: "/examples/about-dossier", img: CARD_ART.aboutDossier, title: "c) About · mission dossier",
    desc: "A paged dossier with seven panels that swipe horizontally, displaying content on the left and an ESA scene on the right. It stacks vertically on narrow viewports.",
  },
];

const PAGE_CARDS = [
  /*{
    to: "/examples/events-swimlanes", img: CARD_ART.eventsSwimlanes, title: "a) Events · Mission swimlanes",
    desc: "Show missions by fleet with collapsible rows for each (S1, S2, S3, S5P). Row headers display event count, affected datatakes, and an 'N active' badge. Expanding a row reveals event details, replacing the chronological list.",
  },
  {
    to: "/examples/events-spacex", img: CARD_ART.eventsSpacex, title: "b) Events · timeline + heatmap",
    desc: "Two layouts share a tab bar: Layout A has a Gantt ribbon by month, and Layout B features 31 day tiles with status pills.",
  },*/
  {
    to: "/examples/events-manifest", img: CARD_ART.eventsManifest, title: "c) Events · filters",
    desc: "Shows mission events on a grid with icons for each event type. Selecting a day reveals occurrences and affected datatakes.",
  },
];

const ACQ_CARDS = [
  {
    to: "/examples/acquisitions-globe", img: CARD_ART.acquisitionsGlobe, title: "a) Acquisitions status",
    desc: "The 3D globe includes on-demand frames, cached coastlines, and a pause feature.",
  },
  /*{
    to: "/examples/acquisitions-ladder", img: CARD_ART.acquisitionsLadder, title: "b) Acquisitions · Level ladder",
    desc: "Satellite data is categorized into flown, sensing, and scheduled. Sentinel-5P has two levels, and Sentinel-3's Level 2 has five instrument groups.",
  },*/
];

const AVAIL_CARDS = [
  {
    to: "/examples/coverage-timeline", img: CARD_ART.coverageTimeline, title: "a) Data Availability · Coverage timeline",
    desc: "The heatmap shows daily mission performance, with outages as horizontal runs and sparkline chips indicating gaps. The table is sorted by recent gaps for easy issue identification.",
  },
  /*{
    to: "/examples/data-availability-spacex", img: CARD_ART.availabilitySpacex, title: "b) Data Availability",
    desc: "The page mimicked a launch console with hairline rules, a UTC clock, donut metrics, and a table for telemetry records.",
  },
  {
    to: "/examples/data-availability", img: CARD_ART.availabilityFiltered, title: "c) Data Availability · Filtered breakdown",
    desc: "The datatake list includes filters for mission, acquisition, and publication status, ensuring consistent charts and rows, along with a sortable table of relevant details.",
  },*/
];

const PROC_CARDS = [
  {
    to: "/processors", img: CARD_ART.versionMatrix, title: "a) Processors",
    desc: "The focus is on the last released processor. Historical information can be accessed by expanding the processor details.",
  },
  /*{
    to: "/examples/release-log", img: CARD_ART.releaseLog, title: "b) Processors · Release Timeline",
    desc: "Release notes appear in order, with filtering options and no status indicators.",
  },
  {
    to: "/examples/version-compare", img: CARD_ART.versionCompare, title: "c) Processors · Gantt timeline",
    desc: "A scrollable gantt-style timeline showing all baseline releases for a selected processor over time.",
  },*/
];

export function ExamplesHome() {
  return (
    <>
      <PageHeader crumb="Proposals" title="Page proposals"
      />
      <section className="wrap pad">
        <div className="section-head" style={{ marginBottom: 24 }}>
          <div><h2 style={{ fontSize: 24 }}>Index page</h2></div>
        </div>
        <div className="ex-list">
          {CARDS.map((c) => (
            <Link className="ex-card" to={c.to} key={c.to}>
              <div className="thumb" style={{ backgroundImage: `url(${c.img})` }} />
              <div className="body"><h3>{c.title}</h3><p>{c.desc}</p><span className="go">Open example →</span></div>
            </Link>
          ))}
        </div>

        <div className="section-head" style={{ margin: "56px 0 24px" }}>
          <div><h2 style={{ fontSize: 24 }}>Acquisitions page</h2></div>
        </div>
        <div className="ex-list">
          {ACQ_CARDS.map((c) => (
            <Link className="ex-card" to={c.to} key={c.to}>
              <div className="thumb" style={{ backgroundImage: `url(${c.img})` }} />
              <div className="body"><h3>{c.title}</h3><p>{c.desc}</p><span className="go">Open example →</span></div>
            </Link>
          ))}
        </div>


        <div className="section-head" style={{ margin: "56px 0 24px" }}>
          <div><h2 style={{ fontSize: 24 }}>Events page</h2></div>
        </div>
        <div className="ex-list">
          {PAGE_CARDS.map((c) => (
            <Link className="ex-card" to={c.to} key={c.to}>
              <div className="thumb" style={{ backgroundImage: `url(${c.img})` }} />
              <div className="body"><h3>{c.title}</h3><p>{c.desc}</p><span className="go">Open example →</span></div>
            </Link>
          ))}
        </div>

        <div className="section-head" style={{ margin: "56px 0 24px" }}>
          <div><h2 style={{ fontSize: 24 }}>Data Availability page</h2></div>
        </div>
        <div className="ex-list">
          {AVAIL_CARDS.map((c) => (
            <Link className="ex-card" to={c.to} key={c.to}>
              <div className="thumb" style={{ backgroundImage: `url(${c.img})` }} />
              <div className="body"><h3>{c.title}</h3><p>{c.desc}</p><span className="go">Open example →</span></div>
            </Link>
          ))}
        </div>

        <div className="section-head" style={{ margin: "56px 0 24px" }}>
          <div><h2 style={{ fontSize: 24 }}>Processors page</h2></div>
        </div>
        <div className="ex-list">
          {PROC_CARDS.map((c) => (
            <Link className="ex-card" to={c.to} key={c.to}>
              <div className="thumb" style={{ backgroundImage: `url(${c.img})` }} />
              <div className="body"><h3>{c.title}</h3><p>{c.desc}</p><span className="go">Open example →</span></div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

export function Index1() {
  const live = [...REALTIME, ...REALTIME];
  const [openSections, setOpenSections] = useState<Record<number, boolean>>({});
  const [newsOpen, setNewsOpen] = useState(false);

  return (
    <>
      <div style={{
        position: "fixed",
        top: "56px",
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--ground)",
        zIndex: 45,
      }}>
        <div style={{
          height: "68px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,.08)",
          overflow: "hidden",
        }}>
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
              color: "#3ddc84",
              cursor: "pointer",
            }}
          >
            <i style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#3ddc84",
              boxShadow: "0 0 11px #3ddc84",
            }} />
            News
            <span style={{ fontFamily: "var(--mono)", fontSize: "11px", color: "#3ddc84" }}>
              {REALTIME.length}
            </span>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{
              transition: "transform .3s ease",
              transform: newsOpen ? "rotate(180deg)" : "rotate(0deg)",
              color: "#3ddc84",
            }}>
              <path d="M5 9l7 7 7-7" />
            </svg>
          </button>
          <div style={{
            flex: "1 1 auto",
            minWidth: "0",
            height: "100%",
            display: "flex",
            alignItems: "center",
            flexWrap: "nowrap",
            overflow: "hidden",
            position: "relative",
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "nowrap",
              width: "max-content",
              whiteSpace: "nowrap",
              animation: "slide 68s linear infinite",
            }}>
              {live.map((e, i) => (
                <span key={i} style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "12px",
                  flex: "0 0 auto",
                  padding: "0 4px",
                  fontSize: "16px",
                  color: "var(--text)",
                  opacity: 0.92,
                }}>
                  <span>{e.title}</span>
                  <span className="nt-sep" />
                  <time style={{
                    fontFamily: "var(--mono)",
                    fontSize: "13px",
                    letterSpacing: ".04em",
                    color: "var(--muted)",
                    flex: "0 0 auto",
                  }}>
                    {e.date} {e.time}
                  </time>
                </span>
              ))}
            </div>
          </div>
        </div>
        {newsOpen && (
          <div style={{
            maxHeight: newsOpen ? "400px" : "0",
            overflow: "auto",
            transition: "max-height .42s cubic-bezier(.22,.61,.36,1)",
            background: "rgba(6,12,16,.94)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(255,255,255,.10)",
            zIndex: 1,
          }}>
            <ul style={{ margin: 0, padding: "6px 0 12px", listStyle: "none" }}>
              {REALTIME.slice(0, 5).map((item, idx) => (
                <li key={idx} style={{
                  display: "grid",
                  gridTemplateColumns: "140px 1fr",
                  gap: "18px",
                  padding: "13px 26px",
                  borderBottom: idx < 4 ? "1px solid rgba(255,255,255,.06)" : "none",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text)",
                }}>
                  <time style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10.5px",
                    letterSpacing: ".04em",
                    color: "var(--text-dim)",
                    paddingTop: "2px",
                  }}>
                    {item.date} {item.time}
                  </time>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <section style={{
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
        paddingTop: "calc(56px + 68px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
        background: "#000",
      }}>
        <video autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }}>
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
              fontSize: "56px",
              fontWeight: 700,
              margin: "0 0 16px",
              color: "#fff",
              letterSpacing: "-.02em",
            }}>
              Copernicus <span style={{ color: "#29c3d6" }}>Sentinel</span> Operations Dashboard
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

      <div style={{ position: "relative", zIndex: 1 }}>
        {MODULES.map((m, i) => (
          <Reveal key={m.idx} as="section" className="px-panel" style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: i % 2 === 0 ? "flex-start" : "flex-end",
          }}>
            <div className="px-panel-bg" style={{ backgroundImage: `url(${m.img})`, backgroundPosition: m.pos ?? "center" }} />
            <div className="px-panel-veil" />
            <div className="px-panel-inner wrap" style={{
              maxWidth: "640px",
              textAlign: i % 2 === 0 ? "left" : "right",
              marginLeft: i % 2 === 0 ? "0" : "auto",
              marginRight: i % 2 === 0 ? "auto" : "0",
              paddingLeft: i % 2 === 0 ? "56px" : "28px",
              paddingRight: i % 2 === 0 ? "28px" : "56px",
            }}>
              <div className="copy">
                <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: ".2em", textTransform: "uppercase", color: "#36d0e0", marginBottom: "14px" }}>
                  {String(i + 1).padStart(2, '0')} — Module
                </span>
                <h2 style={{ margin: "0 0 15px", fontSize: "clamp(30px, 3.6vw, 46px)", fontWeight: 700, letterSpacing: "-.025em", lineHeight: 1.08, color: "#fff", whiteSpace: "nowrap" }}>
                  {m.title}
                </h2>
                <p style={{ margin: "0 0 16px", fontSize: "15px", lineHeight: 1.6, color: "rgba(255,255,255,.92)" }}>
                  {m.desc}
                </p>
                <p style={{ fontSize: "13px", lineHeight: 1.72, color: "rgba(255,255,255,.74)", marginBottom: "30px" }} dangerouslySetInnerHTML={{ __html: m.long }} />
                <Link to={m.href} style={{ display: "inline-block", fontFamily: "var(--mono)", fontSize: "clamp(19px, 1.7vw, 26px)", letterSpacing: "-.01em", color: "#fff", textDecoration: "none" }}>
                  Open module →
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <section style={{ position: "relative", zIndex: 10, padding: "120px 0 130px", background: "var(--ground)" }} id="faq">
        <div style={{ maxWidth: "920px", margin: "0 auto", padding: "0 56px" }}>
          <div style={{ textAlign: "center", marginBottom: "44px" }}>
            <span style={{
              display: "block",
              fontFamily: "var(--mono)",
              fontSize: "10px",
              letterSpacing: ".2em",
              textTransform: "uppercase",
              color: "var(--accent-cyan)",
              marginBottom: "16px",
            }}>
              05 — Support
            </span>
            <h2 style={{
              margin: "0 0 12px",
              fontSize: "clamp(30px, 3.6vw, 46px)",
              fontWeight: 700,
              letterSpacing: "-.025em",
              lineHeight: 1.08,
              color: "#fff",
            }}>
              FAQs
            </h2>
            <p style={{
              margin: "0",
              fontSize: "15px",
              lineHeight: 1.6,
              color: "rgba(255,255,255,.82)",
            }}>
              Find answers to the most common questions about the dashboard.
            </p>
          </div>

          <div>
            {[
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
                  { q: "What is the SentiBoard?", a: "A central point of access for events impacting data availability, real-time data collection insights and key statistics on the products delivered by the Copernicus Sentinel missions." },
                  { q: "Who operates the dashboard?", a: "It is operated by the CSC Operations Coordination Service, as part of the ongoing transformation of the Copernicus Ground Segment." },
                ],
              },
              {
                icon: (
                  <>
                    <path d="M4 13l7-7M8 17l7-7" />
                    <rect x="2" y="9" width="5" height="5" rx="1" transform="rotate(-45 4.5 11.5)" />
                    <rect x="17" y="9" width="5" height="5" rx="1" transform="rotate(-45 19.5 11.5)" />
                    <path d="M14 18l4 4" />
                  </>
                ),
                title: "Sentinel Missions Monitoring",
                items: [
                  { q: "Which missions are covered?", a: "Sentinel-1, Sentinel-2, Sentinel-3 and Sentinel-5P, including every satellite currently in operations or in commissioning." },
                  { q: "Can I see planned acquisitions?", a: "Yes. The Acquisitions Status globe shows past, current and planned acquisitions; by default the real-time sensing scenario is displayed." },
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
                  { q: "How is availability calculated?", a: "As published volume over expected sensing, computed per product type and aggregated by processing level." },
                  { q: "A product I need is missing. Why?", a: "Check the Events page first: a calibration activity, manoeuvre or ground-segment issue in the same window usually explains the gap." },
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
                  { q: "How do I use the processor timeline?", a: "Zoom in and out with the mouse wheel and drag left or right keeping the left button pressed. Clicking a coloured box opens the details of that release." },
                  { q: "Can I filter by mission?", a: "Every module carries its own filters: mission, satellite, day of acquisition and datatake, applied in cascade." },
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
                  { q: "The 3D globe does not render.", a: "The globe needs WebGL. Update your browser or enable hardware acceleration, then reload the page." },
                  { q: "Figures look out of date.", a: "A cached page is the usual cause. Force a reload; if the timestamp in the header stays behind, report it to the contact address below." },
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
                  { q: "How do I report an anomaly?", a: "Write to sentiboard@coordination-service.eu with the mission, the datatake identifier and the time window involved." },
                  { q: "Can I request a new feature?", a: "Yes. Feature requests are collected and reviewed with the Copernicus Ground Segment evolution plan." },
                ],
              },
            ].map((section, idx) => (
              <div key={idx} style={{
                border: `1px solid ${openSections[idx] ? "#29c3d6" : "var(--line-soft)"}`,
                borderRadius: "10px",
                overflow: "hidden",
                marginBottom: "12px",
                background: "rgba(10,18,24,.7)",
                transition: "border-color 0.2s ease",
              }}>
                <button onClick={() => setOpenSections({ ...openSections, [idx]: !openSections[idx] })} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  width: "100%",
                  padding: "16px 20px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "15px",
                  fontWeight: 600,
                  transition: "all .2s ease",
                }}>
                  <span style={{ flex: "none", width: "19px", display: "grid", placeItems: "center", color: "#29c3d6" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      {section.icon}
                    </svg>
                  </span>
                  <span style={{ flex: 1, textAlign: "left", color: "var(--text)" }}>{section.title}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" style={{
                    color: "#29c3d6",
                    transform: openSections[idx] ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform .2s ease",
                  }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {openSections[idx] && (
                  <div style={{ padding: "0 20px 16px 20px", borderTop: "1px solid rgba(41,195,214,.2)" }}>
                    {section.items.map((item, itemIdx) => (
                      <div key={itemIdx} style={{
                        paddingTop: "12px",
                      }}>
                        <p style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 600, color: "#29c3d6" }}>{item.q}</p>
                        <p style={{ margin: "0", fontSize: "13px", lineHeight: 1.6, color: "rgba(255,255,255,.74)" }}>{item.a}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <p style={{
              marginTop: "40px",
              textAlign: "center",
              fontSize: "13px",
              lineHeight: 1.7,
              color: "var(--muted)",
            }}>
              For any inquiries on the Copernicus Sentinel Operations Dashboard contact{" "}
              <a href="mailto:sentiboard@coordination-service.eu" style={{ color: "var(--accent-cyan)", textDecoration: "none" }}>
                sentiboard@coordination-service.eu
              </a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
