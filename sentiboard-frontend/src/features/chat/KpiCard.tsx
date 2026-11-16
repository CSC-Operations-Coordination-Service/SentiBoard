"use client";

import type { KpiDirectMarker } from "./types";
import s from "./kpi-card.module.css";

interface Props {
  marker: KpiDirectMarker;
}

const COLOR_CLASS: Record<NonNullable<KpiDirectMarker["color"]>, string> = {
  green: s.green,
  orange: s.orange,
  red: s.red,
  blue: s.blue,
  gray: s.gray,
};

export default function KpiCard({ marker }: Props) {
  const colorClass = marker.color ? COLOR_CLASS[marker.color] : "";
  return (
    <div className={s.card}>
      <span className={s.label}>{marker.label}</span>
      <span className={[s.value, colorClass].filter(Boolean).join(" ")}>
        {marker.value}
      </span>
      {marker.delta && <span className={s.delta}>{marker.delta}</span>}
    </div>
  );
}
