interface FilterBarProps {
    satellites: string[];
    selectedSats: string[];
    onToggleSat: (sat: string) => void;
    date: string;
    onDateChange: (date: string) => void;
    onReset: () => void;
    resultCount: number;
}

export default function FilterBar({
    satellites, selectedSats, onToggleSat, date, onDateChange, onReset, resultCount,
}: FilterBarProps) {
    const hasFilters = selectedSats.length > 0 || date !== "";

    return (
        <div className="acq-filterbar">
            <div className="acq-filter-group">
                <span className="acq-filter-label">Satellite</span>
                <div className="acq-filter-chips">
                    {satellites.map((sat) => (
                        <button
                            key={sat}
                            type="button"
                            className={"acq-chip" + (selectedSats.includes(sat) ? " active" : "")}
                            onClick={() => onToggleSat(sat)}
                        >
                            {sat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="acq-filter-group">
                <span className="acq-filter-label">Day of acquisition</span>
                <input
                    type="date"
                    className="acq-filter-date"
                    value={date}
                    onChange={(e) => onDateChange(e.target.value)}
                />
            </div>

            <div className="acq-filter-meta">
                <span>{resultCount} datatake{resultCount === 1 ? "" : "s"}</span>
                {hasFilters && (
                    <button type="button" className="acq-filter-reset" onClick={onReset}>
                        Clear filters
                    </button>
                )}
            </div>

            <style>{`
        .acq-filterbar {
          display: flex; flex-wrap: wrap; align-items: center; gap: 20px;
          padding: 14px 18px; margin-bottom: 16px; border-radius: var(--r-lg);
          background: var(--glass);
          border: 1px solid var(--line);
          backdrop-filter: blur(12px);
        }
        .acq-filter-group { display: flex; align-items: center; gap: 10px; }
        .acq-filter-label {
          font-size: 11px; text-transform: uppercase; letter-spacing: var(--track);
          color: var(--text-mute); white-space: nowrap;
        }
        .acq-filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .acq-chip {
          font: inherit; font-size: 12px; padding: 5px 12px; border-radius: 999px;
          border: 1px solid var(--line-strong); background: var(--pill-bg);
          color: var(--text-dim); cursor: pointer; transition: all .15s var(--ease);
        }
        .acq-chip:hover { border-color: var(--accent-2); color: var(--text); }
        .acq-chip.active {
          background: color-mix(in srgb, var(--accent-2) 16%, transparent);
          border-color: var(--accent-2); color: var(--accent-2);
        }
        .acq-filter-date {
          font: inherit; font-size: 12px; padding: 5px 10px; border-radius: var(--r-sm);
          border: 1px solid var(--line-strong);
          background: var(--bg-3); color: var(--text);
        }
        .acq-filter-meta {
          display: flex; align-items: center; gap: 14px; margin-left: auto;
          font-size: 12px; color: var(--text-mute);
        }
        .acq-filter-reset {
          font: inherit; font-size: 12px; padding: 4px 10px; border-radius: var(--r-sm);
          border: 1px solid color-mix(in srgb, var(--crit) 45%, transparent);
          background: transparent; color: var(--crit); cursor: pointer;
        }
        .acq-filter-reset:hover {
          background: color-mix(in srgb, var(--crit) 12%, transparent);
        }
      `}</style>
        </div>
    );
}
