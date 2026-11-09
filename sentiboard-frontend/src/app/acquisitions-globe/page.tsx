import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import PageHeader from "@/components/PageHeader";
import { SITE_NAME, ROUTES } from "@/lib/routes";
import { fmtDate } from "@/lib/missions";
import { getAcquisitions } from "@/features/acquisitions/data";
import { SEO, ACQ_HERO_IMG, ACQ_TITLE, ACQ_SUBTITLE } from "@/features/acquisitions/copy";
import AcquisitionsGlobe from "@/features/acquisitions/AcquisitionsGlobe";
import s from "@/features/acquisitions/acq-globe.module.css";

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
  const now = new Date(); // taken once; Slice 2 passes now.getTime() as nowMs to AcquisitionsGlobe
  const dayKey = fmtDate(now);
  const data = await getAcquisitions(dayKey);
  if (data.datatakes.length === 0) {
    return (
      <section className={s.page}>
        <p className={s.empty}>Acquisition data is not available yet.</p>
      </section>
    );
  }
  return <AcquisitionsGlobe look="stylized" nowMs={now.getTime()} data={data} />;
}

export default function Page() {
  return (
    <>
      <PageHeader title={ACQ_TITLE} subtitle={ACQ_SUBTITLE} img={ACQ_HERO_IMG} />
      <Suspense>
        <AcquisitionsContent />
      </Suspense>
    </>
  );
}
