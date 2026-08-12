import type { Metadata } from "next";
import EventsManifest from "./EventsManifest";

// DEVOCS-219 — Events page proposal. The page stays a server component so it can carry metadata;
// all the interaction lives in the client component it renders.

export const metadata: Metadata = {
  title: "Events · Mission Manifest — SentiBoard v2",
  description: "Design proposal: month grid with a Day Manifest drawer. Not the production page.",
};

export default function EventsManifestPage() {
  return <EventsManifest />;
}
