import { Suspense } from "react";
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
import s from "@/features/availability/availability.module.css";

// Not ported yet (docs/memory/HANDOFF.md). ROUTES.availability.ported = false.
export const metadata = comingSoonMetadata(ROUTES.availability);

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
        {/* Explorer reads useSearchParams(); Suspense is required for PPR prerendering */}
        <Suspense>
          <Explorer />
        </Suspense>
      </section>
    </>
  );
}
