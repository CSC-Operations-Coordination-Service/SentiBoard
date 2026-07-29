import type { RtEvent } from "@/lib/data";

// Presentational: renders the impacting anomalies from the last 24h (server-fetched).
// error=true → backend unreachable (show an error, not fake data).
// empty + no error → "Nominal operations" indicator, like prod.
export default function RealtimeFeed({ items, error }: { items: RtEvent[]; error?: boolean }) {
  return (
    <aside className="hpanel reveal">
      <div className="ph"><h3>Real-time events</h3></div>
      <div className="pbody">
        {error ? (
          <div className="rt-nominal err">⚠ Real-time events unavailable — backend not reachable.</div>
        ) : items.length === 0 ? (
          <div className="rt-nominal">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="currentColor" />
              <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Nominal operations
          </div>
        ) : (
          <ul className="rt">
            {items.map((e, i) => (
              <li key={i} className={e.cls}>
                <div className="rt-text" dangerouslySetInnerHTML={{ __html: e.html }} />
                <div className="rt-time">{e.timeAgo}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
