import PageHeader from "@/components/PageHeader";
import ProcessorsView from "@/components/ProcessorsView";
import { getProcessors } from "@/lib/data";

export default async function ProcessorsPage() {
  const { rows, win } = await getProcessors();

  return (
    <>
      <PageHeader
        title="Processors Releases"
        description={
          <p>Every Copernicus Sentinel processor baseline, laid out on one timeline. Missions run as
          horizontal lanes; each dot is a release. The glowing line marks now.</p>
        }
        breadcrumbs={[
          { label: "Home", href: "/v1" },
          { label: "Processors Releases" },
        ]}
      />

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
