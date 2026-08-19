import { useCallback, useMemo, useState } from "react";
import { RotateCcw, Search, X } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_LOG_DESCRIPTION } from "@/data/copy";
import {
  FEED_BOUNDS, MISSION_ORDER, RELEASE_FEED,
  type GroupBy, type MissionId, type ReleaseRecord,
  filterFeed, groupFeed, highlight, tally,
} from "./mock";
import s from "./log.module.css";

/* Processors PROPOSAL 3 — "Release log". An ALTERNATIVE to the release timeline (the /processors
   page) and to the version matrix, both untouched.

   The other two are spatial: the timeline puts time on an axis you pan and zoom, the matrix puts
   processors and baselines on two axes you read across. Both answer "which version, and when" — and
   both, by construction, reduce the release notes to something you click to reveal. But the notes
   are the part with the actual engineering content: what changed, by how much, and whether anything
   needs reprocessing.

   So this concept inverts the priority. It is a reverse-chronological feed with the notes rendered
   IN FULL and never truncated, one entry per release, and the version and date demoted to metadata
   around the prose. That makes it the only one of the three you can read straight through, and the
   only one where "when did they last touch the cloud mask" is a search rather than a hunt.

     · Entries are newest first, each carrying its processor, baseline version, release date and the
       whole of its release notes.
     · Grouping toggles between BY DATE — one bucket per calendar month, which reads as a changelog —
       and BY PROCESSOR, which reads as per-product release histories.
     · Three filters that compose: mission, a release-date range, and a search that covers the notes,
       the processor and its products, the baseline version, the mission and the satellites — with
       matches inside the notes marked in place.
     · No status of any kind. The feed carries a version, a date and notes; the newest release is
       simply the entry at the top, and nothing here labels anything "current" or "deprecated".

   Colour comes entirely from the shared tokens, so this follows the app's global light/dark switch
   with no palette of its own — see log.module.css. Static mock data throughout, from the fixture
   shared with the matrix (@/data/processor-releases), authored in the upstream feed's own shape. */

type MissionFilter = "All" | MissionId;

const GROUPINGS: { id: GroupBy; label: string }[] = [
  { id: "date", label: "By date" },
  { id: "processor", label: "By processor" },
];

/** The notes, rendered in full. stripHtml has already turned the feed's HTML into lines, with list
 *  items prefixed "• " — so a line is a paragraph and a bullet keeps a hanging indent. */
function Notes({ text, query }: { text: string; query: string }) {
  return (
    <div className={s.notes}>
      {text
        .split("\n")
        .filter((line) => line.trim() !== "")
        .map((line, i) => (
          <p key={i} className={line.startsWith("• ") ? s.bullet : undefined}>
            {highlight(line, query).map((seg, j) =>
              seg.hit ? (
                <mark className={s.hit} key={j}>{seg.text}</mark>
              ) : (
                <span key={j}>{seg.text}</span>
              ),
            )}
          </p>
        ))}
    </div>
  );
}

/** `showProc` names the processor on the entry itself. Off when the feed is grouped BY processor,
 *  where the group header already says it and repeating it on every entry is just noise — there the
 *  baseline version alone identifies the entry. */
function Entry({ rel, query, showProc }: { rel: ReleaseRecord; query: string; showProc: boolean }) {
  return (
    <article className={s.entry}>
      <div className={s.gutter}>
        <span className={s.day}>{rel.day}</span>
        <span className={s.stamp}>{rel.iso}</span>
      </div>

      <div className={s.body}>
        <div className={showProc ? s.head : `${s.head} ${s.bare}`}>
          {showProc && <h3 className={s.proc}>{rel.label}</h3>}
          <span className={s.version}>{rel.baseline}</span>
        </div>
        {showProc && <div className={s.sub}>{rel.sub}</div>}

        {rel.notes ? (
          <Notes text={rel.notes} query={query} />
        ) : (
          // A release the feed carries no notes for is real, not a formatting gap — and in a view
          // whose whole content is the notes, saying so plainly matters more than anywhere else.
          <p className={s.noNotes}>No release notes published for this baseline.</p>
        )}

        <div className={s.sats}>
          <span className={s.satsLab}>Satellites</span>
          {rel.sats.length ? (
            rel.sats.map((sat) => (
              <span className={s.sat} key={sat}>{sat}</span>
            ))
          ) : (
            <span className={`${s.sat} ${s.none}`}>not published in the feed</span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function ReleaseLog() {
  const [mission, setMission] = useState<MissionFilter>("All");
  const [groupBy, setGroupBy] = useState<GroupBy>("date");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const entries = useMemo(
    () => filterFeed(RELEASE_FEED, mission, query, dateFrom, dateTo),
    [mission, query, dateFrom, dateTo],
  );
  const groups = useMemo(() => groupFeed(entries, groupBy), [entries, groupBy]);
  const counts = useMemo(() => tally(entries), [entries]);

  const dated = dateFrom !== "" || dateTo !== "";
  const active = mission !== "All" || query !== "" || groupBy !== "date" || dated;

  const reset = useCallback(() => {
    setMission("All");
    setGroupBy("date");
    setQuery("");
    setDateFrom("");
    setDateTo("");
  }, []);

  return (
    <>
      <PageHeader
        crumb="Processors proposal"
        title="Release Log"
        sub="Every processor release as a reverse-chronological feed, with the release notes in full rather than hidden behind a click. Group by month or by processor, then narrow by mission, by release-date range, or by searching the releases."
        desc={PROCESSORS_LOG_DESCRIPTION}
      />

      <section className="wrap pad">
        {/* ---------------- counters ---------------- */}
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

        {/* ---------------- controls ---------------- */}
        <div className={s.controls}>
          <div className={`${s.control} ${s.grow}`}>
            <label className={s.controlLab} htmlFor="rl-search">Search</label>
            <div className={s.searchWrap}>
              <Search size={15} />
              <input
                id="rl-search"
                type="text"
                placeholder="e.g. placeholder…"
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

          {/* Release date range. Bounded to the span the feed actually covers, so the picker cannot
              wander outside it, and both ends are optional — a `from` alone means "since". */}
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
            <span className={s.controlLab} id="rl-group-lab">Group</span>
            <div className={s.segmented} role="group" aria-labelledby="rl-group-lab">
              {GROUPINGS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={groupBy === g.id ? s.on : ""}
                  onClick={() => setGroupBy(g.id)}
                  aria-pressed={groupBy === g.id}
                >
                  {g.label}
                </button>
              ))}
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

        {/* ---------------- result line ---------------- */}
        <div className={s.resultLine}>
          <span>
            <b>{counts.releases}</b> of {RELEASE_FEED.length} releases
            {query && <> matching “<b>{query}</b>”</>}
            {dated && (
              <>
                {" "}released {dateFrom ? <>from <b>{dateFrom}</b></> : "up to"}
                {dateFrom && dateTo ? " " : ""}
                {dateTo ? <>to <b>{dateTo}</b></> : dateFrom ? " onwards" : ""}
              </>
            )}
          </span>
          <span>
            {groups.length} {groupBy === "date" ? "month" : "processor"}
            {groups.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* ---------------- feed ---------------- */}
        {groups.length === 0 ? (
          <div className={s.empty}>
            <b>No releases match</b>
            {query
              ? `Nothing matches “${query}” — the search covers the release notes, the processor, the baseline version, the mission and the satellites.`
              : dated
                ? "No releases in the selected date range."
                : "No releases for the selected mission."}
          </div>
        ) : (
          <Reveal className={s.feed}>
            {groups.map((g) => (
              <section className={s.group} key={g.key}>
                <header className={s.groupHead}>
                  <h2 className={s.groupTitle}>{g.title}</h2>
                  <span className={s.groupMeta}>{g.meta}</span>
                  <span className={s.groupCount}>
                    {g.entries.length} release{g.entries.length === 1 ? "" : "s"}
                  </span>
                </header>
                {g.entries.map((rel) => (
                  <Entry
                    key={`${rel.ipf}-${rel.baseline}-${rel.ms}`}
                    rel={rel}
                    query={query}
                    showProc={groupBy !== "processor"}
                  />
                ))}
              </section>
            ))}
          </Reveal>
        )}
      </section>
    </>
  );
}
