import { useEffect, useId, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { COMPLETENESS_LABEL, type Completeness, type Status } from "@/data/mock";

/** Matches a CSS media query from JS, kept in sync as the viewport changes.
 *
 *  Layout belongs in CSS; this exists for the cases CSS cannot reach — a panel that should
 *  start collapsed on a phone and expanded on a desktop, where the difference is an initial
 *  React state, not a rule. Read synchronously on first render so a component that only
 *  consults it on mount (a `defaultOpen`, say) gets the right answer without a re-render. */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    setMatches(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** Fade/slide element into view on scroll (SpaceX-style reveal). */
export function Reveal({ children, as: Tag = "div", className = "", style }: {
  children: ReactNode; as?: any; className?: string; style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal ${seen ? "in" : ""} ${className}`} style={style}>{children}</Tag>;
}

// Pills carry two different vocabularies: mission/processor health (Status) and datatake
// completeness (Completeness). Both key their own colour off the class name, so one component
// serves both without either borrowing the other's wording.
const LABELS: Record<Status | Completeness, string> = {
  nominal: "Nominal", degraded: "Degraded", critical: "Critical", info: "Processing", neutral: "Planned",
  ...COMPLETENESS_LABEL,
};

export function Pill({ status, label }: { status: Status | Completeness; label?: string }) {
  return <span className={`pill ${status}`}><span className="dot" />{label ?? LABELS[status]}</span>;
}

/** The slide behind every accordion here — the page "Description" panel and the occurrence rows in
 *  the Events drawers. A grid row going 0fr → 1fr resolves to the content's own height, which is
 *  what lets one rule animate panels of any length; `height:auto` cannot be animated at all, and a
 *  max-height guess either clips the longest copy or spends the transition on empty space.
 *  Stateless on purpose: the caller owns the open flag. */
export function Collapse({ open, id, children }: {
  open: boolean; id?: string; children: ReactNode;
}) {
  return (
    <div className={`collapsible ${open ? "open" : ""}`} id={id}>
      {/* The clip belongs on the child: it is the grid *item* that gets squeezed to zero. */}
      <div className="collapsible-inner">{children}</div>
    </div>
  );
}

/** Inline description rendered directly without accordion toggle. */
export function PageDescription({ children }: {
  children: ReactNode;
}) {
  return <div className="page-description">{children}</div>;
}

/** Modal dialog for Description content. Mounts/unmounts completely without leaving DOM artifacts. */
export function DescriptionModal({ open, onClose, children }: {
  open: boolean; onClose: () => void; children: ReactNode;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current === e.target) onClose();
    };
    window.addEventListener("keydown", handleEsc);
    window.addEventListener("click", handleClickOutside);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      window.removeEventListener("click", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="description-modal-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        className="description-modal"
        style={{
          backgroundColor: "var(--bg, #ffffff)",
          borderRadius: "0",
          padding: "40px",
          maxWidth: "720px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          position: "relative",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2)",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "opacity 0.2s, color 0.2s",
            color: "var(--text-dim, #666)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-2, #0a8b97)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-dim, #666)";
          }}
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div style={{ paddingRight: "32px" }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** `desc` renders the collapsible "Description" panel above.
 *
 *  `img` puts a veiled photograph behind the header — the /examples/about hero recipe, shared as
 *  .ex-hero-bg in global.css. It is a backdrop inside the header the page already has, so passing
 *  it changes nothing about the header's size or spacing; omit it and the markup is unchanged. */
export function PageHeader({ title, sub, crumb, desc, img }: {
  title: string; sub?: string; crumb: string; desc?: ReactNode; img?: string;
}) {
  const [descOpen, setDescOpen] = useState(false);

  return (
    <>
      <div className={`page-head${img ? " ex-hero-host" : ""}`} style={{ width: "100%", boxSizing: "border-box" } as any}>
      {img && (
        <div className="ex-hero-bg" style={{ ["--ex-hero-img" as string]: `url("${img}")` }} aria-hidden />
      )}
      <div className="wrap" style={{ maxWidth: "none", margin: "0", padding: "0", boxSizing: "border-box" } as any}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/examples/index1">HOME</a><span className="sep">/</span><span>{crumb.toUpperCase()}</span>
        </nav>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
    </div>

    {desc && (
      <div style={{ width: "100%", padding: "0 clamp(18px, 4vw, 48px)", boxSizing: "border-box", marginBottom: "24px" } as any}>
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            aria-expanded={descOpen}
            onClick={() => setDescOpen(true)}
            style={{
              cursor: 'pointer',
              padding: '12px 16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '0px',
              background: 'rgb(52, 58, 64)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgb(154, 164, 180)',
              transition: 'color 0.2s, background 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            <span>Description</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00c7d6" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
        <DescriptionModal open={descOpen} onClose={() => setDescOpen(false)}>
          <div className="body">{desc}</div>
        </DescriptionModal>
      </div>
    )}
    </>
  );
}
