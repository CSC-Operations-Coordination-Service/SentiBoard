"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TemporalPlotMarker, TabularPayload } from "./types";
import { fetchOnce } from "./DataTable";
import {
  buildTemporalModel,
  roundDisplay,
  seriesColorClass,
  temporalReadoutText,
  type TemporalChartModel,
} from "./chart-model";
import { DataTableView, type TableState } from "./DataTable";
import type { TabularMarker } from "./types";
import s from "./chart.module.css";

// ---- State types ------------------------------------------------------------

export type TemporalChartState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "done"; model: TemporalChartModel }
  | { status: "table-only"; tablePayload: TabularPayload; title: string };

// ---- SVG layout constants --------------------------------------------------

const PAD = { top: 20, right: 8, bottom: 28, left: 44 } as const;
const CHART_HEIGHT = 200;

function chartArea(width: number) {
  return {
    x: PAD.left,
    y: PAD.top,
    w: Math.max(1, width - PAD.left - PAD.right),
    h: CHART_HEIGHT - PAD.top - PAD.bottom,
  };
}

// ---- TemporalChartView (pure — no hooks) -----------------------------------

export interface TemporalChartViewProps {
  state: TemporalChartState;
  width: number;
  showTable: boolean;
  onRetry?: () => void;
  onToggleTable?: () => void;
  onPointHover?: (text: string | null) => void;
}

export function TemporalChartView({
  state,
  width,
  showTable,
  onRetry,
  onToggleTable,
  onPointHover,
}: TemporalChartViewProps) {
  if (state.status === "loading") {
    return <p className={s.msg}>Loading chart…</p>;
  }
  if (state.status === "not_found") {
    return <p className={s.msg}>This data is no longer available, please ask again.</p>;
  }
  if (state.status === "unavailable") {
    return (
      <div className={s.msg}>
        <span>Could not load the data.</span>
        {onRetry && (
          <button type="button" className={s.retryBtn} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (state.status === "invalid") {
    return <p className={s.msg}>The data could not be displayed.</p>;
  }

  // table-only: >6 series or count table-fallback
  if (state.status === "table-only") {
    const tState: TableState = {
      status: "done",
      payload: state.tablePayload,
      sort: null,
    };
    const tMarker: TabularMarker = {
      kind: "tabular",
      data_id: state.tablePayload.data_id,
      title: state.title,
    };
    return (
      <div className={s.wrap}>
        <DataTableView state={tState} marker={tMarker} />
      </div>
    );
  }

  const { model } = state;
  const { series, yAxis, xLabels, title, numericLabel } = model;
  const isSingleAll = series.length === 1 && series[0].name === "all";
  const ca = chartArea(width);
  const xMin = xLabels.length > 0 ? xLabels[0].date : 0;
  const xMax = xLabels.length > 0 ? xLabels[xLabels.length - 1].date : 1;
  const allPts = series.flatMap((s) => s.segments.flat());
  const dataXMin = allPts.length > 0 ? Math.min(...allPts.map((p) => p.date)) : xMin;
  const dataXMax = allPts.length > 0 ? Math.max(...allPts.map((p) => p.date)) : xMax;
  const xRange = dataXMax - dataXMin || 1;
  const yRange = yAxis.max - yAxis.min || 1;

  function xOf(date: number) {
    return ca.x + ((date - dataXMin) / xRange) * ca.w;
  }
  function yOf(value: number) {
    return ca.y + (1 - (value - yAxis.min) / yRange) * ca.h;
  }

  // "Show as table" mode: render DataTableView with the precomputed tablePayload
  if (showTable) {
    const tState: TableState = { status: "done", payload: model.tablePayload, sort: null };
    const tMarker: TabularMarker = {
      kind: "tabular",
      data_id: model.tablePayload.data_id,
      title,
    };
    return (
      <div className={s.wrap}>
        <DataTableView state={tState} marker={tMarker} />
        <button type="button" className={s.toggle} onClick={onToggleTable}>
          Show chart
        </button>
      </div>
    );
  }

  const minV = roundDisplay(Math.min(...allPts.map((p) => p.value)));
  const maxV = roundDisplay(Math.max(...allPts.map((p) => p.value)));
  const ariaLabel = `Line chart, ${allPts.length} point${allPts.length !== 1 ? "s" : ""}, ${minV} ${model.isPercentage ? "%" : ""} to ${maxV} ${model.isPercentage ? "%" : ""}`;

  return (
    <div className={s.wrap}>
      <p className={s.title}>{title}</p>
      <svg
        className={s.svg}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        height={CHART_HEIGHT}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => onPointHover?.(null)}
      >
        {/* Y-axis grid lines and tick labels */}
        {yAxis.ticks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line className={s.gridLine} x1={ca.x} y1={y} x2={ca.x + ca.w} y2={y} />
              <text
                className={s.axisLabel}
                x={ca.x - 4}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X-axis baseline */}
        <line
          className={s.axisLine}
          x1={ca.x}
          y1={ca.y + ca.h}
          x2={ca.x + ca.w}
          y2={ca.y + ca.h}
        />

        {/* X-axis date labels */}
        {xLabels.map((xl, i) => {
          const x = xOf(xl.date);
          const anchor =
            i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle";
          return (
            <text
              key={xl.date}
              className={s.axisLabel}
              x={x}
              y={ca.y + ca.h + 14}
              textAnchor={anchor}
            >
              {xl.label}
            </text>
          );
        })}

        {/* Series */}
        {series.map((ser, si) => {
          const colorCls = seriesColorClass(ser.name, si);
          const displayName = isSingleAll ? numericLabel : ser.name;
          return (
            <g key={ser.name} className={s[colorCls]}>
              {/* Line segments (gaps break the path) */}
              {ser.segments.map((seg, gi) => {
                if (seg.length === 0) return null;
                const d = seg
                  .map((p, pi) => `${pi === 0 ? "M" : "L"} ${xOf(p.date).toFixed(1)},${yOf(p.value).toFixed(1)}`)
                  .join(" ");
                return <path key={gi} className={s.seriesPath} d={d} />;
              })}
              {/* Visible point markers + invisible hit areas */}
              {ser.segments.flat().map((p) => {
                const cx = xOf(p.date);
                const cy = yOf(p.value);
                const readoutText = temporalReadoutText(p.date, p.value, model.isPercentage);
                return (
                  <g key={p.date}>
                    <circle className={s.seriesPoint} cx={cx} cy={cy} r={2.5} />
                    {/* Invisible wider hit area */}
                    <rect
                      x={cx - 8}
                      y={ca.y}
                      width={16}
                      height={ca.h}
                      fill="transparent"
                      onMouseEnter={() => onPointHover?.(`${isSingleAll ? "" : `${displayName} · `}${readoutText}`)}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {/* Legend — only when >1 series (single "all" → no legend) */}
      {!isSingleAll && series.length > 1 && (
        <div className={s.legend}>
          {series.map((ser, si) => {
            const colorCls = seriesColorClass(ser.name, si);
            return (
              <span key={ser.name} className={`${s.legendItem} ${s[colorCls]}`}>
                <span className={s.legendSwatch} />
                {ser.name}
              </span>
            );
          })}
        </div>
      )}

      <button type="button" className={s.toggle} onClick={onToggleTable}>
        Show as table
      </button>
    </div>
  );
}

// ---- TemporalChart (fetch + state + ResizeObserver) ------------------------

interface TemporalChartProps {
  marker: TemporalPlotMarker;
  requestId: string | undefined;
}

export default function TemporalChart({ marker, requestId }: TemporalChartProps) {
  const [state, setState] = useState<TemporalChartState>({ status: "loading" });
  const [showTable, setShowTable] = useState(false);
  const [readout, setReadout] = useState("");
  const [width, setWidth] = useState(360);
  const containerRef = useRef<HTMLDivElement>(null);

  const startFetch = useCallback(() => {
    if (!requestId) {
      setState({ status: "unavailable" });
      return;
    }
    setState({ status: "loading" });
    fetchOnce(marker.data_id, requestId).then((result) => {
      if (!result.ok) {
        const status = result.reason === "disabled" ? "unavailable" : result.reason;
        setState({ status });
        return;
      }
      if (result.kind !== "tabular") {
        setState({ status: "invalid" });
        return;
      }
      const model = buildTemporalModel(result.data, marker);
      if (model === "invalid") {
        setState({ status: "invalid" });
      } else if (model === "too-many-series") {
        const tr = result.data.temporal_rows ?? [];
        const cols = tr.length > 0 ? Object.keys(tr[0]) : [];
        setState({
          status: "table-only",
          tablePayload: {
            data_id: result.data.data_id,
            title: marker.title ?? result.data.title,
            description: "",
            columns: cols,
            rows: tr,
          },
          title: marker.title ?? result.data.title,
        });
      } else {
        setState({ status: "done", model });
      }
    });
  }, [marker, requestId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    startFetch();
  }, [startFetch]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(Math.round(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef}>
      {/* Hover readout — empty placeholder preserves height */}
      <p className={s.readout}>{readout || " "}</p>
      <TemporalChartView
        state={state}
        width={width}
        showTable={showTable}
        onRetry={startFetch}
        onToggleTable={() => setShowTable((v) => !v)}
        onPointHover={(text) => setReadout(text ?? "")}
      />
    </div>
  );
}
