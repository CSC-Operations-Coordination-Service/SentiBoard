"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import Collapse from "./Collapse";

// The "Description" accordion that sits under every page title, carried over from the legacy
// dashboard's <div id="accordion"> card (apps/templates/home/data-availability.html).
//
// The legacy markup drove this with Bootstrap's data-toggle="collapse", which needs jQuery and
// Bootstrap's JS bundle at runtime. Here the open flag is plain React state and the slide is CSS
// (see Collapse), so the behaviour survives with no third-party JS at all.
//
// Open by default: the guidance is worth reading on arrival, and a reader who does not want it can
// put it away. Collapsing is the deliberate act, not expanding.
export default function PageDescription({
  children,
  title = "Description",
  defaultOpen = true,
}: {
  children: React.ReactNode;
  title?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="page-desc">
      <button
        type="button"
        className="page-desc-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        {title}
        <ChevronDown className="chev" size={15} aria-hidden />
      </button>
      <Collapse open={open} id={bodyId}>
        <div className="body">{children}</div>
      </Collapse>
    </div>
  );
}
