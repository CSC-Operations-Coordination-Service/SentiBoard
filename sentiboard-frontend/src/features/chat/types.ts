// Chatbot marker types — hand-written until the partner provides an OpenAPI schema that
// reflects the agreed architecture (session-less, message-list, streaming).
// See DECISIONS.md 2026-11-13 for context.

// ---- Marker types (one per supported tag name) --------------------------------

export type TabularMarker = {
  kind: "tabular";
  data_id: string;
  title?: string;
  sort_column?: string;
  sort_order?: "asc" | "desc";
};

export type TemporalPlotMarker = {
  kind: "temporal-plot";
  data_id: string;
  date_column: string;
  numeric_column: string;
  categorical_column?: string;
  title?: string;
  event_data_id?: string;
  context_event_data_id?: string;
};

export type CountHistogramMarker = {
  kind: "count-histogram";
  data_id: string;
  count_column: string;
  date_column?: string;
  category_column?: string;
  title?: string;
};

export type EventCalendarMarker = {
  kind: "event-calendar";
  data_id: string;
  title?: string;
};

export type KpiArtifactMarker = {
  kind: "kpi-artifact";
  data_id: string;
  title?: string;
};

export type KpiDirectMarker = {
  kind: "kpi-direct";
  label: string;
  value: string;
  color?: "green" | "orange" | "red" | "blue" | "gray";
  delta?: string;
};

export type WidgetMarker =
  | TabularMarker
  | TemporalPlotMarker
  | CountHistogramMarker
  | EventCalendarMarker
  | KpiArtifactMarker
  | KpiDirectMarker;

// ---- Segments (the output of parseResponse) ----------------------------------

export type MarkdownSegment = { kind: "markdown"; text: string };
export type WidgetSegment = { kind: "widget"; marker: WidgetMarker };
// Emitted when a candidate carries a known tag name but fails attribute validation.
// The raw tag is never placed in the markdown stream; a placeholder is rendered instead.
export type InvalidMarkerSegment = { kind: "invalid-marker"; tag: string; missing: string[] };
export type Segment = MarkdownSegment | WidgetSegment | InvalidMarkerSegment;

// ---- Event-calendar payload types (from partner's JSON schema) ---------------

export type EventCategory =
  | "acquisition"
  | "production"
  | "rfi"
  | "satellite"
  | "other";

export type EventCategoryBasis = "native_origin" | "unclassified";

export type EventStatus =
  | "Open"
  | "Closed"
  | "Delegated"
  | "Duplicated"
  | "Rejected"
  | "Completed"
  | "Returned"
  | "Transferred"
  | "To be deployed"
  | null;

export type EventCriticality = "Blocking" | "Critical" | "Routine" | null;

export type CalendarEvent = {
  key: string;
  occurred_at: string | null;
  title: string;
  description: string;
  category: EventCategory;
  category_basis: EventCategoryBasis;
  origin: string | null;
  status: EventStatus;
  criticality: EventCriticality;
  affected_systems: string[];
  datatake_ids: string[];
  associated_datatake_count: number;
};

export type EventCalendarPayload = {
  data_id: string;
  title: string;
  description: string;
  events: CalendarEvent[];
};

export type TemporalRow = Record<string, unknown>;

export type TabularPayload = {
  data_id: string;
  title: string;
  description: string;
  columns: string[];
  rows: Record<string, unknown>[];
  temporal_rows?: TemporalRow[];
  aggregation?: Record<string, unknown>;
};
