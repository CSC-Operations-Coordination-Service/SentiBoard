import { Link } from "react-router-dom";
import { PageHeader, Reveal } from "@/components/ui";
import { NEWS } from "@/data/mock";

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

const TERMS = `These Terms & Conditions govern the use of the Copernicus Sentinel Operations Dashboard (SentiBoard). The dashboard is provided for informational purposes to support research and development activities. Data is offered on a best-effort basis in line with the Copernicus Data Policy: free, full and open access. While every effort is made to keep information accurate and up to date, no warranty is given as to completeness or fitness for a particular purpose. By using this dashboard you agree to attribute Copernicus / ESA as the source of any reused data.`;

const COOKIE = `SentiBoard uses a minimal set of cookies strictly necessary for the dashboard to function, plus optional analytics cookies to help us understand how the dashboard is used. No personal data is sold or shared with third parties. You can accept or reject optional cookies at any time using the control below.`;

/** News list / legal text / 404 — all share the same simple page frame. */
export function SimplePage({ crumb, title, kind }: {
  crumb: string; title: string; kind: "news" | "terms" | "cookie" | "404";
}) {
  return (
    <>
      <PageHeader crumb={crumb} title={title} />
      <section className="wrap pad">
        {kind === "news" && (
          <div className="grid cols-2">
            {NEWS.map((n, i) => (
              <Reveal key={i}>
                <article className="card">
                  <div className="nmeta" style={{ marginBottom: 10 }}>{n.published}</div>
                  <h3 style={{ fontSize: 18, marginBottom: 10 }}>{n.title}</h3>
                  <p>{n.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        )}
        {kind === "terms" && <Reveal className="card"><p style={{ color: "var(--text-dim)", maxWidth: "80ch" }}>{TERMS}</p></Reveal>}
        {kind === "cookie" && (
          <Reveal className="card" style={{ maxWidth: 720 }}>
            <p style={{ color: "var(--text-dim)" }}>{COOKIE}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button className="btn primary">Accept all</button>
              <button className="btn">Necessary only</button>
            </div>
          </Reveal>
        )}
        {kind === "404" && (
          <Reveal style={{ textAlign: "center", padding: "60px 0" }}>
            <div className="stat" style={{ alignItems: "center" }}><span className="v" style={{ fontSize: 72 }}>404</span></div>
            <p style={{ color: "var(--text-dim)" }}>This page could not be found.</p>
            <Link className="btn primary" to="/" style={{ marginTop: 16 }}>Back to Home <span className="arrow">→</span></Link>
          </Reveal>
        )}
      </section>
    </>
  );
}
