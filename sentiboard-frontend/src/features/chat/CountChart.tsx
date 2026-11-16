"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CountHistogramMarker, TabularPayload } from "./types";
import { fetchOnce } from "./DataTable";
import {
  buildCountModel,
  countReadoutText,
  formatCount,
  truncateLabel,
  type CountBar,
  type CountChartModel,
} from "./chart-model";
import { DataTableView, type TableState } from "./DataTable";
import type { TabularMarker } from "./types";
import s from "./chart.module.css";

// ---- State types ------------------------------------------------------------

export type CountChartState =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "invalid" }
  | { status: "done"; model: CountChartModel };

// ---- Color class mapping ---------------------------------------------------

const BAR_COLOR_CLASS: Record<CountBar["colorToken"], string> = {
  ok: s.barOk,
  warn: s.barWarn,
  crit: s.barCrit,
  "text-dim": s.barTextDim,
  accent: s.barAccent,
};

// ---- Horizontal bar chart constants ----------------------------------------

const LABEL_W = 120;    // px for category label column
const VALUE_W = 56;     // px reserved for count label on the right
const ROW_H = 24;       // px per bar row
const PAD_V = 8;        // vertical padding top/bottom

// ---- CountChartView (pure — no hooks) --------------------------------------

export interface CountChartViewProps {
  state: CountChartState;
  marker: CountHistogramMarker;
  width: number;
  showTable: boolean;
  onRetry?: () => void;
  onToggleTable?: () => void;
  onBarHover?: (text: string | null) => void;
}

export function CountChartView({
  state,
  marker,
  width,
  showTable,
  onRetry,
  onToggleTable,
  onBarHover,
}: CountChartViewProps) {
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

  const { model } = state;

  // Table-fallback: date+category case
  if (model.kind === "table-fallback") {
    const tState: TableState = { status: "done", payload: model.tablePayload, sort: null };
    const tMarker: TabularMarker = {
      kind: "tabular",
      data_id: model.tablePayload.data_id,
      title: model.title,
    };
    return (
      <div className={s.wrap}>
        <p className={s.fallbackNote}>{model.reason}</p>
        <DataTableView state={tState} marker={tMarker} />
      </div>
    );
  }

  // "Show as table" mode
  if (showTable) {
    const tablePayload: TabularPayload = {
      data_id: marker.data_id,
      title: model.title,
      description: "",
      columns:
        model.kind === "category"
          ? [marker.category_column!, marker.count_column]
          : [marker.date_column!, marker.count_column],
      rows:
        model.kind === "category"
          ? model.bars.map((b) => ({
              [marker.category_column!]: b.label,
              [marker.count_column]: b.value,
            }))
          : model.bars.map((b) => ({
              [marker.date_column!]: b.label,
              [marker.count_column]: b.value,
            })),
    };
    const tState: TableState = { status: "done", payload: tablePayload, sort: null };
    const tMarker: TabularMarker = {
      kind: "tabular",
      data_id: marker.data_id,
      title: model.title,
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

  if (model.kind === "category") {
    return renderCategoryBars(model.bars, model.title, width, onBarHover, onToggleTable);
  }

  if (model.kind === "date") {
    return renderCategoryBars(model.bars, model.title, width, onBarHover, onToggleTable);
  }

  return null;
}

function renderCategoryBars(
  bars: CountBar[],
  title: string,
  width: number,
  onBarHover: ((text: string | null) => void) | undefined,
  onToggleTable: (() => void) | undefined,
) {
  const barAreaW = Math.max(10, width - LABEL_W - VALUE_W);
  const maxVal = Math.max(...bars.map((b) => b.value), 1);
  const svgH = bars.length * ROW_H + PAD_V * 2;
  const ariaLabel = `Bar chart, ${bars.length} categories`;

  return (
    <div className={s.wrap}>
      <svg
        className={s.svg}
        viewBox={`0 0 ${width} ${svgH}`}
        height={svgH}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => onBarHover?.(null)}
      >
        {bars.map((bar, i) => {
          const y = PAD_V + i * ROW_H;
          const barW = Math.max(2, (bar.value / maxVal) * barAreaW);
          const colorCls = BAR_COLOR_CLASS[bar.colorToken];
          const displayLabel = truncateLabel(bar.label);
          const readoutText = countReadoutText(bar.label, bar.value);
          return (
            <g
              key={bar.label + i}
              onMouseEnter={() => onBarHover?.(readoutText)}
            >
              {/* Category label (truncated, right-aligned in label column) */}
              <text
                className={s.barLabel}
                x={LABEL_W - 4}
                y={y + ROW_H / 2}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {displayLabel}
              </text>
              {/* Bar */}
              <rect
                className={colorCls}
                x={LABEL_W}
                y={y + 4}
                width={barW}
                height={ROW_H - 8}
                rx={2}
              />
              {/* Count label next to bar */}
              <text
                className={s.barValue}
                x={LABEL_W + barW + 4}
                y={y + ROW_H / 2}
                dominantBaseline="middle"
              >
                {formatCount(bar.value)}
              </text>
            </g>
          );
        })}
      </svg>

      <button type="button" className={s.toggle} onClick={onToggleTable}>
        Show as table
      </button>
    </div>
  );
}

// ---- CountChart (fetch + state + ResizeObserver) ---------------------------

interface CountChartProps {
  marker: CountHistogramMarker;
  requestId: string | undefined;
}

export default function CountChart({ marker, requestId }: CountChartProps) {
  const [state, setState] = useState<CountChartState>({ status: "loading" });
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
      const model = buildCountModel(result.data, marker);
      if (model === "invalid") {
        setState({ status: "invalid" });
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
      <p className={s.readout}>{readout || " "}</p>
      <CountChartView
        state={state}
        marker={marker}
        width={width}
        showTable={showTable}
        onRetry={startFetch}
        onToggleTable={() => setShowTable((v) => !v)}
        onBarHover={(text) => setReadout(text ?? "")}
      />
    </div>
  );
}
