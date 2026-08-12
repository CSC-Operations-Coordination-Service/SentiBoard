import AvailabilityView from "@/components/AvailabilityView";
import PageDescription from "@/components/PageDescription";
import { getAvailability } from "@/lib/data";
import { AVAILABILITY_DESCRIPTION, AVAILABILITY_SUMMARY } from "@/lib/copy";

export default async function AvailabilityPage() {
  const { acq, pub, datatakes } = await getAvailability(); // fetched on the server, falls back to mock

  return (
    <>
      <div className="page-head"><div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/v1"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg> Home</a>
          <span className="sep">/</span><span className="cur">Data Availability</span>
        </nav>
        <h1>Data Availability</h1>
        <PageDescription>{AVAILABILITY_DESCRIPTION}</PageDescription>
      </div></div>

      <section className="wrap pad">
        <AvailabilityView acq={acq} pub={pub} datatakes={datatakes} />
      </section>
    </>
  );
}
