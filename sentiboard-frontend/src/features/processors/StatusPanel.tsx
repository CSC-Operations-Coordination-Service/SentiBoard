/* The page frame shown while the releases load, and by the error boundary: same container, stats
   ("—") and panes as the explorer, with a status message where the timeline goes. */

import type { ReactNode } from "react";
import s from "./processors.module.css";

const STAT_LABELS = ["Processors", "Releases", "Released in the last year", "Latest release"];

export default function StatusPanel({ children }: { children: ReactNode }) {
  return (
    <section className={s.container}>
      <dl className={s.stats}>
        {STAT_LABELS.map((label) => (
          <div key={label} className={s.stat}>
            <dt>{label}</dt>
            <dd>—</dd>
          </div>
        ))}
      </dl>
      <div className={s.split}>
        <section className={s.satpane} aria-hidden="true">
          <div className={s.artGlow}></div>
          <div className={s.art}></div>
        </section>
        <section className={s.procpane}>
          <h2 className={s.phead}>Processors</h2>
          <p className={s.caption}>Release timeline</p>
          {children}
        </section>
        <section className={s.detailpane} aria-hidden="true" />
      </div>
    </section>
  );
}

export function LoadingStatus() {
  return (
    <p className={s.status} role="status">
      <span className={s.statusPulse} aria-hidden="true" />
      Loading processor releases…
    </p>
  );
}
