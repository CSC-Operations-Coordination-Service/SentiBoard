"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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
// Close button — shared between inline card and sheet
// ---------------------------------------------------------------------------

const CloseIcon = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path
      d="M3 3l10 10M13 3L3 13"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

// ---------------------------------------------------------------------------
// Datatake card — inline card (tablet/desktop) or bottom sheet (phone ≤480px).
// Height animation (inline) and slide animation (sheet) both run inside the
// existing cardPhase / onClosed machine so focus restoration works unchanged.
// ---------------------------------------------------------------------------

export default function DatatakeCard({
  d,
  phase,
  onClose,
  onClosed,
  sheet = false,
}: {
  d: Datatake;
  phase: CardPhase;
  onClose: () => void;
  onClosed: () => void;
  /** When true, renders as a bottom-sheet portal instead of an inline card. */
  sheet?: boolean;
}) {
  const { acq, pub } = cardSides(d);
  const ref = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const raf1 = useRef(0);
  const raf2 = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    cancelAnimationFrame(raf1.current);
    cancelAnimationFrame(raf2.current);
    clearTimeout(timer.current);

    if (sheet) {
      // ---- bottom-sheet animation (translate-Y) ----
      const el = ref.current;
      const bd = backdropRef.current;
      if (!el || !bd) return;

      if (phase === "open") {
        if (reduced) {
          el.style.transform = "translateY(0)";
          el.style.transition = "none";
          bd.style.opacity = "1";
          bd.style.transition = "none";
          closeRef.current?.focus();
          return;
        }
        el.style.transform = "translateY(100%)";
        el.style.transition = "none";
        bd.style.opacity = "0";
        bd.style.transition = "none";
        raf1.current = requestAnimationFrame(() => {
          raf2.current = requestAnimationFrame(() => {
            el.style.transition = "transform 400ms cubic-bezier(.2,.7,.2,1)";
            el.style.transform = "translateY(0)";
            bd.style.transition = "opacity 350ms ease";
            bd.style.opacity = "1";
            // Focus ✕ after a short delay so the browser has painted the sheet
            timer.current = setTimeout(() => closeRef.current?.focus(), 50);
          });
        });
      } else if (phase === "close") {
        if (reduced) {
          onClosed();
          return;
        }
        el.style.transition = "transform 380ms cubic-bezier(.8,0,.8,.3)";
        el.style.transform = "translateY(100%)";
        bd.style.transition = "opacity 320ms ease";
        bd.style.opacity = "0";
        timer.current = setTimeout(onClosed, 420);
      } else {
        // swap: instant, no animation (page loaded with ?pick= in URL)
        el.style.transform = "translateY(0)";
        el.style.transition = "none";
        bd.style.opacity = "1";
        bd.style.transition = "none";
        // Don't auto-focus: opened by URL, not by user tap
      }
    } else {
      // ---- inline-card height animation (unchanged) ----
      const el = ref.current;
      if (!el) return;

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
    }

    return () => {
      cancelAnimationFrame(raf1.current);
      cancelAnimationFrame(raf2.current);
      clearTimeout(timer.current);
    };
  }, [phase, onClosed, sheet]);

  // Simple focus trap: Tab/Shift+Tab cycles within the sheet.
  const trapFocus = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const el = ref.current;
    if (!el) return;
    const focusable = Array.from(
      el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // Shared content pieces
  const rings = (
    <div className={s.dtkRings}>
      <Ring title="Acquisition" side={acq} onLabel="Acquired" />
      <Ring
        title="Publication"
        side={pub}
        onLabel={pub.label === "PROCESSING" ? "Processing" : "Published"}
      />
    </div>
  );

  const meta = (
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
  );

  if (sheet) {
    return createPortal(
      <>
        {/* Backdrop: dim layer, tapping closes the sheet */}
        <div
          ref={backdropRef}
          className={s.sheetBackdrop}
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Sheet panel */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dtk-sheet-id"
          className={s.sheet}
          onKeyDown={trapFocus}
        >
          {/* Sticky header */}
          <div className={s.sheetHead}>
            <div className={s.sheetHeadText}>
              <b id="dtk-sheet-id">{d.id}</b>
              <div className={s.dtkWhen}>{fmtDateTime(d.start)}</div>
            </div>
            <button
              ref={closeRef}
              type="button"
              className={s.dtkClose}
              onClick={onClose}
              aria-label="Close details"
            >
              {CloseIcon}
            </button>
          </div>
          {/* Scrollable body */}
          <div className={s.sheetBody}>
            <div className={s.dtkBody}>
              {rings}
              {meta}
            </div>
          </div>
        </div>
      </>,
      document.body,
    );
  }

  // Inline card (tablet / desktop)
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
          {CloseIcon}
        </button>
      </div>
      <div className={s.dtkWhen}>{fmtDateTime(d.start)}</div>
      <div className={s.dtkBody}>
        {rings}
        {meta}
      </div>
    </div>
  );
}
