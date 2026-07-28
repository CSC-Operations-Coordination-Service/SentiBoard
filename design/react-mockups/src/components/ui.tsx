import { useEffect, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Status } from "@/data/mock";

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

const LABELS: Record<Status, string> = {
  nominal: "Nominal", degraded: "Degraded", critical: "Critical", info: "Processing", neutral: "Planned",
};

export function Pill({ status, label }: { status: Status; label?: string }) {
  return <span className={`pill ${status}`}><span className="dot" />{label ?? LABELS[status]}</span>;
}

export function PageHeader({ title, sub, crumb }: { title: string; sub?: string; crumb: string }) {
  return (
    <div className="page-head">
      <div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span className="sep">/</span><span>{crumb}</span>
        </nav>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
    </div>
  );
}
