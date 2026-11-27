import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import PageHeader from "@/components/PageHeader";
import { SITE_NAME, ROUTES } from "@/lib/routes";
import { fmtDate } from "@/lib/missions";
import { reader } from "@/lib/url-params";
import { getAcquisitions } from "@/features/acquisitions/data";
import { adaptAcquisitions } from "@/features/acquisitions/adapter";
import { resolveAcqDay } from "@/features/acquisitions/acq-day-range";
import { SEO, ACQ_HERO_IMG, ACQ_TITLE, ACQ_SUBTITLE, AcquisitionsDescription } from "@/features/acquisitions/copy";
import AcquisitionsGlobe from "@/features/acquisitions/AcquisitionsGlobe";
import AcquisitionsSkeleton from "@/features/acquisitions/AcquisitionsSkeleton";
import { COPERNICUS_STATIONS } from "@/features/acquisitions/stations";

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

// Pattern from src/app/events/page.tsx:48,53 — PageProps["searchParams"] + reader(params)
async function AcquisitionsContent({
  searchParams,
}: {
  searchParams: PageProps<"/acquisitions-globe">["searchParams"];
}) {
  await connection();
  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = fmtDate(now);
  const params = await searchParams;
  const dayKey = resolveAcqDay(reader(params)("day"), todayKey);
  const result = await getAcquisitions(dayKey);
  if (!result.ok) {
    const notice = result.kind === "unreachable"
      ? "Backend unreachable — acquisition data could not be loaded."
      : "Could not load acquisition data.";
    return (
      <AcquisitionsGlobe
        look="stylized"
        nowMs={nowMs}
        data={{ datatakes: [], stations: COPERNICUS_STATIONS }}
        notice={notice}
        dayKey={dayKey}
        todayKey={todayKey}
      />
    );
  }
  const data = adaptAcquisitions(result, nowMs);
  return <AcquisitionsGlobe look="stylized" nowMs={nowMs} data={data} dayKey={dayKey} todayKey={todayKey} />;
}

export default function Page(props: PageProps<"/acquisitions-globe">) {
  return (
    <>
      <PageHeader title={ACQ_TITLE} subtitle={ACQ_SUBTITLE} img={ACQ_HERO_IMG} desc={<AcquisitionsDescription />} />
      <Suspense fallback={<AcquisitionsSkeleton />}>
        <AcquisitionsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
