import { PageHeader, Reveal } from "@/components/ui";
import AcquisitionGlobe from "@/components/AcquisitionGlobe";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES } from "@/data/mock";

/* PROPOSAL — Acquisitions globe, rebuilt around demand-driven rendering.
   Same page composition as /acquisitions; what changes is underneath the canvas.
   This route exists so the upgrade can be reviewed next to the other proposals
   under /examples. */

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
  ["Completeness plates",
    "The right column becomes the datatake rail: per-level isometric plates where the solid volume is published sensing and the dashed cage above it is what is still missing. One prism per product type, an alarm outline below 95%, and a flat dashed pad for a type that is not expected at all — which is not the same as 0%."],
  ["Completeness is one number",
    "The header KPI is the mean across expected product types, so it agrees with the plates. comp and the marker colour are derived from the same product data in mock.ts and cannot be hand-set out of step. Missing time is summed across product types, so it can exceed the sensing window — the rail says so rather than leaving it to be misread."],
  ["Downlink passes (mock)",
    "Station, volume and pass duration per datatake, isolated in data/downlink.ts because the backend has no datatake-to-pass join, no per-pass volume and no per-pass duration yet. Swap the body of passesFor() for the API call and nothing else moves."],
  ["Rail isolated from the canvas",
    "The rail is memoised on the selected datatake alone, so the globe's own churn — contact flipping mid-animation, playback, the roving tabindex — never re-renders the plates, and the canvas setup effect carries no rail state, so selecting never tears the canvas down."],
  ["One dropdown, every mission",
    "The satellite chips and day picker are gone. Selection is a single native dropdown over every datatake, grouped by mission so Sentinel-1, -2, -3 and -5P sit in one list — the way the legacy Acquisitions page picks a datatake. It also replaces the right column's list panel, which would otherwise be a second control with the same name. The coverage-aware day filter is still live on /acquisitions."],
  ["Three layout tiers",
    "560 / 780 / 980px breakpoints, with the canvas sized by a ResizeObserver on its stage rather than window resize events."],
];

export default function AcquisitionsGlobe() {
  return (
    <>
      <PageHeader crumb="Acquisitions · Demand-driven globe" title="Acquisitions Status"
        sub="Proposal for the acquisitions globe: the same interactive 3D view, rebuilt so it only renders when it has to, draws the acquired footprints rather than bare points, and is fully operable from the keyboard."
        desc={ACQUISITIONS_DESCRIPTION} />

      <section className="wrap pad">
        <Reveal>
          <AcquisitionGlobe stations={STATIONS} datatakes={ACQ_DATATAKES} rail="plates" />
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
