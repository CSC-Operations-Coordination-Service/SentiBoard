import { useMemo, useState } from "react";
import { PageHeader, Reveal } from "@/components/ui";
import AcquisitionGlobe from "@/components/AcquisitionGlobe";
import FilterBar from "@/components/FilterBar";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES, type AcqDatatake } from "@/data/mock";

/* PROPOSAL — Acquisitions globe, rebuilt around demand-driven rendering.
   Same page composition as /acquisitions; what changes is underneath the canvas.
   This route exists so the upgrade can be reviewed next to the other proposals
   under /examples. */

// ids look like "S2A_20260716T104201" — pull YYYY-MM-DD out for the date filter
function acquisitionDate(dt: AcqDatatake): string {
  const m = dt.id.match(/_(\d{4})(\d{2})(\d{2})T/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

const CHANGES: [string, string][] = [
  ["Demand-driven rendering",
    "The unconditional requestAnimationFrame loop is gone. Frames are drawn when something asks for one — a drag, a zoom, a hover, a selection — or while the simulation clock is genuinely running."],
  ["Frame-rate independent",
    "Every rate is per second and scaled by a frame delta clamped to 48 ms, so the globe turns at the same speed on a 60 Hz and a 144 Hz display and a stalled tab resumes instead of teleporting the clock forward."],
  ["No per-vertex trigonometry",
    "Coastline coordinates are pre-resolved to unit vectors once and memoised per decimation level (full detail wide, coarser under 780 and 420px). A frame applies the view rotation with four trig values and six multiplies per vertex."],
  ["Cached base layer",
    "Sphere shading, graticule, coastlines and station coverage circles render into an OffscreenCanvas memoised per canvas resolution, redrawn only when the view actually moves — so a hover-only frame is a single blit."],
  ["Paused when unseen",
    "An IntersectionObserver and the document visibility event stop the canvas once it scrolls away or the tab goes to the background, and resume it where it left off."],
  ["Footprints clipped at the limb",
    "Each datatake draws its acquired swath as a polygon. Rings crossing the horizon have the crossing interpolated between the two 3D vertices and renormalised onto the sphere, so the fill stops at the limb instead of wrapping round the far side."],
  ["Picking hits the polygon",
    "Clicking tests whether the cursor is genuinely inside a footprint — the screen point is inverted back to coordinates and ray-cast against the ring — so the whole swath is the target, not a radius around its centre."],
  ["One pointer path",
    "Pointer Events with pointer capture replace the separate mouse and touch handlers: a drag keeps tracking after it leaves the canvas, and the wheel only swallows the scroll when the zoom actually moved."],
  ["Station contact",
    "Coverage circles are drawn per station and light up while a satellite is inside them; the contact set is announced in the globe's live description and is the only part of the animation that reaches React state."],
  ["Keyboard and screen readers",
    "The canvas is a focusable role=\"img\" with a live description and aria-keyshortcuts; arrow keys rotate, +/- zoom, brackets step through datatakes. Every footprint has a mirror button that highlights it on focus, and the datatake list is real buttons."],
  ["Sensing marks on the timeline",
    "The clock track carries one button per datatake at its acquisition time — a single tab stop with a roving tabindex, arrow keys between marks, Home and End to the ends. Activating a mark seeks the clock to it and selects it. Marks outside the simulated day are dropped, and ids are shown only where there is room."],
  ["Coverage-aware day filter",
    "The day picker is bounded by the days that actually carry acquisitions, so it can offer neither a future date nor an empty one."],
  ["Three layout tiers",
    "560 / 780 / 980px breakpoints, with the canvas sized by a ResizeObserver on its stage rather than window resize events."],
];

export default function AcquisitionsGlobe() {
  const [selectedSats, setSelectedSats] = useState<string[]>([]);
  const [date, setDate] = useState("");

  const satellites = useMemo(
    () => Array.from(new Set(ACQ_DATATAKES.map((d) => d.sat))).sort(),
    []
  );

  const coveredDates = useMemo(
    () => Array.from(new Set(ACQ_DATATAKES.map(acquisitionDate).filter(Boolean))).sort(),
    []
  );

  const filtered = useMemo(() => {
    return ACQ_DATATAKES.filter((d) => {
      const satOk = selectedSats.length === 0 || selectedSats.includes(d.sat);
      const dateOk = !date || acquisitionDate(d) === date;
      return satOk && dateOk;
    });
  }, [selectedSats, date]);

  const toggleSat = (sat: string) =>
    setSelectedSats((prev) => (prev.includes(sat) ? prev.filter((s) => s !== sat) : [...prev, sat]));

  const resetFilters = () => { setSelectedSats([]); setDate(""); };

  return (
    <>
      <PageHeader crumb="Acquisitions · Demand-driven globe" title="Acquisitions Status"
        sub="Proposal for the acquisitions globe: the same interactive 3D view, rebuilt so it only renders when it has to, draws the acquired footprints rather than bare points, and is fully operable from the keyboard."
        desc={ACQUISITIONS_DESCRIPTION} />

      <section className="wrap pad">
        <Reveal>
          <FilterBar
            satellites={satellites}
            selectedSats={selectedSats}
            onToggleSat={toggleSat}
            date={date}
            onDateChange={setDate}
            onReset={resetFilters}
            resultCount={filtered.length}
            coveredDates={coveredDates}
          />
          {filtered.length > 0 ? (
            <AcquisitionGlobe stations={STATIONS} datatakes={filtered} />
          ) : (
            <div style={{ padding: "48px 0", textAlign: "center", color: "rgba(205,217,236,.55)" }}>
              No datatakes match your filters.
            </div>
          )}
        </Reveal>
      </section>

      <style>{`
        .acq-changelog {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px; margin: 0;
        }
        .acq-changelog > div {
          padding: 16px 18px; border: 1px solid var(--line);
          border-radius: var(--r-lg); background: var(--bg-2);
        }
        .acq-changelog dt {
          font-family: var(--font-mono); font-size: 12px;
          letter-spacing: .04em; color: var(--accent-2); margin-bottom: 6px;
        }
        .acq-changelog dd {
          margin: 0; font-size: 13px; line-height: 1.55; color: var(--text-dim);
        }
        @media (max-width: 780px) { .acq-changelog { grid-template-columns: 1fr; } }
      `}</style>
    </>
  );
}
