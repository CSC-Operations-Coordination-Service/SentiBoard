import { useCallback, useMemo, useState } from "react";
import { GitCompareArrows, RotateCcw } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_COMPARE_DESCRIPTION } from "@/data/copy";
import {
  COMPARABLE_BY_MISSION, DEFAULT_GROUP,
  type ProcessorGroup,
  currentOf, defaultPair, earlierPool, groupOf,
  laterThan, releaseOf,
} from "./mock";
import s from "./compare.module.css";

const FIRST = DEFAULT_GROUP;

/** Gantt-style timeline showing all baselines and highlighting the compared ones. */
function GanttTimeline({ group, fromV, toV, selectedBaseline, onBaselineSelect }: { group: ProcessorGroup; fromV: string; toV: string; selectedBaseline: string | null; onBaselineSelect: (baseline: string | null) => void }) {
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
            const isCompared = isFrom || isTo;
            const isClicked = selectedBaseline === rel.baseline;

            return (
              <div key={rel.baseline} className={s.ganttRow}>
                <button
                  type="button"
                  className={`${s.ganttBar} ${isFrom ? s.barFrom : ""} ${isTo ? s.barTo : ""} ${isClicked ? s.barClicked : ""}`}
                  style={{
                    left: `${getXPosition(rel.ms)}%`,
                    width: `${getWidth(rel.ms, endMs)}%`,
                  }}
                  title={`${rel.baseline}: ${rel.iso}`}
                  onClick={() => onBaselineSelect(isClicked ? null : rel.baseline)}
                  aria-pressed={isClicked}
                >
                  {isCompared && (
                    <span className={s.barLabel}>
                      {rel.baseline}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function VersionCompare() {
  const [ipf, setIpf] = useState(FIRST?.ipf ?? "");
  const initial = FIRST ? defaultPair(FIRST) : { from: "", to: "" };
  const [fromV, setFromV] = useState(initial.from);
  const [toV, setToV] = useState(initial.to);
  const [selectedBaseline, setSelectedBaseline] = useState<string | null>(null);

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

  const atCurrent = group ? currentOf(group).baseline === toV : false;
  const dirty = group ? ipf !== FIRST?.ipf || fromV !== defaultPair(group).from || toV !== defaultPair(group).to : false;

  return (
    <>
      <PageHeader
        crumb="Processors proposal"
        title="Baseline Timeline"
        sub="A scrollable gantt-style timeline showing all baseline releases for a selected processor over time. Click on any baseline bar to view its complete release information including notes, affected satellites, and processor details."
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
            <button type="button" className={s.btn} onClick={reset} disabled={!dirty}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </Reveal>

        {!group ? (
          <div className={s.empty}>Select a processor to view the timeline.</div>
        ) : (
          <>
            {/* Gantt timeline showing all baselines */}
            <Reveal>
              <GanttTimeline group={group} fromV={fromV} toV={toV} selectedBaseline={selectedBaseline} onBaselineSelect={setSelectedBaseline} />
            </Reveal>

            {/* Release details for selected baseline */}
            {selectedBaseline && (
              <Reveal className={s.releaseDetails}>
                {group.releases
                  .filter((rel) => rel.baseline === selectedBaseline)
                  .map((rel) => (
                    <div key={rel.baseline} className={s.detailsCard}>
                      <div className={s.detailsHead}>
                        <div>
                          <div className={s.detailsVersion}>{rel.baseline}</div>
                          <div className={s.detailsDate}>{rel.day}</div>
                          <div className={s.detailsIso}>{rel.iso}</div>
                        </div>
                        <button
                          type="button"
                          className={s.closeDetails}
                          onClick={() => setSelectedBaseline(null)}
                          aria-label="Close details"
                        >
                          ✕
                        </button>
                      </div>

                      <div className={s.detailsProc}>
                        <span className={s.detailsProcLabel}>{rel.label}</span>
                        <span className={s.detailsSub}>{rel.sub}</span>
                      </div>

                      {rel.notes ? (
                        <div className={s.detailsNotes}>
                          {rel.notes
                            .split("\n")
                            .filter((line) => line.trim() !== "")
                            .map((line, i) => (
                              <p key={i} className={line.startsWith("• ") ? s.notesBullet : undefined}>
                                {line.replace(/^•\s*/, "")}
                              </p>
                            ))}
                        </div>
                      ) : (
                        <p className={s.noNotes}>No release notes published for this baseline.</p>
                      )}

                      {rel.sats.length > 0 && (
                        <div className={s.detailsSats}>
                          <span className={s.satsLabel}>Satellites:</span>
                          {rel.sats.map((sat) => (
                            <span key={sat} className={s.sat}>
                              {sat}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
              </Reveal>
            )}
          </>
        )}
      </section>
    </>
  );
}
