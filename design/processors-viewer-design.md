# Processors Viewer — design brief (DEVOCS-219)

Mission-control register for the Processors Releases page. Borrows the confidence of a launch
manifest without copying its literal look — the subject (mission timelines, version history)
already has a natural kinship with one.

## Palette

Dark, neutral graphite — a deliberate shift from the blue-tinted dark the frontend uses today
(`--ground:#06080D`, `--panel:#0F1622`, `--accent-cyan:#36D0E0`).

| Token | Value | Use |
| --- | --- | --- |
| `--void` | `#0B0D10` | page background, near-black |
| `--panel` | `#14181D` | cards, detail drawer |
| `--hairline` | `rgba(255,255,255,0.08)` | dividers, grid |
| `--text-primary` | `#F2F4F5` | body text |
| `--text-secondary` | `#8A9198` | labels, secondary |
| `--teal-signal` | `#00C7D6` | **only** live/now state + active selection |
| `--amber-flag` | `#FFB020` | **only** anomalies / deprecated baselines — never decoration |

The two accents are rationed on purpose. If teal appears on something that isn't "now" or
"selected", it stops meaning anything.

## Type

- **Condensed technical grotesk** (Space Grotesk / Neue Machina) — big version numbers, headlines.
- **Geometric sans** (Inter) — body, labels.
- **Monospace, strictly** — version strings and UTC timestamps: `IPF 03.71`,
  `2026-07-24T00:00Z`. The mono face is what produces the telemetry-readout feel; no decoration
  needed beyond it.

## Layout

Signature element: a **full-bleed horizontal timeline as the hero**, replacing the boxed feel of
the current widget. A single glowing vertical line — the **now marker** — sweeps through the
version history with a live UTC clock ticking beside it: a launch countdown clock repurposed to
mark *where we are* in processor history.

Rows below are grouped by mission (S1 / S2 / S3 / S5P) as **horizontal lanes**, not a generic
Gantt grid. Each lane carries its own thin accent underline in a muted per-satellite hue — not
the loud teal.

```
┌──────────────────────────────────────────────────────┐
│  SENTIBOARD          PROCESSORS      [search]  ⋮ menu │
├──────────────────────────────────────────────────────┤
│  now ⟶ 2026-07-27T14:02Z            ╎ (glowing line)  │
│                                       ╎                │
│  S1 ─●──●────●───●──╎────●─────●───▶                  │
│  S2 ──●────●──╎──●──────●──●────────▶                 │
│  S3 ────●──╎──●────●──────●─────────▶                 │
│  S5P──╎──●──────●───●───●───────────▶                 │
├──────────────────────────────────────────────────────┤
│  ▸ selected release detail panel (slides up)          │
└──────────────────────────────────────────────────────┘
```

Clicking a release dot expands a bottom detail panel: version string in mono, change notes,
affected products. Same rhythm as a mission page expanding stage/booster details on scroll, but
click-triggered here because the data is discrete releases, not a continuous flight.

## Motion

Reserved for one moment.

- The now line pulses very subtly — 2s ease, opacity `0.6 → 1`.
- Clicking a dot smooth-scrolls the detail panel into view.
- Nothing else animates. Timeline drag/zoom stays snappy and un-animated.

## Decisions taken while implementing

Files: [ProcessorsView.tsx](../frontend/components/ProcessorsView.tsx),
[ProcessorTimeline.tsx](../frontend/components/ProcessorTimeline.tsx),
[globals.css](../frontend/app/globals.css) (`.ptl-*` rules),
[data.ts](../frontend/lib/data.ts) (`getProcessors`, `layoutProcessors`, `Release`, `ProcRow`),
[layout.tsx](../frontend/app/layout.tsx) (fonts).

**Lanes — mission groups with IPF sub-rows.** Missions are lane groups; each IPF is a sub-row
sharing the mission's accent hue. Collapsing S1's processors onto one line would collide their dots
and lose which processor a release belongs to. The mission `<select>` is gone — all four missions are
visible at once, as the brief's diagram shows.

**Release mark — dots on a connecting rail.** A dot per release, joined by a dim rail; the segment
from the newest release to the now marker is brightened in the mission hue and ends in the `▶`. Keeps
the launch-manifest read while preserving how long a baseline has been in force, which plain dots
drop.

**Palette — retuned `:root` site-wide.** The frontend was already dark but blue-tinted
(`#06080D` / `#0F1622` / cyan `#36D0E0`), so the brief's "shift from the light theme" was stale; the
real choice was scope. Nav and Footer are shared across pages, so scoping graphite to
`/v1/processors` would have left them straddling two registers. Hard-coded colour literals across
`globals.css` and the components were swept to match the new tokens.

### Processor roster

Lanes are driven by the **canonical roster**, not by whatever the releases feed happens to contain —
`IPF_ROSTER` in [data.ts](../frontend/lib/data.ts), lifted from `IPFsMap` in
[processors-viewer.js](../apps/static/assets/js/processors-releases/processors-viewer.js) so this
viewer and the operations viewer agree. 41 processors: S1 ×3, S2 ×4, S3 ×20, S5P ×14.

Two things follow from the roster being authoritative:

- **A processor with no releases still gets a lane.** `S2_EUP`, `S3_SR2` and `S3_SY2_VGP` are on the
  roster but absent from the feed today; their rails render empty with a "no releases published"
  note. A missing row would read as an oversight; an empty rail reads as "tracked, nothing yet".
- **A feed key not on the roster is not shown.** `S1_AMALFI` (4 releases) and `S1_ERRMAT` (3) are
  orbit-determination and error-matrix auxiliaries that the operations viewer also omits. That is
  7 of the feed's 380 IPF-release pairs, hence 373 dots.

Lane order is the roster's **processing-chain order** (PUG → L0 → OL1 → OL1_RAC → … ), not
alphabetical. Labels are the bare IPF code as the operations viewer shows them (`L1L2`, `OL1_RAC`,
`SM2_HY`), with a plain-language gloss beneath from `IPF_DESC`.

### What the real backend forced

The live service returns **230 releases across 40 IPFs** spanning **2014–2027** — not the 8 IPFs the
brief's sketch implies. Three consequences:

1. **Lane groups collapse.** S3 has 18 processors and S5P 14; expanding all 40 sub-rows puts a
   ~1400px wall where the hero should be. Rule: a mission opens by default when it has **≤ 6**
   processors (`AUTO_OPEN_MAX`) — S1 and S2 open, S3 and S5P collapsed. A collapsed mission still
   draws *every* one of its releases, merged onto one rail, so nothing is hidden — only aggregated.
   Change `AUTO_OPEN_MAX` to shift the default.
2. **Pan and zoom are required, not optional.** S1 L1/L2 alone has 32 releases over 12 years, some
   days apart — unresolvable at full-window zoom. Scroll zooms anchored on the cursor, drag pans;
   floor is a 45-day span. Ticks follow the zoom: years → quarters → months. Because positions now
   depend on the viewport, they are computed client-side from raw timestamps rather than baked into
   the data as percentages.
3. **Change notes exist after all.** `release_notes` ships as small HTML fragments — flattened to
   text via `stripHtml` rather than injected as markup. `validity_end_date` is real too, so the
   detail panel shows "Valid to" instead of the invented rollout percentage the old mock carried.
   Products remain genuinely absent from the feed, so that row states so explicitly.
4. **Baselines arrive three different ways.** `target_ipfs` entries are usually `S1_L0:6.0.0`, but
   some carry no version (`S1_L0:`) and some put it in `processing_baseline` with the processor code
   repeated (`"L0 1.1.0"`). `cleanBaseline` strips the redundant code and leaves `—` where the feed
   genuinely has no version — a real gap, not a formatting one.

### Impacted satellites come from the feed, never from a lookup

`satellite_units` is read off each release object by `parseReleases`, which is the **single** parser
for both the live payload and the offline fixture. Nothing about the satellite list is inferred from
the mission or filled in from a table — if the feed omits it (8 of 230 releases), the panel says so.

`normSats` exists only to flatten the three shapes the feed actually uses:

| Feed shape | Count | Result |
| --- | --- | --- |
| array — `["S1A","S1C","S1D"]` | 200 | three chips |
| bare string — `"S1A"` | 24 | one chip |
| comma-joined string — `"S1A, S1C"` | 6 | two chips |

`MOCK_RELEASES` is written in the upstream response's own shape — `dd/MM/yyyy` dates,
`"IPF:version"` strings, HTML notes, per-release `satellite_units` — so the fallback exercises the
same parser rather than a parallel code path. It deliberately includes all three satellite shapes and
a two-IPF fan-out.

### Other notes

- **Now marker** is client-only: rendered as `null` on the server and filled after mount, since a
  clock cannot match across the hydration boundary. Same pattern as
  [LiveClock.tsx](../frontend/components/LiveClock.tsx).
- **Search narrows whole lanes**, never individual releases — a lane's rail geometry and its
  in-force segment only read correctly with its full release history present.
- **Fonts** are self-hosted by `next/font` at build time (no runtime request to Google), so the
  build needs network access. Both `--font-sans` and `--font-display` fall back to system stacks.
