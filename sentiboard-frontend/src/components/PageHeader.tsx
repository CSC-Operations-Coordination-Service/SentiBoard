"use client";

// Ported from the prototype (design/react-mockups/src/components/PageHeader.tsx). Styles live in
// src/styles/page-header.css, loaded once by the root layout. Without JavaScript the Description
// panel is shown open and its button hidden (src/styles/no-js.css).
import React, { useLayoutEffect, useRef, useState } from "react";
import { useHydrated } from "@/lib/use-hydrated";

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

/** Space between the bottom of the Description button and the top of the text panel, px — the
 *  SentiBoard.html rule: 5% of the viewport height, kept between 40 and 56px. The button is 44px
 *  tall for an 11px label and the first line carries its own half-leading, so the visible distance
 *  from the word "DESCRIPTION" to the text is about this + 25px (≈ 70–80px), the same on every page. */
const descGap = () =>
  Math.round(Math.max(40, Math.min(56, window.innerHeight * 0.05)));

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
  // aria-hidden on the closed panel only once JavaScript can open it: the server HTML leaves the
  // text exposed, so it stays readable (and announced) without JavaScript.
  const hydrated = useHydrated();
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

  // Measured while closed (the button never moves): the panel is moved so the first line of text
  // opens descGap() under the button on EVERY page, whatever the title, sentence or text length.
  //
  // Before, the pull was capped at the panel's own height so the content below would never rise.
  // A short description (Acquisitions: three lines) could not be pulled far enough and opened
  // ~200px under the button, while long ones (Events, Data Availability) opened at the right
  // distance. Now the pull is never capped; whatever exceeds the panel's height is given back as
  // padding under it (--desc-extra), so the content below still never moves up — it simply stays
  // where it is when the text fits in the space that was already there.
  const measure = () => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    const d = descRef.current;
    if (!wrap || !btn || !d) return;
    // The padding lives on the inner block (.desc-in), so the first line of text starts that far
    // below the panel's top edge. Measure from the wrap's natural (unpulled) position.
    const inner = (d.firstElementChild as HTMLElement | null) ?? d;
    const prevPull =
      parseFloat(wrap.style.getPropertyValue("--desc-pull")) || 0;
    const wrapTop = wrap.getBoundingClientRect().top - (open ? prevPull : 0);
    const textTop = wrapTop + parseFloat(getComputedStyle(inner).paddingTop);
    const gap = textTop - btn.getBoundingClientRect().bottom;
    // pull > 0 lifts the panel; < 0 (button already closer than the target) pushes it down
    const pull = gap - descGap();
    const full = inner.offsetHeight;
    // The pull, the panel's growth and this padding run on the same curve, so the content below
    // moves by (full − pull + extra) × progress, which is never negative.
    const extra = Math.max(0, pull - full);
    wrap.style.setProperty("--desc-pull", `${-pull}px`);
    wrap.style.setProperty("--desc-extra", `${extra}px`);
  };

  const toggle = () => {
    if (!open) measure();
    setOpen((o) => !o);
  };

  // While open, keep the distance when the window is resized (the hero rescales with the width).
  useLayoutEffect(() => {
    if (!open) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
              aria-hidden={hydrated ? !open : undefined}
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
