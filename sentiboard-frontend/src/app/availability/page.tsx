import { comingSoonMetadata } from "@/components/ComingSoon";
import { ROUTES } from "@/lib/routes";
import PageHeader from "@/components/PageHeader";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import { Reveal } from "@/components/Reveal";
import {
  AVAILABILITY_DESCRIPTION,
  AVAILABILITY_HERO_IMG,
  AVAILABILITY_SUBTITLE,
} from "@/features/availability/copy";
import s from "@/features/availability/availability.module.css";

// Not ported yet (docs/memory/HANDOFF.md). ROUTES.availability.ported = false.
export const metadata = comingSoonMetadata(ROUTES.availability);

const RANGES = [
  { id: 1, label: "1D" },
  { id: 7, label: "7D" },
  { id: 30, label: "30D" },
  { id: null, label: "Custom" },
] as const;

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

        <Reveal className={s.counters}>
          <div className={s.counter}>
            <span className={s.counterV}>0</span>
            <span className={s.counterK}>Datatakes in range</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterV}>&#8212;</span>
            <span className={s.counterK}>Mean completeness</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterV}>0</span>
            <span className={s.counterK}>Coverage gaps</span>
          </div>
          <div className={s.counter}>
            <span className={`${s.counterV} ${s.crit}`}>0</span>
            <span className={s.counterK}>Datatakes lost</span>
          </div>
        </Reveal>

        <div className={s.filters}>
          <div className={s.filterGroup}>
            <div className={s.fhead}>
              <h2>Last 30 days</h2>
            </div>
            <div className={s.frange} role="group" aria-label="Time range">
              {RANGES.map((r) => (
                <button
                  key={String(r.id)}
                  type="button"
                  aria-pressed={r.id === 30}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
