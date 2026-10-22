import { describe, expect, it } from "vitest";
import {
  adaptProcessors,
  changesOf,
  parseTargetIpf,
  type ApiProcessor,
} from "./adapter";
import { ROSTER } from "./model";
import { RECORDS } from "./__fixtures__/processor-records";

/** "Today" for every test: 22 October 2026, so the current-baseline rule is deterministic. */
const NOW = Date.UTC(2026, 9, 22);

let seq = 0;
/** A backend record with sensible defaults; override what the test is about. */
function rec(over: Partial<ApiProcessor> = {}): ApiProcessor {
  seq += 1;
  return {
    id: `r${seq}`,
    mission: "S1",
    satellite_units: ["S1A"],
    target_ipfs: ["S1_L0:1.0"],
    processing_baseline: null,
    release_date: null,
    validity_start_date: "2024-01-01T00:00:00Z",
    validity_end_date: null,
    release_notes: null,
    ...over,
  };
}

const lane = (records: ApiProcessor[], ipf: string) => {
  const g = adaptProcessors(records, NOW).groups.find((x) => x.ipf === ipf);
  if (!g) throw new Error(`no lane ${ipf}`);
  return g;
};

describe("parseTargetIpf", () => {
  it("splits IPF key and version", () => {
    expect(parseTargetIpf("S1_L1L2:002.84")).toEqual({ ipf: "S1_L1L2", version: "002.84" });
  });

  it("gives an empty version for an empty one", () => {
    expect(parseTargetIpf("S2_L1:")).toEqual({ ipf: "S2_L1", version: "" });
  });

  it.each(["undefined", "null", "none", "UNDEFINED", "None"])(
    'treats the placeholder "%s" as no version',
    (v) => {
      expect(parseTargetIpf(`S1_L1L2:${v}`)).toEqual({ ipf: "S1_L1L2", version: "" });
    },
  );

  it("takes a target without a colon as a bare IPF key", () => {
    expect(parseTargetIpf("S1_L0")).toEqual({ ipf: "S1_L0", version: "" });
  });

  it("trims whitespace and keeps colons inside the version", () => {
    expect(parseTargetIpf("  S3_SY2_VGS : 06:10 ")).toEqual({ ipf: "S3_SY2_VGS", version: "06:10" });
  });
});

describe("adaptProcessors — placing records on lanes", () => {
  it("puts a record with several targets on each target's lane, sharing one set of notes", () => {
    const r = rec({
      mission: "S2",
      target_ipfs: ["S2_L0:06.05", "S2_L1:06.05"],
      release_notes: "<p>Shared notes</p>",
    });
    const { groups, notes } = adaptProcessors([r], NOW);
    expect(groups.map((g) => g.ipf)).toEqual(["S2_L0", "S2_L1"]);
    const [a, b] = groups.map((g) => g.releases[0]);
    expect(a.id).not.toBe(b.id);
    expect(a.notesId).toBe(r.id);
    expect(b.notesId).toBe(r.id);
    expect(Object.keys(notes)).toEqual([r.id]);
  });

  it.each([
    ["null target_ipfs", { target_ipfs: null as unknown as string[] }],
    ["empty target_ipfs", { target_ipfs: [] }],
    ["an empty target string", { target_ipfs: [""] }],
    ["no date at all", { validity_start_date: null, release_date: null }],
    ["an IPF with no recognisable mission", { mission: null, target_ipfs: ["XX_L0:1.0"] }],
  ])("leaves out a record with %s and reports it as unplaced", (_, over) => {
    const r = rec(over);
    const { groups, unplaced } = adaptProcessors([r], NOW);
    expect(groups).toEqual([]);
    expect(unplaced).toEqual([r]);
  });

  it("falls back to release_date when validity_start_date is missing", () => {
    const g = lane([rec({ validity_start_date: null, release_date: "2025-03-04T00:00:00Z" })], "S1_L0");
    expect(g.releases[0].ms).toBe(Date.UTC(2025, 2, 4));
  });

  it("reads null satellite_units as none, and dedupes and trims the rest", () => {
    const none = lane([rec({ satellite_units: null as unknown as string[] })], "S1_L0");
    expect(none.releases[0].sats).toEqual([]);
    const some = lane([rec({ satellite_units: [" S1A", "S1A", "", "S1C "] })], "S1_L0");
    expect(some.releases[0].sats).toEqual(["S1A", "S1C"]);
  });

  it("takes the mission from the record, or else from the IPF prefix", () => {
    const { groups } = adaptProcessors(
      [rec({ mission: null, target_ipfs: ["S5P_L1B:02.06"] }), rec({ mission: " s3 ", target_ipfs: ["S3_OL1:06.20"] })],
      NOW,
    );
    expect(groups.find((g) => g.ipf === "S5P_L1B")?.mission).toBe("5P");
    expect(groups.find((g) => g.ipf === "S3_OL1")?.mission).toBe("3");
  });
});

describe("adaptProcessors — baseline label", () => {
  it("uses the IPF version when there is one", () => {
    const g = lane([rec({ target_ipfs: ["S1_L0:1.3.2"], processing_baseline: "05.11" })], "S1_L0");
    expect(g.releases[0].baseline).toBe("1.3.2");
  });

  it.each(["S1_L0:", "S1_L0:undefined", "S1_L0"])(
    "falls back to processing_baseline for %s",
    (target) => {
      const g = lane([rec({ target_ipfs: [target], processing_baseline: " 05.11 " })], "S1_L0");
      expect(g.releases[0].baseline).toBe("05.11");
      expect(g.releases[0].processingBaseline).toBe("05.11");
    },
  );

  it('shows "—" when there is neither a version nor a processing baseline', () => {
    const g = lane([rec({ target_ipfs: ["S1_L0:"], processing_baseline: null })], "S1_L0");
    expect(g.releases[0].baseline).toBe("—");
    expect(g.releases[0].processingBaseline).toBeUndefined();
  });
});

describe("adaptProcessors — current-baseline rule", () => {
  const at = (iso: string) => `${iso}T00:00:00Z`;
  const currents = (records: ApiProcessor[]) =>
    lane(records, "S1_L0").releases.map((r) => r.isCurrent);

  it("marks exactly one release current: the latest one in force", () => {
    // None of them has an end date — the feed rarely closes superseded releases.
    expect(
      currents([
        rec({ validity_start_date: at("2022-01-01") }),
        rec({ validity_start_date: at("2025-06-01") }),
        rec({ validity_start_date: at("2024-01-01") }),
      ]),
    ).toEqual([false, false, true]); // releases are sorted oldest first
  });

  it("counts a null validity_end_date as still in force", () => {
    expect(
      currents([
        rec({ validity_start_date: at("2023-01-01"), validity_end_date: null }),
        rec({ validity_start_date: at("2024-01-01"), validity_end_date: at("2025-01-01") }),
      ]),
    ).toEqual([true, false]);
  });

  it("marks none current when every release has ended", () => {
    expect(
      currents([
        rec({ validity_start_date: at("2023-01-01"), validity_end_date: at("2024-01-01") }),
        rec({ validity_start_date: at("2024-01-01"), validity_end_date: at("2025-01-01") }),
      ]),
    ).toEqual([false, false]);
  });

  it("does not mark a future release current", () => {
    expect(
      currents([
        rec({ validity_start_date: at("2024-01-01") }),
        rec({ validity_start_date: at("2027-01-01") }),
      ]),
    ).toEqual([true, false]);
  });

  it("marks none current when the only release is in the future", () => {
    expect(currents([rec({ validity_start_date: at("2027-01-01") })])).toEqual([false]);
  });

  it("lets the later record win when two start on the same day", () => {
    const a = rec({ validity_start_date: at("2024-01-01") });
    const b = rec({ validity_start_date: at("2024-01-01") });
    const releases = lane([a, b], "S1_L0").releases;
    expect(releases.map((r) => [r.id, r.isCurrent])).toEqual([
      [`${a.id}:S1_L0`, false],
      [`${b.id}:S1_L0`, true],
    ]);
  });

  it("decides each lane on its own", () => {
    const { groups } = adaptProcessors(
      [
        rec({ target_ipfs: ["S1_L0:1.0"], validity_start_date: at("2024-01-01") }),
        rec({ target_ipfs: ["S1_L1L2:3.0"], validity_start_date: at("2025-01-01") }),
      ],
      NOW,
    );
    expect(groups.map((g) => g.releases.filter((r) => r.isCurrent).length)).toEqual([1, 1]);
  });
});

describe("adaptProcessors — release ids", () => {
  it("keeps ids unique when the same (IPF, version) recurs in different records", () => {
    const releases = lane(
      [rec({ target_ipfs: ["S1_L0:1.0"] }), rec({ target_ipfs: ["S1_L0:1.0"] })],
      "S1_L0",
    ).releases;
    expect(releases).toHaveLength(2);
    expect(new Set(releases.map((r) => r.id)).size).toBe(2);
  });

  it("gives a record with no id a positional one", () => {
    const releases = lane([rec({ id: null }), rec({ id: null })], "S1_L0").releases;
    expect(releases.map((r) => r.id)).toEqual(["rec0:S1_L0", "rec1:S1_L0"]);
  });

  it("ignores a target repeated within the same record (no duplicate ids)", () => {
    const r = rec({ target_ipfs: ["S1_L0:1.0", "S1_L0:1.0", " S1_L0:1.0 "] });
    const { groups } = adaptProcessors([r], NOW);
    const ids = groups.flatMap((g) => g.releases.map((x) => x.id));
    expect(ids).toEqual([`${r.id}:S1_L0`]);
  });

  it("keeps ids unique across every lane for the real fixtures", () => {
    const { groups } = adaptProcessors(Object.values(RECORDS), NOW);
    const ids = groups.flatMap((g) => g.releases.map((x) => x.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("adaptProcessors — lane order and labels", () => {
  it("orders roster processors by the roster, whatever the feed order", () => {
    const { groups } = adaptProcessors(
      [
        rec({ mission: "S3", target_ipfs: ["S3_SY2:1"] }),
        rec({ mission: "S3", target_ipfs: ["S3_OL1:1"] }),
        rec({ mission: "S3", target_ipfs: ["S3_PUG:1"] }),
      ],
      NOW,
    );
    const rosterIndex = (ipf: string) => ROSTER.findIndex((r) => r.ipf === ipf);
    expect(groups.map((g) => g.ipf)).toEqual(["S3_PUG", "S3_OL1", "S3_SY2"]);
    expect(groups.map((g) => rosterIndex(g.ipf))).toEqual(
      [...groups.map((g) => rosterIndex(g.ipf))].sort((a, b) => a - b),
    );
    expect(groups[0]).toMatchObject({ label: "S3 PUG", sub: "Product User Guide" });
  });

  it("files S3_SM2_HY under the S3_SM2 roster entry", () => {
    const g = lane([rec({ mission: "S3", target_ipfs: ["S3_SM2_HY:7.10"] })], "S3_SM2_HY");
    expect(g).toMatchObject({ label: "S3 SM2_HY", sub: "Surface Measurement 2" });
  });

  it("adds unknown IPF keys after the roster, by key, with a label from the key", () => {
    const { groups } = adaptProcessors(
      [
        rec({ mission: "S5P", target_ipfs: ["S5P_L2_CO:02.04"] }),
        rec({ mission: "S5P", target_ipfs: ["S5P_L2_AER:02.04"] }),
        rec({ mission: "S5P", target_ipfs: ["S5P_L1B:02.06"] }),
      ],
      NOW,
    );
    expect(groups.map((g) => [g.ipf, g.label, g.sub])).toEqual([
      ["S5P_L1B", "S5P L1B", "Radiance · irradiance"],
      ["S5P_L2_AER", "S5P L2_AER", ""],
      ["S5P_L2_CO", "S5P L2_CO", ""],
    ]);
  });
});

describe("adaptProcessors — notes", () => {
  it("stores sanitized notes once per record and leaves notesId out when there are none", () => {
    const withNotes = rec({ release_notes: '<p style="color:red">Fix <script>x()</script></p>' });
    const without = rec({ release_notes: "   " });
    const { groups, notes } = adaptProcessors([withNotes, without], NOW);
    expect(notes[withNotes.id!]).toBe("<p>Fix </p>");
    const releases = groups[0].releases;
    expect(releases.find((r) => r.id.startsWith(`${withNotes.id}:`))?.notesId).toBe(withNotes.id);
    expect(releases.find((r) => r.id.startsWith(`${without.id}:`))?.notesId).toBeUndefined();
  });
});

describe("changesOf", () => {
  it("lists the first two items of the 'Changes introduced' section and counts the rest", () => {
    const html =
      "<p>Intro</p><h3>Changes introduced:</h3><ul><li>One</li><li>Two</li><li>Three</li><li>Four</li></ul><h3>Other</h3><p>x</p>";
    expect(changesOf(html)).toBe("One; Two + 2 more");
  });

  it("accepts a bold paragraph as the section title (Word notes)", () => {
    const html = "<p><b>Changes introduced</b></p><ul><li>Only change</li></ul>";
    expect(changesOf(html)).toBe("Only change");
  });

  it("falls back to the start of the notes, cut at 120 characters", () => {
    const long = "word ".repeat(60).trim();
    const out = changesOf(`<p>${long}</p>`);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThanOrEqual(120);
  });

  it('gives "—" for empty notes', () => {
    expect(changesOf(null)).toBe("—");
    expect(changesOf("<p>&nbsp;</p>")).toBe("—");
  });
});
