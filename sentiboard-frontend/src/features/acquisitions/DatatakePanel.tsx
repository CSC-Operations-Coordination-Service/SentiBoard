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

// YYYY-MM-DDTHH:MM:SS without timezone suffix (mock-up AcquisitionsGlobeEarth.tsx line 481)
function noZone(iso: string): string {
  return new Date(iso).toISOString().slice(0, 19);
}

// Add seconds to a noZone ISO string and return another noZone string (mock-up line 181)
function isoPlus(start: string, addSec: number): string {
  return new Date(Date.parse(start + "Z") + Math.round(addSec) * 1000).toISOString().slice(0, 19);
}

const STATION_CODE: Record<string, string> = {
  Svalbard: "SGS",
  Matera: "MTI",
  Maspalomas: "MPS",
  Inuvik: "INU",
  Neustrelitz: "NSG",
};

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

  // F5 row data (mock-up AcquisitionsGlobeEarth.tsx lines 213–265)
  const start = noZone(dt.startIso);
  const isS1 = dt.unit.startsWith("S1");
  const modeParts = (dt.mode ?? "").split("·").map((p) => p.trim()).filter(Boolean);
  const mode = (isS1 ? modeParts[0] : (modeParts[1] ?? modeParts[0])) ?? "NA";
  const pol = isS1 ? (modeParts[1] ?? "NA") : "NA";
  const orbit = dt.absOrbit ? String(Number(dt.absOrbit)) : "NA";
  const failed = dt.status === "Failed";
  const acqStatus = `${failed ? "Failed" : "Acquired"} (${(failed ? 0 : 100).toFixed(2)}%)`;
  const pubStatus = `${failed ? "Not published" : dt.status} (${dt.comp.toFixed(2)}%)`;
  const stCode = dt.station ? (STATION_CODE[dt.station] ?? "") : "";
  const stationLabel = dt.station
    ? `${dt.station}${stCode ? ` (${stCode})` : ""}`
    : "NA";

  const rows: [string, string][] = [
    ["Satellite ID", dt.unit || "NA"],
    ["Datatake ID", dt.id],
    ["Mode", mode],
    ["Swath", "NA"],
    ["Polarisation", pol],
    ["Observation time start", start],
    ["Observation time stop", isoPlus(start, dt.sensingS)],
    ["Observation duration", `${Math.round(dt.sensingS)} s`],
    ["Orbit absolute", orbit],
    ["Orbit relative", "NA"],
    ["Acquisition status", acqStatus],
    ["Publication status", pubStatus],
    ["Downlink station", stationLabel],
    ["Downlink time", "NA"],
    ["Downlink volume", "NA"],
  ];

  return (
    <div className={s.dtkBlock}>
      <div className={s.dtkHead}>
        <span className={s.eyebrow}>Datatake</span>
        <div className={s.acqHeadR}>
          <span className={s.pill} style={{ color }}>
            {dt.status}
          </span>
          {/* F6: SVG close icon, no border/background (mock-up AcquisitionsGlobeEarth.tsx lines 279–298) */}
          <button
            type="button"
            className={s.acqClose}
            aria-label="Close datatake"
            onClick={onClose}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      <strong className={s.dtkId}>{dt.id}</strong>
      <span className={s.mission}>{dt.unit}</span>

      {/* F4: big % beside sensing/missing horizontally (mock-up acq-globe.module.css line 806–811) */}
      <div className={s.dtkKpi}>
        <b className={s.big}>
          {dt.comp.toFixed(1)}
          <sup>%</sup>
        </b>
        <dl className={s.dtkAside}>
          <div>
            <dt>Sensing</dt>
            <dd>{fmtSeconds(dt.sensingS)}</dd>
          </div>
          <div>
            <dt>Missing</dt>
            <dd className={missingSec > 0.5 ? s.gap : ""}>
              {missingSec > 0.5 ? fmtSeconds(missingSec) : "none"}
            </dd>
          </div>
        </dl>
      </div>
      {productCount > 0 && (
        <p className={s.dtkNote}>
          Mean across {productCount} expected product type{productCount !== 1 ? "s" : ""} · missing time summed across types
        </p>
      )}

      {/* F5: 15 record rows matching mock-up (AcquisitionsGlobeEarth.tsx lines 227–265) */}
      <dl className={s.acqRecord}>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
