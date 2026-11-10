import type { AcqDatatake } from "./types";
import { missingSeconds } from "./model";
import s from "./acq-globe.module.css";

const PILL_COLOR: Record<string, string> = {
  Published: "#00e676",
  Processing: "#9d4edd",
  Failed: "#ff3366",
};

function fmtSeconds(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = Math.round(sec % 60);
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

// Deterministic: adds `sec` seconds to an ISO string. Does not use Date.now().
function addSeconds(iso: string, sec: number): string {
  const ms = Date.parse(iso) + Math.round(sec) * 1000;
  return new Date(ms).toISOString().slice(11, 19) + "Z";
}

export default function DatatakePanel({
  dt,
  onClose,
}: {
  dt: AcqDatatake;
  onClose: () => void;
}) {
  const color = PILL_COLOR[dt.status] ?? "#737373";
  const missingSec = missingSeconds(dt.levels, dt.sensingS);
  const productCount = dt.levels.reduce(
    (n, lv) => n + lv.products.filter((p) => p.pct !== null).length,
    0,
  );
  const startTime = dt.startIso.slice(11, 19) + "Z";
  const stopTime = addSeconds(dt.startIso, dt.sensingS);

  return (
    <div className={s.dtkBlock}>
      <div className={s.dtkHead}>
        <span className={s.eyebrow}>Datatake</span>
        <div className={s.acqHeadR}>
          <span className={s.pill} style={{ color }}>
            {dt.status}
          </span>
          <button
            type="button"
            className={s.acqClose}
            aria-label="Close datatake panel"
            onClick={onClose}
          >
            ×
          </button>
        </div>
      </div>

      <strong className={s.dtkId}>{dt.id}</strong>
      <span className={s.mission}>{dt.unit}</span>

      <div className={s.dtkKpi}>
        <b className={s.big}>
          {dt.comp.toFixed(1)}
          <sup>%</sup>
        </b>
        <span className={s.dtkKpiLabel}>complete</span>
        {productCount > 0 && (
          <span className={s.dtkKpiNote}>
            {productCount} expected product type{productCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <dl className={s.dtkAside}>
        <dt>Sensing</dt>
        <dd>{fmtSeconds(dt.sensingS)}</dd>
        <dt>Missing</dt>
        <dd className={missingSec > 0.5 ? s.gap : ""}>
          {missingSec > 0.5 ? fmtSeconds(missingSec) : "none"}
        </dd>
      </dl>

      <dl className={s.acqRecord}>
        <div>
          <dt>Acq start</dt>
          <dd>{startTime}</dd>
        </div>
        <div>
          <dt>Acq stop</dt>
          <dd>{stopTime}</dd>
        </div>
        <div>
          <dt>Abs orbit</dt>
          <dd>{dt.absOrbit || "NA"}</dd>
        </div>
        <div>
          <dt>Rel orbit</dt>
          <dd>NA</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{dt.mode || "NA"}</dd>
        </div>
        <div>
          <dt>Station</dt>
          <dd>{dt.station || "NA"}</dd>
        </div>
      </dl>
    </div>
  );
}
