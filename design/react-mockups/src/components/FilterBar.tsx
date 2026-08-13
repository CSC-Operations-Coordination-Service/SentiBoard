import { useId, useMemo, useState } from "react";

interface FilterBarProps {
    satellites: string[];
    selectedSats: string[];
    onToggleSat: (sat: string) => void;
    date: string;
    onDateChange: (date: string) => void;
    onReset: () => void;
    resultCount: number;
    /** Every day that actually has acquisitions, as YYYY-MM-DD. Drives the picker bounds. */
    coveredDates: string[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FilterBar({
    satellites, selectedSats, onToggleSat, date, onDateChange, onReset, resultCount, coveredDates,
}: FilterBarProps) {
    const hasFilters = selectedSats.length > 0 || date !== "";
    const uid = useId();
    const satLabelId = `${uid}-sat`;
    const [note, setNote] = useState("");

    // Coverage bounds for the picker: never offer a day before the first acquisition,
    // and never offer a future day — the upper bound is the last covered day, or today
    // if the dataset happens to run ahead of it.
    const coverage = useMemo(() => {
        const days = Array.from(new Set(coveredDates.filter(Boolean))).sort();
        const last = days[days.length - 1];
        return {
            days,
            set: new Set(days),
            min: days[0] ?? "",
            max: !last ? todayISO() : last < todayISO() ? last : todayISO(),
        };
    }, [coveredDates]);

    // A day inside the bounds can still be empty (a gap between passes). Rather than
    // dropping the user into a "no results" view, snap to the nearest covered day and
    // say so — the filter never lands on a date the globe cannot show.
    const nearestCovered = (wanted: string) => {
        let best = coverage.days[0];
        let bestGap = Infinity;
        for (const d of coverage.days) {
            const gap = Math.abs(Date.parse(d) - Date.parse(wanted));
            if (gap < bestGap) { bestGap = gap; best = d; }
        }
        return best;
    };

    const handleDate = (value: string) => {
        if (!value) { setNote(""); onDateChange(""); return; }
        if (coverage.set.has(value)) { setNote(""); onDateChange(value); return; }
        const near = nearestCovered(value);
        if (!near) { setNote("No acquisitions are available to filter."); return; }
        setNote(`No acquisitions on ${value} — showing the nearest covered day, ${near}.`);
        onDateChange(near);
    };

    return (
        <div className="acq-filterbar">
            <div className="acq-filter-group" role="group" aria-labelledby={satLabelId}>
                <span className="acq-filter-label" id={satLabelId}>Satellite</span>
                <div className="acq-filter-chips">
                    {satellites.map((sat) => (
                        <button
                            key={sat}
                            type="button"
                            className={"acq-chip" + (selectedSats.includes(sat) ? " active" : "")}
                            aria-pressed={selectedSats.includes(sat)}
                            onClick={() => onToggleSat(sat)}
                        >
                            {sat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="acq-filter-group">
                <label className="acq-filter-label" htmlFor={`${uid}-date`}>Day of acquisition</label>
                <input
                    id={`${uid}-date`}
                    type="date"
                    className="acq-filter-date"
                    value={date}
                    min={coverage.min || undefined}
                    max={coverage.max || undefined}
                    aria-describedby={`${uid}-coverage`}
                    onChange={(e) => handleDate(e.target.value)}
                />
                <span className="sr-only" id={`${uid}-coverage`}>
                    {coverage.min
                        ? `Acquisitions are available from ${coverage.min} to ${coverage.max}. Days without acquisitions snap to the nearest covered day.`
                        : "No acquisition days are available."}
                </span>
            </div>

            <div className="acq-filter-meta">
                <span>{resultCount} datatake{resultCount === 1 ? "" : "s"}</span>
                {hasFilters && (
                    <button type="button" className="acq-filter-reset" onClick={() => { setNote(""); onReset(); }}>
                        Clear filters
                    </button>
                )}
            </div>

            <p className="acq-filter-note" role="status" aria-live="polite">{note}</p>

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
        .acq-filterbar :focus-visible { outline: 2px solid var(--accent-2); outline-offset: 2px; }
        /* Coverage feedback sits on its own row so appearing and disappearing never
           reflows the controls above it. Empty until there is something to say. */
        .acq-filter-note {
          flex-basis: 100%; margin: 0; min-height: 0;
          font-size: 12px; color: var(--warn);
        }
        .acq-filter-note:empty { display: none; }

        @media (max-width: 780px) {
          .acq-filterbar { gap: 14px; padding: 12px 14px; }
          .acq-filter-meta { margin-left: 0; flex-basis: 100%; }
        }
        @media (max-width: 560px) {
          .acq-filterbar { align-items: flex-start; gap: 12px; }
          .acq-filter-group { flex-direction: column; align-items: flex-start; gap: 6px; flex-basis: 100%; }
        }
      `}</style>
        </div>
    );
}
