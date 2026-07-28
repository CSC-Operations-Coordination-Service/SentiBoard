"use client";
import { useMemo, useState } from "react";
import { groupByMission, type ProcRow, type ProcWindow } from "@/lib/data";
import ProcessorTimeline from "./ProcessorTimeline";

export default function ProcessorsView({ rows, win }: { rows: ProcRow[]; win: ProcWindow }) {
  const [draft, setDraft] = useState(""); // what's typed in the box
  const [query, setQuery] = useState(""); // applied on "Filter" / Enter

  // Search narrows to whole lanes, never to individual releases: a lane's rail geometry and its
  // "in force since" segment only read correctly with its full release history present.
  const missions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupByMission(rows);
    const hits = rows.filter((r) =>
      `${r.label} ${r.sub} ${r.releases.map((rel) => rel.baseline).join(" ")}`.toLowerCase().includes(q),
    );
    return groupByMission(hits);
  }, [rows, query]);

  const apply = () => setQuery(draft);

  return (
    <>
      <div className="filterbar reveal" style={{ marginBottom: 18 }}>
        <div className="field grow">
          <label>Search processor or baseline</label>
          <input
            className="select"
            type="text"
            placeholder="e.g. L1/L2, OLCI, 003.71"
            style={{ backgroundImage: "none", width: "100%" }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
          />
        </div>
        <div className="field">
          <label>&nbsp;</label>
          <button className="btn" onClick={apply}>
            Filter
          </button>
        </div>
      </div>

      {/* key={query} remounts the timeline when the lane set changes, so the selected release resets
          cleanly to the default rather than pointing at a lane that is no longer rendered. */}
      {missions.length > 0 ? (
        <ProcessorTimeline key={query} missions={missions} win={win} />
      ) : (
        <div className="panel reveal" style={{ padding: 24, color: "var(--muted)" }}>
          No processor releases match “{query}”.
        </div>
      )}
    </>
  );
}
