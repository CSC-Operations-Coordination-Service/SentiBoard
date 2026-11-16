"use client";

import type { WidgetMarker, KpiDirectMarker } from "./types";
import s from "./marker-placeholder.module.css";

type NonDirectMarker = Exclude<WidgetMarker, KpiDirectMarker>;

const KIND_LABEL: Record<NonDirectMarker["kind"], string> = {
  tabular: "Table",
  "temporal-plot": "Time series plot",
  "count-histogram": "Count histogram",
  "event-calendar": "Event calendar",
  "kpi-artifact": "KPI",
};

interface Props {
  marker: NonDirectMarker;
}

export default function MarkerPlaceholder({ marker }: Props) {
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
