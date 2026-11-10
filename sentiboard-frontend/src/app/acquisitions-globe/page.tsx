import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import PageHeader from "@/components/PageHeader";
import { SITE_NAME, ROUTES } from "@/lib/routes";
import { fmtDate } from "@/lib/missions";
import { getAcquisitions } from "@/features/acquisitions/data";
import { adaptAcquisitions } from "@/features/acquisitions/adapter";
import { SEO, ACQ_HERO_IMG, ACQ_TITLE, ACQ_SUBTITLE, AcquisitionsDescription } from "@/features/acquisitions/copy";
import AcquisitionsGlobe from "@/features/acquisitions/AcquisitionsGlobe";

// Not ported yet (docs/memory/HANDOFF.md). ROUTES.acquisitionsGlobe.ported = false.
// Canonical points to the Earth variant — same content, different globe look.
export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  robots: { index: false, follow: true },
  alternates: { canonical: ROUTES.acquisitionsEarth.path },
  openGraph: {
    siteName: SITE_NAME,
    title: SEO.title,
    description: SEO.description,
    type: "website",
    url: ROUTES.acquisitionsEarth.path,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    site: "@sentinelonline_",
    creator: "@sentinelonline_",
    title: SEO.title,
    description: SEO.description,
  },
};

async function AcquisitionsContent() {
  await connection();
  const now = new Date();
  const nowMs = now.getTime();
  const dayKey = fmtDate(now);
  const { datatakes, stations } = await getAcquisitions(dayKey);
  const data = adaptAcquisitions({ datatakes, stations }, dayKey);
  return <AcquisitionsGlobe look="stylized" nowMs={nowMs} data={data} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title={ACQ_TITLE} subtitle={ACQ_SUBTITLE} img={ACQ_HERO_IMG} desc={<AcquisitionsDescription />} />
      <Suspense>
        <AcquisitionsContent />
      </Suspense>
    </>
  );
}
