import PageHeader from "@/components/PageHeader";
import AvailabilityView from "@/components/AvailabilityView";
import { getAvailability } from "@/lib/data";
import { AVAILABILITY_DESCRIPTION } from "@/lib/copy";

export default async function AvailabilityPage() {
  const { acq, pub, datatakes } = await getAvailability(); // fetched on the server, falls back to mock

  return (
    <>
      <PageHeader
        title="Data Availability"
        description={AVAILABILITY_DESCRIPTION}
        breadcrumbs={[
          { label: "Home", href: "/v1" },
          { label: "Data Availability" },
        ]}
      />

      <section className="wrap pad">
        <AvailabilityView acq={acq} pub={pub} datatakes={datatakes} />
      </section>
    </>
  );
}
