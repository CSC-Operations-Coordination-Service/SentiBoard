import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import "../styles/page-header.css";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  descriptionTitle?: string;
  descriptionOpen?: boolean;
  backgroundImage?: string;
}

export default function PageHeader({
  title,
  description,
  breadcrumbs,
  descriptionTitle = "Description",
  descriptionOpen = true,
  backgroundImage,
}: PageHeaderProps) {
  const [open, setOpen] = useState(descriptionOpen);

  return (
    <div
      className="page-header"
      style={backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : {}}
    >
      <div className="page-header-inner">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <span key={idx} className="breadcrumb-item">
                {crumb.href ? (
                  <a href={crumb.href}>{crumb.label}</a>
                ) : (
                  <span className="current">{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span className="separator">/</span>}
              </span>
            ))}
          </nav>
        )}

        <h1 className="page-title">{title}</h1>

        {description && (
          <div className="page-description">
            <button
              type="button"
              className="description-toggle"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
            >
              <span className="toggle-label">{descriptionTitle}</span>
              <ChevronDown
                size={16}
                className={`toggle-icon ${open ? "open" : ""}`}
              />
            </button>
            {open && (
              <div className="description-content">
                {description}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
