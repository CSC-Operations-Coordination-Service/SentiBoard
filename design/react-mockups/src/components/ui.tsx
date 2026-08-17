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

/** The "Description" panel under a page title, carried over from the legacy dashboard's
 *  <div id="accordion"> card. That markup needed Bootstrap's data-toggle="collapse" and therefore
 *  jQuery at runtime; here the open flag is React state and the slide is CSS, so the behaviour
 *  survives with no third-party JS.
 *
 *  Open by default: the guidance is worth reading on arrival, so collapsing is the deliberate act,
 *  not expanding. */
export function PageDescription({ children, title = "Description", defaultOpen = true }: {
  children: ReactNode; title?: string; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <div className="page-desc">
      <button
        type="button"
        className="page-desc-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        {title}
        <ChevronDown className="chev" size={15} aria-hidden />
      </button>
      <Collapse open={open} id={bodyId}>
        <div className="body">{children}</div>
      </Collapse>
    </div>
  );
}

/** `desc` renders the collapsible "Description" panel above. */
export function PageHeader({ title, sub, crumb, desc }: {
  title: string; sub?: string; crumb: string; desc?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span>{crumb}</span>
        </nav>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
        {desc && <PageDescription>{desc}</PageDescription>}
      </div>
    </div>
  );
}
