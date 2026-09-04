import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, Camera, Waves, Wind } from "lucide-react";
import { PageHeader, Pill } from "@/components/ui";
import { NEWS, REALTIME } from "@/data/mock";
import { useTheme } from "@/theme";
import "@/styles/examples.css";

/* Index-page PROPOSAL examples — ALTERNATIVES to the real Home page (untouched).
   Plain React + CSS (no Next.js yet, but portable to it). Routes under /examples. */

const MOD_IMG = [
  "/assets/img/modules/acquisitions.jpg",
  "/assets/img/modules/availability.jpg",
  "/assets/img/modules/events.jpg",
  "/assets/img/modules/processors.jpg",
];

const MODULES = [
  { href: "/acquisitions", title: "Acquisitions Status", img: MOD_IMG[0], desc: "Past, current and planned Sentinel acquisitions on an interactive 3D globe." },
  { href: "/events", title: "Events", img: MOD_IMG[2], desc: "Calibration activities, manoeuvres and anomalies that could impede data production." },
  { href: "/availability", title: "Data Availability", img: MOD_IMG[1], desc: "Real-time list of available collections delivered by the missions, with key metrics." },
  { href: "/processors", title: "Processors", img: MOD_IMG[3], desc: "The complete list of Copernicus Sentinel processor releases on an interactive timeline." },
];

// page linked to each MOD_IMG index (for the clickable gallery tiles)
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
  acquisitionsGlobe: MOD_IMG[0],
  acquisitionsLadder: MOD_IMG[1],
  // data availability concepts — again matching each page's backdrop
  coverageTimeline: ESA("Protecting_Atlantic.jpg"),
  availabilitySpacex: ESA("FLEX_Sentinel-3.jpg"),
  availabilityFiltered: ESA("Tierra_Fuego_S1D.jpg"),
  // processors — no backdrops on these pages, so leftovers from the same set
  versionMatrix: MOD_IMG[3],
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
            {e.text}
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
  { to: "/examples/fleet-gallery", img: SCENES[3], title: "d) Fleet + Gallery combined", desc: "Video hero from fleet page → diagonal carousel gallery." },
  { to: "/examples/fleet", img: CARD_ART.fleet, title: "a) Ticker over video - fleet", desc: "Video hero with news scrolling on top and live events along the bottom → Sentinel fleet → image page-cards." },
  { to: "/examples/gallery", img: CARD_ART.gallery, title: "b) Console - linkable gallery", desc: "News + real-time console as the first section (no globe) → diagonal gallery where every image links to a page." },
  { to: "/examples/reveal", img: CARD_ART.reveal, title: "c) Editorial - reveal", desc: "Editorial first section (auto-scrolling Sentinel scenes + news + live rail, no globe) → pages revealed on scroll." },
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
  {
    to: "/examples/events-swimlanes", img: CARD_ART.eventsSwimlanes, title: "a) Events · Mission swimlanes",
    desc: "Show missions by fleet with collapsible rows for each (S1, S2, S3, S5P). Row headers display event count, affected datatakes, and an 'N active' badge. Expanding a row reveals event details, replacing the chronological list.",
  },
  {
    to: "/examples/events-spacex", img: CARD_ART.eventsSpacex, title: "b) Events · timeline + heatmap",
    desc: "Two layouts share a tab bar: Layout A has a Gantt ribbon by month, and Layout B features 31 day tiles with status pills.",
  },
  {
    to: "/examples/events-manifest", img: CARD_ART.eventsManifest, title: "c) Events · filters",
    desc: "Shows mission events on a grid with icons for each event type. Selecting a day reveals occurrences and affected datatakes.",
  },
];

const ACQ_CARDS = [
  {
    to: "/examples/acquisitions-globe", img: CARD_ART.acquisitionsGlobe, title: "a) Acquisitions · Demand-driven globe",
    desc: "The 3D globe includes on-demand frames, cached coastlines, and a pause feature.",
  },
  {
    to: "/examples/acquisitions-ladder", img: CARD_ART.acquisitionsLadder, title: "b) Acquisitions · Level ladder",
    desc: "Satellite data is categorized into flown, sensing, and scheduled. Sentinel-5P has two levels, and Sentinel-3's Level 2 has five instrument groups.",
  },
];

const AVAIL_CARDS = [
  {
    to: "/examples/coverage-timeline", img: CARD_ART.coverageTimeline, title: "a) Data Availability · Coverage timeline",
    desc: "The heatmap shows daily mission performance, with outages as horizontal runs and sparkline chips indicating gaps. The table is sorted by recent gaps for easy issue identification.",
  },
  {
    to: "/examples/data-availability-spacex", img: CARD_ART.availabilitySpacex, title: "b) Data Availability · Telemetry console",
    desc: "The page mimicked a launch console with hairline rules, a UTC clock, donut metrics, and a table for telemetry records.",
  },
  {
    to: "/examples/data-availability", img: CARD_ART.availabilityFiltered, title: "c) Data Availability · Filtered breakdown",
    desc: "The datatake list includes filters for mission, acquisition, and publication status, ensuring consistent charts and rows, along with a sortable table of relevant details.",
  },
];

const PROC_CARDS = [
  {
    to: "/examples/version-matrix", img: CARD_ART.versionMatrix, title: "a) Processors · Version matrix",
    desc: "Processors are arranged in rows with baseline versions in columns.",
  },
  {
    to: "/examples/release-log", img: CARD_ART.releaseLog, title: "b) Processors · Release Timeline",
    desc: "Release notes appear in order, with filtering options and no status indicators.",
  },
  {
    to: "/examples/version-compare", img: CARD_ART.versionCompare, title: "c) Processors · Gantt timeline",
    desc: "A scrollable gantt-style timeline showing all baseline releases for a selected processor over time.",
  },
];

export function ExamplesHome() {
  return (
    <>
      <PageHeader crumb="Proposals" title="Page proposals"
        sub="Alternative layouts for the dashboard pages. The index options each treat the News + Real-Time Events section differently; the page proposals rework a single existing page. The real pages are unchanged." />
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
          <div><h2 style={{ fontSize: 24 }}>About page</h2></div>
        </div>
        <div className="ex-list">
          {ABOUT_CARDS.map((c) => (
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
