import React, { useRef, useState } from "react";
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

  const bg = backgroundImage || img;
  const lede = subtitle || sub;
  const body = description ?? desc;
  const photo = bg ? { backgroundImage: `url(${bg})` } : undefined;

  // Same rule as the HTML: measured while closed (the button never moves), the panel is pulled up so
  // the first line of text opens 40–56px under the button, whatever the viewport.
  const toggle = () => {
    const wrap = wrapRef.current;
    const btn = btnRef.current;
    const d = descRef.current;
    if (!open && wrap && btn && d) {
      wrap.style.setProperty("--desc-pull", "0px");
      const textTop =
        wrap.getBoundingClientRect().top +
        parseFloat(getComputedStyle(d).paddingTop);
      const gap = textTop - btn.getBoundingClientRect().bottom;
      const target = Math.round(
        Math.max(40, Math.min(56, window.innerHeight * 0.05)),
      );
      wrap.style.setProperty("--desc-pull", `${-Math.max(0, gap - target)}px`);
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-ph sharp">
          <i style={photo} />
        </div>
        <div className="hero-ph soft">
          <i style={photo} />
        </div>
        <div className="scrim-x" />
        <div className="scrim-y" />
        <div className="hero-blend" />

        <div className="hero-in">
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

      <div className="hero-after">
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
