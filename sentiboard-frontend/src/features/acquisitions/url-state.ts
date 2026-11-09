/* Filter and navigation state of the Acquisitions pages, as URL search params.

     satellite   unit id (e.g. "S2A") or absent  default: null = "All satellites" (single-select)
     day         YYYY-MM-DD or absent             default: null = current day (from server)
     datatake    datatake id or absent            default: null = none open

   Defaults are left out of the URL; unknown values fall back to defaults. */

import { ALL_SATELLITES } from "@/lib/missions";
import { type ParamSource, reader } from "@/lib/url-params";

export const ACQUISITIONS_EARTH_PATH = "/acquisitions-globe-earth";
export const ACQUISITIONS_GLOBE_PATH = "/acquisitions-globe";

export interface AcqView {
  satellite: string | null;
  day: string | null;
  datatake: string | null;
}

export const DEFAULT_ACQ_VIEW: AcqView = {
  satellite: null,
  day: null,
  datatake: null,
};

const ALL_SATELLITE_SET = new Set(ALL_SATELLITES);

function isDateStr(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function parseAcqView(src: ParamSource): AcqView {
  const get = reader(src);

  const satRaw = get("satellite");
  const satellite = satRaw && ALL_SATELLITE_SET.has(satRaw) ? satRaw : null;

  const dayRaw = get("day");
  const day = dayRaw && isDateStr(dayRaw) ? dayRaw : null;

  const datatake = get("datatake") || null;

  return { satellite, day, datatake };
}

export function acqViewParams(view: AcqView): URLSearchParams {
  const p = new URLSearchParams();
  if (view.satellite) p.set("satellite", view.satellite);
  if (view.day) p.set("day", view.day);
  if (view.datatake) p.set("datatake", view.datatake);
  return p;
}

export function acqViewHref(view: AcqView, basePath = ACQUISITIONS_EARTH_PATH): string {
  const qs = acqViewParams(view).toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
