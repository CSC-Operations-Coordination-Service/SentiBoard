import ProcessorsView from "@/components/ProcessorsView";
import { getProcessors } from "@/lib/data";

export default async function ProcessorsPage() {
  const { rows, win } = await getProcessors();

  return (
    <>
      <div className="page-head"><div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/v1"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg> Home</a>
          <span className="sep">/</span><span className="cur">Processors Releases</span>
        </nav>
        <h1>Processors Releases</h1>
        <p>Every Copernicus Sentinel processor baseline, laid out on one timeline. Missions run as
        horizontal lanes; each dot is a release. The glowing line marks now.</p>
      </div></div>

      <section className="wrap pad">
        <ProcessorsView rows={rows} win={win} />

        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 22, maxWidth: "64ch" }}>
          Click a release dot to inspect it. Dots left of the now marker are past baselines, superseded as newer ones
          enter production; the brightened segment is the baseline currently in force. Products reprocessed under a new
          baseline are flagged in{" "}
          <a style={{ color: "var(--accent-cyan)" }} href="/v1/availability">Data Availability</a>.
        </p>
      </section>
    </>
  );
}
