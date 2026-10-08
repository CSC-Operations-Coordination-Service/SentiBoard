import React, { useState } from "react";
import { Collapse } from "./ui";
import "../styles/page-header.css";

interface PageHeaderProps {
  title: string;
  crumb?: string;
  subtitle?: string;
  description?: React.ReactNode;
  backgroundImage?: string;
  img?: string;
}

export default function PageHeader({
  title,
  crumb,
  subtitle,
  description,
  backgroundImage,
  img,
}: PageHeaderProps) {
  const [isDescOpen, setIsDescOpen] = useState(false);
  const bgImage = backgroundImage || img;

  return (
    <section
      className="hero"
      style={bgImage ? { backgroundImage: `url(${bgImage})` } : {}}
    >
      <div className="hero-ph sharp">
        <i style={bgImage ? { backgroundImage: `url(${bgImage})` } : {}}></i>
      </div>
      <div className="hero-ph soft">
        <i style={bgImage ? { backgroundImage: `url(${bgImage})` } : {}}></i>
      </div>
      <div className="scrim-x"></div>
      <div className="scrim-y"></div>
      <div className="hero-blend"></div>

      <div className="hero-in">
        {crumb && <div className="breadcrumb">{crumb}</div>}
        <h1 className="hero-title">{title}</h1>
        {subtitle && <p className="lede">{subtitle}</p>}

        {description && (
          <div className="page-desc">
            <button
              id="descBtn"
              type="button"
              aria-expanded={isDescOpen}
              aria-controls="descPanel"
              className={`page-desc-head ${isDescOpen ? "open" : ""}`}
              onClick={() => setIsDescOpen((prev) => !prev)}
            >
              <span>Description</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                style={{
                  transform: isDescOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                <path
                  d="M3 6l5 5 5-5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            </button>

            {/* Collapse wrapper handles smooth height expansion */}
            <Collapse open={isDescOpen} id="descPanel">
              <div className="desc-panel-body" style={{ padding: "12px 0" }}>
                {typeof description === "string" ? (
                  <p>{description}</p>
                ) : (
                  description
                )}
              </div>
            </Collapse>
          </div>
        )}
      </div>
    </section>
  );
}
