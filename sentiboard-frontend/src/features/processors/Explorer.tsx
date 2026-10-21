"use client";

/* The interactive part of the Processors page: stats, filters, the satellite / timeline / detail
   panes. Rendered on the server too (only the timeline and the backdrop are browser-only), with
   its state in the URL (./url-state.ts). Every control is a link or a GET form, so the page also
   works without JavaScript; with JavaScript, clicks update the URL through the History API and
   the view changes instantly, with no server round trip. Ported from the prototype's
   processors.tsx. */

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import s from "./processors.module.css";
import x from "./explorer.module.css";
import {
  MISSION_NAMES,
  MISSION_ORDER,
  longDate,
  type MissionId,
  type ProcessorGroup,
  type ProcessorNotes,
  type ReleaseRecord,
} from "./model";
import {
  PROCESSORS_PATH,
  RANGES,
  parseView,
  resolveView,
  viewHref,
  viewParams,
  type BaselineFilter,
  type ProcessorsView,
} from "./url-state";

const ReleaseTimeline = dynamic(() => import("./ReleaseTimeline"), {
  ssr: false,
  loading: () => (
    <p className={`${s.status} sb-js-only`} role="status">
      <span className={s.statusPulse} aria-hidden="true" />
      Loading processor releases…
    </p>
  ),
});

const SpaceBackdrop = dynamic(() => import("@/components/SpaceBackdrop"), {
  ssr: false,
});

// Map mission IDs to satellite image paths
const SATELLITE_IMAGES: Record<MissionId, string> = {
  "1": "/assets/img/satellites/s1_.png",
  "2": "/assets/img/satellites/s2_.png",
  "3": "/assets/img/satellites/s3_.png",
  "5P": "/assets/img/satellites/s5_.png",
};

const BASELINE_OPTIONS: { value: BaselineFilter; label: string }[] = [
  { value: "all", label: "All releases" },
  { value: "current", label: "Current baselines" },
];
const BASELINE_SHORT: Record<BaselineFilter, string> = {
  all: "All",
  current: "Current",
};

/** A plain left click, which the History API can take over; anything else (new tab, …) is left
 *  to the browser and follows the link. */
function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

type Navigate = (next: ProcessorsView, mode: "push" | "replace") => void;

/** A link to another view that, with JavaScript, changes the URL in place instead of loading. */
function ViewLink({
  view,
  mode,
  navigate,
  onNavigate,
  className,
  children,
  ...rest
}: {
  view: ProcessorsView;
  mode: "push" | "replace";
  navigate: Navigate;
  onNavigate?: () => void;
  className?: string;
  children?: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick">) {
  return (
    <a
      {...rest}
      href={viewHref(view)}
      className={className}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        navigate(view, mode);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}

interface FilterDropdownProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; view: ProcessorsView }[];
  /** Short text shown beside the label when closed, e.g. "Current". */
  displayValue?: string;
  navigate: Navigate;
}

/** Label + chevron trigger that opens a vertical menu of links. A <details>, so it opens without
 *  JavaScript; with it, it also closes on outside click or Escape. */
function FilterDropdown<T extends string>({
  id,
  label,
  value,
  options,
  displayValue,
  navigate,
}: FilterDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  const close = (focus: boolean) => {
    if (rootRef.current) rootRef.current.open = false;
    if (focus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <details
      ref={rootRef}
      className={`${s.dd} ${open ? s.ddOpen : ""}`}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        ref={triggerRef}
        id={id}
        className={`${s.ddTrigger} ${x.summary}`}
        aria-controls={`${id}-menu`}
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
      </summary>

      <ul id={`${id}-menu`} className={s.ddMenu}>
        {options.map((o) => {
          const isOn = o.value === value;
          return (
            <li key={o.value}>
              <ViewLink
                view={o.view}
                mode="replace"
                navigate={navigate}
                onNavigate={() => close(true)}
                className={`${s.ddItem} ${x.asButton} ${isOn ? s.ddItemOn : ""}`}
                aria-current={isOn ? "true" : undefined}
              >
                {o.label}
              </ViewLink>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** Release notes, already sanitized on the server (allowlisted tags, no inline styles or
 *  classes), so they take the theme's own typography. */
function ReleaseNotes({ html }: { html?: string }) {
  if (!html) {
    return <p className={s.none}>No release notes in the feed.</p>;
  }
  return <div className={s.rnHtml} dangerouslySetInnerHTML={{ __html: html }} />;
}

const ARROW = {
  back: <path d="M7 3L2 8l5 5M2 8h12"></path>,
  prev: <path d="M15 5l-7 7 7 7"></path>,
  next: <path d="M9 5l7 7-7 7"></path>,
};

function StepIcon({ dir }: { dir: "prev" | "next" }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      {ARROW[dir]}
    </svg>
  );
}

interface ReleaseDetailProps {
  group: ProcessorGroup;
  notes: ProcessorNotes;
  index: number;
  view: ProcessorsView;
  navigate: Navigate;
}

/** The selected baseline's details. Keyed by release so each step replays the entrance. */
function ReleaseDetail({ group, notes, index, view, navigate }: ReleaseDetailProps) {
  const release: ReleaseRecord = group.releases[index];
  const isCurrent = release.isCurrent;
  const prev = group.releases[index - 1];
  const next = group.releases[index + 1];

  const step = (r: ReleaseRecord | undefined, dir: "prev" | "next") => {
    const label = dir === "prev" ? "Previous release" : "Next release";
    return r ? (
      <ViewLink
        view={{ ...view, release: r.id }}
        mode="push"
        navigate={navigate}
        className={s.step}
        aria-label={label}
      >
        <StepIcon dir={dir} />
      </ViewLink>
    ) : (
      <button type="button" className={s.step} disabled aria-label={label}>
        <StepIcon dir={dir} />
      </button>
    );
  };

  return (
    <div key={release.id} className={s.dtIn}>
      <div className={s.dtTop}>
        <ViewLink
          view={{ ...view, release: null }}
          mode="push"
          navigate={navigate}
          className={s.dtBack}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            {ARROW.back}
          </svg>
          Overview
        </ViewLink>
        <div className={s.dtSteps}>
          {step(prev, "prev")}
          {step(next, "next")}
        </div>
      </div>

      <div className={s.dtHead}>
        <div>
          <span className={s.dtProc}>
            {group.sub ? `${group.label} · ${group.sub}` : group.label}
          </span>
          <b className={s.dtVer}>{release.baseline}</b>
        </div>
        <span className={isCurrent ? s.tagNow : s.tagOld}>
          {isCurrent ? "Current baseline" : "Superseded"}
        </span>
      </div>

      <dl className={s.meta}>
        {release.processingBaseline && (
          <div>
            <dt>Processing baseline:</dt>
            <dd>{release.processingBaseline}</dd>
          </div>
        )}
        <div>
          <dt>Released:</dt>
          <dd>
            {release.releasedMs !== undefined
              ? longDate(release.releasedMs)
              : "—"}
          </dd>
        </div>
        <div>
          <dt>Operational since:</dt>
          <dd>{longDate(release.ms)}</dd>
        </div>
        <div>
          <dt>Impacted satellite(s):</dt>
          <dd>{release.sats.length ? release.sats.join(", ") : "—"}</dd>
        </div>
      </dl>

      <div className={s.rn}>
        <h4>Release notes</h4>
        <ReleaseNotes html={release.notesId ? notes[release.notesId] : undefined} />
      </div>
    </div>
  );
}

export type ExplorerData =
  | { ok: true; groups: ProcessorGroup[]; notes: ProcessorNotes; now: number }
  | { ok: false; unreachable: boolean; message: string };

const NO_GROUPS: ProcessorGroup[] = [];
const NO_NOTES: ProcessorNotes = {};

export default function Explorer({
  data,
  releaseList,
}: {
  data: ExplorerData;
  /** The server-rendered release list: the timeline's content for no-JavaScript visitors. */
  releaseList?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const allGroups = data.ok ? data.groups : NO_GROUPS;
  const view = useMemo(
    () => resolveView(parseView(searchParams), allGroups),
    [searchParams, allGroups],
  );
  const activeMission = view.mission;
  const selected = view.release;

  const navigate: Navigate = (next, mode) => {
    const href = viewHref(next);
    if (mode === "push") window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
  };

  // The search box answers every keystroke from local state; the URL follows (replace, so typing
  // adds no history entries). A URL change from elsewhere (back/forward) resets the box.
  const [query, setQuery] = useState(view.q);
  const [syncedQ, setSyncedQ] = useState(view.q);
  if (view.q !== syncedQ) {
    setSyncedQ(view.q);
    setQuery(view.q);
  }
  const changeQuery = (q: string) => {
    setQuery(q);
    setSyncedQ(q);
    navigate({ ...view, q }, "replace");
  };

  // Ambient motion (sky strip, satellite float, timeline scan). Reduced-motion users start paused.
  const [motionPaused] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );

  const now = data.ok ? data.now : 0;
  const satelliteImageUrl = SATELLITE_IMAGES[activeMission];
  const normalisedQuery = query.trim().toLowerCase();
  const isDetail = selected !== null;

  const missionGroups = useMemo(
    () => allGroups.filter((g) => g.mission === activeMission),
    [allGroups, activeMission],
  );

  // Keep the last selection while the pane slides shut, so its content does not vanish mid-motion.
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected && selected !== lastSelected) setLastSelected(selected);
  const shown = selected ?? lastSelected;

  // Detail pane content, looked up from every processor so it never depends on the filters.
  const detailGroup = shown
    ? allGroups.find((g) => g.releases.some((r) => r.id === shown))
    : undefined;
  const detailIndex = detailGroup
    ? detailGroup.releases.findIndex((r) => r.id === shown)
    : -1;

  // Escape closes the detail view, as the Overview button does.
  useEffect(() => {
    if (!isDetail) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") navigate({ ...view, release: null }, "push");
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const missionReleases = missionGroups.flatMap((g) => g.releases);
  const yearAgo = new Date(now);
  yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1);
  const latestMs = missionReleases.reduce((m, r) => Math.max(m, r.ms), 0);
  // Without data (backend down), the counts read "—" rather than a misleading 0.
  const stats = [
    { value: data.ok ? missionGroups.length : "—", label: "Processors" },
    { value: data.ok ? missionReleases.length : "—", label: "Releases" },
    {
      value: data.ok
        ? missionReleases.filter((r) => r.ms >= yearAgo.getTime()).length
        : "—",
      label: "Released in the last year",
    },
    {
      value: latestMs ? new Date(latestMs).getUTCFullYear() : "—",
      label: "Latest release",
    },
  ];

  // A marker opens its release; a second click on the same marker returns to the overview.
  const toggleRelease = (id: string) =>
    navigate({ ...view, release: selected === id ? null : id }, "push");

  return (
    <section className={`${s.container} ${motionPaused ? s.paused : ""}`}>
      <SpaceBackdrop page={1} paused={motionPaused} />
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
            view: { ...view, mission: m, release: null },
          }))}
          navigate={navigate}
        />

        <div className={s.tabs} role="group" aria-label="Timeline range">
          {RANGES.map((r) => (
            <ViewLink
              key={r}
              // a range always shows the overview
              view={{ ...view, range: r, release: null }}
              mode="replace"
              navigate={navigate}
              className={`${s.segBtn} ${x.asButton} ${view.range === r ? s.active : ""}`}
              aria-current={view.range === r ? "true" : undefined}
            >
              {r}
            </ViewLink>
          ))}
        </div>

        <FilterDropdown<BaselineFilter>
          id="baseline-filter"
          label="Baseline"
          value={view.baseline}
          displayValue={BASELINE_SHORT[view.baseline]}
          options={BASELINE_OPTIONS.map((o) => ({
            ...o,
            view: { ...view, baseline: o.value },
          }))}
          navigate={navigate}
        />

        <form
          className={s.search}
          role="search"
          method="get"
          action={PROCESSORS_PATH}
          onSubmit={(e) => e.preventDefault()}
        >
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
          {/* Without JavaScript, Enter submits the search with the other filters kept. */}
          {[...viewParams({ ...view, q: "", release: null })].map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <input
            type="search"
            name="q"
            className={s.searchInput}
            placeholder="Search"
            aria-label="Search processors"
            value={query}
            onChange={(e) => changeQuery(e.target.value)}
          />
        </form>
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
            // A fixed-size decorative render the prototype loads as-is; next/image adds nothing here.
            // eslint-disable-next-line @next/next/no-img-element
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
          <h2 className={s.phead}>{MISSION_NAMES[activeMission]} processors</h2>

          <p className={s.caption}>Release timeline</p>
          {!data.ok ? (
            <div className={s.statusError} role="alert">
              <p className={s.statusTitle}>
                {data.unreachable
                  ? "Backend unreachable"
                  : "Could not load processor releases"}
              </p>
              <p className={s.statusText}>
                {data.unreachable
                  ? "The processor feed did not answer. Check that the backend is running, then try again."
                  : data.message}
              </p>
              {/* A reload of the same view: works with and without JavaScript. */}
              <a className={`${s.retry} ${x.retryLink}`} href={viewHref(view)}>
                Try again
              </a>
            </div>
          ) : missionGroups.length > 0 ? (
            <>
              <ReleaseTimeline
                groups={missionGroups}
                now={now}
                range={view.range}
                baselineFilter={view.baseline}
                query={normalisedQuery}
                selected={selected}
                onPick={toggleRelease}
              />
              {releaseList}
            </>
          ) : (
            <p className={s.none}>No processors for this mission.</p>
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
              notes={data.ok ? data.notes : NO_NOTES}
              index={detailIndex}
              view={view}
              navigate={navigate}
            />
          )}
        </section>
      </div>
    </section>
  );
}
