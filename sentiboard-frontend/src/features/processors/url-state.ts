/* Filter and selection state of the Processors page, as URL search params, so every view can be
   shared and deep-linked. Shared by the server (page, release list) and the client (explorer).

     mission   s1 | s2 | s3 | s5p      default s1
     range     1y | 2y | all           default all
     baseline  all | current           default all
     q         free text search        default ""
     release   <record id>:<IPF>       default none (the overview)

   Defaults are left out of the URL; unknown values fall back to the default. A release that
   belongs to another mission wins over `mission` (resolveView). */

import { MISSION_ORDER, type MissionId, type ProcessorGroup } from "./model";

export const RANGES = ["1Y", "2Y", "ALL"] as const;
export type Range = (typeof RANGES)[number];

/** "all" shows every baseline on the timeline; "current" shows only the baseline in force. */
export type BaselineFilter = "all" | "current";

export interface ProcessorsView {
  mission: MissionId;
  range: Range;
  baseline: BaselineFilter;
  q: string;
  release: string | null;
}

export const DEFAULT_VIEW: ProcessorsView = {
  mission: "1",
  range: "ALL",
  baseline: "all",
  q: "",
  release: null,
};

export const PROCESSORS_PATH = "/processors";

const missionParam = (m: MissionId) => `s${m.toLowerCase()}`;

type ParamSource =
  | URLSearchParams
  | { get(name: string): string | null }
  | Record<string, string | string[] | undefined>;

function reader(src: ParamSource): (name: string) => string | null {
  if (typeof (src as URLSearchParams).get === "function") {
    return (name) => (src as URLSearchParams).get(name);
  }
  return (name) => {
    const v = (src as Record<string, string | string[] | undefined>)[name];
    return (Array.isArray(v) ? v[0] : v) ?? null;
  };
}

export function parseView(src: ParamSource): ProcessorsView {
  const get = reader(src);
  const m = get("mission")?.toLowerCase();
  const r = get("range")?.toUpperCase();
  const b = get("baseline")?.toLowerCase();
  return {
    mission: MISSION_ORDER.find((id) => missionParam(id) === m) ?? DEFAULT_VIEW.mission,
    range: RANGES.find((x) => x === r) ?? DEFAULT_VIEW.range,
    baseline: b === "current" ? "current" : "all",
    q: get("q") ?? "",
    release: get("release") || null,
  };
}

/** Search params for a view, defaults left out. */
export function viewParams(view: ProcessorsView): URLSearchParams {
  const p = new URLSearchParams();
  if (view.mission !== DEFAULT_VIEW.mission) p.set("mission", missionParam(view.mission));
  if (view.range !== DEFAULT_VIEW.range) p.set("range", view.range.toLowerCase());
  if (view.baseline !== DEFAULT_VIEW.baseline) p.set("baseline", view.baseline);
  if (view.q) p.set("q", view.q);
  if (view.release) p.set("release", view.release);
  return p;
}

/** Link to a view of the Processors page. */
export function viewHref(view: ProcessorsView): string {
  const qs = viewParams(view).toString();
  return qs ? `${PROCESSORS_PATH}?${qs}` : PROCESSORS_PATH;
}

/** The mission of `release` replaces `mission` when they disagree; an unknown release is dropped. */
export function resolveView(view: ProcessorsView, groups: ProcessorGroup[]): ProcessorsView {
  if (!view.release) return view;
  const group = groups.find((g) => g.releases.some((r) => r.id === view.release));
  if (!group) return { ...view, release: null };
  return group.mission === view.mission ? view : { ...view, mission: group.mission };
}
