import Link from "next/link";

// Version picker — the container hosts multiple app versions during development
// (per the migration plan). Each version lives under its own route prefix.
const VERSIONS = [
  {
    href: "/v1",
    label: "v1",
    desc: "First visualization — React / Next.js SSR against the real backend: home, Acquisitions 3D globe (Cesium), Events, Data Availability, Processors.",
  },
];

export default function Landing() {
  return (
    <main className="landing">
      <div className="landing-inner">
        <img src="/assets/img/sentiboard.png" alt="SentiBoard" className="landing-logo" />
        <h1>Copernicus Sentinel Operations Dashboard</h1>
        <p>Development preview — choose a version.</p>
        <div className="landing-versions">
          {VERSIONS.map((v) => (
            <Link key={v.href} href={v.href} className="landing-card">
              <span className="landing-card-tag">{v.label}</span>
              <p>{v.desc}</p>
              <span className="go">Open <span className="arrow">→</span></span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
