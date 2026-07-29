"use client";
import { useState } from "react";

// Production-style split vertical slider: the left text cards slide up while the
// right images slide down (opposite directions), driven by the up/down buttons.
// Text is the canonical wording from the production dashboard.
type Slide = { title: string; href: string; img: string; text: string };

const SLIDES: Slide[] = [
  {
    title: "Acquisitions Status",
    href: "/v1/acquisitions",
    img: "/assets/img/acquisitions_status.webp",
    text: "View displays the past, current and future Copernicus Sentinels' acquisition on an interactive, 3D globe. Through this view, users can either inspect the status of a past acquisition, or learn about the planned acquisitions for the mission of interest. By default, the real-time sensing scenario is displayed.",
  },
  {
    title: "Events",
    href: "/v1/events",
    img: "/assets/img/events.webp",
    text: "Provides details of the events over the past three months that could impede data production, such as planned calibration activities, manoeuvres, or anomalies. Information on the extent to which these events affect data production and the data products impacted is provided.",
  },
  {
    title: "Data Availability",
    href: "/v1/availability",
    img: "/assets/img/data_availability.webp",
    text: "Section of the dashboard hosts a real-time list of available collections delivered by the missions, enabling users to scan through these products to find data that meet their research and development requirements, and to assess their quality.",
  },
  {
    title: "Processors",
    href: "/v1/processors",
    img: "/assets/img/processors.webp",
    text: "Shows the complete list of the releases of the Copernicus Sentinels processors, on an interactive timeline.",
  },
  {
    title: "About",
    href: "/v1/about",
    img: "/assets/img/about.webp",
    text: "Copernicus is the EU's Earth observation programme, providing open Sentinel satellite data. Managed by ESA, it supports research through the Operations Dashboard, offering real-time insights and key data stats.",
  },
];

export default function VerticalSlider() {
  const n = SLIDES.length;
  const [i, setI] = useState(0);
  const down = () => setI((p) => (p + 1) % n);
  const up = () => setI((p) => (p - 1 + n) % n);

  const step = 100 / n; // one card = this % of the (n×tall) inner track

  return (
    <section
      id="vertical-slider"
      className="vslider"
      aria-roledescription="carousel"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") down();
        if (e.key === "ArrowUp") up();
      }}
      tabIndex={0}
    >
      {/* LEFT — text cards, in order, sliding UP as the index grows */}
      <div className="vslider-left">
        <div className="vslider-track" style={{ height: `${n * 100}%`, transform: `translateY(-${i * step}%)` }}>
          {SLIDES.map((s, k) => (
            <div className={"vcard " + (k % 2 ? "b" : "a")} style={{ height: `${step}%` }} key={k}>
              <h2>{s.title}</h2>
              <p>{s.text}</p>
              <a className="btn ghost" href={s.href}>
                Learn more <span className="arrow">→</span>
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — images, REVERSED order, sliding DOWN (opposite the cards) */}
      <div className="vslider-right">
        <div className="vslider-track" style={{ height: `${n * 100}%`, transform: `translateY(-${(n - 1 - i) * step}%)` }}>
          {[...SLIDES].reverse().map((s, k) => (
            <div className="vslide" style={{ height: `${step}%`, backgroundImage: `url(${s.img})` }} key={k} aria-hidden="true" />
          ))}
        </div>
      </div>

      {/* up / down controls — centered on the divider, like prod (fa-arrow-down / fa-arrow-up) */}
      <div className="vslider-btns">
        <button className="vbtn" onClick={down} aria-label="Next section">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
        <button className="vbtn" onClick={up} aria-label="Previous section">
          <svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
        </button>
      </div>
    </section>
  );
}
