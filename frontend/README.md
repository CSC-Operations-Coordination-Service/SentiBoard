# SentiBoard v2 — frontend (Next.js + TypeScript)

React frontend for SentiBoard, using **Next.js (App Router)** with **server-side rendering**.
Ported from the React mockups in `../design/react-mockups/`.

## Why Next.js (SSR)
Operational Copernicus/Sentinel data must **not** be exposed via a browser-callable JSON API
(data-sensitivity constraint). With SSR, data is fetched **on the server** (`lib/data.ts` — server
only) and sent to the browser as **rendered HTML**; React then hydrates. There is no public
`/api/...` data endpoint. See `lib/data.ts` — today it returns mock data; swap the bodies for real
OpenSearch / JIRA / Flask calls and the page components stay unchanged.

## Prerequisites
Node.js ≥ 18 (LTS recommended). If not installed (WSL):
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# reopen terminal
nvm install --lts
```

## Run
```bash
cd frontend
npm install
npm run dev
# open http://localhost:3000
```

## Structure
```
app/
  layout.tsx        root layout: <Nav/> + page + <Footer/> + reveal observer
  globals.css       the design system (ported from the mockups' app.css)
  page.tsx          Home (server component) — hero + parallax modules
  events/page.tsx   Events (server component) — SSR calendar from server data
  about/ acquisitions/ availability/ processors/ terms-conditions/ cookie-notice/
                    stub pages (to be ported from the mockups)
components/
  Nav.tsx           header + active-route highlight (client: usePathname)
  Footer.tsx        footer
  LiveClock.tsx     UTC clock (client)
  RealtimeFeed.tsx  live events panel (client; seeded with server data)
  RevealInit.tsx    scroll-reveal observer (client)
  Stub.tsx          placeholder for un-ported pages
lib/
  data.ts           SERVER-ONLY data layer (mock now → real sources later)
public/assets/      images, Font Awesome subset, joystick.svg, hero video
```

## Mock-ups (`/examples`)

Design proposals under review. They live **outside `app/v1`** on purpose: they carry no production
chrome (no `Nav`, no `Footer`), run entirely on locally generated mock data, fetch nothing, and so
can never be mistaken for the shipping pages. Nothing under `/examples` affects `/v1`.

Not reachable from the nav — open `/examples` for the gallery, or type a path:

| Route | Proposal | Proposal for | Source |
| --- | --- | --- | --- |
| `/examples` | Gallery — one card per proposal | — | `app/examples/page.tsx` |
| `/examples/data-availability` | Datatake table with sortable columns and mission / satellite / date / ID filters, over three donut breakdowns. Carries a dark/light toggle the app itself does not have. | `/v1/availability` | `app/examples/data-availability/` |
| `/examples/events` | "Mission Manifest" — month grid with one dot per event and a completeness stripe on days that lost data; selecting a day opens the Day Manifest drawer, whose occurrences expand into the datatakes they impacted. | `/v1/events` | `app/examples/events/` |

```bash
npm run dev
# http://localhost:3000/examples
```

Each proposal is self-contained in its own folder — page, client component, mock data, stylesheet:

```
app/examples/events/
  page.tsx               server component: metadata only, renders the client component
  EventsManifest.tsx     "use client" — filters, month grid, Day Manifest drawer
  mock.ts                August 2026 events + datatakes, and the pure helpers over them
  manifest.module.css    CSS module (see the note below)
```

**Styling is CSS modules, not Tailwind.** This app has no Tailwind, and adding it would put
Tailwind's base reset underneath the ~730-line design system every `/v1` page depends on. The
mock-ups therefore port utility classes to real rules, reading type and width from `globals.css`
(`--sans`, `--mono`, `--display`, `--maxw`) and defining only their own palette.

**Mock data must stay deterministic** — no `Date.now()`, no `new Date()` without arguments, no
un-seeded RNG. These pages are statically prerendered, so anything that differs between the server
render and hydration shows up as a React mismatch. It is also why no calendar day is marked
"today": the Events mock is pinned to August 2026.

The Events proposal is mirrored in the Vite mock-ups app at
`../design/react-mockups/src/pages/events-manifest/` (route `/examples/events-manifest`, port 5180).
`mock.ts` is byte-identical; the component differs only in routing, the `"use client"` directive and
nav-aware geometry. Changing one means changing the other.

## Server vs client components
- **Server components** (default, e.g. `page.tsx`, `events/page.tsx`) fetch data and render HTML.
- **Client components** (`"use client"`, e.g. clock, live feed) handle browser interactivity.

## Notes
- Illustrative mock data only — not live.
- The hero video (`public/assets/home_v2.mp4`, ~15 MB) is git-ignored; copy it from
  `../design/mockups/assets/home_v2.mp4` if missing.
- Still to port from the mockups: Acquisitions globe, Data Availability donuts + datatake list,
  Processors timeline, About + FAQ, Terms & Cookie Notice.
