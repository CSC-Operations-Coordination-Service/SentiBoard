import { describe, expect, it } from "vitest";
import { adaptInstantMessages, MAX_NEWS, type ApiInstantMessage } from "./adapter";

function rec(
  title: string,
  publication_date: string | null,
  over: Partial<ApiInstantMessage> = {},
): ApiInstantMessage {
  return {
    id: null,
    title,
    text: "Some text.",
    link: "",
    publication_date,
    message_type: "info",
    modify_date: publication_date,
    ...over,
  };
}

describe("adaptInstantMessages", () => {
  it("returns empty array for empty input", () => {
    expect(adaptInstantMessages([])).toEqual([]);
  });

  it("sorts by publication_date descending", () => {
    const records = [
      rec("Older", "2026-07-08T08:41:00Z"),
      rec("Newest", "2026-07-20T08:55:00Z"),
      rec("Middle", "2026-07-13T12:56:00Z"),
    ];
    const result = adaptInstantMessages(records);
    expect(result.map((r) => r.title)).toEqual(["Newest", "Middle", "Older"]);
  });

  it("formats publication_date as UTC 'D Mon YYYY' and 'HH:MM'", () => {
    const records = [rec("Test", "2026-07-20T08:55:00Z")];
    const [item] = adaptInstantMessages(records);
    expect(item?.date).toBe("20 Jul 2026");
    expect(item?.time).toBe("08:55");
  });

  it("uses UTC not local time: midnight UTC on 1 Jan stays on 1 Jan", () => {
    const records = [rec("UTC check", "2026-01-01T00:00:00Z")];
    const [item] = adaptInstantMessages(records);
    expect(item?.date).toBe("1 Jan 2026");
    expect(item?.time).toBe("00:00");
  });

  it("excludes records with null publication_date", () => {
    const records = [
      rec("Has date", "2026-07-20T08:55:00Z"),
      rec("No date", null),
    ];
    const result = adaptInstantMessages(records);
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("Has date");
  });

  it("returns empty array when all records have null publication_date", () => {
    const records = [rec("No date 1", null), rec("No date 2", null)];
    expect(adaptInstantMessages(records)).toEqual([]);
  });

  it("keeps only title, date, time — no raw API fields", () => {
    const records = [rec("Item", "2026-07-11T10:05:00Z")];
    const [item] = adaptInstantMessages(records);
    expect(Object.keys(item ?? {})).toEqual(["title", "date", "time"]);
  });

  it(`caps output at MAX_NEWS (${MAX_NEWS}) and returns the newest items in order`, () => {
    const n = MAX_NEWS + 3;
    const records = Array.from({ length: n }, (_, i) =>
      rec(`Item ${i + 1}`, `2026-0${(i % 9) + 1}-${String(i + 1).padStart(2, "0")}T00:00:00Z`),
    );
    const result = adaptInstantMessages(records);
    expect(result).toHaveLength(MAX_NEWS);
    // Each item must be newer than or equal to the next.
    for (let i = 0; i < result.length - 1; i++) {
      const a = new Date(`${result[i]!.date} ${result[i]!.time}`);
      const b = new Date(`${result[i + 1]!.date} ${result[i + 1]!.time}`);
      expect(a.getTime()).toBeGreaterThanOrEqual(b.getTime());
    }
  });
});
