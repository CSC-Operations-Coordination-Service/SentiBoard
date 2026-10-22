"use client";

/* Last-resort boundary for the Processors page. Backend failures do not land here (the page
   renders its own degraded state); this catches anything unexpected, in the same style. */

import { useEffect } from "react";
import PageHeader from "@/components/PageHeader";
import s from "@/features/processors/processors.module.css";
import StatusPanel from "@/features/processors/StatusPanel";
import {
  PROCESSORS_HERO_IMG,
  PROCESSORS_SUBTITLE,
  PROCESSORS_TITLE,
} from "@/features/processors/copy";

export default function ProcessorsError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title={PROCESSORS_TITLE}
          subtitle={PROCESSORS_SUBTITLE}
          img={PROCESSORS_HERO_IMG}
        />
      </div>
      <StatusPanel>
        <div className={s.statusError} role="alert">
          <p className={s.statusTitle}>Could not load processor releases</p>
          <p className={s.statusText}>Something went wrong while showing this page.</p>
          <button type="button" className={s.retry} onClick={() => retry()}>
            Try again
          </button>
        </div>
      </StatusPanel>
    </>
  );
}
