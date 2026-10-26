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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import s from "./processors.module.css";
import x from "./explorer.module.css";
import {
  MISSION_NAMES,
  MISSION_ORDER,
  longDate,
  verOf,
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

// §11 / Decision 11 — orbit rotation on mission change.
// NAV_H matches the shell's fixed nav (§11: "H = 100vh − 64px").
const NAV_H = 64;

function easeInOutCubic(q: number): number {
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
}

/**
 * Planet-centre and STEP for the orbit rotation (§11).
 *   H_stage = innerHeight − 64  (stage below the nav)
 *   centreY_stage = H_stage + 6133.05 × (H_stage / 1600)
 *   centreY_vp    = NAV_H + centreY_stage   (viewport coords)
 *   STEP = W × 1.08 / (centreY_stage − H_stage / 2)
 */
function orbitGeometry() {
  const W = window.innerWidth;
  const H = window.innerHeight - NAV_H;
  const centreY_stage = H + 6133.05 * (H / 1600);
  const centreY_vp = NAV_H + centreY_stage;
  const STEP = (W * 1.08) / (centreY_stage - H / 2);
  return { W, centreY_vp, STEP };
}

/**
 * Tracks the horizon line (navBottom + 0.8334 × (innerHeight − navBottom) − 14)
 * and writes --hz-cut = line − element.top on each ref element every rAF frame.
 * Returns a pump(ms) function for continuous per-frame updates during the FLIP.
 * Decision 21.
 */
function useHorizonMask(
  containerRef: React.RefObject<HTMLElement | null>,
  ...els: React.RefObject<HTMLElement | null>[]
): (durationMs: number) => () => void {
  const updateRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".nav");
    let raf = 0;

    function update() {
      raf = 0;
      const navBottom = nav?.getBoundingClientRect().bottom ?? 64;
      const line = navBottom + 0.8334 * (window.innerHeight - navBottom) - 14;
      for (const ref of els) {
        const el = ref.current;
        if (!el) continue;
        el.style.setProperty(
          "--hz-cut",
          `${Math.round(line - el.getBoundingClientRect().top)}px`,
        );
      }
    }

    updateRef.current = update;

    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    const ro = new ResizeObserver(schedule);
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      updateRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback((durationMs: number): (() => void) => {
    const deadline = performance.now() + durationMs;
    let id = 0;
    function tick() {
      updateRef.current?.();
      if (performance.now() < deadline) id = requestAnimationFrame(tick);
    }
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
}

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
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
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
    <Tag ref={ref} className={`reveal ${seen ? "in" : ""} ${className}`}>
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
  return (
    <div className={s.rnHtml} dangerouslySetInnerHTML={{ __html: html }} />
  );
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
  /** True while the detail pane is open; suppresses vswap on the first open. */
  paneOpen: boolean;
}

/** The selected baseline's details. Steps replay the vswap animation; first open does not. */
function ReleaseDetail({
  group,
  notes,
  index,
  view,
  navigate,
  paneOpen,
}: ReleaseDetailProps) {
  const release: ReleaseRecord = group.releases[index];
  const isCurrent = release.isCurrent;
  const prev = group.releases[index - 1];
  const next = group.releases[index + 1];

  // vswap: play on step / re-pick while open; suppress on first open and while closing.
  // Adjusted during render (React "storing info from previous renders" pattern) so no effect is
  // needed. `open` shadows the previous paneOpen: swap is true only when release.id changes while
  // the pane was already open.
  const [vswap, setVswap] = useState<{ id: string; swap: boolean; open: boolean }>({
    id: release.id,
    swap: false,
    open: false,
  });
  if (release.id !== vswap.id) {
    setVswap({ id: release.id, swap: vswap.open, open: paneOpen });
  } else if (paneOpen !== vswap.open) {
    setVswap((s) => ({ ...s, open: paneOpen }));
  }

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
    <div className={s.dtIn}>
      <div key={vswap.id} className={vswap.swap ? s.swap : undefined}>
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
            <b className={s.dtVer}>{verOf(release)}</b>
          </div>
          <span className={isCurrent ? s.tagNow : s.tagOld}>
            {isCurrent ? "Current baseline" : "Superseded"}
          </span>
        </div>

        <dl className={s.meta}>
          <div>
            <dt>Processor Baseline ID:</dt>
            <dd>{release.processingBaseline ?? "—"}</dd>
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
          <ReleaseNotes
            html={release.notesId ? notes[release.notesId] : undefined}
          />
        </div>
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

  const navigate: Navigate = useCallback(
    (next: ProcessorsView, mode: "push" | "replace") => {
      const href = viewHref(next);
      if (mode === "push") window.history.pushState(null, "", href);
      else window.history.replaceState(null, "", href);
    },
    [],
  );

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

  // §11 / Decision 11 — orbit rotation state and refs.
  const posRef = useRef(MISSION_ORDER.indexOf(activeMission) as number);
  const [tweenTarget, setTweenTarget] = useState<MissionId | null>(null);
  const tweenTargetRef = useRef<MissionId | null>(null);
  const tweenParamsRef = useRef<{
    fromPos: number;
    toIdx: number;
    dur: number;
    mainIdx: number;
  } | null>(null);
  // SpaceBackdrop turn — set once per mission change (§11 deviation: SpaceBackdrop eases 900ms
  // ease-out cubic independently; the orbit rAF runs its own 1300+600n ms ease-in-out cubic).
  const [turn, setTurn] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const { STEP } = orbitGeometry();
    return MISSION_ORDER.indexOf(activeMission) * STEP;
  });
  const sheetMainRef = useRef<HTMLDivElement | null>(null);
  const sheetOverRef = useRef<HTMLDivElement | null>(null);
  // All four satellite images are always in the DOM so the rAF can target them without re-mounting.
  const satImgRefs = useRef<Record<MissionId, HTMLImageElement | null>>({
    "1": null,
    "2": null,
    "3": null,
    "5P": null,
  });
  // displayedMission: what the main sheet shows. Stays at the outgoing mission during the tween.
  const [displayedMission, setDisplayedMission] =
    useState<MissionId>(activeMission);
  const prevMissionRef = useRef<MissionId>(activeMission);

  // Main-sheet groups (outgoing mission during tween so the sheet stays still while rotating away).
  const missionGroups = useMemo(
    () => allGroups.filter((g) => g.mission === displayedMission),
    [allGroups, displayedMission],
  );

  // KPI groups always follow the URL mission (switch to incoming at tween start — §11 point 4).
  const kpiGroups = useMemo(
    () => allGroups.filter((g) => g.mission === activeMission),
    [allGroups, activeMission],
  );

  // Overlay groups: the incoming mission's processors for the overlay sheet (§11 point 1).
  const overlayGroups = useMemo(
    () =>
      tweenTarget
        ? allGroups.filter((g) => g.mission === tweenTarget)
        : NO_GROUPS,
    [allGroups, tweenTarget],
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

  /* Refs and state for the overview ↔ detail FLIP (Decision 12, §10). */
  const containerRef = useRef<HTMLElement>(null);
  const procpaneRef = useRef<HTMLElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const flipFrom = useRef<DOMRect | null>(null);
  const [focusClass, setFocusClass] = useState(false);
  const [detailOn, setDetailOn] = useState(false);
  const [lcolEnter, setLcolEnter] = useState(false);
  const pumpHorizon = useHorizonMask(containerRef, procpaneRef, detailRef);

  // Overview ↔ detail motion orchestration (Decision 12, §10).
  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let t1: ReturnType<typeof setTimeout> | undefined;
    let t2: ReturnType<typeof setTimeout> | undefined;
    let t3: ReturnType<typeof setTimeout> | undefined;

    if (isDetail) {
      if (procpaneRef.current)
        flipFrom.current = procpaneRef.current.getBoundingClientRect();
      // Deferred so the setState doesn't cascade directly into useLayoutEffect([focusClass]).
      t1 = setTimeout(() => setFocusClass(true), 0);
      const t1b = setTimeout(() => setDetailOn(true), reduce ? 0 : 180);
      return () => {
        clearTimeout(t1);
        clearTimeout(t1b);
      };
    } else {
      // Deferred so the setState doesn't sit directly in the effect body.
      t1 = setTimeout(() => setDetailOn(false), 0);
      t2 = setTimeout(
        () => {
          if (procpaneRef.current)
            flipFrom.current = procpaneRef.current.getBoundingClientRect();
          setFocusClass(false);
          setLcolEnter(true);
          t3 = setTimeout(() => setLcolEnter(false), 560);
        },
        reduce ? 0 : 280,
      );
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isDetail]);

  // FLIP: after focusClass changes the grid, animate procpane from its old position to the new.
  useLayoutEffect(() => {
    if (!flipFrom.current) return;
    const el = procpaneRef.current;
    if (!el) return;
    const after = el.getBoundingClientRect();
    const dx = flipFrom.current.left - after.left;
    const dy = flipFrom.current.top - after.top;
    flipFrom.current = null;
    if (
      (dx === 0 && dy === 0) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const cancelPump = pumpHorizon(820);
    el.style.transform = `translate(${dx}px, ${dy}px)`;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "transform 720ms cubic-bezier(.2,.7,.2,1)";
        el.style.transform = "";
        const done = () => {
          el.style.transition = "";
          el.removeEventListener("transitionend", done);
        };
        el.addEventListener("transitionend", done);
      });
    });
    return cancelPump;
  }, [focusClass]); // eslint-disable-line react-hooks/exhaustive-deps

  // One Escape handler: if a dropdown is open close it first, else close the detail.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const openDrop =
        document.querySelector<HTMLDetailsElement>("details[open]");
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

  // A: Preload all four satellite images on mount so the tween never shows a blank frame.
  useEffect(() => {
    for (const src of Object.values(SATELLITE_IMAGES)) {
      const img = new Image();
      img.src = src;
      img.decode().catch(() => {});
    }
  }, []);

  // §11 / Decision 11 — detect URL mission change and start the orbit tween (or instant-swap).
  useEffect(() => {
    const from = prevMissionRef.current;
    const to = activeMission;
    if (from === to) return;
    prevMissionRef.current = to;
    const toIdx = MISSION_ORDER.indexOf(to);

    if (isDetail) {
      // Release open: instant swap — avoid collision with the FLIP (§11).
      // Deferred so setTweenTarget doesn't cascade into useLayoutEffect([tweenTarget]).
      let cancelled = false;
      setTimeout(() => {
        if (cancelled) return;
        setTweenTarget(null);
        tweenTargetRef.current = null;
        posRef.current = toIdx;
        const { STEP } = orbitGeometry();
        setTurn(toIdx * STEP);
        setDisplayedMission(to);
      }, 0);
      return () => {
        cancelled = true;
      };
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      posRef.current = toIdx;
      const { STEP } = orbitGeometry();
      setTurn(toIdx * STEP);
      setDisplayedMission(to);
      return;
    }
    const fromPos = posRef.current;
    const { STEP } = orbitGeometry();
    setTurn(toIdx * STEP); // SpaceBackdrop eases independently (§11 deviation, Decision 11)
    const steps = Math.abs(toIdx - fromPos);
    const dur = 1300 + 600 * Math.max(0, steps - 1); // §11: 1300 + 600·(n−1) ms
    const mainIdx = MISSION_ORDER.indexOf(from);
    tweenParamsRef.current = { fromPos, toIdx, dur, mainIdx };
    tweenTargetRef.current = to;
    setTweenTarget(to); // triggers overlay render; useLayoutEffect starts the rAF after commit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMission]);

  // Start the rAF only after the overlay DOM is committed (avoids refs being null on frame 1).
  useLayoutEffect(() => {
    if (!tweenTarget || !tweenParamsRef.current) return;

    const { fromPos, toIdx, dur, mainIdx } = tweenParamsRef.current;
    const toMission = tweenTarget;
    const mainMission = MISSION_ORDER[mainIdx] as MissionId;

    // Read ALL geometry before any style write (§11 issue-2 fix).
    const W = window.innerWidth;
    const H = window.innerHeight - NAV_H;
    const centreY_stage = H + 6133.05 * (H / 1600);
    const centreY_vp = NAV_H + centreY_stage;
    let STEP_f = (W * 1.08) / (centreY_stage - H / 2);
    const pcx = W / 2;
    const pcy = centreY_vp;

    const sheetMainR = sheetMainRef.current?.getBoundingClientRect();
    const sheetOverR = sheetOverRef.current?.getBoundingClientRect();
    const orbitR = (
      satImgRefs.current[mainMission] ?? satImgRefs.current[toMission]
    )?.getBoundingClientRect();

    const mainSheetO = {
      x: sheetMainR ? pcx - sheetMainR.left : 0,
      y: sheetMainR ? pcy - sheetMainR.top : 0,
    };
    const overSheetO = {
      x: sheetOverR ? pcx - sheetOverR.left : 0,
      y: sheetOverR ? pcy - sheetOverR.top : 0,
    };
    const orbitO = {
      x: orbitR ? pcx - orbitR.left : 0,
      y: orbitR ? pcy - orbitR.top : 0,
    };

    // Pre-hide incoming satellite before first paint (cleared by clearStyles at end/cancel).
    const toSatEl = satImgRefs.current[toMission];
    if (toSatEl) {
      toSatEl.style.visibility = "hidden";
      toSatEl.style.opacity = "0";
    }

    let raf = 0;
    let t0 = 0; // captured on first rAF frame so slow renders don't eat the tween budget

    const clearStyles = () => {
      for (const r of [sheetMainRef, sheetOverRef]) {
        const el = r.current;
        if (!el) continue;
        el.style.opacity = "";
        el.style.visibility = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
      for (const mid of [mainMission, toMission] as MissionId[]) {
        const el = satImgRefs.current[mid];
        if (!el) continue;
        el.style.opacity = "";
        el.style.visibility = "";
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
    };

    const applyEl = (
      el: HTMLElement | null,
      origin: { x: number; y: number },
      off: number,
    ) => {
      if (!el) return;
      const abs = Math.abs(off);
      if (abs >= 0.999) {
        el.style.opacity = "0";
        el.style.visibility = "hidden";
        el.style.transform = "";
        return;
      }
      el.style.visibility = "";
      el.style.opacity = String(Math.max(0, 1 - abs * 1.4));
      el.style.transformOrigin = `${origin.x.toFixed(1)}px ${origin.y.toFixed(1)}px`;
      el.style.transform = `rotate(${(off * STEP_f).toFixed(5)}rad)`;
    };

    const frame = (now_t: number) => {
      if (t0 === 0) t0 = now_t;
      const q = Math.min(1, (now_t - t0) / dur);
      const e = easeInOutCubic(q);
      const pos = fromPos + (toIdx - fromPos) * e;
      posRef.current = pos;

      applyEl(sheetMainRef.current, mainSheetO, mainIdx - pos);
      applyEl(sheetOverRef.current, overSheetO, toIdx - pos);
      applyEl(satImgRefs.current[mainMission], orbitO, mainIdx - pos);
      applyEl(satImgRefs.current[toMission], orbitO, toIdx - pos);

      if (q < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        posRef.current = toIdx;
        setDisplayedMission(toMission);
        setTweenTarget(null);
        tweenTargetRef.current = null;
      }
    };

    const onResize = () => {
      const W2 = window.innerWidth;
      const H2 = window.innerHeight - NAV_H;
      const c2 = H2 + 6133.05 * (H2 / 1600);
      STEP_f = (W2 * 1.08) / (c2 - H2 / 2);
    };
    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      clearStyles();
    };
  }, [tweenTarget]);

  // KPI formulas: last year = ms in (now-365d, now]; latest = year of max ms <= now; "—" when not ok.
  const kpiReleases = kpiGroups.flatMap((g) => g.releases);
  const lastYearCutoff = now - 365 * DAY_MS;
  const latestMs = kpiReleases.reduce(
    (m, r) => (r.ms <= now ? Math.max(m, r.ms) : m),
    0,
  );
  const counters = [
    { value: data.ok ? String(kpiGroups.length) : "—", label: "Processors" },
    { value: data.ok ? String(kpiReleases.length) : "—", label: "Releases" },
    {
      value: data.ok
        ? String(
            kpiReleases.filter((r) => r.ms > lastYearCutoff && r.ms <= now)
              .length,
          )
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
    <section className={s.container} ref={containerRef}>
      <SpaceBackdrop page={2} turn={turn} />

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
          trade places on the grid so the timeline compresses to the left as the detail opens.
          The grid flips between "lcol proc" (overview) and "proc detail" (focus) via a
          JS FLIP on the procpane element. The lcol stays absolutely painted while
          focused so the satellite can fade smoothly before being aria-hidden. */}
      <div className={`${s.split} ${focusClass ? s.focus : ""}`}>
        {/* Satellite column: not sticky, no glow/blend/placeholder. Hidden while detail is open. */}
        <section
          className={`${s.lcol} ${lcolEnter ? s.lcolEnter : ""}`}
          aria-label={`Sentinel-${activeMission}`}
          aria-hidden={focusClass || undefined}
        >
          {/* All four images always in DOM so the rAF can target them without re-mounting.
              .satOff hides non-active/non-target images; rAF writes inline styles on top. */}
          <div className={s.orbit}>
            {MISSION_ORDER.map((mid) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={mid}
                ref={(el) => {
                  satImgRefs.current[mid] = el;
                }}
                src={SATELLITE_IMAGES[mid]}
                className={`${s.sat}${mid !== displayedMission && mid !== tweenTarget ? ` ${s.satOff}` : ""}`}
                alt={mid === activeMission ? `Sentinel-${mid} satellite` : ""}
                aria-hidden={mid !== activeMission || undefined}
              />
            ))}
          </div>
        </section>

        {/* `.tweening` lifts overflow-x so rotating sheets can extend outside (§11). */}
        <section
          className={`${s.procpane} ${tweenTarget ? s.tweening : ""}`}
          ref={procpaneRef}
        >
          {/* Outgoing mission sheet — rotated away by the rAF tween (§11). */}
          <div ref={sheetMainRef} className={s.sheet}>
            <div className={s.phead}>
              <h2>{MISSION_NAMES[displayedMission]} processors</h2>
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
                <a
                  className={`${s.retry} ${x.retryLink}`}
                  href={viewHref(view)}
                >
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

          {/* Incoming mission sheet — full heading + timeline, swings in during the tween (§11).
              inert + aria-hidden: no focus, no events, no tooltip. */}
          {tweenTarget && (
            <div
              ref={sheetOverRef}
              className={`${s.sheet} ${s.sheetOver}`}
              aria-hidden="true"
              inert
            >
              <div className={s.phead}>
                <h2>{MISSION_NAMES[tweenTarget]} processors</h2>
              </div>
              <div className={s.tlBar}>
                <span className={s.tlCap}>Release timeline</span>
              </div>
              {overlayGroups.length > 0 && (
                <ReleaseTimeline
                  groups={overlayGroups}
                  now={now}
                  range={view.range}
                  baselineFilter={view.baseline}
                  query={normalisedQuery}
                  selected={null}
                  onPick={() => {}}
                />
              )}
            </div>
          )}
        </section>

        <section
          ref={detailRef}
          className={`${s.detailpane} ${detailOn ? s.on : ""}`}
          aria-live="polite"
          aria-hidden={focusClass ? undefined : true}
          style={
            detailGroup
              ? ({
                  "--pr-mis": `var(--pr-mis-${detailGroup.mission})`,
                } as CSSProperties)
              : undefined
          }
        >
          {detailGroup && detailIndex >= 0 && (
            <ReleaseDetail
              group={detailGroup}
              notes={data.ok ? data.notes : NO_NOTES}
              index={detailIndex}
              view={view}
              navigate={navigate}
              paneOpen={isDetail}
            />
          )}
        </section>
      </div>
    </section>
  );
}
