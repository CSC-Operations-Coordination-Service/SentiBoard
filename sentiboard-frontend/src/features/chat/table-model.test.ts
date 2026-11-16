import { describe, expect, it } from "vitest";
import {
  COLUMN_LABELS,
  KNOWN_COLUMNS,
  computeInitialSort,
  formatCell,
  labelFor,
  orderedColumns,
  safeCsvCell,
  safeFilename,
  sortRows,
  toCsv,
} from "./table-model";

// ---- COLUMN_LABELS -------------------------------------------------------

describe("COLUMN_LABELS", () => {
  it("maps every known column to a readable label (no raw snake_case)", () => {
    for (const col of KNOWN_COLUMNS) {
      const label = COLUMN_LABELS[col];
      expect(label, `missing label for ${col}`).toBeDefined();
      expect(label, `label for ${col} looks like snake_case`).not.toMatch(/_/);
    }
  });
});

// ---- orderedColumns -------------------------------------------------------

describe("orderedColumns", () => {
  it("places known columns in KNOWN_COLUMNS order before unknowns", () => {
    const cols = ["mission", "datatake_id", "status", "foo_bar"];
    const result = orderedColumns(cols);
    expect(result.indexOf("datatake_id")).toBeLessThan(result.indexOf("status"));
    expect(result.indexOf("status")).toBeLessThan(result.indexOf("mission"));
    expect(result.at(-1)).toBe("foo_bar");
  });

  it("hides `expected` when `expected_sensing` is present", () => {
    const cols = ["expected", "expected_sensing", "status"];
    const result = orderedColumns(cols);
    expect(result).not.toContain("expected");
    expect(result).toContain("expected_sensing");
  });

  it("hides `available` when `available_sensing` is present", () => {
    const cols = ["available", "available_sensing", "status"];
    const result = orderedColumns(cols);
    expect(result).not.toContain("available");
    expect(result).toContain("available_sensing");
  });

  it("keeps `expected` when `expected_sensing` is absent", () => {
    const cols = ["expected", "status"];
    expect(orderedColumns(cols)).toContain("expected");
  });

  it("keeps `available` when `available_sensing` is absent", () => {
    const cols = ["available", "status"];
    expect(orderedColumns(cols)).toContain("available");
  });

  it("hides pairwise independently (expected without available pair)", () => {
    const cols = ["expected", "expected_sensing", "available"];
    const result = orderedColumns(cols);
    expect(result).not.toContain("expected");
    expect(result).toContain("available"); // no available_sensing → keep
  });

  it("appends unknown columns in received order after known ones", () => {
    const cols = ["zzz_col", "datatake_id", "aaa_col"];
    const result = orderedColumns(cols);
    expect(result.indexOf("datatake_id")).toBeLessThan(result.indexOf("zzz_col"));
    expect(result.indexOf("zzz_col")).toBeLessThan(result.indexOf("aaa_col"));
  });
});

// ---- labelFor -------------------------------------------------------

describe("labelFor", () => {
  it("returns the mapped label for known columns", () => {
    expect(labelFor("datatake_id")).toBe("Datatake");
    expect(labelFor("completeness_percentage")).toBe("Completeness");
    expect(labelFor("observation_time_start")).toBe("Start (UTC)");
  });

  it("humanises unknown snake_case columns", () => {
    expect(labelFor("foo_bar")).toBe("Foo bar");
    expect(labelFor("my_custom_field")).toBe("My custom field");
  });
});

// ---- formatCell -------------------------------------------------------

describe("formatCell", () => {
  it("returns '—' for null values", () => {
    expect(formatCell("status", null)).toBe("—");
  });

  it("returns '—' for undefined values", () => {
    expect(formatCell("status", undefined)).toBe("—");
  });

  it("returns '—' for empty string", () => {
    expect(formatCell("status", "")).toBe("—");
  });

  it("formats completeness_percentage with one decimal + ' %'", () => {
    expect(formatCell("completeness_percentage", 0)).toBe("0.0 %");
    expect(formatCell("completeness_percentage", 99.5)).toBe("99.5 %");
    expect(formatCell("completeness_percentage", 100)).toBe("100.0 %");
  });

  it("formats ISO 8601 date-times as 'YYYY-MM-DD HH:MM UTC' (by value shape)", () => {
    expect(formatCell("observation_time_start", "2026-07-05T14:32:34.000Z")).toBe(
      "2026-07-05 14:32 UTC",
    );
    // Works for any column name that holds an ISO date
    expect(formatCell("some_other_col", "2026-01-01T00:00:00Z")).toBe("2026-01-01 00:00 UTC");
  });

  it("does not format partial date strings", () => {
    const v = "2026-07-05";
    expect(formatCell("some_col", v)).toBe("2026-07-05");
  });

  it("returns numbers as strings for non-special columns", () => {
    expect(formatCell("mission", 42)).toBe("42");
  });

  it("returns strings as-is for non-special columns", () => {
    expect(formatCell("status", "Missing")).toBe("Missing");
  });
});

// ---- sortRows -------------------------------------------------------

describe("sortRows", () => {
  const rows = [
    { name: "b", score: 2, dt: "2026-07-02T00:00:00Z" },
    { name: "a", score: 1, dt: "2026-07-01T00:00:00Z" },
    { name: "c", score: null, dt: "2026-07-03T00:00:00Z" },
  ];

  it("sorts strings ascending (case-insensitive locale)", () => {
    const r = sortRows(rows, "name", "asc");
    expect(r[0].name).toBe("a");
    expect(r[1].name).toBe("b");
    expect(r[2].name).toBe("c");
  });

  it("sorts strings descending", () => {
    const r = sortRows(rows, "name", "desc");
    expect(r[0].name).toBe("c");
    expect(r[1].name).toBe("b");
    expect(r[2].name).toBe("a");
  });

  it("sorts numbers numerically ascending", () => {
    const r = sortRows(rows, "score", "asc");
    expect(r.map((x) => x.score)).toEqual([1, 2, null]);
  });

  it("sorts numbers numerically descending", () => {
    const r = sortRows(rows, "score", "desc");
    expect(r[0].score).toBe(2);
    expect(r[1].score).toBe(1);
  });

  it("sorts ISO date strings correctly by lexicographic comparison", () => {
    const r = sortRows(rows, "dt", "asc");
    expect(r[0].dt).toBe("2026-07-01T00:00:00Z");
    expect(r[1].dt).toBe("2026-07-02T00:00:00Z");
    expect(r[2].dt).toBe("2026-07-03T00:00:00Z");
  });

  it("puts nulls last regardless of direction", () => {
    const withNull = [{ v: null }, { v: 5 }, { v: 1 }];
    expect(sortRows(withNull, "v", "asc").at(-1)?.v).toBeNull();
    expect(sortRows(withNull, "v", "desc").at(-1)?.v).toBeNull();
  });

  it("compares mixed types (number and string) as strings", () => {
    const mixed = [{ v: "10" }, { v: 2 }, { v: "banana" }];
    // No crash, stable result
    expect(() => sortRows(mixed, "v", "asc")).not.toThrow();
  });

  it("does not mutate the original array", () => {
    const original = [...rows];
    sortRows(rows, "name", "desc");
    expect(rows).toEqual(original);
  });
});

// ---- safeCsvCell -------------------------------------------------------

describe("safeCsvCell", () => {
  it("prefixes ' to strings starting with =", () => {
    expect(safeCsvCell("=SUM(A1:A5)")).toBe("'=SUM(A1:A5)");
  });

  it("prefixes ' to strings starting with +", () => {
    expect(safeCsvCell("+cmd|/C calc")).toBe("'+cmd|/C calc");
  });

  it("prefixes ' to strings starting with -", () => {
    expect(safeCsvCell("-1+1")).toBe("'-1+1");
  });

  it("prefixes ' to strings starting with @", () => {
    expect(safeCsvCell("@SUM(1,2)")).toBe("'@SUM(1,2)");
  });

  it("prefixes ' to strings starting with tab", () => {
    expect(safeCsvCell("\tHello")).toBe("'\tHello");
  });

  it("prefixes ' to strings starting with CR", () => {
    expect(safeCsvCell("\rHello")).toBe("'\rHello");
  });

  it("does not modify safe strings", () => {
    expect(safeCsvCell("Hello")).toBe("Hello");
    expect(safeCsvCell("S3A-141-195")).toBe("S3A-141-195");
  });

  it("does not apply the guard to empty string", () => {
    expect(safeCsvCell("")).toBe("");
  });
});

// ---- toCsv -------------------------------------------------------

describe("toCsv", () => {
  const rows = [
    { datatake_id: "S3A-001", status: "Missing", completeness_percentage: 0 },
    { datatake_id: "S3A-002", status: "Complete", completeness_percentage: 100 },
  ];
  const cols = ["datatake_id", "status", "completeness_percentage"];

  it("starts with a UTF-8 BOM", () => {
    const csv = toCsv(rows, cols);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("uses readable labels as the header row", () => {
    const csv = toCsv(rows, cols);
    const header = csv.slice(1).split("\r\n")[0];
    expect(header).toContain("Datatake");
    expect(header).toContain("Status");
    expect(header).toContain("Completeness");
    expect(header).not.toContain("datatake_id");
  });

  it("includes all data rows in CRLF-delimited lines", () => {
    const lines = toCsv(rows, cols).slice(1).split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("outputs raw numeric values, not formatted display values", () => {
    const csv = toCsv(rows, cols);
    expect(csv).toContain("0");
    expect(csv).toContain("100");
    // Should NOT contain "0.0 %" (that is the display format)
    expect(csv).not.toContain("0.0 %");
  });

  it("RFC 4180: wraps a cell containing a comma in quotes", () => {
    const r = [{ col: "hello, world" }];
    const csv = toCsv(r, ["col"]);
    expect(csv).toContain('"hello, world"');
  });

  it("RFC 4180: escapes double quotes by doubling them", () => {
    const r = [{ col: 'say "hi"' }];
    const csv = toCsv(r, ["col"]);
    expect(csv).toContain('"say ""hi"""');
  });

  it("applies the injection guard to string cells", () => {
    const r = [{ col: "=EVIL()" }];
    const csv = toCsv(r, ["col"]);
    expect(csv).toContain("'=EVIL()");
  });

  it("does not apply the injection guard to numeric cells", () => {
    const r = [{ col: -5 }];
    const dataLine = toCsv(r, ["col"]).slice(1).split("\r\n")[1];
    expect(dataLine).toBe("-5");
  });

  it("renders null/undefined cells as empty", () => {
    const r = [{ col: null }, { col: undefined }];
    const csv = toCsv(r, ["col"]);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[1]).toBe("");
    expect(lines[2]).toBe("");
  });
});

// ---- safeFilename -------------------------------------------------------

describe("safeFilename", () => {
  it("strips characters that are not alphanumeric, _, -, or space", () => {
    expect(safeFilename("My Table! (2026)")).toBe("My_Table_2026");
  });

  it("collapses whitespace to underscores", () => {
    expect(safeFilename("hello  world")).toBe("hello_world");
  });

  it("strips leading and trailing underscores", () => {
    expect(safeFilename("  hello  ")).toBe("hello");
  });

  it("returns empty string for a title with no safe characters", () => {
    expect(safeFilename("!!!")).toBe("");
  });
});

// ---- computeInitialSort -------------------------------------------------------

describe("computeInitialSort", () => {
  const cols = ["datatake_id", "status", "completeness_percentage"];

  it("returns null when sort_column is not in columns", () => {
    expect(computeInitialSort(cols, "nonexistent", "asc")).toBeNull();
  });

  it("returns null when sort_column is undefined", () => {
    expect(computeInitialSort(cols, undefined, "asc")).toBeNull();
  });

  it("returns sort state when column exists", () => {
    expect(computeInitialSort(cols, "datatake_id", "asc")).toEqual({
      col: "datatake_id",
      order: "asc",
    });
    expect(computeInitialSort(cols, "status", "desc")).toEqual({
      col: "status",
      order: "desc",
    });
  });

  it("defaults order to 'asc' when sort_order is undefined", () => {
    expect(computeInitialSort(cols, "datatake_id", undefined)).toEqual({
      col: "datatake_id",
      order: "asc",
    });
  });
});
