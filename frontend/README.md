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

## Server vs client components
- **Server components** (default, e.g. `page.tsx`, `events/page.tsx`) fetch data and render HTML.
- **Client components** (`"use client"`, e.g. clock, live feed) handle browser interactivity.

## Notes
- Illustrative mock data only — not live.
- The hero video (`public/assets/home_v2.mp4`, ~15 MB) is git-ignored; copy it from
  `../design/mockups/assets/home_v2.mp4` if missing.
- Still to port from the mockups: Acquisitions globe, Data Availability donuts + datatake list,
  Processors timeline, About + FAQ, Terms & Cookie Notice.
