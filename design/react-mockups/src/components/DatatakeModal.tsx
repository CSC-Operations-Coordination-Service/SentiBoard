import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, X } from "lucide-react";
import { datatakeDetails, type DatatakeSummary } from "@/data/datatake-details";
import "@/styles/datatake-modal.css";

/* Datatake details modal — the React counterpart of production's #completenessTableModal
   (apps/templates/home/data-availability.html), opened from the "View Details" action in the
   datatake table.

   Production shows only the per-product completeness table. This adds the datatake's own identity
   above it — platform, sensing window, orbit and track, downlink station, coverage — because that
   is what an operator has to read off the row today by eye, and it costs nothing to put in a panel
   that is already open.

   Ownership of state is deliberate: the PAGE owns which datatake is selected, this component owns
   only what belongs to an open dialog (the table's page number, the "copied" flash). Mount it as
   {selected && <DatatakeModal datatake={selected} onClose={…} />} so every open starts clean, and
   key it by ID if you let one row be swapped for another without closing.

   Dialog behaviour, all of it here rather than in the pages: Escape closes, a click on the
   backdrop closes (only when the press *started* there, so a drag out of the table never does),
   focus moves in on open and returns to the trigger on close, Tab is trapped inside, and the page
   behind is scroll-locked without shifting under the scrollbar's width. */

const ROWS_PER_PAGE = 10; // production paginates at 10 (datatakes.js: infoItemsPerPage)

const pad = (n: number) => String(n).padStart(2, "0");
const fmtUTC = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes(),
  )}:${pad(d.getUTCSeconds())}`;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="dtm-kv">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

/** Two takes on the same dialog, one per page, so the proposals can be compared:
 *
 *  - "compact" — what production does today, restyled: the ID in the title, the per-product
 *    percentages, pagination, Close. Nothing else. Used by /availability.
 *  - "full" — the proposal: the same table with the datatake's identity above it, so sensing
 *    window, orbit, track and station no longer have to be read off the row. Used by
 *    /examples/data-availability.
 */
export type DatatakeModalVariant = "compact" | "full";

export default function DatatakeModal({
  datatake,
  onClose,
  variant = "full",
}: {
  datatake: DatatakeSummary;
  onClose: () => void;
  variant?: DatatakeModalVariant;
}) {
  const full = variant === "full";
  const details = useMemo(() => datatakeDetails(datatake), [datatake]);
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const backdropPress = useRef(false);

  const totalPages = Math.max(1, Math.ceil(details.products.length / ROWS_PER_PAGE));
  const pageRows = details.products.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE);

  // Escape closes, Tab stays inside. Both live on the dialog's own subtree except Escape, which
  // has to work even when focus has wandered.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeInside = dialogRef.current.contains(document.activeElement);
      if (e.shiftKey && (document.activeElement === first || !activeInside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  // Scroll-lock the page behind. Padding the body by the scrollbar's width keeps the layout from
  // jumping sideways the moment the overlay opens.
  useEffect(() => {
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPad = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPad;
    };
  }, []);

  // Move focus in, and hand it back to whatever opened the dialog on the way out.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => opener?.focus?.();
  }, []);

  const copyId = useCallback(() => {
    navigator.clipboard?.writeText(datatake.id).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      },
      () => setCopied(false),
    );
  }, [datatake.id]);

  const downloadCsv = useCallback(() => {
    const head = details.showTimeliness ? "timeliness,product_type,status_pct" : "product_type,status_pct";
    const lines = details.products.map((p) =>
      details.showTimeliness ? `${p.timeliness},${p.type},${p.pct.toFixed(2)}` : `${p.type},${p.pct.toFixed(2)}`,
    );
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${datatake.id}_products.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [details, datatake.id]);

  return createPortal(
    <div
      className="dtm-backdrop"
      onMouseDown={(e) => {
        backdropPress.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (backdropPress.current && e.target === e.currentTarget) onClose();
        backdropPress.current = false;
      }}
    >
      <div
        className={full ? "dtm-dialog" : "dtm-dialog compact"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dtm-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <header className="dtm-head">
          <div>
            <span className="eyebrow">Datatake details</span>
            <h3 id="dtm-title">{datatake.id}</h3>
          </div>
          <button className="dtm-x" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        </header>

        <div className="dtm-body">
          {full && (
            <>
              <div className="dtm-status">
                <span className="dtm-badge" style={{ ["--badge" as string]: datatake.statusColor }}>
                  {datatake.statusLabel}
                </span>
                <div className="dtm-meter">
                  <div className="track">
                    <div
                      className="fill"
                      style={{ width: `${datatake.completeness}%`, background: datatake.statusColor }}
                    />
                  </div>
                  <span className="val">{datatake.completeness}%</span>
                </div>
                <span className="dtm-meter-lab">publication completeness</span>
              </div>

              <div className="dtm-grid">
                <Row label="Platform" value={datatake.platform} />
                <Row label="Mission" value={datatake.mission} />
                <Row label="Sensor mode" value={details.sensorMode} />
                <Row label="Sensing start" value={fmtUTC(datatake.sensingStart)} />
                <Row label="Sensing stop" value={fmtUTC(details.sensingStop)} />
                <Row label="Duration" value={`${details.durationMin} min`} />
                <Row label="Absolute orbit" value={details.absoluteOrbit} />
                <Row label="Relative orbit (track)" value={details.relativeOrbit} />
                <Row label="Cycle" value={details.cycle} />
                <Row label="Downlink station" value={details.station} />
                <Row label="Processing levels" value={details.levels.join(" · ")} />
                <Row label="Coverage" value={`${details.coverage}% · ${details.footprint}`} />
              </div>

              <div className="dtm-tablehead">
                <span className="eyebrow">Products</span>
                <span className="meta">{details.products.length} entries</span>
              </div>
            </>
          )}

          <table className="dtm-table">
            <thead>
              <tr>
                {details.showTimeliness && <th>Timeliness</th>}
                <th>Product type</th>
                <th className="num">Status (%)</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={`${p.timeliness}-${p.type}`}>
                  {details.showTimeliness && <td className="tl">{p.timeliness}</td>}
                  <td className="ty">{p.type}</td>
                  <td className="num">{p.pct.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <nav className="dtm-pager" aria-label="Product table pages">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                « Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  className={n === page ? "on" : ""}
                  aria-current={n === page ? "page" : undefined}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next »
              </button>
            </nav>
          )}
        </div>

        <footer className="dtm-foot">
          {full && (
            <>
              <button className="dtm-act" onClick={copyId}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy ID"}
              </button>
              <button className="dtm-act" onClick={downloadCsv}>
                <Download size={14} />
                Product list (CSV)
              </button>
            </>
          )}
          <button className="dtm-close" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
