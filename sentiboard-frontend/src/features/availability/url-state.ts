/* Filter and navigation state of the Data Availability page, as URL search params (Decision #7).

     range       1 | 7 | 30 | null       default: 30 (null = custom)
     offset      integer ≥ 0             default: 0 (0 = latest window)
     from        YYYY-MM-DD              custom range start (only when range = null)
     to          YYYY-MM-DD              custom range end   (only when range = null)
     missionsOff comma-separated ids     default: "" (all on)   e.g. "S1,S2"
     statusesOff comma-separated values  default: "" (all on)   e.g. "Planned,Partial"
     q           free text               default: ""
     pick        datatake id             default: null (no card open)

   Multi-select toggles: every item starts ON; the URL stores what is OFF so the default URL
   stays clean. Defaults are left out of the URL; unknown values fall back to defaults.

   Decision #14: DELAYED is mapped to Processing before reaching the UI; this module only knows
   the five display statuses. */

import { MISSION_ORDER, STATUS_ORDER, type MissionId, type Status } from "./model";

export type RangeId = 1 | 7 | 30;

export interface AvailabilityView {
  range: RangeId | null; // null = custom
  offset: number;        // days to shift the window back; 0 = latest
  customFrom: string | null; // YYYY-MM-DD, only meaningful when range = null
  customTo: string | null;
  missionsOff: ReadonlySet<MissionId>;
  statusesOff: ReadonlySet<Status>;
  q: string;
  pick: string | null; // picked datatake id
}

export const DEFAULT_VIEW: AvailabilityView = {
  range: 30,
  offset: 0,
  customFrom: null,
  customTo: null,
  missionsOff: new Set(),
  statusesOff: new Set(),
  q: "",
  pick: null,
};

export const AVAILABILITY_PATH = "/availability";

const VALID_RANGES = new Set<number>([1, 7, 30]);
const MISSION_ID_SET = new Set<MissionId>(MISSION_ORDER);
const STATUS_SET = new Set<Status>(STATUS_ORDER);

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

function parseOffSet<T extends string>(
  raw: string | null,
  validate: (v: string) => v is T,
): Set<T> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is T => validate(s)),
  );
}

function isMissionId(v: string): v is MissionId {
  return MISSION_ID_SET.has(v as MissionId);
}

function isStatus(v: string): v is Status {
  return STATUS_SET.has(v as Status);
}

function isDateStr(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function parseView(src: ParamSource): AvailabilityView {
  const get = reader(src);

  const rangeRaw = get("range");
  const rangeN = rangeRaw ? parseInt(rangeRaw, 10) : NaN;
  const range: RangeId | null = VALID_RANGES.has(rangeN)
    ? (rangeN as RangeId)
    : rangeRaw === "custom"
      ? null
      : DEFAULT_VIEW.range;

  const offsetRaw = parseInt(get("offset") ?? "", 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

  const fromRaw = get("from");
  const toRaw = get("to");
  const customFrom = fromRaw && isDateStr(fromRaw) ? fromRaw : null;
  const customTo = toRaw && isDateStr(toRaw) ? toRaw : null;

  const missionsOff = parseOffSet(get("missionsOff"), isMissionId);
  const statusesOff = parseOffSet(get("statusesOff"), isStatus);

  return {
    range,
    offset,
    customFrom,
    customTo,
    missionsOff,
    statusesOff,
    q: get("q") ?? "",
    pick: get("pick") || null,
  };
}

/** Serialise a view to search params; defaults are left out. */
export function viewParams(view: AvailabilityView): URLSearchParams {
  const p = new URLSearchParams();
  if (view.range !== DEFAULT_VIEW.range) {
    p.set("range", view.range === null ? "custom" : String(view.range));
  }
  if (view.offset !== 0) p.set("offset", String(view.offset));
  if (view.range === null) {
    if (view.customFrom) p.set("from", view.customFrom);
    if (view.customTo) p.set("to", view.customTo);
  }
  if (view.missionsOff.size > 0) p.set("missionsOff", [...view.missionsOff].join(","));
  if (view.statusesOff.size > 0) p.set("statusesOff", [...view.statusesOff].join(","));
  if (view.q) p.set("q", view.q);
  if (view.pick) p.set("pick", view.pick);
  return p;
}

export function viewHref(view: AvailabilityView): string {
  const qs = viewParams(view).toString();
  return qs ? `${AVAILABILITY_PATH}?${qs}` : AVAILABILITY_PATH;
}

export const RANGE_LABEL: Record<string, string> = {
  "1": "Last 24 hours",
  "7": "Last 7 days",
  "30": "Last 30 days",
  custom: "Custom range",
};
