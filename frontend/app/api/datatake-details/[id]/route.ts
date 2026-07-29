import { NextResponse } from "next/server";

// Server-side proxy for the datatake product completeness — replicates prod's
// on-demand AJAX to /api/worker/cds-datatake/<id>. That endpoint is @internal_only,
// so we call it from the Next SERVER (Node sends X-Requested-With + a same-host
// Referer, which internal_only accepts) and hand the JSON to the browser same-origin.
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5005";
export const dynamic = "force-dynamic";

// Best-effort extraction of a [{type, pct}] product-completeness list from whatever
// shape load_datatake_details returns (kept defensive until confirmed against a live
// response — the backend endpoint currently hangs locally).
function extractProducts(data: any): { type: string; pct: number }[] {
  if (!data || typeof data !== "object") return [];
  const asRows = (arr: any[]) =>
    arr
      .map((p: any) => ({
        type: String(p.productType ?? p.type ?? p.product ?? p.name ?? "?"),
        pct: Number(p.status ?? p.percentage ?? p.value ?? p.completeness ?? 0),
      }))
      .filter((r) => Number.isFinite(r.pct));
  for (const key of ["completeness", "products", "completeness_list", "completenessList"]) {
    if (Array.isArray(data[key])) return asRows(data[key]);
  }
  if (Array.isArray(data)) return asRows(data);
  const src = data.raw && typeof data.raw === "object" ? { ...data, ...data.raw } : data;
  return Object.entries(src)
    .filter(([k, v]) => /percentage$/i.test(k) && typeof v === "number")
    .map(([k, v]) => ({ type: k.replace(/_?(local_)?percentage$/i, "").replace(/_/g, " ").trim() || k, pct: Number(v) }));
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const url = `${BACKEND_URL}/api/worker/cds-datatake/${encodeURIComponent(params.id)}`;
  const headers = { "X-Requested-With": "XMLHttpRequest", Referer: `${BACKEND_URL}/` };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000); // don't hang the UI forever
  try {
    const res = await fetch(url, { cache: "no-store", headers, signal: ctrl.signal });
    if (!res.ok) return NextResponse.json({ products: [], error: `HTTP ${res.status}` });
    const data = await res.json();
    return NextResponse.json({ products: extractProducts(data) });
  } catch (e: any) {
    const error = e?.name === "AbortError" ? "backend timed out" : e?.message || "fetch failed";
    return NextResponse.json({ products: [], error });
  } finally {
    clearTimeout(timer);
  }
}
