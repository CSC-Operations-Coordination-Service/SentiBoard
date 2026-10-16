import React, { useLayoutEffect, useRef, useState } from "react";
import "../styles/page-header.css";

interface PageHeaderProps {
  title: string;
  crumb?: string;
  subtitle?: string;
  /** @deprecated use subtitle */
  sub?: string;
  /** HTML string (from data/copy) or JSX */
  description?: React.ReactNode;
  /** @deprecated use description */
  desc?: React.ReactNode;
  img?: string;
  backgroundImage?: string;
}

export default function PageHeader({
  title,
  crumb,
  subtitle,
  sub,
  description,
  desc,
  img,
  backgroundImage,
}: PageHeaderProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const innRef = useRef<HTMLDivElement>(null);
  const afterRef = useRef<HTMLDivElement>(null);

  const bg = backgroundImage || img;
  const lede = subtitle || sub;
  const body = description ?? desc;
  const photo = bg ? { backgroundImage: `url(${bg})` } : undefined;

  // Same rule as SentiBoard.html: the title block sits in the middle of the space between the top of the
  // hero (under the menu) and the line where the content below starts rising over it. The block is
  // measured as if its sentence took two lines, so the title lands at the same height on every page.
  useLayoutEffect(() => {
    const hero = heroRef.current;
    const inn = innRef.current;
    const after = afterRef.current;
    if (!hero || !inn || !after) return;

    const place = () => {
      if (window.innerWidth <= 640) {
        inn.style.removeProperty("--hero-top");
        return;
      }
      const h1 = inn.querySelector<HTMLElement>(".hero-title");
      const ledeEl = inn.querySelector<HTMLElement>(".lede");
      const bar = inn.querySelector<HTMLElement>(".descbar");
      if (!h1) return;

      const gap = parseFloat(getComputedStyle(inn).rowGap) || 0;
      let h = h1.offsetHeight;
      if (ledeEl) {
        const ls = getComputedStyle(ledeEl);
        const lh = parseFloat(ls.lineHeight) || parseFloat(ls.fontSize) * 1.6;
        h += gap + 2 * lh;
      }
      if (bar) {
        h +=
          gap +
          (parseFloat(getComputedStyle(bar).marginTop) || 0) +
          bar.offsetHeight;
      }

      // where the content below begins (the hero's height minus the overlap)
      const skyTop =
        after.getBoundingClientRect().top - hero.getBoundingClientRect().top;
      const top = Math.max(12, Math.round((skyTop - h) / 2));
      inn.style.setProperty("--hero-top", `${top}px`);
    };

    place();
    const ro = new ResizeObserver(place);
    ro.observe(hero);
    document.fonts?.ready.then(place);
    return () => ro.disconnect();
  }, [title, lede, body]);

  // Same rule as the HTML: measured while closed (the button never moves), the panel is pulled up so
  // the first line of text opens 40–56px under the button, whatever the viewport.
  const toggle = () => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    const d = descRef.current;
    if (!open && wrap && btn && d) {
      // The padding lives on the inner block (.desc-in), so the first line of text starts that far
      // below the panel's top edge.
      const inner = (d.firstElementChild as HTMLElement | null) ?? d;
      wrap.style.setProperty("--desc-pull", "0px");
      const textTop =
        wrap.getBoundingClientRect().top +
        parseFloat(getComputedStyle(inner).paddingTop);
      const gap = textTop - btn.getBoundingClientRect().bottom;
      const target = Math.round(
        Math.max(40, Math.min(56, window.innerHeight * 0.05)),
      );
      // The pull and the panel's growth run on the same curve, so the content below moves by
      // (height − pull) × progress. Capping the pull at the panel's full height keeps that never
      // negative: the content below only ever moves down while opening, and only up while closing.
      const full = inner.offsetHeight;
      const pull = Math.min(Math.max(0, gap - target), full);
      wrap.style.setProperty("--desc-pull", `${-pull}px`);
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <section className="hero" ref={heroRef}>
        <div className="hero-ph sharp">
          <i style={photo} />
        </div>
        <div className="hero-ph soft">
          <i style={photo} />
        </div>
        <div className="scrim-x" />
        <div className="scrim-y" />
        <div className="hero-blend" />

        <div className="hero-in" ref={innRef}>
          {crumb && <div className="breadcrumb">{crumb}</div>}
          <h1 className="hero-title">{title}</h1>
          {lede && <p className="lede">{lede}</p>}

          {body && (
            <div className="descbar">
              <button
                ref={btnRef}
                type="button"
                aria-expanded={open}
                aria-controls="descPanel"
                className={`desc-btn ${open ? "open" : ""}`}
                onClick={toggle}
              >
                Description
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 6l5 5 5-5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </section>

      <div className="hero-after" ref={afterRef}>
        {body && (
          <div ref={wrapRef} className={`desc-wrap ${open ? "open" : ""}`}>
            <div
              ref={descRef}
              className="desc"
              id="descPanel"
              aria-hidden={!open}
            >
              {typeof body === "string" ? (
                <div
                  className="desc-in"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              ) : (
                <div className="desc-in">{body}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
