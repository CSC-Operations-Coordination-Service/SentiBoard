import type { CalendarEvent, EventCalendarPayload } from "./types";

// ---- Internal helpers --------------------------------------------------------

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isStringOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && (v as unknown[]).every(isString);
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

const CATEGORIES = new Set(["acquisition", "production", "rfi", "satellite", "other"]);
const CATEGORY_BASES = new Set(["native_origin", "unclassified"]);
const STATUSES = new Set([
  "Open", "Closed", "Delegated", "Duplicated", "Rejected",
  "Completed", "Returned", "Transferred", "To be deployed",
]);
const CRITICALITIES = new Set(["Blocking", "Critical", "Routine"]);

function validateEvent(raw: Record<string, unknown>, idx: number): CalendarEvent | string {
  if (!isString(raw.key) || raw.key.length === 0) {
    return `events[${idx}].key missing or not a non-empty string`;
  }

  // occurred_at: required field, value may be null or a parseable date string.
  if (!("occurred_at" in raw)) return `events[${idx}].occurred_at is required`;
  if (!isStringOrNull(raw.occurred_at)) {
    return `events[${idx}].occurred_at must be a string or null`;
  }
  if (raw.occurred_at !== null && isNaN(Date.parse(raw.occurred_at))) {
    return `events[${idx}].occurred_at is not a valid date: "${raw.occurred_at}"`;
  }

  if (!isString(raw.title)) return `events[${idx}].title missing or not a string`;
  if (!isString(raw.description)) return `events[${idx}].description missing or not a string`;

  if (!isString(raw.category) || !CATEGORIES.has(raw.category)) {
    return `events[${idx}].category invalid: ${String(raw.category)}`;
  }
  if (!isString(raw.category_basis) || !CATEGORY_BASES.has(raw.category_basis)) {
    return `events[${idx}].category_basis invalid: ${String(raw.category_basis)}`;
  }

  // origin: required, can be null or any string.
  if (!("origin" in raw)) return `events[${idx}].origin is required`;
  if (!isStringOrNull(raw.origin)) {
    return `events[${idx}].origin must be a string or null`;
  }

  // status: required, can be null or one of the enum values.
  if (!("status" in raw)) return `events[${idx}].status is required`;
  if (raw.status !== null && (!isString(raw.status) || !STATUSES.has(raw.status))) {
    return `events[${idx}].status invalid: ${String(raw.status)}`;
  }

  // criticality: required, can be null or one of the enum values.
  if (!("criticality" in raw)) return `events[${idx}].criticality is required`;
  if (
    raw.criticality !== null &&
    (!isString(raw.criticality) || !CRITICALITIES.has(raw.criticality))
  ) {
    return `events[${idx}].criticality invalid: ${String(raw.criticality)}`;
  }

  if (!isStringArray(raw.affected_systems)) {
    return `events[${idx}].affected_systems missing or not a string array`;
  }
  if (!isStringArray(raw.datatake_ids)) {
    return `events[${idx}].datatake_ids missing or not a string array`;
  }
  if (!isNonNegInt(raw.associated_datatake_count)) {
    return `events[${idx}].associated_datatake_count missing or not a non-negative integer`;
  }
  // A count that differs from datatake_ids.length is not an error per spec.

  return {
    key: raw.key,
    occurred_at: raw.occurred_at as string | null,
    title: raw.title,
    description: raw.description,
    category: raw.category as CalendarEvent["category"],
    category_basis: raw.category_basis as CalendarEvent["category_basis"],
    origin: raw.origin,
    status: (raw.status ?? null) as CalendarEvent["status"],
    criticality: (raw.criticality ?? null) as CalendarEvent["criticality"],
    affected_systems: raw.affected_systems as string[],
    datatake_ids: raw.datatake_ids as string[],
    associated_datatake_count: raw.associated_datatake_count as number,
  };
}

// ---- Public API --------------------------------------------------------------

export type ParseEventCalendarOk = { ok: true; data: EventCalendarPayload };
export type ParseEventCalendarErr = { ok: false; reason: string };
export type ParseEventCalendarResult = ParseEventCalendarOk | ParseEventCalendarErr;

/**
 * Validates an unknown JSON value against the EventCalendarDataResponse schema.
 *
 * Returns { ok: true, data } when valid, { ok: false, reason } on any error.
 * Unknown extra fields on events are allowed and ignored (the partner may add fields).
 * Events with occurred_at null are kept — they go in a "No date" group later.
 * A associated_datatake_count that differs from datatake_ids.length is not an error.
 * Never throws.
 */
export function parseEventCalendar(json: unknown): ParseEventCalendarResult {
  if (!isObject(json)) return { ok: false, reason: "payload is not an object" };

  if (!isString(json.data_id) || json.data_id.length === 0) {
    return { ok: false, reason: "data_id missing or not a non-empty string" };
  }
  if (!isString(json.title)) {
    return { ok: false, reason: "title missing or not a string" };
  }
  if (!isString(json.description)) {
    return { ok: false, reason: "description missing or not a string" };
  }
  if (!Array.isArray(json.events)) {
    return { ok: false, reason: "events missing or not an array" };
  }

  const events: CalendarEvent[] = [];
  for (let i = 0; i < json.events.length; i++) {
    const raw = json.events[i] as unknown;
    if (!isObject(raw)) {
      return { ok: false, reason: `events[${i}] is not an object` };
    }
    const result = validateEvent(raw, i);
    if (typeof result === "string") return { ok: false, reason: result };
    events.push(result);
  }

  return {
    ok: true,
    data: {
      data_id: json.data_id,
      title: json.title,
      description: json.description,
      events,
    },
  };
}
