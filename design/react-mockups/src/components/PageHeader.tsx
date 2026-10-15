import React, { useState } from "react";
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
  const bg = backgroundImage || img;
  const lede = subtitle || sub;
  const body = description ?? desc;
  const bgStyle = bg ? { backgroundImage: `url(${bg})` } : undefined;

  return (
    <section className={`hero ${open ? "open" : ""}`} style={bgStyle}>
      <div className="hero-ph sharp">
        <i style={bgStyle} />
      </div>
      <div className="hero-ph soft">
        <i style={bgStyle} />
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
              type="button"
              aria-expanded={open}
              aria-controls="descPanel"
              className={`desc-btn ${open ? "open" : ""}`}
              onClick={() => setOpen((o) => !o)}
            >
              <span>Description</span>
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
            <div className={`desc-wrap ${open ? "open" : ""}`}>
              <div className="desc" id="descPanel">
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
          </div>
        )}
      </div>
    </section>
  );
}
