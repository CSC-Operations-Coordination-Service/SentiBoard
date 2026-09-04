import { useCallback, useMemo, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_LOG_DESCRIPTION } from "@/data/copy";
import {
  FEED_BOUNDS, MISSION_ORDER, RELEASE_FEED,
  type MissionId, type ReleaseRecord,
  filterFeed, tally,
} from "./mock";
import s from "./log.module.css";

type MissionFilter = "All" | MissionId;

/** Timeline visualization component showing releases as dots with processor chips below. */
function TimelineView({ entries, selectedDate, onDateSelect }: { entries: ReleaseRecord[]; selectedDate: number | null; onDateSelect: (date: number | null) => void }) {
  if (entries.length === 0) return null;

  const minDate = Math.min(...entries.map((e) => e.ms));
  const maxDate = Math.max(...entries.map((e) => e.ms));
  const span = maxDate - minDate || 1;

  // Group entries by date for positioning
  const byDate = new Map<number, ReleaseRecord[]>();
  for (const entry of entries) {
    const key = entry.ms;
    byDate.set(key, [...(byDate.get(key) ?? []), entry]);
  }

  const sortedDates = Array.from(byDate.keys()).sort((a, b) => a - b);

  return (
    <div className={s.timelineContainer}>
      <div className={s.timelineWrapper}>
        {/* Timeline axis */}
        <svg className={s.timelineAxis} viewBox="0 0 1000 40" preserveAspectRatio="none">
          <line x1="0" y1="20" x2="1000" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          {sortedDates.map((date) => {
            const xPercent = ((date - minDate) / span) * 100;
            return (
              <g key={date}>
                <line x1={`${xPercent}%`} y1="15" x2={`${xPercent}%`} y2="25" stroke="currentColor" opacity="0.3" />
              </g>
            );
          })}
        </svg>

        {/* Release events */}
        <div className={s.timelineEvents} style={{ minWidth: `${Math.max(100, span / (maxDate - minDate) * 100)}%` }}>
          {sortedDates.map((date) => {
            const xPercent = ((date - minDate) / span) * 100;
            const releases = byDate.get(date)!;
            const isSelected = selectedDate === date;

            return (
              <button
                key={date}
                className={`${s.timelineEvent} ${isSelected ? s.selected : ""}`}
                style={{ left: `${xPercent}%` }}
                onClick={() => onDateSelect(isSelected ? null : date)}
                type="button"
                aria-pressed={isSelected}
              >
                <div className={s.eventDot} title={new Date(date).toLocaleDateString()} />
                <div className={s.eventLabel}>
                  <span className={s.eventDate}>{new Date(date).toLocaleDateString()}</span>
                  <div className={s.processorChips}>
                    {releases.map((rel) => (
                      <span key={`${rel.ipf}-${rel.baseline}`} className={s.procChip} title={`${rel.label} v${rel.baseline}`}>
                        {rel.label}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Details below timeline - only show when a date is selected */}
      {selectedDate && (
        <div className={s.timelineDetails}>
          {byDate.has(selectedDate) && (
            <div className={s.dateSection}>
              <div className={s.dateHeader}>
                <h3 className={s.dateTitle}>{new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</h3>
                <button
                  className={s.closeDetails}
                  onClick={() => onDateSelect(null)}
                  type="button"
                  aria-label="Close details"
                >
                  ✕
                </button>
              </div>
              {byDate.get(selectedDate)!.map((rel) => (
                <div key={`${rel.ipf}-${rel.baseline}`} className={s.releaseCard}>
                  <div className={s.cardHead}>
                    <span className={s.cardProc}>{rel.label}</span>
                    <span className={s.cardVersion}>{rel.baseline}</span>
                  </div>
                  <div className={s.cardSub}>{rel.sub}</div>
                  {rel.notes ? (
                    <div className={s.cardNotes}>
                      {rel.notes
                        .split("\n")
                        .filter((line) => line.trim() !== "")
                        .map((line, i) => (
                          <p key={i} className={line.startsWith("• ") ? s.cardBullet : undefined}>
                            {line.replace(/^•\s*/, "")}
                          </p>
                        ))}
                    </div>
                  ) : (
                    <p className={s.noNotes}>No release notes published</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ReleaseLog() {
  const [mission, setMission] = useState<MissionFilter>("All");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const entries = useMemo(
    () => filterFeed(RELEASE_FEED, mission, query, dateFrom, dateTo),
    [mission, query, dateFrom, dateTo],
  );
  const counts = useMemo(() => tally(entries), [entries]);

  const dated = dateFrom !== "" || dateTo !== "";
  const active = mission !== "All" || query !== "" || dated;

  const reset = useCallback(() => {
    setMission("All");
    setQuery("");
    setDateFrom("");
    setDateTo("");
  }, []);

  return (
    <>
      <PageHeader
        crumb="Processors proposal"
        title="Release Log"
        sub="A visual timeline of every processor release. Use the filters to narrow by mission, date range, or search the release notes. Hover over events to see details."
      />

      <section className="wrap pad">
        {/* Counters */}
        <Reveal className={s.counters}>
          <div className={s.counter}>
            <span className={s.counterK}>Releases</span>
            <span className={s.counterV}>{String(counts.releases).padStart(2, "0")}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Processors</span>
            <span className={s.counterV}>{String(counts.processors).padStart(2, "0")}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>With release notes</span>
            <span className={s.counterV}>{String(counts.withNotes).padStart(2, "0")}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Span</span>
            <span className={`${s.counterV} ${s.small}`}>
              {counts.span ? `${counts.span.from} → ${counts.span.to}` : "—"}
            </span>
          </div>
        </Reveal>

        {/* Controls */}
        <div className={s.controls}>
          <div className={`${s.control} ${s.grow}`}>
            <label className={s.controlLab} htmlFor="rl-search">Search</label>
            <div className={s.searchWrap}>
              <Search size={15} />
              <input
                id="rl-search"
                type="text"
                placeholder="Search release notes..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query && (
                <button className={s.clear} onClick={() => setQuery("")} aria-label="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className={s.control}>
            <span className={s.controlLab} id="rl-mission-lab">Mission</span>
            <div className={s.segmented} role="group" aria-labelledby="rl-mission-lab">
              {(["All", ...MISSION_ORDER] as MissionFilter[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mission === m ? s.on : ""}
                  onClick={() => setMission(m)}
                  aria-pressed={mission === m}
                >
                  {m === "All" ? "All" : `S${m}`}
                </button>
              ))}
            </div>
          </div>

          <div className={s.control}>
            <span className={s.controlLab}>Released between</span>
            <div className={s.dates}>
              <input
                type="date"
                className={s.dateInput}
                aria-label="Released on or after"
                value={dateFrom}
                min={FEED_BOUNDS.min}
                max={dateTo || FEED_BOUNDS.max}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className={s.dateSep} aria-hidden>→</span>
              <input
                type="date"
                className={s.dateInput}
                aria-label="Released on or before"
                value={dateTo}
                min={dateFrom || FEED_BOUNDS.min}
                max={FEED_BOUNDS.max}
                onChange={(e) => setDateTo(e.target.value)}
              />
              {dated && (
                <button
                  className={s.clear}
                  onClick={() => { setDateFrom(""); setDateTo(""); }}
                  aria-label="Clear date range"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          <div className={s.control}>
            <span className={s.controlLab}>&nbsp;</span>
            <button type="button" className={s.reset} onClick={reset} disabled={!active}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>

        {/* Result summary */}
        <div className={s.resultLine}>
          <span>
            <b>{counts.releases}</b> of {RELEASE_FEED.length} releases
            {query && <> matching "<b>{query}</b>"</>}
            {dated && (
              <>
                {" "}released {dateFrom ? <>from <b>{dateFrom}</b></> : "up to"}
                {dateFrom && dateTo ? " " : ""}
                {dateTo ? <>to <b>{dateTo}</b></> : dateFrom ? " onwards" : ""}
              </>
            )}
          </span>
        </div>

        {/* Timeline visualization */}
        {entries.length === 0 ? (
          <div className={s.empty}>
            <b>No releases match</b>
            {query
              ? `Nothing matches "${query}" — the search covers the release notes, the processor, the baseline version, the mission and the satellites.`
              : dated
                ? "No releases in the selected date range."
                : "No releases for the selected mission."}
          </div>
        ) : (
          <Reveal>
            <TimelineView entries={entries} selectedDate={selectedDate} onDateSelect={setSelectedDate} />
          </Reveal>
        )}
      </section>
    </>
  );
}
