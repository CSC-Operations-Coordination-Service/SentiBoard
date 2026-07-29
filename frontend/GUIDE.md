# SentiBoard frontend — developer guide

A guide to how this React frontend is built, where everything lives, and how it will
connect to the backend. Written for someone new to React/Next.js.

---

## 1. The big picture

- **React** is a library for building UIs out of **components** — small, reusable pieces of
  interface described in a file. You compose pages out of components.
- **Next.js** is a framework *on top of* React that adds routing, server-side rendering,
  bundling, and a dev server — so we don't wire all that up by hand. We use its **App Router**
  (the `app/` folder).
- **TypeScript** is JavaScript with types (the `.tsx`/`.ts` files). Types catch mistakes early
  and power editor autocomplete.

### Why Next.js with SSR (important)
Operational Sentinel data must **not** be exposed as a browser-callable JSON API
(data-sensitivity rule). Next.js **Server-Side Rendering (SSR)** fits this perfectly:

```
Browser ──requests page──►  Next.js server ──(server-side)──►  data source (OpenSearch/JIRA/Flask)
        ◄──── HTML ────────  (renders the page to HTML)
```

The browser only ever receives **HTML** (already filled with data). There is no public
`/api/data` endpoint to scrape. The place that touches data is `lib/data.ts`, which runs
**only on the server**.

---

## 2. Server components vs client components (the #1 concept)

Next App Router has two kinds of components:

- **Server Components** (the default). They run on the server, can be `async`, and can fetch
  data directly. They render to HTML. They **cannot** use browser features (clicks, `useState`,
  `window`). All our `app/**/page.tsx` files are server components.
- **Client Components**. Marked with `"use client";` at the very top of the file. They run in the
  browser and can be interactive (state, effects, event handlers). Our `components/*.tsx` that
  need interactivity are client components (the clock, live feed, globe, donuts, timeline).

Rule of thumb: **start server; add `"use client"` only when a piece needs interactivity.**

```
page.tsx (server, fetches data)
   └─ renders ─► <SomeClientComponent data={...} />   ← interactive island
```

---

## 3. Where everything lives (folder map)

```
frontend/
├─ package.json         dependencies + scripts (dev/build/start)
├─ tsconfig.json        TypeScript config (note: "@/..." = project root import alias)
├─ next.config.mjs      Next.js config
│
├─ app/                 ROUTES + layout live here (App Router)
│  ├─ layout.tsx        the shell wrapped around every page: <Nav> + page + <Footer>
│  ├─ globals.css       the whole design system (colors, components, all CSS)
│  ├─ page.tsx          "/"            → Home
│  ├─ events/page.tsx   "/events"      → Events (SSR calendar)
│  ├─ availability/page.tsx  "/availability"
│  ├─ processors/page.tsx    "/processors"
│  ├─ acquisitions/page.tsx  "/acquisitions"
│  ├─ about/page.tsx         "/about"
│  ├─ terms-conditions/page.tsx
│  └─ cookie-notice/page.tsx
│
├─ components/          reusable UI pieces (imported by pages)
│  ├─ Nav.tsx           top menu (client — highlights the active link)
│  ├─ Footer.tsx        footer (server)
│  ├─ LiveClock.tsx     UTC clock (client)
│  ├─ RealtimeFeed.tsx  live events panel (client)
│  ├─ RevealInit.tsx    scroll-in animations (client)
│  ├─ Donut.tsx         availability donut charts (client canvas)
│  ├─ ProcessorTimeline.tsx  processors timeline (client)
│  ├─ AcquisitionGlobe.tsx   the 3D globe (client canvas)
│  ├─ CookieToggle.tsx  cookie opt-in/out (client)
│  └─ Stub.tsx          (leftover placeholder helper — unused now)
│
├─ lib/
│  └─ data.ts           ★ THE DATA LAYER (server-only). Mock now → real later.
│
└─ public/              static files served as-is at the site root
   └─ assets/           images, the Font Awesome font, joystick.svg, hero video
      └─ img/...         referenced in code as "/assets/img/..."
```

**How routing works:** the folder name under `app/` *is* the URL. `app/events/page.tsx` → `/events`.
To add a page `/news`, create `app/news/page.tsx`. That's it — no route table to edit.

---

## 4. Anatomy of a page (read one to understand all)

Open `app/availability/page.tsx`:

```tsx
import Donut from "@/components/Donut";          // import a component
import { getAvailability } from "@/lib/data";     // import the data function

export default async function AvailabilityPage() {          // server component (async!)
  const { acq, pub, datatakes } = await getAvailability();  // fetch data ON THE SERVER

  return (                                                  // return the UI (JSX)
    <>
      <div className="page-head">...</div>
      <section className="wrap pad">
        <Donut ... segments={acq} />                        {/* hand data to a client component */}
        {datatakes.map((dt) => ( <div key={dt.id}> ... </div> ))}  {/* loop over data */}
      </section>
    </>
  );
}
```

Key things you're seeing:
- **JSX**: HTML-like syntax inside JavaScript. Note `className` instead of `class`, and
  `{ ... }` to drop JavaScript values/expressions into the markup.
- **props**: data passed into a component, e.g. `<Donut segments={acq} />`. Inside `Donut`,
  it's received as a function argument.
- **`.map(...)`**: how you render a list — loop over an array and return one element per item.
  Each needs a unique `key`.
- **`await getAvailability()`**: because the page is a server component, it can fetch directly
  before rendering. The user never sees a loading spinner or an API call.

---

## 5. Client components & hooks (interactivity)

Open `components/LiveClock.tsx` — the smallest example:

```tsx
"use client";                          // ← this file runs in the browser
import { useEffect, useState } from "react";

export default function LiveClock() {
  const [t, setT] = useState("--:--:-- UTC");   // state: a value + its setter
  useEffect(() => {                              // effect: runs after render (side effects)
    const id = setInterval(() => setT(nowUTC()), 1000);
    return () => clearInterval(id);              // cleanup when the component goes away
  }, []);                                        // [] = run once on mount
  return <span className="clock">{t}</span>;     // re-renders whenever t changes
}
```

The three hooks we use most:
- **`useState`** — a piece of data that, when changed, re-renders the component (e.g. which
  datatake is selected).
- **`useEffect`** — run code after render for "side effects": timers, canvas drawing, event
  listeners. The returned function cleans up.
- **`useRef`** — a mutable box that survives re-renders but does **not** trigger a re-render
  (used for the `<canvas>` element and the globe's animation state).

The canvas pages (`AcquisitionGlobe`, `Donut`) use `useRef` for the canvas + a `useEffect` that
runs the draw loop and attaches mouse/touch handlers, exactly like plain JS — just wrapped in
React's lifecycle so it cleans up correctly.

---

## 6. Styling

- All styles are in **`app/globals.css`** — one file, ported from the design mockups.
- It starts with **design tokens** (CSS variables) in `:root`, e.g. `--accent`, `--ground`,
  `--muted`. Everything references these, so changing one value re-themes the app.
- Components use plain **class names** (`className="card"`, `className="pill nominal"`), which
  map to rules in `globals.css`. No CSS-in-JS to learn.
- Small one-off styles use the `style={{ ... }}` prop (note: an object, camelCased keys —
  `style={{ marginTop: 18 }}`).

To change a colour globally: edit the variable in `:root` at the top of `globals.css`.

---

## 7. The layout & navigation

- **`app/layout.tsx`** is the shell rendered around *every* page: it puts `<Nav />` on top,
  the page in the middle, `<Footer />` at the bottom, and imports `globals.css`.
- **`components/Nav.tsx`** holds the menu. The menu items are a simple array:
  ```tsx
  const LINKS = [{ href: "/", label: "Index" }, { href: "/about", label: "About" }, ...];
  ```
  Edit that array to rename/reorder/add menu items. It's a client component because it
  highlights the current page using `usePathname()`.

---

## 8. ★ How this connects to the backend

**Everything funnels through `lib/data.ts`.** Right now each function returns hard-coded mock
data. To go live, you replace the *inside* of each function with a real server-side call — and
**no page or component needs to change**, because they just call these functions.

### Today (mock)
```ts
export async function getAvailability() {
  await wait();                 // placeholder
  return { acq: [...], pub: [...], datatakes: [...] };  // hard-coded
}
```

### Later (real) — three common options

**Option A — call the existing Flask service (server-to-server):**
```ts
export async function getAvailability() {
  const res = await fetch(`${process.env.BACKEND_URL}/internal/availability`, {
    headers: { Authorization: `Bearer ${process.env.BACKEND_TOKEN}` },
    cache: "no-store",          // always fresh (or set a revalidate time)
  });
  return res.json();
}
```
This `fetch` runs on the **Next server**, not the browser. The `BACKEND_URL` can be an
internal-only address; the browser never sees it. So it stays off the public network.

**Option B — query OpenSearch / a database directly** from `lib/data.ts` using its Node client
(also server-only). Same idea: the query runs on the server, only HTML reaches the browser.

**Option C — keep Flask rendering some fragments** and have Next request them. Less common here.

### Environment variables
Secrets/URLs go in `frontend/.env.local` (git-ignored), e.g.:
```
BACKEND_URL=http://sentiboard-api.internal:8000
BACKEND_TOKEN=xxxxx
```
Read them with `process.env.BACKEND_URL` **inside server code only** (never in a `"use client"`
file — those ship to the browser). Prefix a var with `NEXT_PUBLIC_` only if it's safe for the
browser to see.

### Freshness / "real-time"
- Server components can re-fetch per request (`cache: "no-store"`) or on a timer
  (`next: { revalidate: 60 }`).
- For the live panels (events feed), the pattern is: server renders the initial list, and a
  small client component refreshes it periodically by calling a **server action** or re-fetching
  a server-rendered fragment — still no public JSON data API. `RealtimeFeed.tsx` currently
  *simulates* this with a timer; that's the seam to wire up.

### The data types
`lib/data.ts` also defines TypeScript **types** (e.g. `Datatake`, `Release`, `AcqDatatake`).
When you switch to real data, make the real response match these shapes (or update the types)
and the whole app stays type-checked end to end.

---

## 9. Running & building

```bash
cd frontend
npm install        # once (downloads dependencies into node_modules/)
npm run dev        # start dev server with hot-reload → http://localhost:3000
npm run build      # production build (also type-checks everything — good for catching errors)
npm run start      # run the built production server
```
- **Hot reload:** while `npm run dev` runs, saving a file updates the browser automatically.
- **`npm run build`** is the best way to catch TypeScript/JSX errors across the whole project.

---

## 10. Common "how do I…" recipes

| I want to… | Do this |
|---|---|
| Rename a menu item | Edit the `LINKS` array in `components/Nav.tsx` |
| Add a new page at `/foo` | Create `app/foo/page.tsx` exporting a component |
| Change page text | Edit the JSX text in that page's `page.tsx` |
| Change the sample data | Edit the return value in the matching `lib/data.ts` function |
| Connect real data | Replace the body of the `lib/data.ts` function with a `fetch`/DB call (Section 8) |
| Change a colour/spacing globally | Edit the CSS variables in `:root` of `app/globals.css` |
| Add an interactive widget | New file in `components/`, put `"use client"` at the top, use `useState`/`useEffect` |
| Add an image | Drop it in `public/assets/img/`, reference as `/assets/img/name.png` |

---

## 11. Mini glossary

- **Component** — a function returning JSX (a piece of UI).
- **JSX** — HTML-like markup inside JS/TS; `className`, `{expr}`, self-closing tags.
- **props** — inputs passed to a component: `<X a={1} />`.
- **state** (`useState`) — data that re-renders the UI when it changes.
- **effect** (`useEffect`) — code that runs after render (timers, canvas, listeners).
- **ref** (`useRef`) — mutable value that doesn't cause re-renders (e.g. the canvas node).
- **server component** — default; runs on server; can fetch data; renders HTML.
- **client component** — `"use client"`; runs in browser; interactive.
- **SSR** — server renders HTML with data already in it; browser hydrates.
- **route** — a URL, defined by a folder + `page.tsx` under `app/`.
- **hydrate** — React attaching interactivity to the server-rendered HTML in the browser.

---

*Start by reading, in order: `app/layout.tsx` → `app/page.tsx` → `components/RealtimeFeed.tsx`
→ `lib/data.ts`. That path shows the whole model: shell → server page → client island → data.*
