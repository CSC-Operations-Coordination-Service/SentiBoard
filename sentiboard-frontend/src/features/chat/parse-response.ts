import type { Segment, WidgetMarker } from "./types";
import { findMarkerCandidates, parseAttributes } from "./marker-syntax";

// Maximum length for text attributes (label, value, title, delta).
// The guide says "length-bounded" but gives no limit — 200 chars is a named assumption.
// See DECISIONS.md 2026-11-13.
export const TEXT_ATTR_MAX_LEN = 200;

const DATA_ID_RE = /^artifact_[A-Za-z0-9]+$/; // case-sensitive per the guide
const COLUMN_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

function isDataId(v: string): boolean {
  return DATA_ID_RE.test(v);
}

function isColumn(v: string): boolean {
  return COLUMN_RE.test(v);
}

function isSortOrder(v: string): v is "asc" | "desc" {
  return v === "asc" || v === "desc";
}

function isKpiColor(
  v: string,
): v is "green" | "orange" | "red" | "blue" | "gray" {
  return (
    v === "green" || v === "orange" || v === "red" || v === "blue" || v === "gray"
  );
}

function isTextAttr(v: string): boolean {
  return v.length > 0 && v.length <= TEXT_ATTR_MAX_LEN;
}

// Returns the attribute value if present and non-empty, else null.
function req(attrs: Map<string, string>, name: string): string | null {
  const v = attrs.get(name);
  return v !== undefined && v.length > 0 ? v : null;
}

// Returns the attribute value if present, else undefined.
function opt(attrs: Map<string, string>, name: string): string | undefined {
  return attrs.get(name);
}

// Allowed attribute sets per tag form.
const ALLOWED_TABULAR = new Set(["data_id", "title", "sort_column", "sort_order"]);
const ALLOWED_TEMPORAL_PLOT = new Set([
  "data_id", "date_column", "numeric_column", "categorical_column",
  "title", "event_data_id", "context_event_data_id",
]);
const ALLOWED_COUNT_HISTOGRAM = new Set([
  "data_id", "count_column", "date_column", "category_column", "title",
]);
const ALLOWED_EVENT_CALENDAR = new Set(["data_id", "title"]);
const ALLOWED_KPI_BROAD = new Set(["data_id", "title", "label", "value", "color", "delta"]);
const ALLOWED_KPI_ARTIFACT = new Set(["data_id", "title"]);
const ALLOWED_KPI_DIRECT = new Set(["label", "value", "color", "delta"]);

function hasUnknownAttrs(attrs: Map<string, string>, allowed: Set<string>): boolean {
  for (const name of attrs.keys()) {
    if (!allowed.has(name)) return true;
  }
  return false;
}

function validateMarker(tagName: string, attrs: Map<string, string>): WidgetMarker | null {
  switch (tagName) {
    case "tabular": {
      if (hasUnknownAttrs(attrs, ALLOWED_TABULAR)) return null;
      const data_id = req(attrs, "data_id");
      if (!data_id || !isDataId(data_id)) return null;
      const title = opt(attrs, "title");
      if (title !== undefined && !isTextAttr(title)) return null;
      const sort_column = opt(attrs, "sort_column");
      if (sort_column !== undefined && !isColumn(sort_column)) return null;
      const sort_order = opt(attrs, "sort_order");
      if (sort_order !== undefined && !isSortOrder(sort_order)) return null;
      return {
        kind: "tabular",
        data_id,
        ...(title !== undefined && { title }),
        ...(sort_column !== undefined && { sort_column }),
        ...(sort_order !== undefined && { sort_order }),
      };
    }

    case "temporal-plot": {
      if (hasUnknownAttrs(attrs, ALLOWED_TEMPORAL_PLOT)) return null;
      const data_id = req(attrs, "data_id");
      if (!data_id || !isDataId(data_id)) return null;
      const date_column = req(attrs, "date_column");
      if (!date_column || !isColumn(date_column)) return null;
      const numeric_column = req(attrs, "numeric_column");
      if (!numeric_column || !isColumn(numeric_column)) return null;
      const categorical_column = opt(attrs, "categorical_column");
      if (categorical_column !== undefined && !isColumn(categorical_column)) return null;
      const title = opt(attrs, "title");
      if (title !== undefined && !isTextAttr(title)) return null;
      const event_data_id = opt(attrs, "event_data_id");
      if (event_data_id !== undefined && !isDataId(event_data_id)) return null;
      const context_event_data_id = opt(attrs, "context_event_data_id");
      if (context_event_data_id !== undefined && !isDataId(context_event_data_id)) return null;
      return {
        kind: "temporal-plot",
        data_id,
        date_column,
        numeric_column,
        ...(categorical_column !== undefined && { categorical_column }),
        ...(title !== undefined && { title }),
        ...(event_data_id !== undefined && { event_data_id }),
        ...(context_event_data_id !== undefined && { context_event_data_id }),
      };
    }

    case "count-histogram": {
      if (hasUnknownAttrs(attrs, ALLOWED_COUNT_HISTOGRAM)) return null;
      const data_id = req(attrs, "data_id");
      if (!data_id || !isDataId(data_id)) return null;
      const count_column = req(attrs, "count_column");
      if (!count_column || !isColumn(count_column)) return null;
      const date_column = opt(attrs, "date_column");
      if (date_column !== undefined && !isColumn(date_column)) return null;
      const category_column = opt(attrs, "category_column");
      if (category_column !== undefined && !isColumn(category_column)) return null;
      // At least one of date_column or category_column is required.
      if (date_column === undefined && category_column === undefined) return null;
      const title = opt(attrs, "title");
      if (title !== undefined && !isTextAttr(title)) return null;
      return {
        kind: "count-histogram",
        data_id,
        count_column,
        ...(date_column !== undefined && { date_column }),
        ...(category_column !== undefined && { category_column }),
        ...(title !== undefined && { title }),
      };
    }

    case "event-calendar": {
      if (hasUnknownAttrs(attrs, ALLOWED_EVENT_CALENDAR)) return null;
      const data_id = req(attrs, "data_id");
      if (!data_id || !isDataId(data_id)) return null;
      const title = opt(attrs, "title");
      if (title !== undefined && !isTextAttr(title)) return null;
      return {
        kind: "event-calendar",
        data_id,
        ...(title !== undefined && { title }),
      };
    }

    case "kpi": {
      // Reject any truly unknown attribute before distinguishing forms.
      if (hasUnknownAttrs(attrs, ALLOWED_KPI_BROAD)) return null;
      const hasDataId = attrs.has("data_id");
      const hasLabel = attrs.has("label");
      const hasValue = attrs.has("value");
      // Mixed forms are malformed.
      if (hasDataId && (hasLabel || hasValue)) return null;

      if (hasDataId) {
        // Artifact-backed KPI.
        if (hasUnknownAttrs(attrs, ALLOWED_KPI_ARTIFACT)) return null;
        const data_id = req(attrs, "data_id");
        if (!data_id || !isDataId(data_id)) return null;
        const title = opt(attrs, "title");
        if (title !== undefined && !isTextAttr(title)) return null;
        return {
          kind: "kpi-artifact",
          data_id,
          ...(title !== undefined && { title }),
        };
      }

      // Direct KPI.
      if (hasUnknownAttrs(attrs, ALLOWED_KPI_DIRECT)) return null;
      const label = req(attrs, "label");
      if (!label || !isTextAttr(label)) return null;
      const value = req(attrs, "value");
      if (!value || !isTextAttr(value)) return null;
      const color = opt(attrs, "color");
      if (color !== undefined && !isKpiColor(color)) return null;
      const delta = opt(attrs, "delta");
      if (delta !== undefined && !isTextAttr(delta)) return null;
      return {
        kind: "kpi-direct",
        label,
        value,
        ...(color !== undefined && { color }),
        ...(delta !== undefined && { delta }),
      };
    }

    default:
      return null;
  }
}

/**
 * Parses the assistant's raw `response` string into an ordered list of segments.
 * Each segment is either { kind: "markdown", text } or { kind: "widget", marker }.
 *
 * Segments appear in source order so widgets render in place (this differs from the
 * Streamlit reference client, which groups widgets by type — see DECISIONS.md 2026-11-13).
 *
 * Fail-closed: a malformed or unknown marker is never promoted to a widget; it stays as
 * plain markdown text so model errors remain visible. This function never throws.
 *
 * Adjacent markdown pieces merge into one segment; whitespace-only segments are dropped.
 * Math ($$…$$ or $…$) is left inside markdown segments for later KaTeX rendering.
 */
export function parseResponse(raw: string): Segment[] {
  const candidates = findMarkerCandidates(raw);
  const segments: Segment[] = [];
  let pos = 0;
  let pending = "";

  function flushPending(): void {
    if (pending.trim() !== "") segments.push({ kind: "markdown", text: pending });
    pending = "";
  }

  for (const candidate of candidates) {
    pending += raw.slice(pos, candidate.start);

    const attrs = parseAttributes(candidate.rawAttrBody);
    const marker = attrs !== null ? validateMarker(candidate.tagName, attrs) : null;

    if (marker !== null) {
      flushPending();
      segments.push({ kind: "widget", marker });
    } else {
      // Invalid candidate: keep literal text in the markdown stream.
      pending += raw.slice(candidate.start, candidate.end);
    }

    pos = candidate.end;
  }

  pending += raw.slice(pos);
  flushPending();

  return segments;
}
