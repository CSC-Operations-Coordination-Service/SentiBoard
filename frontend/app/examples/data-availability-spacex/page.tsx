import type { Metadata } from "next";
import DataAvailabilitySpaceX from "@/components/DataAvailabilitySpaceX";

// DEVOCS-219 — Data Availability, proposal 3 ("telemetry console"). The route is a thin mount:
// the mock-up is one self-contained client component, including its own themes, so there is
// nothing to wire up here.

export const metadata: Metadata = {
  title: "Data Availability · Telemetry console — mock-up",
  description: "Design proposal 3. Mock data, no backend.",
};

export default function DataAvailabilitySpaceXPage() {
  return <DataAvailabilitySpaceX />;
}
