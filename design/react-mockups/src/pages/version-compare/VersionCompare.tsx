import { useCallback, useMemo, useState } from "react";
import { ArrowRight, GitCompareArrows, RotateCcw } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_COMPARE_DESCRIPTION } from "@/data/copy";
import {
  COMPARABLE_BY_MISSION, DEFAULT_GROUP,
  type DiffLine, type ReleaseRecord, type ProcessorGroup,
  ageLabel, currentOf, defaultPair, diffLines, earlierPool, groupOf,
  laterThan, noteLines, releaseOf, sideBySide, summarise,
} from "./mock";
import s from "./compare.module.css";

const FIRST = DEFAULT_GROUP;

/** Gantt-style timeline showing all baselines and highlighting the compared ones. */
function GanttTimeline({ group, fromV, toV }: { group: ProcessorGroup; fromV: string; toV: string }) {
  if (!group.releases.length) return null;

  const releases = group.releases;
  const minDate = releases[0].ms;
  const maxDate = releases[releases.length - 1].ms;
  const span = maxDate - minDate || 1;

  const getXPosition = (ms: number) => ((ms - minDate) / span) * 100;
  const getWidth = (startMs: number, endMs: number) => {
    const start = Math.max(startMs, minDate);
    const end = Math.min(endMs, maxDate);
    return ((end - start) / span) * 100;
  };

  return (
    <div className={s.ganttContainer}>
      <div className={s.ganttChart}>
        <div className={s.ganttLabels}>
          {releases.map((rel) => (
            <div key={rel.baseline} className={s.ganttLabel}>
              <span className={s.labelVersion}>{rel.baseline}</span>
              <span className={s.labelDate}>{rel.from}</span>
            </div>
          ))}
        </div>

        <div className={s.ganttBars}>
          {releases.map((rel, idx) => {
            const nextRelease = releases[idx + 1];
            const endMs = nextRelease ? nextRelease.ms : maxDate + (maxDate - minDate) * 0.1;
            const isFrom = rel.baseline === fromV;
            const isTo = rel.baseline === toV;

            return (
              <div key={rel.baseline} className={s.ganttRow}>
                <div
                  className={`${s.ganttBar} ${isFrom ? s.barFrom : ""} ${isTo ? s.barTo : ""}`}
                  style={{
                    left: `${getXPosition(rel.ms)}%`,
                    width: `${getWidth(rel.ms, endMs)}%`,
                  }}
                  title={`${rel.baseline}: ${rel.iso}`}
                >
                  {(isFrom || isTo) && (
                    <span className={s.barLabel}>
                      {isFrom && "from"}
                      {isFrom && isTo ? " / " : ""}
                      {isTo && "to"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
      />

      <section className="wrap pad">
        {/* Pickers */}
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
            {/* Gantt timeline showing all baselines */}
            <Reveal>
              <GanttTimeline group={group} fromV={fromV} toV={toV} />
            </Reveal>

            {/* Summary stats */}
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

            {/* Side-by-side comparison */}
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
