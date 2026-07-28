"use client";
import { useMemo, useState } from "react";
import type { Datatake, DonutSeg } from "@/lib/data";
import Donut from "./Donut";

// "S2A" → "2", "S5P" → "5P" — used to match a datatake's satellite to the Mission filter.
function missionOf(sat: string): string {
  const s = sat.toUpperCase();
  if (s.includes("5P")) return "5P";
  const m = s.match(/S?([1-5])/);
  return m ? m[1] : "";
}

export default function AvailabilityView({
  acq,
  pub,
  datatakes,
}: {
  acq: DonutSeg[];
  pub: DonutSeg[];
  datatakes: Datatake[];
}) {
  const [mission, setMission] = useState("all");
  const [sat, setSat] = useState("all");
  const [query, setQuery] = useState("");

  // Derived list — the datatakes are already in the browser, so filtering is instant, no fetch.
  const filtered = useMemo(
    () =>
      datatakes.filter(
        (dt) =>
          (mission === "all" || missionOf(dt.sat) === mission) &&
          (sat === "all" || dt.sat.toUpperCase() === sat) &&
          (query === "" || dt.id.toLowerCase().includes(query.toLowerCase())),
      ),
    [datatakes, mission, sat, query],
  );

  const active = mission !== "all" || sat !== "all" || query !== "";
  const reset = () => {
    setMission("all");
    setSat("all");
    setQuery("");
  };

  return (
    <>
      <div className="filterbar reveal" style={{ marginBottom: 18 }}>
        <div className="field">
          <label>Mission</label>
          <select
            className="select"
            value={mission}
            onChange={(e) => {
              setMission(e.target.value);
              setSat("all"); // reset satellite when mission changes so they never contradict
            }}
          >
            <option value="all">All Missions</option>
            <option value="1">Sentinel 1</option>
            <option value="2">Sentinel 2</option>
            <option value="3">Sentinel 3</option>
            <option value="5P">Sentinel 5P</option>
          </select>
        </div>
        <div className="field">
          <label>Satellite</label>
          <select className="select" value={sat} onChange={(e) => setSat(e.target.value)}>
            <option value="all">All Satellites</option>
            <option>S1A</option>
            <option>S1C</option>
            <option>S2A</option>
            <option>S2B</option>
            <option>S3A</option>
            <option>S3B</option>
            <option>S5P</option>
          </select>
        </div>
        {/* From/To narrow which data is fetched — that's server/URL state (like the Events month).
            Left inert here for now; wire them the same way we did month navigation when needed. */}
        <div className="field">
          <label>From</label>
          <select className="select">
            <option>01 Apr 2026</option>
            <option>01 May 2026</option>
            <option>01 Jun 2026</option>
          </select>
        </div>
        <div className="field">
          <label>To</label>
          <select className="select">
            <option>30 Jun 2026</option>
          </select>
        </div>
        <div className="field">
          <label>Datatake</label>
          <input
            className="select"
            type="text"
            placeholder="Search by id..."
            style={{ backgroundImage: "none" }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="field grow" />
        <div className="field">
          <label>&nbsp;</label>
          <button className="btn" onClick={reset} disabled={!active}>
            Reset Filters
          </button>
        </div>
      </div>

      <div className="panel reveal">
        <div className="donut-row">
          <Donut title="Acquisition completeness" sub="Share of planned datatakes successfully acquired and downlinked." centerLabel="Acquired or better" centerValue={96.2} segments={acq} />
          <Donut title="Publication completeness" sub="Share of products published to users within the timeliness target." centerLabel="Published on time" centerValue={97.1} segments={pub} />
        </div>
      </div>

      <div className="section-head reveal" style={{ marginTop: 50 }}>
        <div>
          <span className="eyebrow">Datatakes · past 3 months</span>
          <h2>Completeness per datatake</h2>
        </div>
        <span className="meta">REFRESHED HOURLY</span>
      </div>

      <div style={{ margin: "0 2px 8px", fontSize: "12.5px", opacity: 0.6 }}>
        Showing {filtered.length} of {datatakes.length} datatakes{active ? " · filtered" : ""}
      </div>

      <div className="dtk-list reveal">
        <div className="dtk-head">
          <span>Datatake</span>
          <span>Product completeness</span>
          <span>%</span>
          <span>Status</span>
        </div>
        {filtered.map((dt) => (
          <div className="dtk-row" key={dt.id}>
            <div className="dtk-id">
              {dt.id}
              <span className="dtk-sub">
                {dt.sat} · {dt.time}
              </span>
            </div>
            <div className="dtk-meter">
              {dt.segs.map((s, i) => (
                <div key={i} className={"seg " + s.st}>
                  {s.label}
                </div>
              ))}
            </div>
            <div className="dtk-pct">{dt.pct}</div>
            <div className="dtk-status">
              <span className={"pill " + dt.status.cls}>{dt.status.label}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="dtk-row">
            <div className="dtk-id" style={{ opacity: 0.6 }}>
              No datatakes match the current filters.
            </div>
          </div>
        )}
      </div>

      <div className="legend" style={{ marginTop: 16 }}>
        <span>
          <i style={{ background: "#3DD68C" }} /> Published
        </span>
        <span>
          <i style={{ background: "#00C7D6" }} /> Processing
        </span>
        <span>
          <i style={{ background: "#FFB020" }} /> Partial
        </span>
        <span>
          <i style={{ background: "#FF5C6C" }} /> Unavailable
        </span>
        <span>
          <i style={{ background: "transparent", boxShadow: "inset 0 0 0 1px var(--line)" }} /> Planned
        </span>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 20, maxWidth: "66ch" }}>
        Each datatake&apos;s bar shows its expected products (L0 → L2) coloured by publication status, so you can see
        exactly what is complete and what is missing — not just an overall number. Sentinel-3A datatakes are degraded by
        the ongoing Svalbard downlink incident (
        <a style={{ color: "var(--accent-cyan)" }} href="/v1/events">
          GSANOM-4821
        </a>
        ).
      </p>
    </>
  );
}
