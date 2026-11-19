/* Builds a SentiBoard URL from a <page-link> marker's attributes.
   Marker vocabulary = SentiBoardContext (page ids from ROUTES, missions S1|S2|S3|S5P,
   positive lists). Each page's own parseView validates the result on load and falls
   back to defaults for anything invalid, so no validation is duplicated here. */

import { ROUTES } from "@/lib/routes";
import { MISSIONS as EVENT_MISSIONS } from "@/features/events/model";

type Attrs = Record<string, string | undefined>;

const LINKABLE = ["home", "availability", "events", "acquisitionsGlobe", "processors"] as const;
type LinkablePage = (typeof LINKABLE)[number];

const MISSIONS = ["S1", "S2", "S3", "S5P"];
const STATUSES = ["Planned", "Processing", "Acquired", "Partial", "Unavailable"];
const CATEGORIES = ["Acquisition", "Production", "Manoeuvre", "Calibration", "Satellite"];
const ALL_SATELLITES = Object.values(EVENT_MISSIONS).flat();

/** "S1,S2" → list; empty/missing → null (= all). */
const list = (v?: string) =>
  v ? v.split(",").map((s) => s.trim()).filter(Boolean) : null;

/** Positive list → comma-separated "off" set for the URL; null when nothing is off. */
function offSet(on: string[] | null, all: string[]): string | null {
  if (!on) return null;
  const off = all.filter((x) => !on.includes(x));
  return off.length ? off.join(",") : null;
}

function setIf(p: URLSearchParams, key: string, value: string | null | undefined) {
  if (value) p.set(key, value);
}

export function buildPageLink(attrs: Attrs, basePath = ""): string | null {
  const page = attrs.page as LinkablePage;
  if (!LINKABLE.includes(page)) return null; // fail closed: unknown page drops the link

  const p = new URLSearchParams();

  switch (page) {
    case "availability":
      if (attrs.from && attrs.to) {
        p.set("range", "custom");
        p.set("from", attrs.from);
        p.set("to", attrs.to);
      } else {
        setIf(p, "range", attrs.range_days);
      }
      setIf(p, "missionsOff", offSet(list(attrs.missions), MISSIONS));
      setIf(p, "statusesOff", offSet(list(attrs.statuses), STATUSES));
      setIf(p, "q", attrs.search);
      setIf(p, "pick", attrs.datatake);
      break;

    case "events": {
      setIf(p, "year", attrs.year);
      setIf(p, "month", attrs.month);
      setIf(p, "typesOff", offSet(list(attrs.categories), CATEGORIES));
      const missions = list(attrs.missions)?.map((m) => m.toLowerCase()) ?? null; // Events uses s1, s2…
      setIf(p, "missionsOff", offSet(missions, MISSIONS.map((m) => m.toLowerCase())));
      setIf(p, "satellitesOff", offSet(list(attrs.satellites), ALL_SATELLITES));
      setIf(p, "q", attrs.search);
      setIf(p, "event", attrs.event);
      break;
    }

    case "acquisitionsGlobe":
      setIf(p, "satellite", attrs.satellite);
      setIf(p, "day", attrs.day);
      setIf(p, "datatake", attrs.datatake);
      break;

    case "processors":
      setIf(p, "mission", attrs.mission?.toLowerCase()); // URL uses s1, s2…
      setIf(p, "range", attrs.range?.toLowerCase());
      setIf(p, "baseline", attrs.baseline);
      setIf(p, "q", attrs.search);
      setIf(p, "release", attrs.release);
      break;
  }

  const qs = p.toString();
  return `${basePath}${ROUTES[page].path}${qs ? `?${qs}` : ""}`;
}