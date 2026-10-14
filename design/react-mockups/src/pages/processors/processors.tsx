import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import { PROCESSORS_DESCRIPTION } from "@/data/copy";
import {
  PROCESSOR_GROUPS,
  MISSION_ORDER,
  MISSION_NAMES,
  MONTHS,
  type MissionId,
  type ProcessorGroup,
  type ReleaseRecord,
} from "@/data/processor-releases";
import s from "./processors.module.css";

// Map mission IDs to satellite image paths
const SATELLITE_IMAGES: Record<MissionId, string> = {
  "1": "/assets/img/satellites/s1.jpg",
  "2": "/assets/img/satellites/s2.png",
  "3": "/assets/img/satellites/s3.jpg",
  "5P": "/assets/img/satellites/s5.png",
};

const DESCRIPTION = (
  <>
    <p>{PROCESSORS_DESCRIPTION}</p>
  </>
);

/** Mission shown on first render. Changing it is only ever done from the Mission dropdown. */
const DEFAULT_MISSION: MissionId = "1";

/** The timeline's visible window. */
const RANGES = ["1Y", "2Y", "ALL"] as const;
type Range = (typeof RANGES)[number];

const DAY = 24 * 60 * 60 * 1000;
const MONTH_MS = 30.44 * DAY;

/** "all" shows every baseline on the timeline; "current" shows only the baseline in force. */
type BaselineFilter = "all" | "current";
const BASELINE_OPTIONS: { value: BaselineFilter; label: string }[] = [
  { value: "all", label: "All releases" },
  { value: "current", label: "Current baselines" },
];
const BASELINE_SHORT: Record<BaselineFilter, string> = {
  all: "All",
  current: "Current",
};

/** The release whose detail is open on the right. */
interface Selection {
  ipf: string;
  baseline: string;
}

interface Mark {
  pct: number;
  label: string;
}

interface GridLine {
  pct: number;
  major: boolean;
}

interface Axis {
  start: number;
  end: number;
  /** Percent position of TODAY along the track. */
  today: number;
  /** Narrow windows keep a readable width; long ones scroll sideways. */
  minWidth: number;
  grid: GridLine[];
  months: Mark[];
  years: Mark[];
}

/**
 * Window bounds, as the reference timeline draws them: from the quarter before the earliest
 * baseline (never later than Jan 2014) up to three months past today.
 */
function timelineBounds(earliest: number, now: number): [number, number] {
  const first = new Date(Math.min(earliest, Date.UTC(2014, 0, 1)));
  const today = new Date(now);
  const start = Date.UTC(
    first.getUTCFullYear(),
    Math.floor(first.getUTCMonth() / 3) * 3 - 3,
    1,
  );
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 3, 1);
  return [start, end];
}

/**
 * Window and ticks for the timeline. 1Y and 2Y start at the same month a year or two back; ALL
 * uses the full bounds. Tick density follows the window length: monthly labels up to 15 months,
 * every second month up to 28, quarterly up to 60, and yearly beyond that.
 */
function buildAxis(range: Range, now: number, earliest: number): Axis {
  const [boundsStart, end] = timelineBounds(earliest, now);
  const today = new Date(now);
  const start =
    range === "ALL"
      ? boundsStart
      : Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth() - (range === "1Y" ? 12 : 24),
          1,
        );
  const span = end - start;
  const months = span / MONTH_MS;
  const every = months <= 15 ? 1 : months <= 28 ? 2 : months <= 60 ? 3 : 12;

  const grid: GridLine[] = [];
  const monthMarks: Mark[] = [];
  const yearMarks: Mark[] = [];
  const at = (t: number) => ((t - start) / span) * 100;

  const cursor = new Date(start);
  let y = cursor.getUTCFullYear();
  let m = cursor.getUTCMonth();
  let firstYear = true;
  while (Date.UTC(y, m, 1) <= end) {
    const pct = at(Date.UTC(y, m, 1));
    const isYear = m === 0;
    if (pct >= -1 && (m % every === 0 || isYear)) {
      grid.push({ pct, major: isYear });
      if (pct < 93 && every < 12) {
        monthMarks.push({ pct, label: MONTHS[m].toUpperCase() });
      }
    }
    if (pct >= -1 && pct < 95 && (isYear || firstYear)) {
      yearMarks.push({ pct: Math.max(0, pct), label: String(y) });
      firstYear = false;
    }
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }

  return {
    start,
    end,
    today: at(now),
    minWidth: Math.max(620, Math.round(116 + months * 6)),
    grid,
    months: monthMarks,
    years: yearMarks,
  };
}

/** "S1 SAR L1/L2" → "SAR L1/L2": the lane names drop the mission prefix the page already shows. */
function laneName(label: string): string {
  return label.replace(/^S(?:1|2|3|5P)\s+/, "");
}

function matchesQuery(group: ProcessorGroup, query: string): boolean {
  if (!query) return true;
  const haystack = [
    group.label,
    group.sub,
    ...group.releases.map((r) => r.baseline),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

/** "5 February 2026" */
function longDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "February 2026 Release" */
function baselineId(ms: number): string {
  const month = new Date(ms).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${month} Release`;
}

interface ReleaseTimelineProps {
  groups: ProcessorGroup[];
  axis: Axis;
  baselineFilter: BaselineFilter;
  selected: Selection | null;
  onPick: (ipf: string, baseline: string) => void;
}

function ReleaseTimeline({
  groups,
  axis,
  baselineFilter,
  selected,
  onPick,
}: ReleaseTimelineProps) {
  const toPct = (ms: number) =>
    ((ms - axis.start) / (axis.end - axis.start)) * 100;

  return (
    <div className={s.tlScroll}>
      <div className={s.tl} style={{ minWidth: axis.minWidth }}>
        <div className={s.tlAxisRow}>
          <span />
          <div className={s.tlAxis}>
            {axis.years.map((t) => (
              <span
                key={`y${t.label}`}
                className={s.tlYear}
                style={{ left: `${t.pct}%` }}
              >
                {t.label}
              </span>
            ))}
            {axis.months.map((t) => (
              <span
                key={`m${t.pct}`}
                className={s.tlMonth}
                style={{ left: `${t.pct}%` }}
              >
                {t.label}
              </span>
            ))}
          </div>
        </div>

        {groups.map((g) => {
          const last = g.releases.length - 1;
          const marks = g.releases
            .map((r, i) => ({ r, isCurrent: i === last, x: toPct(r.ms) }))
            .filter(
              ({ x, isCurrent }) =>
                x >= 0 && x <= 100 && (baselineFilter === "all" || isCurrent),
            );

          return (
            <div key={g.ipf} className={s.tlLane}>
              <span className={s.tlName}>{laneName(g.label)}</span>
              <div className={s.tlTrack}>
                {axis.grid.map((line) => (
                  <i
                    key={line.pct}
                    className={line.major ? s.tlGridMajor : s.tlGrid}
                    style={{ left: `${line.pct}%` }}
                  />
                ))}
                {marks.map(({ r, isCurrent, x }) => {
                  const isSelected =
                    selected?.ipf === g.ipf && selected.baseline === r.baseline;
                  return (
                    <button
                      key={r.baseline}
                      type="button"
                      className={[
                        s.mk,
                        isCurrent ? s.mkNow : "",
                        isSelected ? s.mkSel : "",
                      ].join(" ")}
                      style={{ left: `${x}%` }}
                      title={`${r.baseline} · ${r.day}${isCurrent ? " · in force" : ""}`}
                      aria-label={`${laneName(g.label)} ${r.baseline}, released ${r.day}${isCurrent ? ", in force" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => onPick(g.ipf, r.baseline)}
                    />
                  );
                })}
                <i
                  className={s.tlToday}
                  style={{ left: `${axis.today}%` }}
                  aria-hidden="true"
                />
              </div>
            </div>
          );
        })}

        <div className={s.tlFoot}>
          <span />
          <div className={s.tlTrack}>
            <span
              className={`${s.tlTodayLabel} ${axis.today > 94 ? s.tlTodayEnd : ""}`}
              style={{ left: `${axis.today}%` }}
            >
              Today
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface FilterDropdownProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string }[];
  /** Short text shown beside the label when closed, e.g. "Current". */
  displayValue?: string;
  onChange: (value: T) => void;
}

/** Label + chevron trigger that opens a vertical menu. Closes on outside click or Escape. */
function FilterDropdown<T extends string>({
  id,
  label,
  value,
  options,
  displayValue,
  onChange,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={`${s.dd} ${open ? s.ddOpen : ""}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={s.ddTrigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={s.ddLabel}>{label}</span>
        {displayValue && <span className={s.ddValue}>{displayValue}</span>}
        <svg
          className={`${s.ddChev} ${open ? s.ddChevUp : ""}`}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6"></path>
        </svg>
      </button>

      {open && (
        <ul id={`${id}-menu`} className={s.ddMenu}>
          {options.map((o) => {
            const isOn = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  className={`${s.ddItem} ${isOn ? s.ddItemOn : ""}`}
                  aria-current={isOn ? "true" : undefined}
                  onClick={() => choose(o.value)}
                >
                  {o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Release notes as the feed carries them: flattened text where "•" lines are list items. Dataset
 * keys such as MSI_L0__GR are picked out as tags, and a bullet's "Lead: rest" gets a bold lead.
 */
function ReleaseNotes({ notes }: { notes?: string }) {
  if (!notes) {
    return <p className={s.none}>No release notes in the feed.</p>;
  }

  const tagged = (text: string): ReactNode[] =>
    text.split(/(\b[A-Z][A-Z0-9]*(?:_+[A-Za-z0-9]+)+\b)/).map((part, i) =>
      i % 2 ? (
        <code key={i} className={s.tag}>
          {part}
        </code>
      ) : (
        part
      ),
    );

  const blocks: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => {
    if (!items.length) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} className={s.rnList}>
        {items.map((item, i) => {
          const colon = item.indexOf(": ");
          const lead = colon > 0 && colon < 60 ? item.slice(0, colon) : "";
          return (
            <li key={i}>
              {lead ? (
                <>
                  <b>{lead}</b>: {tagged(item.slice(colon + 2))}
                </>
              ) : (
                tagged(item)
              )}
            </li>
          );
        })}
      </ul>,
    );
    items = [];
  };

  for (const raw of notes.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("•")) {
      items.push(line.replace(/^•\s*/, ""));
    } else {
      flush();
      blocks.push(
        <p key={`p${blocks.length}`} className={s.rnP}>
          {tagged(line)}
        </p>,
      );
    }
  }
  flush();

  return <>{blocks}</>;
}

interface ReleaseDetailProps {
  group: ProcessorGroup;
  index: number;
  onClose: () => void;
  onStep: (delta: -1 | 1) => void;
}

/** The selected baseline's details. Keyed by release so each step replays the entrance. */
function ReleaseDetail({ group, index, onClose, onStep }: ReleaseDetailProps) {
  const release: ReleaseRecord = group.releases[index];
  const isCurrent = index === group.releases.length - 1;

  return (
    <div key={`${group.ipf}-${release.baseline}`} className={s.dtIn}>
      <div className={s.dtTop}>
        <button type="button" className={s.dtBack} onClick={onClose}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M7 3L2 8l5 5M2 8h12"></path>
          </svg>
          Overview
        </button>
        <div className={s.dtSteps}>
          <button
            type="button"
            className={s.step}
            disabled={index <= 0}
            onClick={() => onStep(-1)}
            aria-label="Previous release"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7"></path>
            </svg>
          </button>
          <button
            type="button"
            className={s.step}
            disabled={index >= group.releases.length - 1}
            onClick={() => onStep(1)}
            aria-label="Next release"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className={s.dtHead}>
        <div>
          <span className={s.dtProc}>
            {group.label} · {group.sub}
          </span>
          <b className={s.dtVer}>{release.baseline}</b>
        </div>
        <span className={isCurrent ? s.tagNow : s.tagOld}>
          {isCurrent ? "Current baseline" : "Superseded"}
        </span>
      </div>

      <dl className={s.meta}>
        <div>
          <dt>Processor Baseline ID:</dt>
          <dd>{baselineId(release.ms)}</dd>
        </div>
        <div>
          <dt>Operational since:</dt>
          <dd>{longDate(release.ms)}</dd>
        </div>
        <div>
          <dt>Impacted satellite(s):</dt>
          <dd>{release.sats.join(", ")}</dd>
        </div>
      </dl>

      <div className={s.rn}>
        <h4>Release notes</h4>
        <ReleaseNotes notes={release.notes} />
      </div>
    </div>
  );
}

export default function Processors() {
  // Captured once so the stats and the timeline window agree for the life of the page.
  const [now] = useState(() => Date.now());
  const [activeMission, setActiveMission] =
    useState<MissionId>(DEFAULT_MISSION);
  const [range, setRange] = useState<Range>("ALL");
  const [baselineFilter, setBaselineFilter] = useState<BaselineFilter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Selection | null>(null);
  // Ambient motion (sky strip, satellite float, timeline scan). Reduced-motion users start paused;
  // everyone can pause it, since the motion runs longer than five seconds.
  const [motionPaused, setMotionPaused] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );

  const satelliteImageUrl = SATELLITE_IMAGES[activeMission];
  const normalisedQuery = query.trim().toLowerCase();
  const isDetail = selected !== null;

  const missionGroups = useMemo(
    () => PROCESSOR_GROUPS.filter((g) => g.mission === activeMission),
    [activeMission],
  );
  const visibleGroups = useMemo(
    () => missionGroups.filter((g) => matchesQuery(g, normalisedQuery)),
    [missionGroups, normalisedQuery],
  );
  const axis = useMemo(() => {
    // Earliest baseline of the selected mission sets how far back the ALL window reaches.
    const earliest = missionGroups.reduce(
      (min, g) => g.releases.reduce((m, r) => Math.min(m, r.ms), min),
      now,
    );
    return buildAxis(range, now, earliest);
  }, [missionGroups, range, now]);

  // Keep the last selection while the pane slides shut, so its content does not vanish mid-motion.
  const lastSelected = useRef<Selection | null>(null);
  if (selected) lastSelected.current = selected;
  const view = selected ?? lastSelected.current;

  // Detail pane content, looked up from the full roster so it never depends on the filters.
  const detailGroup = view
    ? PROCESSOR_GROUPS.find((g) => g.ipf === view.ipf)
    : undefined;
  const detailIndex =
    detailGroup && view
      ? detailGroup.releases.findIndex((r) => r.baseline === view.baseline)
      : -1;

  // Escape closes the detail view, as the Overview button does.
  useEffect(() => {
    if (!isDetail) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDetail]);

  const missionReleases = missionGroups.flatMap((g) => g.releases);
  const yearAgo = new Date(now);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const latestMs = missionReleases.reduce((m, r) => Math.max(m, r.ms), 0);
  const stats = [
    { value: missionGroups.length, label: "Processors" },
    { value: missionReleases.length, label: "Releases" },
    {
      value: missionReleases.filter((r) => r.ms >= yearAgo.getTime()).length,
      label: "Released in the last year",
    },
    {
      value: latestMs ? new Date(latestMs).getUTCFullYear() : "—",
      label: "Latest release",
    },
  ];

  // A marker opens its release; a second click on the same marker returns to the overview.
  const toggleRelease = (ipf: string, baseline: string) =>
    setSelected((prev) =>
      prev && prev.ipf === ipf && prev.baseline === baseline
        ? null
        : { ipf, baseline },
    );

  const stepRelease = (delta: -1 | 1) => {
    if (!detailGroup) return;
    const next = detailGroup.releases[detailIndex + delta];
    if (next) setSelected({ ipf: detailGroup.ipf, baseline: next.baseline });
  };

  const changeMission = (m: MissionId) => {
    setActiveMission(m);
    setSelected(null);
  };

  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title="Processors"
          desc={DESCRIPTION}
          img="/assets/img/modules/processors.jpg"
        />
      </div>

      <section className={`${s.container} ${motionPaused ? s.paused : ""}`}>
        {/* Decorative starfield that loops behind the page. Purely visual, so it is hidden from AT. */}
        <div className={s.skyStrip} aria-hidden="true">
          <div className={s.skyTrack}>
            <div className={s.skyTile} />
            <div className={s.skyTile} />
          </div>
        </div>

        {/* Headline counts for the selected mission */}
        <dl className={s.stats}>
          {stats.map((st) => (
            <div key={st.label} className={s.stat}>
              <dt>{st.label}</dt>
              <dd>{st.value}</dd>
            </div>
          ))}
        </dl>

        {/* Filter bar: mission menu, timeline window, baseline menu, search */}
        <div className={s.filters}>
          <FilterDropdown<MissionId>
            id="mission-filter"
            label="Mission"
            value={activeMission}
            options={MISSION_ORDER.map((m) => ({
              value: m,
              label: MISSION_NAMES[m].toUpperCase(),
            }))}
            onChange={changeMission}
          />

          <div className={s.tabs} role="group" aria-label="Timeline range">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                className={`${s.segBtn} ${range === r ? s.active : ""}`}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <FilterDropdown<BaselineFilter>
            id="baseline-filter"
            label="Baseline"
            value={baselineFilter}
            displayValue={BASELINE_SHORT[baselineFilter]}
            options={BASELINE_OPTIONS}
            onChange={setBaselineFilter}
          />

          <label className={s.search}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7"></circle>
              <path d="M20 20l-4-4"></path>
            </svg>
            <input
              type="search"
              className={s.searchInput}
              placeholder="Search"
              aria-label="Search processors"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </div>

        {/* Three panes: satellite, timeline, and the release detail. The satellite and the detail
            trade places on the grid so the timeline compresses to the left as the detail opens. */}
        <div className={`${s.split} ${isDetail ? s.isDetail : ""}`}>
          <section
            className={s.satpane}
            aria-label={`Sentinel-${activeMission}`}
            aria-hidden={isDetail || undefined}
          >
            <div className={s.artGlow} aria-hidden="true"></div>
            <div className={s.art} aria-hidden="true"></div>

            {satelliteImageUrl && (
              <img
                src={satelliteImageUrl}
                alt={`Sentinel-${activeMission} satellite`}
                className={s.satelliteImage}
              />
            )}

            <div className={s.placeholder}>
              <div className={s.placeholderText}>
                Sentinel-{activeMission} Visualization
              </div>
            </div>
          </section>

          <section className={s.procpane}>
            <h2 className={s.phead}>
              {MISSION_NAMES[activeMission]} processors
            </h2>

            <div className={s.captionRow}>
              <p className={s.caption}>Release timeline</p>
              <button
                type="button"
                className={s.motionBtn}
                aria-pressed={motionPaused}
                onClick={() => setMotionPaused((p) => !p)}
              >
                {motionPaused ? "Resume motion" : "Pause motion"}
              </button>
            </div>
            {visibleGroups.length > 0 ? (
              <ReleaseTimeline
                groups={visibleGroups}
                axis={axis}
                baselineFilter={baselineFilter}
                selected={selected}
                onPick={toggleRelease}
              />
            ) : (
              <p className={s.none}>No processors match the search.</p>
            )}
          </section>

          <section
            className={`${s.detailpane} ${isDetail ? s.detailOpen : ""}`}
            aria-live="polite"
            aria-hidden={!isDetail || undefined}
          >
            {detailGroup && detailIndex >= 0 && (
              <ReleaseDetail
                group={detailGroup}
                index={detailIndex}
                onClose={() => setSelected(null)}
                onStep={stepRelease}
              />
            )}
          </section>
        </div>
      </section>
    </>
  );
}
