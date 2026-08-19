import { useCallback, useMemo, useState } from "react";
import { ArrowRight, GitCompareArrows, RotateCcw } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_COMPARE_DESCRIPTION } from "@/data/copy";
import {
  COMPARABLE_BY_MISSION, DEFAULT_GROUP,
  type DiffLine, type ReleaseRecord,
  ageLabel, currentOf, defaultPair, diffLines, earlierPool, groupOf,
  laterThan, noteLines, releaseOf, sideBySide, summarise,
} from "./mock";
import s from "./compare.module.css";

/* Processors PROPOSAL 4 — "Version compare". An ALTERNATIVE to the three browsing views (the
   /processors timeline, /examples/version-matrix and /examples/release-log), all untouched.

   The other three are all built for scanning: the timeline to see when baselines landed, the matrix
   to see which version each processor is on, the log to read the notes as they accumulate. Every one
   of them answers "what is out there". None of them answers the question that actually precedes a
   reprocessing decision: "we are on X, they have moved to Y — what is the difference?"

   So this is not a browsing layout at all. It is two picks and an answer:

     · choose a processor, then the two baselines to compare. The pickers enforce direction — the
       "to" list only offers baselines released after the "from" — so an added line always means the
       later baseline added it, and the +/- can never invert under the reader;
     · "Compare to current" jumps the later side to the newest release on record, which is the
       comparison anyone arrives with;
     · a summary strip states what the two dates imply: the gap, how many baselines the jump covers,
       which ones it skips over, and how the satellite coverage differs;
     · the notes sit side by side, line-diffed. Lines both baselines carry are dimmed, lines only the
       earlier one had are marked "−", lines the later one added are marked "+".

   The diff is a real longest-common-subsequence over paragraphs (see mock.ts), not a similarity
   guess, so a line that merely moved is never reported as changed.

   No status of any kind: the feed carries a version, a date and notes, and "current" here means the
   most recently released baseline, nothing more. Colour comes entirely from the shared tokens — see
   compare.module.css. Static mock data, from the fixture shared with the other proposals. */

const FIRST = DEFAULT_GROUP;

function Notes({ lines }: { lines: DiffLine[] }) {
  if (!lines.length) {
    return <p className={s.noNotes}>No release notes published for this baseline.</p>;
  }
  return (
    <div className={s.notes}>
      {lines.map((line, i) => (
        <div className={`${s.line} ${s[line.op]}`} key={i}>
          <span className={s.glyph} aria-hidden>
            {line.op === "add" ? "+" : line.op === "del" ? "−" : "·"}
          </span>
          <span className={line.bullet ? `${s.text} ${s.bullet}` : s.text}>
            {/* A screen reader gets the marker as words rather than punctuation. */}
            <span className="sr-only">
              {line.op === "add" ? "Added: " : line.op === "del" ? "Removed: " : ""}
            </span>
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function Panel({
  side, release, lines, onlySats,
}: {
  side: "earlier" | "later";
  release: ReleaseRecord;
  lines: DiffLine[];
  onlySats: string[];
}) {
  const only = new Set(onlySats);
  return (
    <section className={side === "later" ? `${s.panel} ${s.later}` : s.panel}>
      <div className={s.panelHead}>
        <span className={s.side}>{side === "later" ? "Later — to" : "Earlier — from"}</span>
        <span className={s.ver}>{release.baseline}</span>
        <span className={s.when}>{release.iso}</span>
      </div>

      <div className={s.panelMeta}>
        <span className={s.metaLab}>Released</span>
        <span className={s.sat}>{release.day}</span>
        <span className={s.metaLab} style={{ marginLeft: 8 }}>Satellites</span>
        {release.sats.length ? (
          release.sats.map((sat) => (
            <span className={only.has(sat) ? `${s.sat} ${s.only}` : s.sat} key={sat}>
              {only.has(sat) ? `+ ${sat}` : sat}
            </span>
          ))
        ) : (
          <span className={`${s.sat} ${s.none}`}>not published in the feed</span>
        )}
      </div>

      <Notes lines={lines} />
    </section>
  );
}

export default function VersionCompare() {
  const [ipf, setIpf] = useState(FIRST?.ipf ?? "");
  const initial = FIRST ? defaultPair(FIRST) : { from: "", to: "" };
  const [fromV, setFromV] = useState(initial.from);
  const [toV, setToV] = useState(initial.to);

  const group = useMemo(() => groupOf(ipf), [ipf]);

  /* Changing the processor invalidates both baselines, so the pair is reset with it rather than
     left pointing at versions the new processor does not have. */
  const pickProcessor = useCallback((next: string) => {
    setIpf(next);
    const g = groupOf(next);
    if (!g) return;
    const pair = defaultPair(g);
    setFromV(pair.from);
    setToV(pair.to);
  }, []);

  /* Moving "from" forward can leave "to" behind it. Rather than refuse the change, the later side is
     pulled to the first baseline that is still after it — the picker stays usable and the diff stays
     directional. */
  const pickFrom = useCallback((next: string) => {
    setFromV(next);
    if (!group) return;
    const stillValid = laterThan(group, next).some((r) => r.baseline === toV);
    if (!stillValid) {
      const options = laterThan(group, next);
      if (options.length) setToV(options[options.length - 1].baseline);
    }
  }, [group, toV]);

  const compareToCurrent = useCallback(() => {
    if (!group) return;
    setToV(currentOf(group).baseline);
  }, [group]);

  const reset = useCallback(() => {
    if (!FIRST) return;
    pickProcessor(FIRST.ipf);
  }, [pickProcessor]);

  const from = group && releaseOf(group, fromV);
  const to = group && releaseOf(group, toV);

  const diff = useMemo(
    () => (from && to ? diffLines(noteLines(from.notes), noteLines(to.notes)) : []),
    [from, to],
  );
  const split = useMemo(() => sideBySide(diff), [diff]);
  const stats = useMemo(
    () => (group && from && to ? summarise(group, from, to) : null),
    [group, from, to],
  );

  const atCurrent = group && to ? currentOf(group).baseline === to.baseline : false;
  const dirty = group ? ipf !== FIRST?.ipf || fromV !== defaultPair(group).from || toV !== defaultPair(group).to : false;

  return (
    <>
      <PageHeader
        crumb="Processors proposal"
        title="Version Compare"
        sub="Pick a processor and two of its baselines, and read what changed between them: the release dates, the baselines the jump covers, how satellite coverage differs, and the release notes side by side with the differences marked."
        desc={PROCESSORS_COMPARE_DESCRIPTION}
      />

      <section className="wrap pad">
        {/* ---------------- pickers ---------------- */}
        <Reveal className={s.picker}>
          <div className={s.field}>
            <label className={s.fieldLab} htmlFor="vc-proc">Processor</label>
            <select
              id="vc-proc"
              className={s.select}
              value={ipf}
              onChange={(e) => pickProcessor(e.target.value)}
            >
              {COMPARABLE_BY_MISSION.map((m) => (
                <optgroup label={m.name} key={m.id}>
                  {m.groups.map((g) => (
                    <option value={g.ipf} key={g.ipf}>
                      {g.label} — {g.releases.length} baselines
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div className={s.field}>
            <label className={s.fieldLab} htmlFor="vc-from">From — earlier baseline</label>
            <select
              id="vc-from"
              className={s.select}
              value={fromV}
              onChange={(e) => pickFrom(e.target.value)}
              disabled={!group}
            >
              {group &&
                earlierPool(group).map((r) => (
                  <option value={r.baseline} key={r.baseline}>
                    {r.baseline} · {r.from}
                  </option>
                ))}
            </select>
          </div>

          <div className={s.field}>
            <label className={s.fieldLab} htmlFor="vc-to">To — later baseline</label>
            <select
              id="vc-to"
              className={s.select}
              value={toV}
              onChange={(e) => setToV(e.target.value)}
              disabled={!group}
            >
              {group &&
                laterThan(group, fromV).map((r) => (
                  <option value={r.baseline} key={r.baseline}>
                    {r.baseline} · {r.from}
                  </option>
                ))}
            </select>
          </div>

          <div className={s.actions}>
            <button
              type="button"
              className={s.btn}
              onClick={compareToCurrent}
              disabled={!group || atCurrent}
              title={atCurrent ? "Already comparing against the latest release" : undefined}
            >
              <GitCompareArrows size={13} />
              Compare to current
            </button>
            <button type="button" className={s.btn} onClick={reset} disabled={!dirty}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </Reveal>

        {!group || !from || !to ? (
          <div className={s.empty}>Select a processor and two of its baselines to compare.</div>
        ) : (
          <>
            {/* ---------------- summary ---------------- */}
            <Reveal className={s.summary}>
              <div className={s.stat}>
                <span className={s.statK}>Comparing</span>
                <span className={s.statV}>
                  {from.baseline} <ArrowRight size={13} style={{ verticalAlign: "-2px" }} /> {to.baseline}
                </span>
              </div>
              <div className={s.stat}>
                <span className={s.statK}>Apart</span>
                <span className={s.statV}>{ageLabel(stats!.months)}</span>
              </div>
              <div className={s.stat}>
                <span className={s.statK}>Baselines covered</span>
                <span className={s.statV}>
                  {stats!.steps}
                  <span className={s.statK} style={{ marginLeft: 6 }}>
                    {stats!.steps === 1 ? "consecutive" : "steps"}
                  </span>
                </span>
              </div>
              <div className={s.stat}>
                <span className={s.statK}>Skipped over</span>
                {stats!.skipped.length ? (
                  <span className={s.skipped}>
                    {stats!.skipped.map((r) => (
                      <span className={s.skip} key={r.baseline}>{r.baseline}</span>
                    ))}
                  </span>
                ) : (
                  <span className={`${s.statV} ${s.dim}`}>none — consecutive releases</span>
                )}
              </div>
              <div className={s.stat}>
                <span className={s.statK}>Notes changed</span>
                <span className={`${s.statV} ${s.dim}`}>
                  +{split.counts.add} / −{split.counts.del} · {split.counts.same} unchanged
                </span>
              </div>
            </Reveal>

            {/* ---------------- side by side ---------------- */}
            <div className={s.panels}>
              <Panel side="earlier" release={from} lines={split.from} onlySats={stats!.sats.onlyFrom} />
              <Panel side="later" release={to} lines={split.to} onlySats={stats!.sats.onlyTo} />
            </div>

            <div className={s.legend}>
              <span className={s.key} style={{ ["--c" as string]: "var(--accent)" }}>
                <i />+ added by {to.baseline}
              </span>
              <span className={s.key} style={{ ["--c" as string]: "var(--text-mute)" }}>
                <i />− only in {from.baseline}
              </span>
              <span className={s.key} style={{ ["--c" as string]: "var(--line-strong)" }}>
                <i />· carried by both
              </span>
              <span className={s.legendNote}>
                Differences are compared paragraph by paragraph, so a line both baselines restate is
                shown as carried rather than changed.
              </span>
            </div>
          </>
        )}
      </section>
    </>
  );
}
