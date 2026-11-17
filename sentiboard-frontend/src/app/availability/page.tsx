import { Suspense } from "react";
import { connection } from "next/server";
import { comingSoonMetadata } from "@/components/ComingSoon";
import { ROUTES } from "@/lib/routes";
import PageHeader from "@/components/PageHeader";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import {
  AVAILABILITY_DESCRIPTION,
  AVAILABILITY_HERO_IMG,
  AVAILABILITY_SUBTITLE,
} from "@/features/availability/copy";
import Explorer from "@/features/availability/Explorer";
import { getDatatakes } from "@/features/availability/data";
import { computeDataWindow, fmtDate } from "@/features/availability/model";
import s from "@/features/availability/availability.module.css";

// Not ported yet (docs/memory/HANDOFF.md). ROUTES.availability.ported = false.
export const metadata = comingSoonMetadata(ROUTES.availability);

// Async server component: opts into dynamic rendering via connection() so `now`
// is the actual request time, not the build-time snapshot. getDatatakes() is cached per day.
async function AvailabilityData() {
  await connection();
  const now = new Date();
  const result = await getDatatakes(fmtDate(now));
  const { windowStart, windowLast } = computeDataWindow(now);
  const notice = result.ok
    ? undefined
    : result.kind === "unreachable"
      ? "Backend unreachable — datatake data could not be loaded."
      : "Could not load datatake data.";
  return (
    <Explorer
      datatakes={result.ok ? result.datatakes : []}
      windowStart={windowStart}
      windowLast={windowLast}
      notice={notice}
    />
  );
}

export default function Page() {
  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title="Data Availability"
          subtitle={AVAILABILITY_SUBTITLE}
          description={AVAILABILITY_DESCRIPTION}
          img={AVAILABILITY_HERO_IMG}
        />
      </div>

      <section className={s.page}>
        <SpaceBackdrop page={1} />
        {/* AvailabilityData calls connection() so it renders per-request, not at build time.
            Explorer reads useSearchParams(); Suspense is required for PPR prerendering. */}
        <Suspense>
          <AvailabilityData />
        </Suspense>
      </section>
    </>
  );
}
