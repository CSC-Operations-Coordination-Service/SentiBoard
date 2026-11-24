import s from "./events.module.css";

const METRIC_LABELS = [
  "Events this month",
  "Datatakes in scope",
  "Lost datatakes",
  "Satellites monitored",
] as const;

export default function EventsSkeleton() {
  const cells = Array.from({ length: 35 });

  return (
    <div role="status" className={`${s.page} ${s.skRoot}`}>
      <span className="sr-only">Loading events…</span>

      <div className={s.inner}>
        {/* 4 metric tiles — mirrors <Metric> × 4 at Explorer.tsx:855-858 */}
        <div className={s.metrics}>
          {METRIC_LABELS.map((label) => (
            <div key={label} className={s.metric}>
              <span className={`${s.metricValue} ${s.skPulse}`}>&nbsp;</span>
              <span className={s.metricLabel}>{label}</span>
            </div>
          ))}
        </div>

        {/* Month bar — real classes so real CSS breakpoints (1140px nowrap, 760px column) apply */}
        <div className={s.monthBar}>
          {/* Month nav — mirrors Explorer.tsx:864-872; placeholder text hidden but takes space */}
          <div className={s.monthNav}>
            <span aria-hidden style={{ display: "grid", placeItems: "center", width: 34, height: 40 }} />
            <span className={s.monthLabel} style={{ visibility: "hidden" }}>November 2026</span>
            <span aria-hidden style={{ display: "grid", placeItems: "center", width: 34, height: 40 }} />
          </div>
          <div className={s.barFilters}>
            <div className={s.fdrop}><div className={`${s.skPulse} ${s.skFdrop}`} /></div>
            <div className={s.fdrop}><div className={`${s.skPulse} ${s.skFdrop}`} /></div>
            <div className={s.fdrop}><div className={`${s.skPulse} ${s.skFdrop}`} /></div>
            <div className={s.inline}><div className={`${s.skPulse} ${s.skInline}`} /></div>
          </div>
          {/* Reset: position:absolute at ≥761px (no flow); position:static min-height:44px at ≤760px */}
          <span className={s.reset} aria-hidden />
        </div>

        {/* Calendar — real calRow/calWrap/grid; zodiac reproduced with aspect-ratio pulse */}
        <div className={s.calRow}>
          <aside className={s.zodiac} aria-hidden>
            <div className={`${s.skPulse} ${s.skZodiac}`} />
          </aside>
          <div className={s.calWrap}>
            <div className={s.grid}>
              {cells.map((_c, i) => (
                <div key={i} className={`${s.cell} ${s.skCell}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
