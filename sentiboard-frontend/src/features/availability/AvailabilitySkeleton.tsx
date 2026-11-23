import s from "./availability.module.css";

export default function AvailabilitySkeleton() {
  return (
    <div role="status" className={s.skRoot}>
      <span className="sr-only">Loading datatakes…</span>

      {/* KPI row — reuses .counters and .counter; breakpoint overrides are inherited */}
      <div className={s.counters}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={s.counter}>
            <span className={`${s.skPulse} ${s.skKpiVal}`} />
            <span className={`${s.skPulse} ${s.skKpiKey}`} />
          </div>
        ))}
      </div>

      {/* Toolbar placeholder:
          Rows 1+2 always visible — desktop conservative 2-row (items can wrap at ~900–1100px),
          and 761–900px explicit 2-row (.rowBreak in the real toolbar).
          Row 3 shown at ≤760px (.fhead gets width:100%, heading takes its own row → 3 rows).
          Row 4 shown at ≤480px (4 rows: heading+tabs, pager, mission+status, search+reset). */}
      <div className={s.skToolbar}>
        <div className={`${s.skPulse} ${s.skToolbarRow}`} />
        <div className={`${s.skPulse} ${s.skToolbarRow} ${s.skToolbarRow2}`} />
        <div className={`${s.skPulse} ${s.skToolbarRow} ${s.skToolbarRow3}`} />
        <div className={`${s.skPulse} ${s.skToolbarRow} ${s.skToolbarRow4}`} />
      </div>

      {/* Lane strips — reuses .panel, .mapInner, .mapRow, .lane, .track, .mapLabel */}
      <div className={s.panel}>
        <div className={s.mapInner}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${s.mapRow}${i === 3 ? ` ${s.skLastRow}` : ""}`}>
              <div className={`${s.mapLabel} ${s.skPulse} ${s.skLabelBar}`} />
              <div className={s.lane}>
                <div className={`${s.track} ${s.skPulse} ${s.skTrack}`} />
              </div>
              <div className={s.axis} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
