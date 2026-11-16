/* What the chatbot is told about the page the user is on, sent with every message.

   Built from the browser URL at send time, so it follows filter changes made with
   history.pushState/replaceState without a reload. Each page's own URL-state parser is reused,
   so the context shows the *effective* view (defaults and fallbacks applied), not the raw params.

   Shape (the chatbot's SentiBoardContext accepts only these three fields):
     page_id    key of ROUTES (src/lib/routes.ts), e.g. "events"; null for an unknown path
     filters    always { url, path, page_title, now, time_zone? } + the page's filters
     selection  the selected item (release, event, datatake), or null

   `url` and `now` live in `filters` because SentiBoardContext rejects extra fields (422).
   Mission ids are normalised to S1 | S2 | S3 | S5P whatever form the page uses.

   Pure and client-safe: no server-only import. */

import type { components } from "@/lib/chatbot/schema";
import { ROUTES } from "@/lib/routes";
import { parseView as parseProcessorsView } from "@/features/processors/url-state";
import { parseView as parseEventsView } from "@/features/events/url-state";
import { parseView as parseAvailabilityView } from "@/features/availability/url-state";
import { parseAcqView } from "@/features/acquisitions/url-state";

export type PageContext = components["schemas"]["SentiBoardContext"];
type Fields = Record<string, unknown>;

export type PageId = keyof typeof ROUTES;

/** "s1", "1", "S1" → "S1"; "s5p", "5P" → "S5P". */
export function normaliseMission(id: string): string {
  return `S${id.replace(/^s/i, "").toUpperCase()}`;
}

/** Mission of a satellite unit id: "S2A" → "S2", "S5P" → "S5P". */
function missionOfSatellite(unit: string): string {
  return unit.toUpperCase() === "S5P" ? "S5P" : unit.slice(0, 2).toUpperCase();
}

const sorted = (values: Iterable<string>) => [...values].sort();

/** Route key for a pathname (without base path), or null. Trailing slashes are ignored. */
export function pageIdOf(pathname: string): PageId | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
  const hit = (Object.keys(ROUTES) as PageId[]).find((k) => ROUTES[k].path === path);
  return hit ?? null;
}

interface PageState {
  filters: Fields;
  selection: Fields | null;
}

function pageState(id: PageId | null, params: URLSearchParams, now: Date): PageState {
  switch (id) {
    case "processors": {
      const v = parseProcessorsView(params);
      return {
        filters: {
          mission: normaliseMission(v.mission),
          range: v.range,
          baseline: v.baseline,
          ...(v.q && { search: v.q }),
        },
        selection: v.release ? { release: v.release } : null,
      };
    }
    case "events": {
      const v = parseEventsView(params, {
        year: now.getUTCFullYear(),
        month: now.getUTCMonth() + 1,
      });
      return {
        filters: {
          year: v.year,
          month: v.month,
          categories_off: sorted(v.typesOff),
          missions_off: sorted([...v.missionsOff].map(normaliseMission)),
          satellites_off: sorted(v.satellitesOff),
          ...(v.q && { search: v.q }),
        },
        selection: v.event ? { event: v.event } : null,
      };
    }
    case "acquisitionsEarth":
    case "acquisitionsGlobe": {
      const v = parseAcqView(params);
      return {
        filters: {
          satellite: v.satellite ?? "all",
          ...(v.satellite && { mission: missionOfSatellite(v.satellite) }),
          day: v.day ?? now.toISOString().slice(0, 10),
        },
        selection: v.datatake ? { datatake: v.datatake } : null,
      };
    }
    case "availability": {
      const v = parseAvailabilityView(params);
      return {
        filters: {
          range_days: v.range ?? "custom",
          ...(v.range !== null && v.offset > 0 && { offset_days: v.offset }),
          ...(v.range === null && { from: v.customFrom, to: v.customTo }),
          missions_off: sorted([...v.missionsOff].map(normaliseMission)),
          statuses_off: sorted(v.statusesOff),
          ...(v.q && { search: v.q }),
        },
        selection: v.pick ? { datatake: v.pick } : null,
      };
    }
    default:
      return { filters: {}, selection: null };
  }
}

/**
 * Context for the page at `href`.
 * @param href      full browser URL (window.location.href)
 * @param basePath  the site's base path (NEXT_PUBLIC_BASE_PATH), "" when served at "/"
 * @param now       the user's current time
 * @param timeZone  the user's IANA time zone, when known
 */
export function buildPageContext(
  href: string,
  basePath: string,
  now: Date,
  timeZone?: string,
): PageContext {
  const url = new URL(href);
  let path = url.pathname;
  if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
    path = path.slice(basePath.length) || "/";
  }
  const id = pageIdOf(path);
  const { filters, selection } = pageState(id, url.searchParams, now);

  return {
    page_id: id,
    filters: {
      url: url.href,
      path,
      page_title: id ? ROUTES[id].title : null,
      now: now.toISOString(),
      ...(timeZone && { time_zone: timeZone }),
      ...filters,
    },
    selection,
  };
}
