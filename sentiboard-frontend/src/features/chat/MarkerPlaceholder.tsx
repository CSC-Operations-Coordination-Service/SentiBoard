"use client";

import type { WidgetMarker, KpiDirectMarker, InvalidMarkerSegment } from "./types";
import s from "./marker-placeholder.module.css";

type NonDirectMarker = Exclude<WidgetMarker, KpiDirectMarker>;

const KIND_LABEL: Record<NonDirectMarker["kind"], string> = {
  tabular: "Table",
  "temporal-plot": "Time series plot",
  "count-histogram": "Count histogram",
  "event-calendar": "Event calendar",
  "kpi-artifact": "KPI",
};

// User-facing noun for each known tag that can produce an invalid-marker segment.
const INVALID_NOUN: Record<string, string> = {
  "temporal-plot": "chart",
  "count-histogram": "chart",
  tabular: "table",
  "event-calendar": "calendar",
  kpi: "KPI",
};

type Props = { marker: NonDirectMarker } | { invalid: InvalidMarkerSegment };

export default function MarkerPlaceholder(props: Props) {
  if ("invalid" in props) {
    const noun = INVALID_NOUN[props.invalid.tag] ?? "widget";
    return (
      <div className={s.placeholder} aria-label={`This ${noun} couldn't be displayed`}>
        <span className={s.kind}>This {noun} couldn&apos;t be displayed.</span>
        <span className={s.note}> Try asking again.</span>
      </div>
    );
  }
  const { marker } = props;
  const kindLabel = KIND_LABEL[marker.kind];
  const title = "title" in marker && typeof marker.title === "string" ? marker.title : undefined;
  const display = title ? `${kindLabel}: ${title}` : kindLabel;
  return (
    <div className={s.placeholder} aria-label={`${display} — not displayed yet`}>
      <span className={s.kind}>{display}</span>
      <span className={s.note}> — not displayed yet</span>
    </div>
  );
}
