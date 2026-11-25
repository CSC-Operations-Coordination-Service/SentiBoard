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
          Rows 1+2 always visible — desktop conservative 2-row (items wrap at ~900–1565px),
          and 761–900px explicit 2-row (.rowBreak in the real toolbar).
          ≤760px: 4 rows — heading+tabs | pager | Mission+Status | search+Reset
          (same at ≤480px: heading+tabs stay on one row via .filterGroup flex space-between). */}
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
