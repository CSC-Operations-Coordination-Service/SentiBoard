"use client";

import dynamic from "next/dynamic";
import type { Segment } from "./types";
import KpiCard from "./KpiCard";
import MarkerPlaceholder from "./MarkerPlaceholder";

// Lazy-loaded so that react-markdown, remark/rehype and KaTeX land in a
// separate chunk from the initial widget bundle.
const MarkdownContent = dynamic(() => import("./MarkdownContent"), {
  loading: () => null,
  ssr: false,
});

interface Props {
  segments: Segment[];
}

export default function AssistantAnswer({ segments }: Props) {
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "markdown") {
          return <MarkdownContent key={i} text={seg.text} />;
        }
        if (seg.marker.kind === "kpi-direct") {
          return <KpiCard key={i} marker={seg.marker} />;
        }
        return <MarkerPlaceholder key={i} marker={seg.marker} />;
      })}
    </>
  );
}
