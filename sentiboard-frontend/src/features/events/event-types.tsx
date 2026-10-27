/* Shared type-colour, icon-path and completeness logic for the Events page.
   Values are exact copies from the prototype (docs/design/events-prototype-ref.md). */

import type { EventCategory, EventDatatake } from "./model";

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  Acquisition: "#A7B1BE",
  Calibration: "#4FC9CB",
  Manoeuvre:   "#EFA73C",
  Production:  "#B45CF2",
  Satellite:   "#F2772B",
};

/** SVG inner markup for each category (16×16 viewBox, no fill, stroke on the parent `<svg>`). */
export const CATEGORY_SVG_INNER: Record<EventCategory, string> = {
  Acquisition:
    '<ellipse cx="6.6" cy="6.8" rx="4.5" ry="2.5" transform="rotate(-40 6.6 6.8)"/>' +
    '<path d="M6.6 6.8 10.1 3.3"/>' +
    '<circle cx="10.6" cy="2.8" r="0.9"/>' +
    '<path d="M8.4 8.8 10.7 13.1"/>' +
    '<path d="M8.5 13.3h4.4"/>',
  Calibration:
    '<circle cx="8" cy="8" r="5.3"/>' +
    '<path d="M6.1 9.9 9.9 6.1"/>',
  Manoeuvre:
    '<circle cx="8" cy="5.3" r="2.3"/>' +
    '<path d="M8 7.6v4.3M5.2 13.3h5.6"/>',
  Production:
    '<circle cx="8" cy="8" r="2.4"/>' +
    '<path d="M8 1.6v2.2M8 12.2v2.2M1.6 8h2.2M12.2 8h2.2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M12.5 3.5 11 5M5 11l-1.5 1.5"/>',
  Satellite:
    '<path d="M8 4.1 11.9 8 8 11.9 4.1 8z"/>' +
    '<path d="M11.6 4.4 13.7 2.3M2.3 13.7l2.1-2.1"/>' +
    '<path d="M13.4 2.9 3 13.3"/>',
};

/** Render a category icon as a React SVG element (16×16 viewBox, prototype stroke style). */
export function CategoryIcon({
  category,
  color,
  size = 14,
}: {
  category: EventCategory;
  color: string;
  size?: number;
}) {
  // dangerouslySetInnerHTML is safe here — values are static, hardcoded above.
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: CATEGORY_SVG_INNER[category] }}
    />
  );
}

/* ---- datatake completeness & status ---- */

export type DatatakeStatus = "acquired" | "partial" | "lost" | "noData";

export const STATUS_COLOR: Record<DatatakeStatus, string> = {
  acquired: "#3FCF7F",
  partial:  "#F0A63A",
  lost:     "#E8514B",
  noData:   "#6B7280",
};

export const STATUS_LABEL: Record<DatatakeStatus, string> = {
  acquired: "ACQUIRED",
  partial:  "PARTIAL",
  lost:     "LOST",
  noData:   "NO DATA",
};

/** Mean of the non-null levels (L0/L1/L2). Returns null when all levels are null. */
export function meanCompleteness(dt: EventDatatake): number | null {
  const vals = [dt.L0, dt.L1, dt.L2].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Classify one datatake: mean ≥ 90 → acquired, ≥ 10 → partial, < 10 → lost, no data → noData. */
export function classifyDatatake(dt: EventDatatake): DatatakeStatus {
  const pct = meanCompleteness(dt);
  if (pct === null) return "noData";
  if (pct >= 90) return "acquired";
  if (pct >= 10) return "partial";
  return "lost";
}

/** Classify overall impact for an event's datatake list.
 *  Red (lost) if any LOST, orange (partial) if any PARTIAL, green (acquired) if all ACQUIRED,
 *  grey (noData) if all NO DATA or the list is empty. */
export function classifyImpact(datatakes: EventDatatake[]): DatatakeStatus {
  const statuses = datatakes.map(classifyDatatake);
  if (statuses.some((s) => s === "lost")) return "lost";
  if (statuses.some((s) => s === "partial")) return "partial";
  if (statuses.some((s) => s === "acquired")) return "acquired";
  return "noData";
}
