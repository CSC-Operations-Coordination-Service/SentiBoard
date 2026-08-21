import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, X } from "lucide-react";
import { PageHeader, Reveal } from "@/components/ui";
import { PROCESSORS_MATRIX_DESCRIPTION } from "@/data/copy";
import {
  KIND_COLOR, KIND_LABEL, KIND_ORDER, MISSION_ORDER, ROWS, STALE_MONTHS,
  type MatrixRow, type MissionId, type Release, type RelKind,
  ageLabel, currentOf, depthOf, groupByMission, tally,
} from "./mock";
import s from "./matrix.module.css";

/* Processors PROPOSAL 2 — "Version matrix". An ALTERNATIVE to the release timeline (the /processors
   page and its zoomable rebuild), which is untouched.

   The timeline answers "when did each baseline come in" — it puts time on the X axis, so reading it
   means panning and zooming, and comparing two processors means holding two places on the same rail
   at once. This one drops the spatial axis entirely and answers the question an operator arrives
   with: "what baseline is each processor on, and how old is it?"

     · Rows are processors; columns are baseline versions in sequence. History is RIGHT-ALIGNED, so
       every row's newest baseline lands in the same last column and that column reads straight down
       as the current state of the constellation. Columns to its left are one, two, three baselines
       back — a fixed comparison, with nothing to pan.
     · Every cell carries the two facts the feed actually holds: the baseline version and its release
       date. There is NO status field upstream, so nothing is coloured by one — the only distinction
       drawn is the one the dates imply, most-recently-released versus replaced by a later release.
     · Picking a cell opens the release beside the grid — release date, how long that baseline held,
       what it replaced and what replaced it, the changelog, and the satellites it applies to.
     · "Current versions only" collapses the grid to one column: each row's most recent release, with
       how long it has been in force. That is the five-second read; the full grid is the follow-up.

   Colour comes entirely from the shared tokens, so this follows the app's global light/dark switch
   with no palette of its own — see matrix.module.css. Static mock data throughout; the fixture is
   authored in the upstream feed's own shape, so nothing here would need reshaping to wire up. */

type MissionFilter = "All" | MissionId;

const pad2 = (n: number) => String(n).padStart(2, "0");

export default function VersionMatrix() {
  const [mission, setMission] = useState<MissionFilter>("All");
  const [liveOnly, setLiveOnly] = useState(false);
  const [sel, setSel] = useState<{ row: string; release: Release } | null>(null);

  const rows = useMemo(
    () => (mission === "All" ? ROWS : ROWS.filter((r) => r.mission === mission)),
    [mission],
  );

  const missions = useMemo(() => groupByMission(rows), [rows]);
  const counts = useMemo(() => tally(rows), [rows]);

  /* Column count. In current-only, the grid is one column by definition; otherwise it is the longest
     release history in the filtered set, which shrinks when a single mission is selected — a
     Sentinel-5P view should not carry three empty columns because Sentinel-1 has four baselines. */
  const cols = liveOnly ? 1 : Math.max(1, depthOf(rows));

  const active = mission !== "All" || liveOnly;

  /* On a phone the grid is wider than the screen, and a left-aligned scroll opens on the OLDEST
     baselines with the latest column off-screen — the exact opposite of what the layout is for. So
     the scroller starts at its right-hand end and history is what you scroll back to. A no-op on a
     desktop, where nothing overflows. */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [cols, liveOnly, mission]);

  const reset = useCallback(() => {
    setMission("All");
    setLiveOnly(false);
    setSel(null);
  }, []);

  /* Switching filters can hide the selected cell. Rather than tracking that, the selection is
     cleared whenever a control changes — the detail panel never describes a cell that is not on
     screen. */
  const pickMission = (m: MissionFilter) => {
    setMission(m);
    setSel(null);
  };

  const toggleLive = () => {
    setLiveOnly((v) => !v);
    setSel(null);
  };

  const pick = (row: MatrixRow, release: Release) => {
    const same = sel?.row === row.label && sel.release === release;
    setSel(same ? null : { row: row.label, release });
  };

  /** One cell: the baseline version, and the date it was released. */
  const Cell = ({ row, release }: { row: MatrixRow; release: Release }) => {
    const on = sel?.row === row.label && sel.release === release;
    const held = release.kind === "cur"
      ? `in force ${ageLabel(release.months).toLowerCase()}`
      : `held ${ageLabel(release.months).toLowerCase()}`;
    return (
      <button
        type="button"
        className={on ? `${s.cell} ${s.sel}` : s.cell}
        style={{ ["--c" as string]: KIND_COLOR[release.kind] }}
        onClick={() => pick(row, release)}
        aria-pressed={on}
        title={`${row.label} · ${release.baseline} · released ${release.from} · ${held}`}
      >
        <span className={s.cellVer}>{release.baseline}</span>
        <span className={s.cellMeta}>
          <i className={release.kind === "old" ? `${s.cellDot} ${s.hollow}` : s.cellDot} />
          {release.from}
        </span>
      </button>
    );
  };

  /** A row's cells, right-aligned into `cols` columns. */
  const rowCells = (row: MatrixRow) => {
    if (liveOnly) {
      const cur = currentOf(row);
      return (
        <div className={s.cellWrap} key={`${row.label}-cur`}>
          {cur ? <Cell row={row} release={cur} /> : <span className={s.slotEmpty} aria-hidden />}
        </div>
      );
    }
    const lead = cols - row.releases.length; // empty slots before the history starts
    return [
      ...Array.from({ length: Math.max(0, lead) }, (_, i) => (
        <div className={s.cellWrap} key={`${row.label}-pad-${i}`}>
          <span className={s.slotEmpty} aria-hidden />
        </div>
      )),
      ...row.releases.map((rel) => (
        <div className={s.cellWrap} key={`${row.label}-${rel.baseline}`}>
          <Cell row={row} release={rel} />
        </div>
      )),
    ];
  };

  /* Column headers. Right-aligned history means the last column is the newest release on record and
     the ones before it are offsets from it — "−1" is one baseline back for THAT row, which is the
     comparison the layout is for. */
  const headers = liveOnly
    ? ["In force"]
    : Array.from({ length: cols }, (_, i) => (i === cols - 1 ? "Latest" : `−${cols - 1 - i}`));

  const detail = sel?.release ?? null;
  const detailRow = sel ? rows.find((r) => r.label === sel.row) : undefined;

  return (
    <>
      <PageHeader
        crumb="Processors proposal"
        title="Version Matrix"
        sub="Baseline versions per processor, as a comparison grid rather than a timeline. Rows are processors, columns are baselines in sequence, and every row's newest release sits in the same last column — so the current state of the constellation reads straight down. Select a cell for the release detail."
      />

      <section className="wrap pad">
        {/* ---------------- counters ---------------- */}
        <Reveal className={s.counters}>
          <div className={s.counter}>
            <span className={s.counterK}>Processors tracked</span>
            <span className={s.counterV}>{pad2(counts.rows)}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Baselines on record</span>
            <span className={s.counterV}>{pad2(counts.baselines)}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Latest release</span>
            <span className={`${s.counterV} ${s.small}`}>{counts.newest ? counts.newest.from : "—"}</span>
          </div>
          <div className={s.counter}>
            <span className={s.counterK}>Unchanged over {STALE_MONTHS} mo</span>
            <span className={s.counterV}>{pad2(counts.stale)}</span>
          </div>
        </Reveal>

        {/* ---------------- controls ---------------- */}
        <div className={s.controls}>
          <div className={s.control}>
            <span className={s.controlLab} id="vm-mission-lab">Mission</span>
            <div className={s.segmented} role="group" aria-labelledby="vm-mission-lab">
              {(["All", ...MISSION_ORDER] as MissionFilter[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={mission === m ? s.on : ""}
                  onClick={() => pickMission(m)}
                  aria-pressed={mission === m}
                >
                  {m === "All" ? "All" : `S${m}`}
                </button>
              ))}
            </div>
          </div>

          <div className={s.control}>
            <span className={s.controlLab}>View</span>
            <label className={liveOnly ? `${s.toggle} ${s.on}` : s.toggle}>
              <input type="checkbox" checked={liveOnly} onChange={toggleLive} />
              <span className={s.track} aria-hidden />
              Current versions only
            </label>
          </div>

          <div className={s.control}>
            <span className={s.controlLab}>&nbsp;</span>
            <button type="button" className={s.reset} onClick={reset} disabled={!active}>
              <RotateCcw size={12} />
              Reset
            </button>
          </div>
        </div>

        {/* ---------------- matrix + detail ---------------- */}
        <div className={s.split}>
          <Reveal className={s.panel}>
            <div className={s.panelHead}>
              <span className={s.panelTitle}>
                {liveOnly
                  ? `In force · ${counts.live} of ${counts.rows} processors`
                  : `Baseline history · ${cols} column${cols === 1 ? "" : "s"} deep`}
              </span>
              <span className={s.panelHint}>
                {liveOnly
                  ? counts.oldest
                    ? `Oldest in force · ${counts.oldest.baseline} · ${ageLabel(counts.oldest.months)}`
                    : "Nothing on record"
                  : "Select a cell for the release detail"}
              </span>
            </div>

            <div className={s.gridScroll} ref={scrollRef}>
              <div className={liveOnly ? `${s.grid} ${s.one}` : s.grid} style={{ ["--cols" as string]: cols }}>
                <div className={`${s.gridRow} ${s.axis}`}>
                  <div className={s.axisCorner}>Mission · processor</div>
                  {headers.map((h, i) => (
                    <div
                      key={h}
                      className={i === headers.length - 1 ? `${s.axisCell} ${s.latest}` : s.axisCell}
                    >
                      {h}
                    </div>
                  ))}
                </div>

                {missions.map((m) => (
                  <div key={m.id}>
                    <div className={s.gridRow}>
                      <div className={s.band}>
                        <span className={s.bandLab}>
                          <b>{m.name}</b>{" "}
                          <span className={s.bandCount}>
                            · {m.rows.length} processor{m.rows.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {m.rows.map((row) => (
                      <div className={`${s.gridRow} ${s.row}`} key={row.label}>
                        <div className={s.rowLab}>
                          <span className={s.rowName}>{row.label}</span>
                          <span className={s.rowSub}>{row.sub}</span>
                        </div>
                        {row.releases.length === 0 ? (
                          <div className={s.noneRow}>No baseline published</div>
                        ) : (
                          rowCells(row)
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {missions.length === 0 && <div className={s.empty}>No processors match the current filters.</div>}
              </div>
            </div>

            <div className={s.legend}>
              {KIND_ORDER.map((k: RelKind) => (
                <span key={k} className={s.legendItem} style={{ ["--c" as string]: KIND_COLOR[k] }}>
                  <i className={k === "old" ? s.hollow : ""} />
                  {KIND_LABEL[k]}
                </span>
              ))}
              <span className={s.legendNote}>Each cell shows its baseline and release date</span>
              <span className={s.legendCount}>
                {counts.rows} processors · {counts.baselines} baselines
              </span>
            </div>
          </Reveal>

          {detail && detailRow ? (
            // key replays the slide-up on each selection change.
            <aside className={s.detail} key={`${detailRow.label}-${detail.baseline}`}>
              <div className={s.detailHead}>
                <div className={s.detailTitle}>
                  <span className={s.detailEyebrow}>
                    {detailRow.label} · {detail.proc}
                  </span>
                  <span className={s.detailVer}>{detail.baseline}</span>
                  {/* The app's own pill, borrowed for its shape, taking its colour from the baseline
                      token. Both labels are read off the release dates, not off a status field. */}
                  <span className="pill" style={{ color: KIND_COLOR[detail.kind] }}>
                    <span className="dot" />
                    {KIND_LABEL[detail.kind]}
                  </span>
                </div>
                <button
                  type="button"
                  className={s.close}
                  onClick={() => setSel(null)}
                  aria-label="Close release detail"
                >
                  <X size={13} />
                </button>
              </div>

              <div className={s.detailBody}>
                <div className={s.kv}>
                  <div className={s.kvItem}>
                    <span className={s.kvK}>Released</span>
                    <span className={s.kvV}>{detail.iso}</span>
                  </div>
                  <div className={s.kvItem}>
                    <span className={s.kvK}>{detail.kind === "cur" ? "In force" : "Was in force"}</span>
                    <span className={s.kvV}>{ageLabel(detail.months)}</span>
                  </div>
                  <div className={s.kvItem}>
                    <span className={s.kvK}>Replaced</span>
                    <span className={s.kvV}>{detail.prev}</span>
                  </div>
                  <div className={s.kvItem}>
                    <span className={s.kvK}>Replaced by</span>
                    {/* Null for the newest release, which is the only reason a baseline is current. */}
                    <span className={s.kvV}>{detail.next ?? "—"}</span>
                  </div>
                </div>

                {/* The window is stated rather than inferred: a baseline runs from its own release
                    date until its successor's, and to the present day when it has none. */}
                <div className={s.window}>
                  <span className={s.windowLab}>Period</span>
                  <span className={s.windowVal}>
                    {detail.from} → {detail.untilMs === null ? "present" : releaseMonth(detail.untilMs)}
                  </span>
                </div>

                <div className={s.block}>
                  <span className={s.blockLab}>Release notes</span>
                  <div className={s.blockBody}>
                    {detail.notes ? (
                      detail.notes.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)
                    ) : (
                      // A release with no notes is real in this feed, not a formatting gap.
                      <span className={s.blockNone}>No release notes published for this baseline.</span>
                    )}
                  </div>
                </div>

                <div className={s.block}>
                  <span className={s.blockLab}>Impacted satellite(s)</span>
                  <div className={s.tags}>
                    {detail.sats.length ? (
                      detail.sats.map((sat) => (
                        <span className={s.tag} key={sat}>{sat}</span>
                      ))
                    ) : (
                      <span className={`${s.tag} ${s.none}`}>Not published in the releases feed</span>
                    )}
                  </div>
                </div>
              </div>
            </aside>
          ) : (
            <div className={s.detailIdle}>
              <b>Release detail</b>
              Select any cell in the grid to read that baseline's release date, how long it has been in
              force, what it replaced, its release notes and the satellites it applies to.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const releaseMonth = (ms: number) => {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};
