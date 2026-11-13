import { describe, expect, it } from "vitest";
import { parseEventCalendar } from "./event-calendar";
import SAMPLE from "./__fixtures__/event-calendar-sample.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    key: "GSANOM-99999",
    occurred_at: "2026-07-07T03:18:00.000Z",
    title: "Test anomaly",
    description: "A test description.",
    category: "rfi",
    category_basis: "native_origin",
    origin: "RFI",
    status: "Closed",
    criticality: "Blocking",
    affected_systems: ["S-1"],
    datatake_ids: ["S1D-00001"],
    associated_datatake_count: 1,
    ...overrides,
  };
}

function validPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    data_id: "artifact_abc123",
    title: "Test calendar",
    description: "Test description.",
    events: [validEvent()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

describe("parseEventCalendar — valid payloads", () => {
  it("accepts the partner's sample payload verbatim", () => {
    const result = parseEventCalendar(SAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.data_id).toBe("artifact_fcd5ed14590f47e592dffc2227f6c66e");
    expect(result.data.events).toHaveLength(1);
    expect(result.data.events[0].key).toBe("GSANOM-23018");
    expect(result.data.events[0].criticality).toBe("Blocking");
    expect(result.data.events[0].datatake_ids).toEqual(["S1D-25912", "S1D-25913"]);
  });

  it("accepts an empty events array", () => {
    const result = parseEventCalendar(validPayload({ events: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.events).toHaveLength(0);
  });

  it("keeps events with occurred_at: null", () => {
    const payload = validPayload({ events: [validEvent({ occurred_at: null })] });
    const result = parseEventCalendar(payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.events[0].occurred_at).toBeNull();
  });

  it("accepts status: null", () => {
    const result = parseEventCalendar(validPayload({ events: [validEvent({ status: null })] }));
    expect(result.ok).toBe(true);
  });

  it("accepts criticality: null", () => {
    const result = parseEventCalendar(
      validPayload({ events: [validEvent({ criticality: null })] })
    );
    expect(result.ok).toBe(true);
  });

  it("accepts origin: null", () => {
    const result = parseEventCalendar(
      validPayload({ events: [validEvent({ origin: null })] })
    );
    expect(result.ok).toBe(true);
  });

  it("allows and ignores unknown extra fields on an event", () => {
    const result = parseEventCalendar(
      validPayload({ events: [validEvent({ extra_field: "ignored", another: 42 })] })
    );
    expect(result.ok).toBe(true);
  });

  it("does not error when associated_datatake_count differs from datatake_ids.length", () => {
    const result = parseEventCalendar(
      validPayload({
        events: [validEvent({ datatake_ids: ["S1D-1", "S1D-2"], associated_datatake_count: 99 })],
      })
    );
    expect(result.ok).toBe(true);
  });

  it("accepts all valid event categories", () => {
    for (const category of ["acquisition", "production", "rfi", "satellite", "other"]) {
      const result = parseEventCalendar(validPayload({ events: [validEvent({ category })] }));
      expect(result.ok).toBe(true);
    }
  });

  it("accepts all valid status values", () => {
    const statuses = [
      "Open", "Closed", "Delegated", "Duplicated", "Rejected",
      "Completed", "Returned", "Transferred", "To be deployed", null,
    ];
    for (const status of statuses) {
      const result = parseEventCalendar(validPayload({ events: [validEvent({ status })] }));
      expect(result.ok).toBe(true);
    }
  });

  it("accepts both category_basis values", () => {
    for (const cb of ["native_origin", "unclassified"]) {
      const result = parseEventCalendar(
        validPayload({ events: [validEvent({ category_basis: cb })] })
      );
      expect(result.ok).toBe(true);
    }
  });

  it("accepts associated_datatake_count of 0", () => {
    const result = parseEventCalendar(
      validPayload({
        events: [validEvent({ datatake_ids: [], associated_datatake_count: 0 })],
      })
    );
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Failure cases
// ---------------------------------------------------------------------------

describe("parseEventCalendar — rejects invalid payloads", () => {
  function expectFail(input: unknown): void {
    const result = parseEventCalendar(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  }

  // Top-level shape
  it("rejects non-object input (null)", () => expectFail(null));
  it("rejects non-object input (array)", () => expectFail([]));
  it("rejects non-object input (string)", () => expectFail("string"));
  it("rejects non-object input (number)", () => expectFail(42));

  it("rejects missing data_id", () => {
    const p = { ...validPayload() };
    delete p.data_id;
    expectFail(p);
  });
  it("rejects empty data_id", () => expectFail(validPayload({ data_id: "" })));
  it("rejects non-string title", () => expectFail(validPayload({ title: 123 })));
  it("rejects missing description", () => {
    const p = validPayload();
    delete (p as Record<string, unknown>).description;
    expectFail(p);
  });
  it("rejects events not being an array", () => expectFail(validPayload({ events: "not array" })));

  // Event-level
  it("rejects event that is not an object", () => {
    expectFail(validPayload({ events: ["not an event"] }));
  });
  it("rejects missing key", () => {
    expectFail(validPayload({ events: [validEvent({ key: undefined })] }));
  });
  it("rejects empty key", () => {
    expectFail(validPayload({ events: [validEvent({ key: "" })] }));
  });
  it("rejects invalid occurred_at (not a date)", () => {
    expectFail(
      validPayload({ events: [validEvent({ occurred_at: "not-a-date" })] })
    );
  });
  it("rejects occurred_at as a number", () => {
    expectFail(validPayload({ events: [validEvent({ occurred_at: 12345 })] }));
  });
  it("rejects invalid category", () => {
    expectFail(validPayload({ events: [validEvent({ category: "unknown" })] }));
  });
  it("rejects invalid category_basis", () => {
    expectFail(validPayload({ events: [validEvent({ category_basis: "other" })] }));
  });
  it("rejects invalid status value", () => {
    expectFail(validPayload({ events: [validEvent({ status: "Pending" })] }));
  });
  it("rejects invalid criticality value", () => {
    expectFail(validPayload({ events: [validEvent({ criticality: "High" })] }));
  });
  it("rejects affected_systems as non-array", () => {
    expectFail(validPayload({ events: [validEvent({ affected_systems: "S-1" })] }));
  });
  it("rejects affected_systems containing non-string", () => {
    expectFail(validPayload({ events: [validEvent({ affected_systems: [1, 2] })] }));
  });
  it("rejects datatake_ids as non-array", () => {
    expectFail(validPayload({ events: [validEvent({ datatake_ids: null })] }));
  });
  it("rejects negative associated_datatake_count", () => {
    expectFail(validPayload({ events: [validEvent({ associated_datatake_count: -1 })] }));
  });
  it("rejects fractional associated_datatake_count", () => {
    expectFail(validPayload({ events: [validEvent({ associated_datatake_count: 1.5 })] }));
  });
  it("rejects string associated_datatake_count", () => {
    expectFail(validPayload({ events: [validEvent({ associated_datatake_count: "2" })] }));
  });

  it("includes a reason string on failure", () => {
    const result = parseEventCalendar(validPayload({ events: [validEvent({ category: "bad" })] }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/category/);
  });
});
