// Server-side data layer.
// These functions run ONLY on the server (Server Components / route handlers),
// so the browser never sees a JSON data API — it receives rendered HTML.
// Today they return mock data; later, swap the bodies for real calls to
// OpenSearch / JIRA / the Flask services. The component code above does not change.

export type Status = "nominal" | "degraded" | "critical" | "info" | "neutral";

// News = the DB "Instant Messages" (same fields prod serves from the DB on /index).
// status is the derived UI state prod shows as an icon (new / resolved / disaster).
export type NewsStatusKind = "new" | "resolved" | "disaster";
export interface NewsItem {
  id: number | string;
  title: string;
  text: string;
  messageType: string;      // "info" | "warning" | "success" | "danger" | ...
  status: NewsStatusKind;
  publicationDate: string;  // display date, e.g. "19-Jun-2026 at 09:40"
  link: string;
}
// prod mapping (apps/models/instant_messages.py): warning/info → new, success →
// resolved, danger → disaster. Accepts either a status or a messageType string.
export function newsStatus(v: unknown): NewsStatusKind {
  const k = String(v ?? "").toLowerCase();
  if (k === "resolved" || k === "success") return "resolved";
  if (k === "disaster" || k === "danger") return "disaster";
  return "new";
}

// Real-time events = the impacting anomalies from the last 24h (Elasticsearch),
// after prod's filtering (allowed satellites + completeness < 90%).
export interface RtEvent {
  cls: "ok" | "warn" | "crit" | "info";
  timeAgo: string; // e.g. "2 hour(s) ago"
  html: string;    // title incl. the "Read More" link (rendered as HTML)
}

export interface ModuleCard {
  idx: string;
  href: string;
  title: string;
  pill: { label: string; status: Status };
  metric: string;
  unit: string;
  desc: string;
  img: string;
}

export type IssueType = "acquisition" | "calibration" | "manoeuvre" | "production" | "satellite";
export type Completion = "ok" | "proc" | "warn" | "un" | "plan"; // Acquired/Processing/Partial/Unavailable/Planned
export interface EventDatatake { id: string; comp: Completion }
export interface CalEvent {
  day: number;
  type: IssueType;
  label: string;
  time?: string;         // e.g. "11:30:00 UTC"
  dateLabel?: string;    // e.g. "26 Jun 2026"
  satellites?: string;   // e.g. "S2B"
  datatakes?: EventDatatake[];
}

const wait = () => Promise.resolve(); // placeholder for real async I/O

// Base URL of the Flask backend. Runs on the SERVER only, so it can point at an
// internal-only address. Configure in frontend/.env.local (see .env.local.example).
// Use 127.0.0.1 (not "localhost"): Node's fetch tries IPv6 ::1 first, which a
// 127.0.0.1-only backend won't answer — causing a confusing "fetch failed".
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5005";

// Format a date like the current app does: "19-Jun-2026 at 09:40".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtNewsDate(v: unknown): string {
  if (!v) return "";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return `${p(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()} at ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
const pad = (n: number) => (n < 10 ? "0" : "") + n;
function fmtTimeUTC(d: Date): string {
  return isNaN(d.getTime()) ? "" : `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
function fmtDayUTC(d: Date, fallbackKey: string): string {
  if (isNaN(d.getTime())) return fallbackKey;
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Normalise any completeness/status string to our 5 states.
function normComp(v: unknown): Completion {
  const k = String(v ?? "").trim().toLowerCase();
  if (["ok", "acquired", "published", "complete", "completed"].includes(k)) return "ok";
  if (["proc", "processing"].includes(k)) return "proc";
  if (["warn", "partial", "delayed", "degraded"].includes(k)) return "warn";
  if (["un", "unavailable", "failed", "missing"].includes(k)) return "un";
  if (["plan", "planned", "scheduled"].includes(k)) return "plan";
  return "warn";
}
function fmtDtTimeUTC(v: unknown): string {
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return "";
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
function titleCase(s: string): string {
  return (s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
const COMP_PILL: Record<Completion, Status> = { ok: "nominal", proc: "info", warn: "degraded", un: "critical", plan: "neutral" };

const NEWS_HOME_PAGE_SIZE = 5; // prod shows the 5 most recent messages on the home page

// Result wrapper so the UI can tell a genuine backend FAILURE apart from an
// empty-but-successful response. No mock fallback — a failure surfaces as error:true.
export interface LoadResult<T> {
  items: T[];
  error: boolean;
}

// News from the DB (prod: InstantMessages, newest first, limited to the home page size).
// On failure returns { items: [], error: true } — the UI shows an error, not fake data.
export async function getNews(): Promise<LoadResult<NewsItem>> {
  // /api/instant-messages returns the DB Instant Messages newest-first (see apps/routes/rest).
  const url = `${BACKEND_URL}/api/instant-messages?limit=${NEWS_HOME_PAGE_SIZE}`;
  console.log("[data] getNews → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store" }); // no-store = fetch fresh every load
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    // The API already sorts newest-first and applies the limit; stay defensive on shape.
    const list: any[] = Array.isArray(raw) ? raw : raw.messages ?? raw.items ?? raw.news ?? raw.data ?? [];
    const items: NewsItem[] = list.slice(0, NEWS_HOME_PAGE_SIZE).map((n: any, i: number) => ({
      id: n.id ?? i,
      title: n.title ?? "Untitled",
      text: n.text ?? n.body ?? "",
      messageType: n.messageType ?? n.category ?? "info",
      status: newsStatus(n.status ?? n.messageType),
      publicationDate: fmtNewsDate(n.publicationDate ?? n.occurrenceDate),
      link: n.link ?? "",
    }));
    console.log(`[data] getNews → OK, ${items.length} messages from backend`);
    return { items, error: false }; // empty is legitimate (prod: "There are no news…")
  } catch (err: any) {
    console.warn("[data] getNews → backend unavailable. Reason:", err?.message);
    return { items: [], error: true };
  }
}

// ── Real-time events: port of prod's /index anomaly banner logic ───────────
// Active satellites accepted by the home banner (from utils/satellite_registry.py).
const ALLOWED_SATELLITES = new Set(["S1A", "S1C", "S1D", "S2A", "S2B", "S2C", "S3A", "S3B", "S5P"]);
const SATELLITE_DISPLAY_NAMES: Record<string, string> = {
  S1A: "Copernicus Sentinel-1A", S1C: "Copernicus Sentinel-1C", S1D: "Copernicus Sentinel-1D",
  S2A: "Copernicus Sentinel-2A", S2B: "Copernicus Sentinel-2B", S2C: "Copernicus Sentinel-2C",
  S3A: "Copernicus Sentinel-3A", S3B: "Copernicus Sentinel-3B", S5P: "Copernicus Sentinel-5P",
};
// Category → banner wording + severity colour (Platform reads as "Satellite", like prod).
const CAT_LABEL: Record<string, string> = { Platform: "Satellite", Acquisition: "Acquisition", Production: "Production", Manoeuvre: "Manoeuvre", Calibration: "Calibration" };
const CAT_CLS: Record<string, RtEvent["cls"]> = { Platform: "crit", Acquisition: "warn", Production: "warn", Manoeuvre: "info", Calibration: "info" };

// "Copernicus Sentinel-2A" → "S2A" (prod's normalisation).
function normSat(raw: string): string {
  return raw.replace(/Copernicus/g, "").replace(/Sentinel-/g, "S").replace(/Sentinel /g, "S").replace(/-/g, "").replace(/ /g, "").toUpperCase();
}
// Parse prod's anomaly "start": "dd/MM/yyyy HH:mm:ss" (UTC) → epoch ms, or null.
function parseAnomalyStart(s: unknown): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
}
// An anomaly is "impacting" if any datatake's completeness averages < 90% (prod threshold).
// datatakes_completeness may arrive as an array or a Python-repr string; a parse failure
// is treated as impacting (prod does the same in its except branch).
function anomalyIsImpacting(raw: unknown): boolean {
  let list: any[];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try { list = JSON.parse(raw.replace(/'/g, '"')); } catch { return true; }
  } else return true;
  for (const dt of list) {
    if (!dt || typeof dt !== "object") continue;
    const vals = Object.values(dt).filter((v): v is number => typeof v === "number");
    const avg = vals.length >= 3 ? (vals[0] + vals[1] + vals[2]) / 3 : vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    if (avg < 90) return true;
  }
  return false;
}

// Real-time events, ported from prod's /index route: read the last-24h anomalies
// (Elasticsearch), keep only allowed satellites with impacting datatakes, and build
// up to 2 banners. On failure returns { items: [], error: true } — no fake data.
export async function getRealtimeEvents(): Promise<LoadResult<RtEvent>> {
  // Internal SSR feed (@internal_only): reachable server-to-server with an AJAX
  // header + same-host Referer — no browser login needed, unlike the protected
  // /api/events/anomalies/last-… endpoint (which 403s from the SSR layer).
  const url = `${BACKEND_URL}/api/ssr/anomalies/last-24h`;
  const headers = { "X-Requested-With": "XMLHttpRequest", Referer: `${BACKEND_URL}/` };
  console.log("[data] getRealtimeEvents → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const list: any[] = Array.isArray(raw) ? raw : raw.anomalies ?? raw.data ?? [];
    const now = Date.now();
    const out: RtEvent[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const startMs = parseAnomalyStart(item.start);
      if (startMs == null) continue;
      const totalSeconds = (now - startMs) / 1000;
      if (totalSeconds < 0 || totalSeconds > 86400) continue; // last 24h only

      const rawSat = item.impactedSatellite;
      if (!rawSat) continue;
      const sat = normSat(String(rawSat));
      if (!ALLOWED_SATELLITES.has(sat)) continue;

      if (!anomalyIsImpacting(item.datatakes_completeness ?? "[]")) continue;

      const hours = totalSeconds / 3600;
      const timeAgo = hours >= 1 ? `${Math.round(hours)} hour(s) ago` : `${Math.floor(totalSeconds / 60)} minute(s) ago`;
      const category = item.category ?? "Unknown";
      const display = SATELLITE_DISPLAY_NAMES[sat] ?? String(rawSat);
      const label = CAT_LABEL[category] ?? category;
      const pubDate = String(item.publicationDate ?? "").slice(0, 10);
      const html = `${label} issue, affecting ${display} data. <a href="/v1/events?showDayEvents=${pubDate}">Read More</a>`;
      out.push({ cls: CAT_CLS[category] ?? "warn", timeAgo, html });
      if (out.length >= 2) break;
    }
    console.log(`[data] getRealtimeEvents → OK, ${out.length} impacting anomalies from backend`);
    return { items: out, error: false }; // empty is legitimate → UI shows "Nominal operations"
  } catch (err: any) {
    console.warn("[data] getRealtimeEvents → backend unavailable. Reason:", err?.message);
    return { items: [], error: true };
  }
}

export async function getModules(): Promise<ModuleCard[]> {
  await wait();
  return [
    { idx: "", href: "/acquisitions", title: "Acquisitions Status", pill: { label: "Nominal", status: "nominal" }, metric: "98.6%", unit: "completeness · last 24h", desc: "Sentinel acquisition plans on an interactive 3D globe — drill into the products of each datatake.", img: "/assets/img/acquisitions_status.webp" },
    { idx: "", href: "/events", title: "Events", pill: { label: "2 active", status: "degraded" }, metric: "7", unit: "open events · 2 critical", desc: "Mission events and anomalies on a calendar, correlated to the datatakes they affect.", img: "/assets/img/events.webp" },
    { idx: "", href: "/availability", title: "Data Availability", pill: { label: "Nominal", status: "nominal" }, metric: "99.4%", unit: "published on time", desc: "Real-time datatake completeness across the constellation, from L0 through L2.", img: "/assets/img/data_availability.webp" },
    { idx: "", href: "/processors", title: "Processors", pill: { label: "Up to date", status: "nominal" }, metric: "23", unit: "baselines live", desc: "Processor releases — baseline versions, rollout status and impacted products.", img: "/assets/img/processors.webp" },
  ];
}

export interface DonutSeg { label: string; val: number; color: string }
export type SegStatus = "ok" | "proc" | "warn" | "un" | "plan";
export interface Datatake {
  id: string; sat: string; time: string;
  segs: { label: string; st: SegStatus }[];
  pct: string;
  status: { label: string; cls: Status };
}

const MOCK_AVAIL: { acq: DonutSeg[]; pub: DonutSeg[]; datatakes: Datatake[] } = {
  acq: [
    { label: "Acquired", val: 88.4, color: "#3DD68C" },
    { label: "Partial", val: 5.1, color: "#F5B544" },
    { label: "Processing", val: 2.7, color: "#36D0E0" },
    { label: "Planned", val: 2.8, color: "#2E7DF6" },
    { label: "Unavailable", val: 1.0, color: "#FF5C6C" },
  ],
  pub: [
    { label: "Published", val: 90.3, color: "#3DD68C" },
    { label: "Processing", val: 5.2, color: "#36D0E0" },
    { label: "Delayed", val: 2.6, color: "#F5B544" },
    { label: "Unavailable", val: 1.9, color: "#FF5C6C" },
  ],
  datatakes: [
    { id: "S1A_44218_001", sat: "Sentinel-1A", time: "29 Jun 09:12 UTC", segs: [{ label: "L0", st: "ok" }, { label: "SLC", st: "ok" }, { label: "GRD", st: "ok" }, { label: "OCN", st: "proc" }], pct: "96%", status: { label: "Acquired", cls: "nominal" } },
    { id: "S3A_22887_044", sat: "Sentinel-3A", time: "29 Jun 07:55 UTC", segs: [{ label: "L0", st: "ok" }, { label: "OL_1", st: "warn" }, { label: "OL_2", st: "un" }], pct: "61%", status: { label: "Downlink loss", cls: "critical" } },
  ],
};

// Data Availability. Uses the real, public /data-availability?ajax=1 route, which returns
// { datatakes: [ {id, platform, observation_time_start, acquisition_status, publication_status,
//   raw.completeness_status{ACQ,PUB}} ], has_more }. Donut summary stays mock for now.
export async function getAvailability(): Promise<{ acq: DonutSeg[]; pub: DonutSeg[]; datatakes: Datatake[] }> {
  const url = `${BACKEND_URL}/data-availability?ajax=1&period=week&limit=20`;
  console.log("[data] getAvailability → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "X-Requested-With": "XMLHttpRequest" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const list: any[] = raw.datatakes ?? [];
    const datatakes: Datatake[] = list.slice(0, 12).map((d: any) => {
      const cs = d.raw?.completeness_status ?? {};
      const acq = d.acquisition_status ?? cs?.ACQ?.status ?? "";
      const pub = d.publication_status ?? cs?.PUB?.status ?? "";
      const cAcq = normComp(acq), cPub = normComp(pub);
      const pctNum = cs?.ACQ?.percentage ?? cs?.percentage;
      return {
        id: String(d.id ?? d.datatake_id ?? "—"),
        sat: d.platform ?? d.satellite_unit ?? "—",
        time: fmtDtTimeUTC(d.observation_time_start ?? d.start_time),
        segs: [{ label: "ACQ", st: cAcq }, { label: "PUB", st: cPub }],
        pct: typeof pctNum === "number" ? `${Math.round(pctNum)}%` : (cAcq === "ok" ? "100%" : cAcq === "un" ? "0%" : "—"),
        status: { label: titleCase(acq) || "—", cls: COMP_PILL[cAcq] },
      };
    });
    if (!datatakes.length) throw new Error("empty or unrecognised response shape");
    console.log(`[data] getAvailability → OK, ${datatakes.length} datatakes from backend`);
    return { acq: MOCK_AVAIL.acq, pub: MOCK_AVAIL.pub, datatakes };
  } catch (err: any) {
    console.warn("[data] getAvailability → backend unavailable, using mock. Reason:", err?.message);
    return MOCK_AVAIL;
  }
}

export interface Station { name: string; lat: number; lon: number }
export interface AcqProd { lvl: string; sub: string; st: "Published" | "Processing" | "Partial" | "Failed" }
export interface AcqDatatake {
  id: string; sat: string; station: string; lat: number; lon: number;
  comp: number; status: string; cls: "ok" | "warn" | "crit"; prods: AcqProd[];
  poly?: [number, number][]; // footprint polygon [lon,lat] pairs (from the plan KML)
  details?: { label: string; value: string }[]; // KML ExtendedData in order (for the panel table)
  // Detail fields shown in the datatake panel (prod parity); optional/defensive.
  mode?: string;
  swath?: string;
  polarisation?: string;
  obsStart?: string;
  obsStop?: string;
  duration?: string | number;
  orbitAbsolute?: string | number;
  orbitRelative?: string | number;
  scenes?: string | number;
  acqStatus?: string;
  pubStatus?: string;
}

const MOCK_ACQ: { stations: Station[]; datatakes: AcqDatatake[] } = {
  stations: [
    { name: "Svalbard", lat: 78, lon: 15 },
    { name: "Matera", lat: 40, lon: 16 },
    { name: "Maspalomas", lat: 27, lon: -15 },
    { name: "Inuvik", lat: 68, lon: -133 },
  ],
  datatakes: [
    { id: "S1A_44218_001", sat: "Sentinel-1A", station: "Svalbard", lat: 74, lon: 18, comp: 100, status: "Acquired", cls: "ok", prods: [{ lvl: "L0", sub: "RAW", st: "Published" }, { lvl: "L1", sub: "SLC", st: "Published" }, { lvl: "L1", sub: "GRD", st: "Published" }, { lvl: "L2", sub: "OCN", st: "Processing" }] },
    { id: "S1A_44219_005", sat: "Sentinel-1A", station: "Matera", lat: 41, lon: 16, comp: 61, status: "Downlink loss", cls: "crit", prods: [{ lvl: "L0", sub: "RAW", st: "Partial" }, { lvl: "L1", sub: "SLC", st: "Failed" }] },
    { id: "S2A_31002_012", sat: "Sentinel-2A", station: "Maspalomas", lat: 22, lon: -22, comp: 99, status: "Acquired", cls: "ok", prods: [{ lvl: "L0", sub: "—", st: "Published" }, { lvl: "L1", sub: "C", st: "Published" }, { lvl: "L2", sub: "A", st: "Published" }] },
    { id: "S3A_22887_044", sat: "Sentinel-3A", station: "Svalbard", lat: 80, lon: 6, comp: 88, status: "Partial", cls: "warn", prods: [{ lvl: "L0", sub: "—", st: "Published" }, { lvl: "L1", sub: "EFR", st: "Published" }, { lvl: "L2", sub: "LFR", st: "Processing" }] },
    { id: "S2B_31010_021", sat: "Sentinel-2B", station: "Inuvik", lat: 62, lon: -122, comp: 100, status: "Acquired", cls: "ok", prods: [{ lvl: "L0", sub: "—", st: "Published" }, { lvl: "L1", sub: "C", st: "Published" }, { lvl: "L2", sub: "A", st: "Published" }] },
    { id: "S5P_19920_007", sat: "Sentinel-5P", station: "Svalbard", lat: 55, lon: 62, comp: 100, status: "Acquired", cls: "ok", prods: [{ lvl: "L1", sub: "B", st: "Published" }, { lvl: "L2", sub: "NO2", st: "Published" }, { lvl: "L2", sub: "O3", st: "Published" }] },
  ],
};

const ACQ_CLS = new Set(["ok", "warn", "crit"]);
function toAcqCls(v: unknown): "ok" | "warn" | "crit" {
  const s = String(v ?? "").toLowerCase();
  return (ACQ_CLS.has(s) ? s : "ok") as "ok" | "warn" | "crit";
}

// Acquisitions (globe). This page is the most access-restricted on the real backend:
//   • /api/acquisitions/acquisition-datatakes/<mission>/<sat>/<day>  → @internal_only
//       (reachable server-to-server with an AJAX header + same-host Referer)
//   • /api/acquisitions/stations  and  /api/acquisitions/satellite/orbits  → @login_required
// So we fetch datatakes with the internal_only header trick, and try stations separately —
// if stations is auth-gated we keep the mock stations. Everything falls back to mock on failure.
export async function getAcquisitions(
  mission = "S1",
  sat = "S1A",
  day = "2026-06-29",
): Promise<{ stations: Station[]; datatakes: AcqDatatake[] }> {
  // internal_only accepts an AJAX request whose Referer host matches the server host.
  const headers = { "X-Requested-With": "XMLHttpRequest", Referer: `${BACKEND_URL}/` };
  const dtUrl = `${BACKEND_URL}/api/acquisitions/acquisition-datatakes/${mission}/${sat}/${day}`;
  // Stations are login-protected; use the internal SSR feed (server-to-server) instead.
  const stUrl = `${BACKEND_URL}/api/ssr/acquisitions/stations`;
  console.log("[data] getAcquisitions → fetching from backend:", dtUrl);
  try {
    const res = await fetch(dtUrl, { cache: "no-store", headers });
    if (!res.ok) throw new Error(`datatakes HTTP ${res.status}`);
    const raw = await res.json();
    const list: any[] = Array.isArray(raw) ? raw : raw.datatakes ?? raw.data ?? [];
    const datatakes: AcqDatatake[] = list.map((d: any) => ({
      id: String(d.id ?? d.datatake_id ?? "—"),
      sat: d.sat ?? d.satellite ?? d.satellite_unit ?? "—",
      station: d.station ?? d.acquisition_station ?? "—",
      lat: Number(d.lat ?? d.latitude ?? 0),
      lon: Number(d.lon ?? d.longitude ?? 0),
      comp: Number(d.comp ?? d.completeness ?? 0),
      status: d.status ?? "—",
      cls: toAcqCls(d.cls ?? d.class),
      prods: Array.isArray(d.prods)
        ? d.prods.map((p: any) => ({ lvl: p.lvl ?? p.level ?? "", sub: p.sub ?? "", st: p.st ?? p.status ?? "Published" }))
        : [],
      // detail fields (defensive across possible backend field names)
      mode: d.mode ?? d.observation_mode ?? d.timeliness,
      obsStart: d.obsStart ?? d.observation_time_start ?? d.start_time ?? d.start,
      obsStop: d.obsStop ?? d.observation_time_stop ?? d.stop_time ?? d.stop,
      duration: d.duration ?? d.observation_duration,
      orbitAbsolute: d.orbitAbsolute ?? d.absolute_orbit ?? d.orbit_absolute,
      orbitRelative: d.orbitRelative ?? d.relative_orbit ?? d.orbit_relative,
      scenes: d.scenes ?? d.number_of_scenes ?? d.num_scenes,
      acqStatus: d.acqStatus ?? d.acquisition_status,
      pubStatus: d.pubStatus ?? d.publication_status,
    }));
    // NOTE: an empty list is a VALID response (that day/satellite simply has no
    // datatakes) — do NOT fall back to mock here, or every date would show the same
    // static mock datatakes. Mock is only for a genuine fetch failure (see catch).

    // Stations are login-protected on the real backend; keep mock if the call fails.
    let stations = MOCK_ACQ.stations;
    try {
      const sRes = await fetch(stUrl, { cache: "no-store", headers });
      if (sRes.ok) {
        const sRaw = await sRes.json();
        const sList: any[] = Array.isArray(sRaw) ? sRaw : sRaw.stations ?? [];
        const mapped = sList.map((s: any) => ({
          name: s.name ?? s.station ?? "?",
          lat: Number(s.lat ?? s.latitude ?? 0),
          lon: Number(s.lon ?? s.longitude ?? 0),
        }));
        if (mapped.length) stations = mapped;
      } else {
        console.log(`[data] getAcquisitions → stations HTTP ${sRes.status} (login-protected), using mock stations`);
      }
    } catch {
      console.log("[data] getAcquisitions → stations unavailable, using mock stations");
    }

    console.log(`[data] getAcquisitions → OK, ${datatakes.length} datatakes from backend`);
    return { stations, datatakes };
  } catch (err: any) {
    console.warn("[data] getAcquisitions → backend unavailable, using mock. Reason:", err?.message);
    return MOCK_ACQ;
  }
}

// Satellite orbits as CZML (Cesium-native). The backend builds this from TLEs via
// satellite_czml; @internal_only, so fetched server-to-server. Returns the parsed
// CZML array (document + one packet per satellite), or null if unavailable.
export async function getSatelliteOrbitsCzml(): Promise<unknown[] | null> {
  const url = `${BACKEND_URL}/api/ssr/acquisitions/orbits`;
  const headers = { "X-Requested-With": "XMLHttpRequest", Referer: `${BACKEND_URL}/` };
  console.log("[data] getSatelliteOrbitsCzml → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const czml = JSON.parse(text); // body may be a JSON string regardless of content-type
    if (!Array.isArray(czml) || !czml.length) throw new Error("empty or invalid CZML");
    // Normalise each satellite packet:
    //  • drop the billboard (points at Flask /static images that 404 under Next →
    //    Cesium spams "Error loading image for billboard") and use a coloured point;
    //  • force the orbit path to show a clean ±100-min arc so EVERY satellite's
    //    orbit renders regardless of the CZML's own lead/trail settings.
    let satCount = 0;
    for (const p of czml as any[]) {
      if (!p || typeof p !== "object") continue;
      const rgba = p.label?.fillColor?.rgba ?? [54, 208, 224, 255];
      if (p.billboard) {
        delete p.billboard;
        if (!p.point) p.point = { pixelSize: 10, color: { rgba }, outlineColor: { rgba: [255, 255, 255, 255] }, outlineWidth: 1 };
      }
      if (p.path && typeof p.path === "object") {
        satCount++;
        p.path.show = true;
        p.path.leadTime = 6000;
        p.path.trailTime = 6000;
        if (p.path.resolution == null) p.path.resolution = 120;
      }
      // Show every satellite's label, even when it's behind the globe (otherwise only
      // the front-facing one — Sentinel-1A here — is visible).
      if (p.label && typeof p.label === "object") {
        p.label.show = true;
        p.label.disableDepthTestDistance = 100000000;
      }
    }
    console.log(`[data] getSatelliteOrbitsCzml → OK, ${czml.length} packets (${satCount} with orbit paths)`);
    return czml;
  } catch (err: any) {
    console.warn("[data] getSatelliteOrbitsCzml → backend unavailable. Reason:", err?.message);
    return null;
  }
}

// Parse the acquisition-plan KML into the datatake list — the SAME source prod uses
// for the dropdown, details panel AND the footprint polygons (each <Placemark> carries
// <name>, <styleUrl> status, <ExtendedData> fields, and the <Polygon>). Cesium renders
// the polygons from the KML directly; this gives the list/details that match them.
export function parseAcquisitionPlanKml(kml: string): AcqDatatake[] {
  const out: AcqDatatake[] = [];
  const placemarks = kml.match(/<Placemark\b[\s\S]*?<\/Placemark>/g) ?? [];
  for (const pm of placemarks) {
    const name = (/<name>([\s\S]*?)<\/name>/.exec(pm)?.[1] ?? "").trim();
    const style = (/<styleUrl>#?([\s\S]*?)<\/styleUrl>/.exec(pm)?.[1] ?? "").trim();
    const data: Record<string, string> = {};
    const details: { label: string; value: string }[] = [];
    const dRe = /<Data name="([^"]+)">\s*<value>([\s\S]*?)<\/value>\s*<\/Data>/g;
    let d: RegExpExecArray | null;
    while ((d = dRe.exec(pm))) {
      const k = d[1].trim();
      const v = d[2].trim();
      data[k] = v;
      details.push({ label: k, value: v });
    }

    // id: S2-style uses "ID", S1-style uses "DatatakeId" (name is a timestamp for S1).
    const id = data["ID"] || data["DatatakeId"] || data["Datatake"] || name;
    if (!id) continue;
    const acqStatus = data["Acquisition Status"] || "";
    const up = `${acqStatus} ${style}`.toUpperCase();
    const cls: AcqDatatake["cls"] = up.includes("FAIL") || up.includes("LOSS") ? "crit" : up.includes("PARTIAL") ? "warn" : "ok";

    // Footprint polygon (first <coordinates> = "lon,lat,alt lon,lat,alt …") + centroid.
    const coordStr = /<coordinates>([\s\S]*?)<\/coordinates>/.exec(pm)?.[1] ?? "";
    const poly = coordStr
      .trim()
      .split(/\s+/)
      .map((t) => t.split(",").map(Number))
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map((p) => [p[0], p[1]] as [number, number]);
    let lat = 0;
    let lon = 0;
    if (poly.length) {
      for (const [x, y] of poly) { lon += x; lat += y; }
      lon /= poly.length;
      lat /= poly.length;
    }

    out.push({
      id,
      sat: data["SatelliteId"] || id.split(/[-_]/)[0] || "",
      station: "",
      lat,
      lon,
      poly: poly.length >= 3 ? poly : undefined,
      comp: Number(/\(([\d.]+)\s*%\)/.exec(acqStatus)?.[1] ?? 0),
      status: style || acqStatus || "—",
      cls,
      prods: [],
      details,
      mode: data["Mode"],
      swath: data["Swath"],
      polarisation: data["Polarisation"] || data["Polarization"],
      obsStart: data["ObservationTimeStart"],
      obsStop: data["ObservationTimeStop"],
      duration: data["ObservationDuration"],
      orbitAbsolute: data["OrbitAbsolute"],
      orbitRelative: data["OrbitRelative"],
      scenes: data["Scenes"],
      acqStatus: data["Acquisition Status"],
      pubStatus: data["Publication Status"],
    });
  }
  return out;
}

// Acquisition-plan day coverage: { mission: { satellite: ["YYYY-MM-DD", ...] } }.
// Drives the day dropdown so we only request days that actually have a plan (→ KML 200
// → footprints render). @internal_only, fetched server-side. Empty object on failure.
export type PlanCoverage = Record<string, Record<string, string[]>>;
export async function getAcquisitionPlanDays(): Promise<PlanCoverage> {
  const url = `${BACKEND_URL}/api/ssr/acquisitions/plan-days`;
  const headers = { "X-Requested-With": "XMLHttpRequest", Referer: `${BACKEND_URL}/` };
  console.log("[data] getAcquisitionPlanDays → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return raw && typeof raw === "object" ? (raw as PlanCoverage) : {};
  } catch (err: any) {
    console.warn("[data] getAcquisitionPlanDays → unavailable. Reason:", err?.message);
    return {};
  }
}

// Acquisition-plan KML for the globe. The backend endpoint is @internal_only and
// returns raw KML, so we fetch it SERVER-SIDE (AJAX header + same-host Referer) and
// hand the text to the client globe — the browser never calls a data API.
// Returns the KML string, or null if unavailable (globe then renders without a plan).
export async function getAcquisitionPlanKml(mission: string, sat: string, day: string): Promise<string | null> {
  const url = `${BACKEND_URL}/api/acquisitions/acquisition-plans/${mission}/${sat}/${day}`;
  const headers = { "X-Requested-With": "XMLHttpRequest", Referer: `${BACKEND_URL}/` };
  console.log("[data] getAcquisitionPlanKml → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text || !text.includes("<kml")) throw new Error("empty or non-KML response");
    console.log(`[data] getAcquisitionPlanKml → OK, ${text.length} bytes of KML`);
    return text;
  } catch (err: any) {
    console.warn("[data] getAcquisitionPlanKml → backend unavailable. Reason:", err?.message);
    return null;
  }
}

export type RelKind = "old" | "cur" | "roll" | "held";
export interface Release {
  proc: string; baseline: string; prev: string; from: string;
  status: string; pill: Status;
  /** Satellite units the release applies to, e.g. ["S1A","S1C","S1D"]. */
  sats: string[];
  kind: RelKind; def?: boolean;
  // DEVOCS-219: positions are computed client-side from `ms` against the current viewport, so the
  // timeline can zoom. `iso`/`isoEnd` are the mono telemetry readouts; `endMs` is null when the
  // baseline is still open-ended.
  ms: number; endMs: number | null; iso: string; isoEnd: string; notes?: string;
}
export interface ProcRow { mission: MissionId; ipf: string; label: string; sub: string; releases: Release[] }
/** One horizontal lane group in the timeline: a mission and the IPF sub-rows beneath it. */
export interface ProcMission { id: MissionId; name: string; rows: ProcRow[] }
/** The timeline's shared horizontal scale. `years` are the axis ticks. */
export interface ProcWindow { start: number; end: number; years: number[] }
export type MissionId = "1" | "2" | "3" | "5P";

const MISSION_NAMES: Record<MissionId, string> = {
  "1": "Sentinel-1", "2": "Sentinel-2", "3": "Sentinel-3", "5P": "Sentinel-5P",
};
const MISSION_ORDER: MissionId[] = ["1", "2", "3", "5P"];

// The canonical display roster, in the operations viewer's processing-chain order (NOT alphabetical).
// Lifted from apps/static/assets/js/processors-releases/processors-viewer.js (`IPFsMap`) so the two
// viewers agree on which processors exist and in what order they read.
//
// This drives the lanes, not the releases feed: a processor on this list with no releases yet still
// gets a lane (S2_EUP, S3_SR2, S3_SY2_VGP today), and a key in the feed that is NOT on the list is
// not shown (S1_AMALFI and S1_ERRMAT — orbit/error-matrix auxiliaries the legacy viewer also omits).
const IPF_ROSTER: Record<MissionId, string[]> = {
  "1": ["S1_L0", "S1_L1L2", "S1_SETAP"],
  "2": ["S2_L0", "S2_L1", "S2_L2", "S2_EUP"],
  "3": [
    "S3_PUG", "S3_L0", "S3_OL1", "S3_OL1_RAC", "S3_OL1_SPC", "S3_OL2",
    "S3_SL1", "S3_SL2", "S3_SL2_LST", "S3_SL2_FRP",
    "S3_SR1", "S3_SR2", "S3_SM2_HY", "S3_SM2_LI", "S3_SM2_SI", "S3_MW1",
    "S3_SY2", "S3_SY2_AOD", "S3_SY2_VGS", "S3_SY2_VGP",
  ],
  "5P": [
    "S5P_L1B",
    "S5P_L2O3_NRT", "S5P_L2O3_OFFL", "S5P_L2O3_TCL", "S5P_L2O3_PR",
    "S5P_L2_NO2", "S5P_L2_SO2", "S5P_L2_CO", "S5P_L2_CH4", "S5P_L2_HCHO",
    "S5P_L2_CLOUD", "S5P_L2AER_AI", "S5P_L2AER_LH", "S5P_L2SUOMI_CLOUD",
  ],
};

/** Group flat IPF rows into mission lanes, dropping empty missions and keeping S1→S5P order. */
export function groupByMission(rows: ProcRow[]): ProcMission[] {
  return MISSION_ORDER.map((id) => ({
    id,
    name: MISSION_NAMES[id],
    rows: rows.filter((r) => r.mission === id),
  })).filter((g) => g.rows.length > 0);
}

/** One release as it arrives from the backend, before layout. */
interface RawRelease { baseline: string; start: string; end: string; notes: string; sats: string[] }

// `satellite_units` arrives three ways: a real array (["S1A","S1C"]), a bare string ("S1A"), or a
// comma-joined string ("S1A, S1C"). Flatten all three to a deduped list.
function normSats(v: unknown): string[] {
  const parts = (Array.isArray(v) ? v : [v]).flatMap((x) => String(x ?? "").split(","));
  return [...new Set(parts.map((s) => s.trim()).filter(Boolean))];
}

// Offline fixture in the upstream response's own shape — dd/MM/yyyy dates, "IPF:version" strings,
// HTML notes, and `satellite_units` per release. It goes through parseReleases() exactly like the
// live payload, so there is a single code path and nothing about it is inferred or mapped.
// satellite_units deliberately covers all three shapes the real feed uses: array, bare string and
// comma-joined string.
const MOCK_RELEASES: any[] = [
  { mission: "S1", satellite_units: ["S1A"], target_ipfs: ["S1_L0:001.00"], validity_start_date: "18/01/2023", validity_end_date: "09/04/2024", release_notes: "<p>First Level-0 baseline of the routine phase.</p>" },
  { mission: "S1", satellite_units: ["S1A", "S1C"], target_ipfs: ["S1_L0:001.02"], validity_start_date: "09/04/2024", validity_end_date: "12/08/2025", release_notes: "<p>Annotation fixes for the extended orbit set.</p>" },
  { mission: "S1", satellite_units: ["S1A", "S1C", "S1D"], target_ipfs: ["S1_L0:001.03"], validity_start_date: "12/08/2025", validity_end_date: "", release_notes: "<p>Improved downlink packet handling.</p>" },
  { mission: "S1", satellite_units: "S1A", target_ipfs: ["S1_L1L2:003.52"], validity_start_date: "14/03/2023", validity_end_date: "11/06/2024", release_notes: "<p>Radiometric calibration update for SLC and GRD.</p>" },
  { mission: "S1", satellite_units: "S1A, S1C", target_ipfs: ["S1_L1L2:003.61"], validity_start_date: "11/06/2024", validity_end_date: "16/06/2026", release_notes: "<p>Revised OCN wind retrieval; DEM refresh.</p>" },
  { mission: "S1", satellite_units: ["S1A", "S1C", "S1D"], target_ipfs: ["S1_L1L2:003.71"], validity_start_date: "16/06/2026", validity_end_date: "", release_notes: "<p>Absolute geolocation improvement across SLC, GRD and OCN.</p>" },
  { mission: "S1", satellite_units: ["S1A"], target_ipfs: ["S1_SETAP:001.04"], validity_start_date: "05/09/2023", validity_end_date: "18/02/2025", release_notes: "" },
  { mission: "S1", satellite_units: ["S1A", "S1C"], target_ipfs: ["S1_SETAP:001.06"], validity_start_date: "18/02/2025", validity_end_date: "", release_notes: "<p>Auxiliary set-up parameter refresh.</p>" },
  // One release, two target IPFs — the fan-out the real feed does for paired S2 packages.
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L0:06.05", "S2_L1:06.05"], validity_start_date: "04/02/2026", validity_end_date: "", release_notes: "<p>TLM marker in JP2K; antemeridian nodata fix.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L1:05.09"], validity_start_date: "24/01/2023", validity_end_date: "07/05/2024", release_notes: "<p>Geometric refinement using the global reference image.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L1:05.11"], validity_start_date: "11/03/2025", validity_end_date: "04/02/2026", release_notes: "<p>Cloud mask and radiometric offset update.</p>" },
  { mission: "S2", satellite_units: ["S2A", "S2B"], target_ipfs: ["S2_L2:05.09"], validity_start_date: "07/02/2023", validity_end_date: "11/03/2025", release_notes: "" },
  { mission: "S2", satellite_units: ["S2A", "S2B", "S2C"], target_ipfs: ["S2_L2:05.11"], validity_start_date: "11/03/2025", validity_end_date: "", release_notes: "<p>Sen2Cor atmospheric correction update.</p>" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL1:OL_06.10"], validity_start_date: "16/05/2023", validity_end_date: "24/09/2024", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_OL1:OL_07.01"], validity_start_date: "24/09/2024", validity_end_date: "", release_notes: "<p>OLCI radiometric characterisation update.</p>" },
  { mission: "S3", satellite_units: ["S3A"], target_ipfs: ["S3_SL1:SL_06.08"], validity_start_date: "11/07/2023", validity_end_date: "04/11/2025", release_notes: "" },
  { mission: "S3", satellite_units: ["S3A", "S3B"], target_ipfs: ["S3_SL1:SL_07.00"], validity_start_date: "04/11/2025", validity_end_date: "", release_notes: "<p>SLSTR geolocation and cloud flag improvements.</p>" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_NO2:02.04"], validity_start_date: "14/11/2023", validity_end_date: "25/02/2025", release_notes: "" },
  { mission: "S5P", satellite_units: ["S5P"], target_ipfs: ["S5P_L2_NO2:02.06"], validity_start_date: "25/02/2025", validity_end_date: "", release_notes: "<p>Tropospheric NO2 air-mass factor revision.</p>" },
];

// The horizontal scale spans whole years — first release year → next January — so the axis ticks
// land on year boundaries and the "now" marker always falls inside the last segment.
function procWindow(stamps: number[]): ProcWindow {
  const now = Date.now();
  const startYear = new Date(stamps.length ? Math.min(...stamps) : now).getUTCFullYear();
  const endYear = new Date(now).getUTCFullYear() + 1;
  const years: number[] = [];
  for (let y = startYear; y < endYear; y++) years.push(y);
  return { start: Date.UTC(startYear, 0, 1), end: Date.UTC(endYear, 0, 1), years };
}

// Turn grouped IPF releases into lanes. Positions are NOT precomputed — the client places dots
// against whatever slice of time is currently zoomed to — so this only normalises and orders.
function layoutProcessors(byIpf: Map<string, RawRelease[]>): { rows: ProcRow[]; win: ProcWindow } {
  const now = Date.now();
  const ms = (v: string) => new Date(v).getTime();
  const stamps: number[] = [];
  for (const rels of byIpf.values()) for (const r of rels) if (!isNaN(ms(r.start))) stamps.push(ms(r.start));
  const win = procWindow(stamps);

  // Walk the roster, not the feed, so lane order is the canonical processing-chain order and
  // processors awaiting their first release still get a (empty) lane.
  const rows: ProcRow[] = [];
  for (const mission of MISSION_ORDER) {
    for (const ipf of IPF_ROSTER[mission]) {
      const sorted = (byIpf.get(ipf) ?? [])
        .filter((r) => !isNaN(ms(r.start)))
        .sort((a, b) => ms(a.start) - ms(b.start));
      const label = ipfLabel(ipf);
      const releases: Release[] = sorted.map((rel, i) => {
        const endMs = ms(rel.end);
        const hasEnd = !isNaN(endMs);
        // Newest release wins "in production"; anything older is superseded regardless of its
        // recorded end date, since a later baseline is what is actually running.
        const isCur = i === sorted.length - 1 && (!hasEnd || endMs > now);
        return {
          proc: `S${mission} ${label}`, baseline: rel.baseline, prev: sorted[i - 1]?.baseline ?? "—",
          from: fmtMonthYear(rel.start), iso: isoUtc(rel.start),
          endMs: hasEnd ? endMs : null, isoEnd: hasEnd ? isoUtc(rel.end) : "open",
          ms: ms(rel.start), notes: rel.notes || undefined, sats: rel.sats,
          status: isCur ? "In production" : "Superseded",
          pill: isCur ? "nominal" : "neutral",
          kind: isCur ? "cur" : "old",
        };
      });
      rows.push({ mission, ipf, label, sub: IPF_DESC[ipf] ?? "", releases });
    }
  }
  // Open on the current S1 L1/L2 baseline — the page's headline processor.
  const lead = rows.find((r) => r.ipf === "S1_L1L2") ?? rows.find((r) => r.releases.length);
  const cur = lead?.releases[lead.releases.length - 1];
  if (cur) cur.def = true;
  return { rows, win };
}

// Telemetry-style readout: 2026-07-24T00:00Z
function isoUtc(v: unknown): string {
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? String(v ?? "") : `${d.toISOString().slice(0, 16)}Z`;
}
// Release notes arrive as small HTML fragments — flatten to text rather than injecting markup.
function stripHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
function fmtMonthYear(v: unknown): string {
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? String(v ?? "") : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Copernicus baseline dates are dd/MM/yyyy; convert to yyyy-mm-dd so new Date() parses UTC-correctly.
function ddmmyyyyToISO(v: unknown): string {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : s;
}
// Lane labels are the bare IPF code, matching the operations viewer's rows (L1L2, OL1_RAC, SM2_HY…).
// The mission prefix is dropped because the lane group already carries it.
function ipfLabel(ipf: string): string {
  return ipf.replace(/^S(?:1|2|3|5P)_/, "");
}

// Drop a processor code the feed repeats inside the version ("L0 1.1.0" → "1.1.0"). An em dash
// marks a release the feed carries no version for at all — that is real, not a formatting gap.
function cleanBaseline(raw: string, label: string): string {
  const s = raw.trim();
  if (!s) return "—";
  const stripped = s.replace(new RegExp(`^${label.replace(/[^\w]/g, "\\$&")}[\\s:_-]+`, "i"), "").trim();
  return stripped || s;
}

// Plain-language gloss shown under each code. Keys are full IPF identifiers.
const IPF_DESC: Record<string, string> = {
  S1_L0: "Level-0",
  S1_L1L2: "SLC · GRD · OCN",
  S1_SETAP: "Set-up auxiliary",
  S2_L0: "Level-0",
  S2_L1: "Level-1C",
  S2_L2: "Level-2A",
  S2_EUP: "Ephemeris update",
  S3_PUG: "Product user guide",
  S3_L0: "Level-0",
  S3_OL1: "OLCI radiance",
  S3_OL1_RAC: "OLCI Rayleigh-corrected",
  S3_OL1_SPC: "OLCI spectral campaign",
  S3_OL2: "OLCI water · land",
  S3_SL1: "SLSTR radiance · BT",
  S3_SL2: "SLSTR sea surface temp",
  S3_SL2_LST: "SLSTR land surface temp",
  S3_SL2_FRP: "SLSTR fire radiative power",
  S3_SR1: "SRAL Level-1",
  S3_SR2: "SRAL Level-2",
  S3_SM2_HY: "STM hydrology",
  S3_SM2_LI: "STM land ice",
  S3_SM2_SI: "STM sea ice",
  S3_MW1: "Microwave radiometer",
  S3_SY2: "Synergy",
  S3_SY2_AOD: "Synergy aerosol optical depth",
  S3_SY2_VGS: "Synergy vegetation (S)",
  S3_SY2_VGP: "Synergy vegetation (P)",
  S5P_L1B: "Radiance",
  S5P_L2O3_NRT: "Ozone, near-real-time",
  S5P_L2O3_OFFL: "Ozone, offline",
  S5P_L2O3_TCL: "Ozone tropospheric column",
  S5P_L2O3_PR: "Ozone profile",
  S5P_L2_NO2: "Nitrogen dioxide",
  S5P_L2_SO2: "Sulphur dioxide",
  S5P_L2_CO: "Carbon monoxide",
  S5P_L2_CH4: "Methane",
  S5P_L2_HCHO: "Formaldehyde",
  S5P_L2_CLOUD: "Cloud",
  S5P_L2AER_AI: "Aerosol index",
  S5P_L2AER_LH: "Aerosol layer height",
  S5P_L2SUOMI_CLOUD: "Suomi-NPP cloud",
};

// Processors. Each release carries processing_baseline, validity_start_date / _end_date,
// release_notes and target_ipfs[]. We fan each release out across its target IPFs, group by IPF
// into lanes, and let the client place the dots against the zoomed viewport.
export async function getProcessors(): Promise<{ rows: ProcRow[]; win: ProcWindow }> {
  // Conor's FastAPI processors service (DEVOCS-220). Override with PROCESSORS_API_URL if the host/port
  // differ; defaults to the local uvicorn from apps/sentiboard_backend on :8000.
  const url = process.env.PROCESSORS_API_URL || "http://127.0.0.1:8000/api/v1/processors/releases";
  console.log("[data] getProcessors → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    // His FastAPI wraps the list as { data: { processors_releases: [...] } }; also accept the older
    // top-level array / { releases } shapes so the demo backend keeps working as a fallback.
    const list: any[] = raw?.data?.processors_releases ?? (Array.isArray(raw) ? raw : raw.releases ?? raw.data ?? []);
    const { rows, win } = layoutProcessors(parseReleases(list));
    if (!rows.length) throw new Error("no Sentinel releases (or unrecognised shape)");
    console.log(`[data] getProcessors → OK, ${rows.length} processor rows from backend`);
    return { rows, win };
  } catch (err: any) {
    console.warn("[data] getProcessors → backend unavailable, using mock. Reason:", err?.message);
    return layoutProcessors(parseReleases(MOCK_RELEASES));
  }
}

// Fan each release out across its target IPFs and group by IPF. Every field — including
// satellite_units — is read off the release object itself; nothing is inferred from the mission or
// filled in from a lookup table. Live payload and offline fixture both come through here.
function parseReleases(list: any[]): Map<string, RawRelease[]> {
  const byIpf = new Map<string, RawRelease[]>();
  for (const r of list) {
    // Dates from the Copernicus config API are dd/MM/yyyy — normalise to ISO so new Date() is correct.
    const start = ddmmyyyyToISO(r.validity_start_date ?? r.release_date ?? r.start ?? "");
    const end = ddmmyyyyToISO(r.validity_end_date ?? r.end ?? "");
    const notes = stripHtml(r.release_notes ?? r.notes ?? "");
    const sats = normSats(r.satellite_units ?? r.satellites);
    const ipfs = r.target_ipfs ?? r.ipfs ?? [];
    for (const rawIpf of Array.isArray(ipfs) ? ipfs : [ipfs]) {
      // target_ipfs entries look like "S1_L1L2:002.36" → name before ':', baseline after it.
      const s = typeof rawIpf === "string" ? rawIpf : rawIpf?.name ?? rawIpf?.ipf ?? "";
      if (!s) continue;
      const [namePart, ...rest] = String(s).split(":");
      const ipf = namePart.trim();
      if (!/^S[1-5]/i.test(ipf)) continue; // Sentinel missions only
      const ver = rest.join(":").trim();
      // processing_baseline is often blank; the per-IPF version after ':' is the reliable one.
      // Both are sometimes missing entirely, and processing_baseline sometimes repeats the
      // processor code ("L0 1.1.0") which the lane label already carries.
      const baseline = cleanBaseline(ver || String(r.processing_baseline ?? r.baseline ?? ""), ipfLabel(ipf));
      byIpf.set(ipf, [...(byIpf.get(ipf) ?? []), { baseline, start, end, notes, sats }]);
    }
  }
  return byIpf;
}

const MOCK_CAL: CalEvent[] = [
  { day: 3, type: "acquisition", label: "Acquisition", time: "09:00:00 UTC", dateLabel: "03 Jun 2026", satellites: "S2A", datatakes: [{ id: "S2A-31002-12", comp: "ok" }] },
  { day: 12, type: "production", label: "Production", time: "08:00:00 UTC", dateLabel: "12 Jun 2026", satellites: "S1A", datatakes: [{ id: "S1A-44218-1", comp: "ok" }] },
  { day: 22, type: "manoeuvre", label: "Manoeuvre", time: "00:00:00 UTC", dateLabel: "22 Jun 2026", satellites: "S5P", datatakes: [] },
  { day: 26, type: "acquisition", label: "Acquisition", time: "11:30:00 UTC", dateLabel: "26 Jun 2026", satellites: "S2B", datatakes: [{ id: "S2B-48597-1", comp: "warn" }] },
  { day: 26, type: "acquisition", label: "Acquisition", time: "12:00:00 UTC", dateLabel: "26 Jun 2026", satellites: "S2C", datatakes: [{ id: "S2C-9430-2", comp: "warn" }] },
  { day: 26, type: "acquisition", label: "Acquisition", time: "17:02:00 UTC", dateLabel: "26 Jun 2026", satellites: "S1D", datatakes: [{ id: "S1D-24592 (6010)", comp: "warn" }] },
  { day: 27, type: "satellite", label: "Satellite", time: "10:00:00 UTC", dateLabel: "27 Jun 2026", satellites: "S3A", datatakes: [{ id: "S3A-22887-44", comp: "un" }] },
  { day: 29, type: "satellite", label: "Satellite", time: "11:00:00 UTC", dateLabel: "29 Jun 2026", satellites: "S3A", datatakes: [{ id: "S3A-22890-2", comp: "warn" }] },
];

// Map an anomaly `category` string to one of our five calendar issue types.
const ISSUE_MAP: Record<string, IssueType> = {
  acquisition: "acquisition", calibration: "calibration",
  manoeuvre: "manoeuvre", maneuver: "manoeuvre",
  production: "production", platform: "satellite", satellite: "satellite", anomaly: "satellite",
};
function toIssue(cat: string): IssueType {
  return ISSUE_MAP[(cat || "").trim().toLowerCase()] ?? "satellite";
}

// Events calendar. Uses the real /events_data route (NOT login-protected), which returns
// { year, month, anomalies, anomalies_by_date: { "YYYY-MM-DD": [ {category, ...} ] }, events }.
// The calendar UI currently shows June 2026, so we request that month.
export async function getCalendarEvents(year = 2026, month = 6): Promise<CalEvent[]> {
  const url = `${BACKEND_URL}/events_data?year=${year}&month=${month}`;
  console.log("[data] getCalendarEvents → fetching from backend:", url);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const byDate: Record<string, any[]> = raw.anomalies_by_date ?? {};
    const mapped: CalEvent[] = [];
    for (const [dateKey, list] of Object.entries(byDate)) {
      const day = parseInt(dateKey.slice(8, 10), 10);
      for (const inst of list as any[]) {
        const cat = inst.category ?? inst.type ?? "";
        const d = new Date(inst.occurrenceDate ?? inst.start ?? inst.publicationDate ?? dateKey);
        const dtl: any[] = Array.isArray(inst.datatakes_completeness) ? inst.datatakes_completeness
          : Array.isArray(inst.datatakes) ? inst.datatakes : [];
        mapped.push({
          day,
          type: toIssue(cat),
          label: cat || toIssue(cat),
          time: fmtTimeUTC(d),
          dateLabel: fmtDayUTC(d, dateKey),
          satellites: inst.impactedSatellite ?? inst.satellites ?? "",
          datatakes: dtl.map((dt) => ({
            id: String(dt.id ?? dt.datatake ?? dt.name ?? dt),
            comp: normComp(dt.status ?? dt.completeness ?? dt.state),
          })),
        });
      }
    }
    if (!mapped.length) throw new Error("no events for this month (or unrecognised shape)");
    console.log(`[data] getCalendarEvents → OK, ${mapped.length} events from backend`);
    return mapped;
  } catch (err: any) {
    console.warn("[data] getCalendarEvents → backend unavailable, using mock. Reason:", err?.message);
    return MOCK_CAL;
  }
}
