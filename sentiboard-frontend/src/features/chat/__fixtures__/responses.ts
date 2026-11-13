// Raw assistant response strings derived from docs/design/chatbot-integration-guide.md §3.

// ---- One marker per type -------------------------------------------------------

export const RES_KPI_DIRECT =
  `Completeness was high last week.\n` +
  `<kpi label="Completeness" value="98.5%" color="green" delta="up 1.2 points" />`;

export const RES_KPI_ARTIFACT =
  `Availability summary from the latest run.\n` +
  `<kpi data_id="artifact_ABC123" title="Availability overview" />`;

export const RES_TABULAR =
  `Here are the partial datatakes.\n` +
  `<tabular data_id="artifact_ABC123" title="Partial datatakes" sort_column="completeness_percentage" sort_order="asc" />`;

export const RES_TEMPORAL_PLOT =
  `Completeness trend for the selected period.\n` +
  `<temporal-plot data_id="artifact_ABC123" date_column="bucket_start" numeric_column="mean_completeness_percentage" categorical_column="mission" title="Completeness trend" event_data_id="artifact_DEF456" context_event_data_id="artifact_GHI789" />`;

export const RES_COUNT_HISTOGRAM =
  `Datatake counts by mission and date.\n` +
  `<count-histogram data_id="artifact_ABC123" date_column="bucket_start" category_column="mission" count_column="record_count" title="Datatake counts" />`;

export const RES_EVENT_CALENDAR =
  `CAMS events for the period.\n` +
  `<event-calendar data_id="artifact_ABC123" title="CAMS events" />`;

// ---- Mix of several markers in source order ------------------------------------

export const RES_MIXED =
  `Overall completeness was high.\n` +
  `<kpi label="Completeness" value="98.5%" color="green" />\n` +
  `See the trend below.\n` +
  `<temporal-plot data_id="artifact_ABC123" date_column="bucket_start" numeric_column="mean_completeness_percentage" />\n` +
  `Full datatake list:\n` +
  `<tabular data_id="artifact_XYZ456" />`;

// ---- Prose before and after a marker -------------------------------------------

export const RES_PROSE_AROUND =
  `The following calendar shows the anomaly events for the selected period:\n` +
  `<event-calendar data_id="artifact_123abc" />\n` +
  `Please review the events carefully and report any discrepancies.`;

// ---- Malformed and rejection cases ---------------------------------------------

// Unknown tag name — stays as markdown
export const RES_MALFORMED_UNKNOWN_TAG =
  `Check this out: <unknown data_id="artifact_ABC" /> and more text.`;

// Duplicate attribute — stays as markdown
export const RES_MALFORMED_DUPLICATE_ATTR =
  `<kpi label="A" label="B" value="99%" />`;

// Missing required attribute (data_id absent for tabular)
export const RES_MALFORMED_MISSING_REQUIRED =
  `<tabular title="No data_id here" />`;

// data_id with wrong case prefix ("Artifact_" instead of "artifact_")
export const RES_MALFORMED_BAD_DATA_ID_CASE =
  `<tabular data_id="Artifact_ABC123" />`;

// data_id without the "artifact_" prefix entirely
export const RES_MALFORMED_BAD_DATA_ID_PREFIX =
  `<tabular data_id="data_ABC123" />`;

// column name starting with a digit
export const RES_MALFORMED_BAD_COLUMN_DIGIT =
  `<tabular data_id="artifact_abc" sort_column="1bad_col" />`;

// column name exceeding 64 characters
export const RES_MALFORMED_BAD_COLUMN_LONG =
  `<tabular data_id="artifact_abc" sort_column="${"a".repeat(65)}" />`;

// sort_order with wrong capitalisation
export const RES_MALFORMED_BAD_SORT_ORDER =
  `<tabular data_id="artifact_ABC" sort_column="col" sort_order="DESC" />`;

// KPI direct with unknown color
export const RES_MALFORMED_BAD_KPI_COLOR =
  `<kpi label="X" value="1" color="yellow" />`;

// KPI direct — the model outputs a double quote inside a quoted value.
// The regex matches label="He said " (stops at the inner quote), leaving
// trailing malformed content; parseAttributes returns null.
export const RES_MALFORMED_DOUBLE_QUOTE_IN_VALUE =
  `<kpi label="He said "hi"" value="1" />`;

// count-histogram with neither date_column nor category_column
export const RES_MALFORMED_HISTOGRAM_NO_GROUP =
  `<count-histogram data_id="artifact_ABC" count_column="count" />`;

// KPI with both data_id (artifact form) and label (direct form) — mixed forms
export const RES_MALFORMED_KPI_MIXED_FORMS =
  `<kpi data_id="artifact_ABC" label="X" value="1" />`;

// Unknown attribute on tabular
export const RES_MALFORMED_UNKNOWN_ATTR =
  `<tabular data_id="artifact_ABC" unknown_attr="x" />`;

// Empty required attribute (data_id present but empty string)
export const RES_MALFORMED_EMPTY_REQUIRED =
  `<tabular data_id="" />`;

// ---- Edge cases for no-throw guarantee -----------------------------------------

export const RES_EMPTY = ``;

export const RES_ONLY_WHITESPACE = `   \n\n   `;

export const RES_ONLY_MARKER =
  `<kpi label="X" value="1" />`;

export const RES_ONLY_MARKERS =
  `<kpi label="X" value="1" /><event-calendar data_id="artifact_abc" />`;

// A tag that starts but never closes
export const RES_UNCLOSED_TAG =
  `Some text <kpi label="Completeness" value="98.5%" not properly closed`;

// A very large string with one valid marker in the middle
export const RES_HUGE_STRING =
  `${"x".repeat(5000)}<kpi label="A" value="1" />${"y".repeat(5000)}`;
