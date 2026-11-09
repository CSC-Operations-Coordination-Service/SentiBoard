"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { cardSides, fmtDateTime, type CardSide, type Datatake } from "./model";
import s from "./availability.module.css";

export type CardPhase = "open" | "swap" | "close";

// ---------------------------------------------------------------------------
// SVG ring for the datatake card (Acquisition or Publication)
// ---------------------------------------------------------------------------

function Ring({
  title,
  side,
  onLabel,
}: {
  title: string;
  side: CardSide;
  onLabel: string;
}) {
  const R = 27;
  const C = 2 * Math.PI * R;
  const v = side.pct ?? 0;
  const len = (v / 100) * C;
  return (
    <div className={s.ring}>
      <span className={s.ringTitle}>{title}</span>
      <div className={s.ringWrap}>
        <svg
          viewBox="0 0 70 70"
          role="img"
          aria-label={`${title} completeness ${side.pct !== null ? `${side.pct.toFixed(2)}%` : "—"}`}
        >
          <circle
            cx="35" cy="35" r={R}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="9"
          />
          {v > 0 && (
            <circle
              cx="35" cy="35" r={R}
              fill="none"
              stroke={side.color}
              strokeWidth="9"
              strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
              transform="rotate(-90 35 35)"
            />
          )}
        </svg>
        <b className={s.ringMid}>
          <em>Completeness</em>
          <span style={{ color: side.color }}>
            {side.pct === null ? "—" : `${side.pct.toFixed(2)}%`}
          </span>
        </b>
      </div>
      <span className={s.ringLegend}>
        <i style={{ background: side.color } as CSSProperties} />
        {onLabel}
      </span>
      <span className={s.ringLegend}>
        <i style={{ background: "rgba(255,255,255,0.24)" } as CSSProperties} />
        Missing
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datatake card — opens inline under the picked bar's band.
// Height animation mirrors NewsBar.tsx (double-rAF, cancel on phase change).
// ---------------------------------------------------------------------------

export default function DatatakeCard({
  d,
  phase,
  onClose,
  onClosed,
}: {
  d: Datatake;
  phase: CardPhase;
  onClose: () => void;
  onClosed: () => void;
}) {
  const { acq, pub } = cardSides(d);
  const ref = useRef<HTMLDivElement>(null);
  const raf1 = useRef(0);
  const raf2 = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cancelAnimationFrame(raf1.current);
    cancelAnimationFrame(raf2.current);
    clearTimeout(timer.current);

    if (phase === "open") {
      if (reduced) {
        el.style.cssText = "height:auto;opacity:1;overflow:hidden;transition:none";
        return;
      }
      el.style.cssText = "height:0px;opacity:0;overflow:hidden;transition:none";
      raf1.current = requestAnimationFrame(() => {
        raf2.current = requestAnimationFrame(() => {
          const h = el.scrollHeight;
          el.style.transition =
            "height 560ms cubic-bezier(.2,.7,.2,1), opacity 400ms ease 120ms";
          el.style.height = `${h}px`;
          el.style.opacity = "1";
          timer.current = setTimeout(() => {
            el.style.height = "auto";
            el.style.transition = "";
          }, 600);
        });
      });
    } else if (phase === "close") {
      if (reduced) {
        onClosed();
        return;
      }
      const h = el.scrollHeight;
      el.style.cssText = `height:${h}px;opacity:1;overflow:hidden;transition:none`;
      raf1.current = requestAnimationFrame(() => {
        raf2.current = requestAnimationFrame(() => {
          el.style.transition =
            "height 560ms cubic-bezier(.8,0,.8,.3), opacity 300ms ease";
          el.style.height = "0px";
          el.style.opacity = "0";
          timer.current = setTimeout(onClosed, 620);
        });
      });
    } else {
      // swap: instant, no animation
      el.style.cssText = "height:auto;opacity:1;overflow:hidden;transition:none";
    }

    return () => {
      cancelAnimationFrame(raf1.current);
      cancelAnimationFrame(raf2.current);
      clearTimeout(timer.current);
    };
  }, [phase, onClosed]);

  return (
    <div ref={ref} className={s.dtkCard}>
      <div className={s.dtkHead}>
        <b>{d.id}</b>
        <button
          type="button"
          className={s.dtkClose}
          onClick={onClose}
          aria-label="Close details"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path
              d="M3 3l10 10M13 3L3 13"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className={s.dtkWhen}>{fmtDateTime(d.start)}</div>
      <div className={s.dtkBody}>
        <div className={s.dtkRings}>
          <Ring title="Acquisition" side={acq} onLabel="Acquired" />
          <Ring
            title="Publication"
            side={pub}
            onLabel={pub.label === "PROCESSING" ? "Processing" : "Published"}
          />
        </div>
        <dl className={s.dtkMeta}>
          <dt>Data take ID</dt>
          <dd>{d.id}</dd>
          <dt>Platform</dt>
          <dd>{d.satellite}</dd>
          <dt>Sensor mode</dt>
          <dd>{d.sensorMode}</dd>
          <dt>Start date</dt>
          <dd>{fmtDateTime(d.start)}</dd>
          <dt>Stop date</dt>
          <dd>{fmtDateTime(d.stop)}</dd>
          <dt>Acquisition</dt>
          <dd>
            <span
              className={s.dtkBadge}
              style={{ background: acq.color } as CSSProperties}
            >
              {acq.label}
            </span>
          </dd>
          <dt>Publication</dt>
          <dd>
            <span
              className={s.dtkBadge}
              style={{ background: pub.color } as CSSProperties}
            >
              {pub.label}
            </span>
          </dd>
        </dl>
      </div>
    </div>
  );
}
