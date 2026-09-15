"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Collapse from "./Collapse";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  descriptionTitle?: string;
  descriptionOpen?: boolean;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  descriptionTitle = "Description",
  descriptionOpen = true,
}: PageHeaderProps) {
  const [open, setOpen] = useState(descriptionOpen);
  const bodyId = useId();

  return (
    <div className="page-head">
      <div className="wrap">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="crumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx}>
                {crumb.href ? (
                  <a href={crumb.href}>
                    {idx === 0 && (
                      <svg viewBox="0 0 24 24" style={{ marginRight: 4 }}>
                        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                      </svg>
                    )}
                    {crumb.label}
                  </a>
                ) : (
                  <span className="cur">{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span className="sep">/</span>}
              </span>
            ))}
          </nav>
        )}

        <h1>{title}</h1>

        {description && (
          <div className="page-desc">
            <button
              type="button"
              className="page-desc-head"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls={bodyId}
            >
              {descriptionTitle}
              <ChevronDown className="chev" size={15} aria-hidden />
            </button>
            <Collapse open={open} id={bodyId}>
              <div className="body">{description}</div>
            </Collapse>
          </div>
        )}
      </div>
    </div>
  );
}
