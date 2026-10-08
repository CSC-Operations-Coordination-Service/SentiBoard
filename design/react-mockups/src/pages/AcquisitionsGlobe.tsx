import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Reveal } from "@/components/ui";
import AcquisitionGlobe from "@/components/AcquisitionGlobe";
import { ACQUISITIONS_DESCRIPTION } from "@/data/copy";
import { STATIONS, ACQ_DATATAKES } from "@/data/mock";

/* PROPOSAL — Acquisitions globe, rebuilt around demand-driven rendering.
   Same page composition as /acquisitions; what changes is underneath the canvas.
   This route exists so the upgrade can be reviewed next to the other proposals
   under /examples. */

const DESCRIPTION = (
  <>
    <p>{ACQUISITIONS_DESCRIPTION}</p>
  </>
);

export default function AcquisitionsGlobe() {
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Acquisitions Status"
        subtitle="Past, current and planned Sentinel acquisitions on an interactive 3D globe."
        img="/assets/img/modules/acquisitions.jpg"
        desc={DESCRIPTION}
      />

      <section
        style={
          {
            width: "100vw",
            position: "relative",
            left: "50%",
            transform: "translateX(-50%)",
            boxSizing: "border-box",
            paddingTop: "0",
            paddingBottom: "clamp(56px, 8vw, 120px)",
          } as any
        }
      >
        <div
          style={
            {
              width: "100%",
              maxWidth: "none",
              margin: "0",
              padding: "0 clamp(18px, 4vw, 48px)",
              boxSizing: "border-box",
            } as any
          }
        >
          {/* Cross-link to the second Acquisitions concept. The two answer different questions —
              this one is the geographic reading, the ladder is the pipeline reading — so they are
              reviewed together rather than one replacing the other. */}

          <Reveal>
            <AcquisitionGlobe
              stations={STATIONS}
              datatakes={ACQ_DATATAKES}
              rail="plates"
            />
          </Reveal>
        </div>
      </section>

    </>
  );
}
