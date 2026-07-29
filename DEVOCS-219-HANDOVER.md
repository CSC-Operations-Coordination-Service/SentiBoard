# DEVOCS-219 — Frontend Restyling — handover

Branch: `feature-DEVOCS-219-Frontend-Restyling`, built on top of Conor's DEVOCS-220 FastAPI
processors service (`07a0360`, on `feature-DEVOCS-220-Architecture-refactoring`).

Two things to look at: the **Processors Releases page rebuilt on the new Next.js frontend**, and the
**React mockups** the redesign came from. They run independently — you don't need the mockups to
review the page, or the page to browse the mockups.

---

## 1. Run it

Three pieces, three terminals. Ports: backend `8000`, frontend `3000`, mockups `5180`.

### Processors backend (FastAPI)

Proxies and caches the Copernicus configuration API. Needs outbound network on first call.

```bash
cd apps/sentiboard_backend
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
./.venv/bin/uvicorn main:app --port 8000
```

Check it: `curl -s localhost:8000/api/v1/processors/releases | head -c 300` → should return
`{"data":{"processors_releases":[...` with ~230 releases.

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000/v1/processors
```

Node ≥ 18. First build downloads the Space Grotesk / Inter webfonts via `next/font`, so the initial
`npm run dev` needs network too; after that they are self-hosted in `.next`.

**The page works without the backend.** If `:8000` is unreachable it falls back to an offline
fixture (`MOCK_RELEASES` in `frontend/lib/data.ts`) — 20 releases instead of 373, and the terminal
logs `backend unavailable, using mock`. Worth knowing so a quiet fallback isn't mistaken for a bug.
Point it elsewhere with `PROCESSORS_API_URL` if your backend is on another host.

### Mockups (Vite + React)

```bash
cd design/react-mockups
npm install
npm run dev          # http://localhost:5180
```

Design proposal only — all data is static. `design/react-mockups/README.md` has the page inventory.

**Two About-page layouts to compare**, both rendering the same source text (`src/data/about.ts`):

| | URL | Treatment |
| --- | --- | --- |
| Layout A | `/about` | page-header led — standard crumb + `About` title, then prose, module links, FAQs |
| Layout B | `/examples/about` | hero led — full-bleed hero with the headline "The Copernicus Sentinel Operations Dashboard", then prose, feature cards, FAQs |

Each links to the other, so you can flip between them without retyping URLs.

The other `/examples/*` routes (`fleet`, `gallery`, `reveal`, indexed at `/examples`) are **index-page**
proposals and are a separate question from the About layouts.

---

## 2. What changed on the Processors page

Full rationale in **[design/processors-viewer-design.md](design/processors-viewer-design.md)** —
palette, type, layout, and every decision the real data forced. Short version:

The old boxed Gantt grid with a mission dropdown became a **full-bleed lane timeline**. Missions are
lane groups (S1 / S2 / S3 / S5P, each with a muted accent hue); every processor is a sub-row with a
rail of release dots. One glowing "now" marker with a live UTC clock sweeps the whole plot. Clicking a
dot opens a detail panel that slides up.

Things worth knowing before you review:

- **Scroll zooms, drag pans.** Not decoration — S1 L1L2 alone has 32 releases over 12 years, some days
  apart, unresolvable at full-window zoom. Floor is a 45-day span; ticks step years → quarters →
  months. "Reset zoom" is top-right of the plot.
- **S3 and S5P start collapsed.** They have 20 and 14 processors; expanding all 41 lanes would be a
  ~1400px wall. A collapsed mission still draws *every* release, merged onto one rail — aggregated,
  not hidden. Click a mission name to expand. Threshold is `AUTO_OPEN_MAX` in
  `components/ProcessorTimeline.tsx`.
- **The palette shifted site-wide**, not just here — `:root` in `app/globals.css` moved from
  blue-tinted dark to neutral graphite, because Nav and Footer are shared and would otherwise
  straddle two registers. Other `/v1` pages are affected by design.

### Data mapping

`frontend/lib/data.ts` → `parseReleases()` is the single parser for both the live payload and the
offline fixture. Fields, and what the feed actually does:

| Panel field | Source | Note |
| --- | --- | --- |
| Baseline | version after `:` in `target_ipfs`, else `processing_baseline` | see below |
| Previous | preceding release on the same lane | derived |
| Operational since | `validity_start_date`, else `release_date` | `dd/MM/yyyy` → ISO |
| Valid to | `validity_end_date` | `open` when blank |
| Release notes | `release_notes` | HTML flattened to text, **not** injected |
| Impacted satellite(s) | `satellite_units` | three shapes, all normalised |

Three feed quirks the parser absorbs:

- **`satellite_units`** arrives as an array (`["S1A","S1C"]`, 200×), a bare string (`"S1A"`, 24×) or a
  comma-joined string (`"S1A, S1C"`, 6×). All flatten to a deduped list. 8 of 230 releases have none
  at all — the panel says "not published" rather than showing an empty row.
- **Baselines** arrive three ways: normally `S1_L0:6.0.0`; sometimes with no version (`S1_L0:`);
  sometimes in `processing_baseline` with the processor code repeated (`"L0 1.1.0"`). The redundant
  code is stripped; `—` means the feed genuinely carries no version.
- **`release_notes`** is Atlassian/Word export markup — inline `font-family`, `background-color`,
  gradient `border-image`, `<o:p>` tags. The legacy viewer injected it raw, which would drag
  light-theme Confluence styling into the dark panel and open an injection path from an upstream
  feed. It is flattened to text; nested `<ul>` bullets survive as `• ` lines.

### One open decision

Lanes come from `IPF_ROSTER` in `data.ts` — a static list of 41 processors copied from `IPFsMap` in
`apps/static/assets/js/processors-releases/processors-viewer.js`, so this viewer and the operations
viewer agree on which processors exist and in what order.

It is static because **the feed has no processor list** — upstream `graph` contains only
`processors_releases`, so the only processors derivable from JSON are those that already have a
release. Consequences, both deliberate:

- `S2_EUP`, `S3_SR2`, `S3_SY2_VGP` are on the roster with no releases yet → they render as empty
  rails with a "no releases published" note.
- `S1_AMALFI` and `S1_ERRMAT` have releases (7 between them) but are **not** on the roster, matching
  the operations viewer, so they are not shown. Hence 373 dots rather than 380.

If we'd rather lanes track the feed and accept losing the three release-less processors, that's a
small change — worth deciding together before Thursday.

---

## 3. Review shortlist

| File | What to look at |
| --- | --- |
| [frontend/components/ProcessorTimeline.tsx](frontend/components/ProcessorTimeline.tsx) | the timeline: lanes, dots, zoom/pan, now marker, detail panel |
| [frontend/lib/data.ts](frontend/lib/data.ts) | `parseReleases`, `layoutProcessors`, `IPF_ROSTER`, `MOCK_RELEASES` |
| [frontend/app/globals.css](frontend/app/globals.css) | `:root` tokens (site-wide), `.ptl-*` rules |
| [frontend/components/ProcessorsView.tsx](frontend/components/ProcessorsView.tsx) | search — narrows whole lanes, not individual releases |
| [design/processors-viewer-design.md](design/processors-viewer-design.md) | why any of it looks like this |

## Status

- `npx tsc --noEmit` clean; `npm run build` clean on both the live and fallback paths.
- Verified against the live backend (373 dots / 41 processors) and the offline fixture.
- Not yet done: no automated tests, no visual regression check, and the page has not been exercised
  on a real mobile viewport — the lane gutter narrows at 900px but that is untested on a device.
