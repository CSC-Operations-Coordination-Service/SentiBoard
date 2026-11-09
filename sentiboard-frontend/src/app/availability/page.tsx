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
import { generateMockData, getMockWindow } from "@/features/availability/mock-data";
import s from "@/features/availability/availability.module.css";

// Not ported yet (docs/memory/HANDOFF.md). ROUTES.availability.ported = false.
export const metadata = comingSoonMetadata(ROUTES.availability);

// Async server component: opts into dynamic rendering via connection() so `now`
// is the actual request time, not the build-time snapshot. Session 5 replaces
// generateMockData with the real API call in this same component.
async function AvailabilityData() {
  await connection();
  const now = new Date();
  const datatakes = generateMockData(now);
  const { start: windowStart, last: windowLast } = getMockWindow(now);
  return (
    <Explorer
      datatakes={datatakes}
      windowStart={windowStart}
      windowLast={windowLast}
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
