import { useEffect, useId, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
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

/** `desc` renders the collapsible "Description" panel above.
 *
 *  `img` puts a veiled photograph behind the header — the /examples/about hero recipe, shared as
 *  .ex-hero-bg in global.css. It is a backdrop inside the header the page already has, so passing
 *  it changes nothing about the header's size or spacing; omit it and the markup is unchanged. */
export function PageHeader({ title, sub, crumb, desc, img }: {
  title: string; sub?: string; crumb: string; desc?: ReactNode; img?: string;
}) {
  const [descOpen, setDescOpen] = useState(true);

  return (
    <>
      <style>{`.page-head .page-desc { max-width: none !important; }`}</style>
      <div className={`page-head${img ? " ex-hero-host" : ""}`} style={{ width: "100vw", position: "relative", left: "50%", transform: "translateX(-50%)", boxSizing: "border-box" } as any}>
      {img && (
        <div className="ex-hero-bg" style={{ ["--ex-hero-img" as string]: `url("${img}")` }} aria-hidden />
      )}
      <div className="wrap" style={{ maxWidth: "none", margin: "0", padding: "0 clamp(18px, 4vw, 48px)", boxSizing: "border-box" } as any}>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span>{crumb}</span>
        </nav>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
        {desc && (
          <div className="page-desc">
            <button
              className="page-desc-head"
              onClick={() => setDescOpen(!descOpen)}
              aria-expanded={descOpen}
            >
              <span>Description</span>
              <ChevronDown className="chev" size={14} />
            </button>
            <Collapse open={descOpen}>
              <div className="body">{desc}</div>
            </Collapse>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
