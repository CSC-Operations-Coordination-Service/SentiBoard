import type { AcqDatatake } from "@/data/mock";

const DERIVED_MESSAGE = "Plan derived by SentiBoard from orbit and datatake data.";

export default function KmlLinkDisplay({ datatake }: { datatake: AcqDatatake }) {
  const isSentinel1or2 = datatake.unit.startsWith("S1") || datatake.unit.startsWith("S2");

  if (isSentinel1or2 && datatake.kmlLink) {
    return (
      <div className="kml-link-container">
        <span className="kml-label">Official source:</span>
        <a
          href={datatake.kmlLink.url}
          target="_blank"
          rel="noopener noreferrer"
          className="kml-link"
          title={`Download KML: ${datatake.kmlLink.filename}`}
        >
          {datatake.kmlLink.filename}
          <span className="kml-icon" aria-label="opens in new tab">↗</span>
        </a>
      </div>
    );
  }

  if (!isSentinel1or2) {
    return (
      <div className="kml-link-container kml-derived">
        <span className="kml-label">Coverage:</span>
        <span className="kml-notice">{DERIVED_MESSAGE}</span>
      </div>
    );
  }

  return null;
}
