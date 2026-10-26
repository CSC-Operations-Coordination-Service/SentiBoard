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
  useCallback,
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

// Transparent WebP cut-outs (alpha confirmed). Decision 10, §5.3.
const SATELLITE_IMAGES: Record<MissionId, string> = {
  "1": "/assets/img/satellites/s1.webp",
  "2": "/assets/img/satellites/s2.webp",
  "3": "/assets/img/satellites/s3.webp",
  "5P": "/assets/img/satellites/s5p.webp",
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

/** Static chevron for dropdown heads — no rotation, matching DA behaviour (Decision 3). */
function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

interface FilterDropdownProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: { value: T; label: string; view: ProcessorsView }[];
  /** Short text shown beside the label when closed (Baseline only). */
  displayValue?: string;
  navigate: Navigate;
}

/** In-flow dropdown: <details>/<summary> for no-JS, JS closes on outside click.
 *  Uses MOCK's fdrop* classes. No own Escape listener — Explorer handles it. */
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

  const close = (focus: boolean) => {
    if (rootRef.current) rootRef.current.open = false;
    if (focus) {
      rootRef.current?.querySelector<HTMLElement>("summary")?.focus();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: globalThis.MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <details
      ref={rootRef}
      className={`${s.fdrop} ${x.fdropDetails}`}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        id={id}
        className={`${s.fdropHead} ${x.summary}`}
        aria-controls={`${id}-menu`}
      >
        <span className={s.fdropLabel}>{label}</span>
        {displayValue && <span className={s.fdropVal}>{displayValue}</span>}
        <ChevronDown />
      </summary>

      <div className={s.fdropBody}>
        <div className={s.fdropInner}>
          <div className={s.fdropPad} id={`${id}-menu`}>
            {options.map((o) => {
              const isOn = o.value === value;
              return (
                <ViewLink
                  key={o.value}
                  view={o.view}
                  mode="replace"
                  navigate={navigate}
                  onNavigate={() => close(true)}
                  className={`${s.fitem} ${x.asButton} ${isOn ? "" : s.fitemOff}`}
                  aria-current={isOn ? "true" : undefined}
                >
                  {o.label}
                </ViewLink>
              );
            })}
          </div>
        </div>
      </div>
    </details>
  );
}

/** Scroll-reveal fade-in using global .reveal / .reveal.in CSS. */
function Reveal({
  children,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  as?: React.ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? "in" : ""} ${className}`}
    >
      {children}
    </Tag>
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

const DAY_MS = 24 * 60 * 60 * 1000;

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

  const navigate: Navigate = useCallback((next: ProcessorsView, mode: "push" | "replace") => {
    const href = viewHref(next);
    if (mode === "push") window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
  }, []);

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

  const now = data.ok ? data.now : 0;
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

  // One Escape handler: if a dropdown is open close it first, else close the detail.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const openDrop = document.querySelector<HTMLDetailsElement>("details[open]");
      if (openDrop) {
        openDrop.removeAttribute("open");
        openDrop.querySelector<HTMLElement>("summary")?.focus();
      } else if (isDetail) {
        navigate({ ...view, release: null }, "push");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDetail, view, navigate]);

  const missionReleases = missionGroups.flatMap((g) => g.releases);
  // KPI formulas: last year = ms in (now-365d, now]; latest = year of max ms <= now; "—" when not ok.
  const lastYearCutoff = now - 365 * DAY_MS;
  const latestMs = missionReleases.reduce(
    (m, r) => (r.ms <= now ? Math.max(m, r.ms) : m),
    0,
  );
  const counters = [
    { value: data.ok ? String(missionGroups.length) : "—", label: "Processors" },
    { value: data.ok ? String(missionReleases.length) : "—", label: "Releases" },
    {
      value: data.ok
        ? String(missionReleases.filter((r) => r.ms > lastYearCutoff && r.ms <= now).length)
        : "—",
      label: "Released in the last year",
    },
    {
      value: latestMs ? String(new Date(latestMs).getUTCFullYear()) : "—",
      label: "Latest release",
    },
  ];

  // A marker opens its release; a second click on the same marker returns to the overview.
  const toggleRelease = (id: string) =>
    navigate({ ...view, release: selected === id ? null : id }, "push");

  return (
    <section className={s.container}>
      <SpaceBackdrop page={2} />

      {/* Headline counts for the selected mission */}
      <Reveal as="dl" className={s.counters}>
        {counters.map((ct) => (
          <div key={ct.label} className={s.counter}>
            <b className={s.counterV}>{ct.value}</b>
            <span className={s.counterK}>{ct.label}</span>
          </div>
        ))}
      </Reveal>

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

        <div className={s.frange} role="group" aria-label="Timeline range">
          {RANGES.map((r) => (
            <ViewLink
              key={r}
              view={{ ...view, range: r, release: null }}
              mode="replace"
              navigate={navigate}
              className={`${s.frangeBtn} ${x.asButton} ${view.range === r ? s.frangeBtnOn : ""}`}
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
            width="13"
            height="13"
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
      <div className={`${s.split} ${isDetail ? s.focus : ""}`}>
        {/* Satellite column: not sticky, no glow/blend/placeholder. Hidden while detail is open. */}
        <section
          className={s.lcol}
          aria-label={`Sentinel-${activeMission}`}
          aria-hidden={isDetail || undefined}
        >
          <div className={s.orbit}>
            {SATELLITE_IMAGES[activeMission] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={SATELLITE_IMAGES[activeMission]}
                alt={`Sentinel-${activeMission} satellite`}
                className={s.sat}
              />
            )}
          </div>
        </section>

        <section className={s.procpane}>
          <div className={s.sheet}>
            <div className={s.phead}>
              <h2>{MISSION_NAMES[activeMission]} processors</h2>
            </div>
            <div className={s.tlBar}>
              <span className={s.tlCap}>Release timeline</span>
            </div>

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
          </div>
        </section>

        <section
          className={`${s.detailpane} ${isDetail ? s.on : ""}`}
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
