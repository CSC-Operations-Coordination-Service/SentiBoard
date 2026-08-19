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
      <span className="ex-badge">Example A · Ticker over video + fleet</span>
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
      <span className="ex-badge">Example B · Console + linkable gallery</span>
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
      <span className="ex-badge">Example C · Editorial + reveal</span>
    </>
  );
}

// ================= landing =================
const CARDS = [
  { to: "/examples/fleet", img: MOD_IMG[0], title: "A · Ticker over video + fleet", desc: "Video hero with news scrolling on top and live events along the bottom → Sentinel fleet → image page-cards." },
  { to: "/examples/gallery", img: MOD_IMG[2], title: "B · Console + linkable gallery", desc: "News + real-time console as the first section (no globe) → diagonal gallery where every image links to a page." },
  { to: "/examples/reveal", img: SCENES[0], title: "C · Editorial + reveal", desc: "Editorial first section (auto-scrolling Sentinel scenes + news + live rail, no globe) → pages revealed on scroll." },
];

// Proposals for pages other than the index — same idea, grouped separately so
// it stays clear which real page each one is an alternative to.
const PAGE_CARDS = [
  {
    to: "/examples/events-log-v3", img: MOD_IMG[1], title: "Events · mission tiles + side panel",
    desc: "The month displays as a daily grid using single dots for events and impact stripes for data-loss days. Selecting a day opens a panel detailing affected datatakes and their completeness. Designed on a near-black canvas with condensed type and a single accent color.",
  },
  {
    to: "/examples/events-spacex", img: MOD_IMG[0], title: "Events · timeline + heatmap (2 concepts)",
    desc: "Two layouts under one tab bar with a shared period selector. Layout A has an orbital Gantt ribbon with months on the X-axis and detail popovers for each block. Layout B features 31 square day tiles with micro status pills for day selection over the UTC log.",
  },
  {
    to: "/examples/events-manifest", img: MOD_IMG[3], title: "Events · filters + day drawer",
    desc: "Shows mission events on a grid, marking days with missing data. Selecting a day reveals occurrences and impacted datatakes.",
  },
];

const ACQ_CARDS = [
  {
    to: "/examples/acquisitions-globe", img: MOD_IMG[0], title: "Acquisitions · Demand-driven globe",
    desc: "The 3D globe is improved with on-demand frames, cached coastlines, and a pause feature for when it's hidden. Datatakes show footprints, are keyboard-operable, and day filters match available coverage.",
  },
];

const AVAIL_CARDS = [
  {
    to: "/examples/coverage-timeline", img: MOD_IMG[0], title: "Data Availability · Coverage timeline",
    desc: "The heatmap visualizes mission performance with daily completeness, showing outages as horizontal runs. Sparkline chips indicate days since the last gap, with the table sorted by the most recent gaps for quick identification of issues. Selecting a cell focuses on the specific mission and day.",
  },
  {
    to: "/examples/data-availability-spacex", img: MOD_IMG[3], title: "Data Availability · Telemetry console",
    desc: "The page mimicked a launch console with hairline rules, a UTC clock, donut metrics, and a table for telemetry records.",
  },
  {
    to: "/examples/data-availability", img: MOD_IMG[1], title: "Data Availability · Filtered breakdown",
    desc: "The datatake list includes filters for mission, acquisition, and publication status, ensuring consistent charts and rows, along with a sortable table of relevant details.",
  },
];

const PROC_CARDS = [
  {
    to: "/examples/version-matrix", img: MOD_IMG[3], title: "Processors · Version matrix",
    desc: "A structured comparison displays processors in rows and baseline versions in columns, with the latest releases right-aligned. Each cell shows the baseline version and release date, indicating current (filled) versus replaced (hollow) versions. A mission filter narrows the rows, while 'Current versions only' shows the latest release per processor. Selecting a cell reveals details like release dates and impacted satellites.",
  },
  {
    to: "/examples/release-log", img: SCENES[2], title: "Processors · Release log",
    desc: "Release notes are displayed in reverse-chronological order, with full entries and minimal metadata. Users can filter by date or processor, and search across various fields. The latest release is always at the top, with no status indicators.",
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
          <span className="meta">3 options</span>
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
          <div><h2 style={{ fontSize: 24 }}>Events page</h2></div>
          <span className="meta">3 alternatives to /events</span>
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
          <div><h2 style={{ fontSize: 24 }}>Acquisitions page</h2></div>
          <span className="meta">1 alternative to /acquisitions</span>
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
          <div><h2 style={{ fontSize: 24 }}>Data Availability page</h2></div>
          <span className="meta">3 alternatives to /availability</span>
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
          <span className="meta">2 alternatives to /processors</span>
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
