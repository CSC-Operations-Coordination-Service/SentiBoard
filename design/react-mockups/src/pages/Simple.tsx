import { Link } from "react-router-dom";
import { PageHeader, Reveal } from "@/components/ui";

/** Statistics-style page with a KPI row + chart placeholder. */
export function StatPage({ crumb, title, sub, kpis }: {
  crumb: string; title: string; sub: string; kpis: [string, string, string][];
}) {
  return (
    <>
      <PageHeader crumb={crumb} title={title} sub={sub} />
      <section className="wrap pad">
        <Reveal className="grid cols-4">
          {kpis.map(([k, v, u]) => (
            <div className="card stat" key={k}>
              <span className="k">{k}</span>
              <span className="v">{v}{u && <small>{u}</small>}</span>
            </div>
          ))}
        </Reveal>

        <Reveal className="card" style={{ marginTop: 20, minHeight: 340, display: "flex", flexDirection: "column" }}>
          <div className="section-head" style={{ marginBottom: 20 }}>
            <div><div className="eyebrow">Trend · last 3 months</div><h2 style={{ fontSize: 22 }}>{title}</h2></div>
            <span className="meta">Interactive chart in production</span>
          </div>
          <ChartMock />
        </Reveal>
      </section>
    </>
  );
}

/** Lightweight animated area-chart placeholder (SVG, theme-aware). */
function ChartMock() {
  const pts = [30, 42, 38, 55, 48, 63, 58, 72, 66, 80, 74, 88];
  const w = 100, h = 40;
  const path = pts.map((p, i) => `${(i / (pts.length - 1)) * w},${h - (p / 100) * h}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", flex: 1, minHeight: 200 }}>
      <defs>
        <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${path} ${w},${h}`} fill="url(#cg)" />
      <polyline points={path} fill="none" stroke="var(--accent-2)" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 404 — the only page still on this simple frame; Terms and the Cookie Notice carry real copy now. */
export function NotFoundPage() {
  return (
    <>
      <PageHeader crumb="Not found" title="Page not found" />
      <section className="wrap pad">
        <Reveal style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="stat" style={{ alignItems: "center" }}><span className="v" style={{ fontSize: 72 }}>404</span></div>
          <p style={{ color: "var(--text-dim)" }}>This page could not be found.</p>
          <Link className="btn primary" to="/" style={{ marginTop: 16 }}>Back to Home <span className="arrow">→</span></Link>
        </Reveal>
      </section>
    </>
  );
}
