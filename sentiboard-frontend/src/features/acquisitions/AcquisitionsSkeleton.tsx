import s from "./acq-globe.module.css";

export default function AcquisitionsSkeleton() {
  return (
    <div role="status" className={s.skRoot}>
      <span className="sr-only">Loading acquisitions…</span>

      {/* KPI row — real .kpis / .kpi / .kpiV / .kpiK so height comes from the real font */}
      <div className={s.kpis}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={s.kpi}>
            <b className={`${s.kpiV} ${s.skPulse}`} style={{ display: "inline-block", width: "3ch" }}>&nbsp;</b>
            <span className={`${s.kpiK} ${s.skPulse}`} style={{ display: "inline-block", width: "80%" }}>&nbsp;</span>
          </div>
        ))}
      </div>

      {/* Toolbar — real .toolbar / .tbHeading / .fdrop + modifiers / .fdropHead / .fsearch.
          fdropHead is a <div> (not <button>) so it carries no interactivity;
          aria-hidden suppresses the decorative label text from screen readers. */}
      <div className={s.toolbar}>
        <h2 className={s.tbHeading}>
          <span className={s.skPulse} style={{ display: "inline-block", width: "11ch" }}>&nbsp;</span>
        </h2>

        <div className={`${s.fdrop} ${s.fdropSat}`}>
          <div className={s.fdropHead} aria-hidden={true}>
            <span className={s.fdropLabel}>Satellite</span>
            <span className={`${s.fdropVal} ${s.skPulse}`} style={{ display: "inline-block", width: "3ch" }}>&nbsp;</span>
          </div>
        </div>

        <div className={`${s.fdrop} ${s.fdropDay}`}>
          <div className={s.fdropHead} aria-hidden={true}>
            <span className={s.fdropLabel}>Day of acquisition</span>
            <span className={`${s.fdropVal} ${s.skPulse}`} style={{ display: "inline-block", width: "7ch" }}>&nbsp;</span>
          </div>
        </div>

        <div className={`${s.fdrop} ${s.fdropDtk}`}>
          <div className={s.fdropHead} aria-hidden={true}>
            <span className={s.fdropLabel}>Datatake</span>
            <span className={`${s.fdropVal} ${s.skPulse}`} style={{ display: "inline-block", width: "5ch" }}>&nbsp;</span>
          </div>
        </div>

        <div className={s.fsearch}>
          <span className={s.skPulse} style={{ display: "inline-block", width: "100%" }}>&nbsp;</span>
        </div>
      </div>

      {/* Globe stage — real .stageRow / .globeStage so the height clamp is inherited.
          .skGlobe is a static dim fill (no pulse) to stay more subtle than the other placeholders. */}
      <div className={s.stageRow}>
        <div className={s.globeStage}>
          <div className={s.skGlobe} />
        </div>
      </div>
    </div>
  );
}
