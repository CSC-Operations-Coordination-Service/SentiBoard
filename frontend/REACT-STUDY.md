# Learning React through the changes we made

This is a **study companion**. Every concept below is tied to real code you already saw working
in this project. Open the referenced file side-by-side and read the snippet in context — that's
the fastest way for it to click.

> For the project basics (folder layout, how to run it, server-vs-client overview) see [GUIDE.md](GUIDE.md).
> This document goes deeper on the **React ideas** behind the filters, month navigation, and the
> reveal-animation fix.

---

## The one mental model to hold in your head

React has exactly two rules that explain almost everything:

1. **Data flows DOWN** (parent → child, through *props*).
2. **A component re-renders when its *state* or *props* change** — and "re-render" just means
   *React calls your function again and compares the result to what's on screen*.

You never "update the DOM" by hand. You change state; React re-runs the component and updates the
screen to match. Everything else is detail.

There's also a split that trips up every beginner, and which our Events page shows on one screen:

- **Server Components** run once, on the server, to produce HTML. They can `await` data. No interactivity.
- **Client Components** (`"use client"`) run in the browser. They can use `useState`/`useEffect`, respond to clicks, and re-render.

---

## Part 1 — Server vs Client components

**Open:** [app/events/page.tsx](app/events/page.tsx) (server) and [components/EventsView.tsx](components/EventsView.tsx) (client)

The Events page is a **server component**. Notice:
- It's `async` and does `await getCalendarEvents(...)` — only server components can `await` data like this.
- It has **no** `useState`, no `onClick`. It just produces HTML.
- Its whole job: fetch the month's events on the server, then hand them to a client component.

```tsx
export default async function EventsPage({ searchParams }) {
  const events = await getCalendarEvents(year, month); // runs on the SERVER
  return <EventsView events={events} year={year} month={month} ... />;
}
```

`EventsView` is a **client component** — its very first line is `"use client"`. That line is the
switch: it means "ship this to the browser so it can be interactive." Only client components may
use hooks (`useState`, `useEffect`, …) or handle events (`onClick`, `onChange`).

**Why split it?** The server does the heavy, data-touching work *once*; the browser only gets the
small interactive shell. This is also why the browser never calls a data API directly (a security
requirement for this project).

> 🔑 **Rule of thumb:** start every component as a server component. Add `"use client"` *only* when
> you need state, effects, or event handlers.

---

## Part 2 — Props: passing data down

**Open:** [app/events/page.tsx](app/events/page.tsx) → look at `<EventsView ... />`

Props are just the "arguments" you pass to a component. The parent passes them:

```tsx
<EventsView events={events} year={year} month={month} monthLabel={`${MONTH_NAMES[month-1]} ${year}`} todayDay={todayDay} />
```

The child receives them by destructuring its single argument:

```tsx
export default function EventsView({ events, year, month, monthLabel, todayDay }: {
  events: CalEvent[]; year: number; month: number; monthLabel: string; todayDay: number | null;
}) { ... }
```

The `{ ... }: { ... }` looks busy but it's two things: the **left** `{ }` destructures the props,
the **right** `{ }` is the **TypeScript type** describing them. Props are **read-only** — a child
never modifies its props; it asks the parent to change them (see Part 7).

---

## Part 3 — `useState`: a component's memory

**Open:** [components/EventsView.tsx](components/EventsView.tsx), top of the function

```tsx
const [type, setType] = useState<IssueType | "all">("all");
const [mission, setMission] = useState("all");
const [query, setQuery] = useState("");
```

`useState(initial)` returns a **pair**: the current value, and a function to change it. The names
are yours by convention (`x` / `setX`).

The crucial part: **calling `setType("acquisition")` doesn't just change a variable — it tells
React "re-render this component."** React runs `EventsView` again, `type` is now `"acquisition"`,
and the UI reflects it. That's the whole loop:

```
user clicks a chip  →  setType(...)  →  React re-renders EventsView  →  new UI
```

If you changed a plain `let` variable instead of using state, the screen would **not** update —
React wouldn't know anything happened.

---

## Part 4 — Event handlers & controlled inputs

**Open:** [components/AvailabilityView.tsx](components/AvailabilityView.tsx), the `<select>` and `<input>`

```tsx
<select className="select" value={mission} onChange={(e) => { setMission(e.target.value); setSat("all"); }}>
```

Two ideas here:

- **`onChange` / `onClick`** are how you respond to the user. They take a function React calls when
  the event happens.
- **"Controlled" input:** `value={mission}` means *React state is the source of truth*, not the DOM.
  The box shows whatever `mission` is; when the user types/picks, `onChange` updates the state, which
  re-renders and shows the new value. The data flows in a single loop, so the input can never drift
  out of sync with your state.

The search box is the same idea:

```tsx
<input value={query} onChange={(e) => setQuery(e.target.value)} />
```

---

## Part 5 — Rendering lists with `.map()` and the `key`

**Open:** [components/AvailabilityView.tsx](components/AvailabilityView.tsx), the datatake list

```tsx
{filtered.map((dt) => (
  <div className="dtk-row" key={dt.id}>
    <div className="dtk-id">{dt.id}<span className="dtk-sub">{dt.sat} · {dt.time}</span></div>
    ...
  </div>
))}
```

To render a list you `.map()` an array to an array of elements. The **`key`** is required and must
be **stable and unique per item** (here, the datatake id). React uses keys to tell items apart
between re-renders, so when the list changes it moves/updates the right rows instead of rebuilding
everything. Never use the array index as a key if the list can reorder or filter — a stable id is
better.

---

## Part 6 — Derived state & `useMemo` (the big lesson)

**Open:** [components/EventsView.tsx](components/EventsView.tsx), the `filtered` computation

The single most important habit we practiced: **don't store what you can compute.**

We did **not** create a `filteredEvents` state variable that we manually keep in sync. Instead there
is one source of truth (`events` from the server) plus the filter values, and the visible list is
*derived* from them on every render:

```tsx
const filtered = useMemo(
  () => events.filter(e =>
    (type === "all" || e.type === type) && matchesMission(e, mission) && matchesSearch(e, query)
  ),
  [events, type, mission, query],
);
```

Because `filtered` is recomputed from current state each render, it **cannot** fall out of sync.
There's no "update the calendar" step — you change a filter, the component re-renders, `filtered`
is naturally recomputed, and the calendar (which receives `filtered`) shows the new list.

`useMemo(fn, deps)` is just an optimization: it caches the result and only re-runs `fn` when
something in `deps` (`[events, type, mission, query]`) actually changes. You could delete the
`useMemo` wrapper and the app would still be correct — just slightly less efficient.

> 🔑 **State should be minimal.** Ask "can I compute this from what I already have?" If yes, compute
> it — don't add another `useState`.

---

## Part 7 — Lifting state up

**Open:** [components/EventsView.tsx](components/EventsView.tsx) as a whole

The filter bar and the calendar are **siblings** but must share the filter values. React's answer:
put the shared state in their **closest common parent**. That's why `EventsView` exists — it holds
`type/mission/query`, the controls *write* them, and the calendar *reads* the result:

```tsx
// EventsView owns the state
const [type, setType] = useState(...);
// controls write it
<span onClick={() => setType(c.key)}>...</span>
// calendar reads the derived result
<EventsCalendar events={filtered} ... />
```

This is also why, on the Availability page, the donuts ended up *inside*
[AvailabilityView](components/AvailabilityView.tsx): the filter bar (above) and the datatake list
(below) share state, so one component has to contain both — and the donuts sit between them.

> 🔑 If two components need the same state, move that state to whoever contains both.

---

## Part 8 — Conditional rendering

**Open:** [components/ProcessorsView.tsx](components/ProcessorsView.tsx)

You render different things based on state using ordinary JS expressions inside `{ }`:

```tsx
{filtered.length > 0
  ? <ProcessorTimeline key={mission} rows={filtered} />
  : <div className="panel">No processor releases match the current filters.</div>}
```

We *needed* this one: `ProcessorTimeline` picks a default selected release with `all[0]`, which
would crash if `all` were empty. So we only render it when there's something to show. Common forms:
`cond ? a : b` (either/or) and `cond && <X/>` (show X or nothing).

---

## Part 9 — `useEffect`, cleanup, and the dependency bug we fixed

**Open:** [components/RevealInit.tsx](components/RevealInit.tsx)

`useEffect` runs **side effects** — things outside React's render, like observers, timers, or
subscriptions. Our reveal-on-scroll uses browser observers:

```tsx
useEffect(() => {
  const io = new IntersectionObserver(...);   // set up
  const scan = () => document.querySelectorAll(".reveal:not(.in)").forEach(el => io.observe(el));
  scan();
  const mo = new MutationObserver(scan);
  mo.observe(document.body, { childList: true, subtree: true });

  return () => { io.disconnect(); mo.disconnect(); };  // CLEANUP
}, []);                                                  // dependency array
```

Three things to learn here:

1. **The cleanup function** (the returned `() => { ... }`) runs when the component unmounts (or
   before the effect re-runs). Always tear down observers/timers here, or they leak.
2. **The dependency array `[]`** controls *when* the effect re-runs. `[]` = "run once on mount."
   `[path]` = "re-run whenever `path` changes."
3. **This is exactly where the calendar bug lived.** The old code used `[path]` from
   `usePathname()`. But changing the month only changes the URL's **query string** (`?month=5`),
   not the **path** (`/events`) — so the effect never re-ran, the freshly-rendered calendar never
   got its `.in` class, and it stayed invisible (`opacity: 0`). The fix was to stop depending on the
   path and instead watch the DOM itself with a `MutationObserver`, so *any* new content reveals.

> 🔑 The dependency array is a promise to React: "re-run this effect only when these values change."
> Get it wrong and effects either go stale (miss updates) or run too often.

---

## Part 10 — Two kinds of state: client vs URL/server

**Open:** [app/events/page.tsx](app/events/page.tsx) (reads the URL) + [components/EventsView.tsx](components/EventsView.tsx) (`goTo`)

This is the subtlest and most valuable idea we covered. The Events page has **both** kinds at once:

| | **Month** (‹ ›) | **Chips / Mission / Search** |
|---|---|---|
| Lives in | the **URL** (`?year=&month=`) | component **`useState`** |
| Owned by | the **server** | the **client** |
| Changing it | **refetches** on the server | **recomputes** in the browser |
| Survives refresh / shareable | ✅ yes | ❌ resets |
| Right for | *which data to load* | *how to view data you already have* |

The month is in the URL. The server component reads it from `searchParams` and refetches:

```tsx
export default async function EventsPage({ searchParams }) {
  const month = toInt(searchParams.month, 6, 1, 12);
  const events = await getCalendarEvents(year, month);
```

And a client component changes the URL with the router:

```tsx
const router = useRouter();
const goTo = (y, m) => router.push(`/events?year=${y}&month=${m}`);
// <button onClick={() => goTo(prev.y, prev.m)}>‹</button>
```

`router.push(newURL)` → Next.js re-runs the **server** component with the new `searchParams` →
fresh HTML. Contrast with the chip filters, which never touch the server — they just recompute
`filtered` in the browser.

> 🔑 **If it decides *what to fetch*, put it in the URL. If it only *re-views* data already in the
> browser, use `useState`.**

---

## Part 11 — The `key` prop as a "remount" tool

**Open:** [app/events/page.tsx](app/events/page.tsx) (`key={...}` on EventsView) and [components/ProcessorsView.tsx](components/ProcessorsView.tsx) (`key={mission}`)

You've seen `key` for lists (Part 5). It has a second superpower: **changing a component's `key`
makes React throw the old instance away and mount a fresh one** — which resets all its `useState`.

```tsx
<EventsView key={`${year}-${month}`} ... />
```

Without this, navigating June → May would *keep* your active chip filter and selected day, because
React reuses the same `EventsView` instance across a same-route navigation. Changing the key says
"this is a different thing now" → remount → filters and selected day reset cleanly. We used the
same trick with `key={mission}` on the processor timeline so its selected release resets when you
switch missions.

---

## Part 12 — Putting the re-render loop together

Trace what happens when you type in the Availability search box:

1. You press a key → the `<input onChange>` fires → `setQuery("S1")`.
2. `setQuery` marks `AvailabilityView` as needing a re-render.
3. React calls `AvailabilityView()` again. `query` is now `"S1"`.
4. `filtered` (a `useMemo`) sees `query` changed → recomputes the list.
5. The `.map()` renders the new rows; the "Showing N of M" line updates.
6. React diffs the result against the screen and updates only what changed.

You wrote **none** of steps 2–6 by hand. You changed one piece of state; React did the rest. That's
the entire framework in a sentence.

---

## Hooks we actually used (mini-reference)

| Hook | What it's for | Where in our code |
|---|---|---|
| `useState` | remember a value; changing it re-renders | every `*View` component |
| `useMemo` | cache a computed value; recompute only when deps change | `filtered` lists |
| `useEffect` | side effects + cleanup (observers, timers) | [RevealInit.tsx](components/RevealInit.tsx) |
| `useRouter` | navigate / change the URL from a client component | [EventsView.tsx](components/EventsView.tsx) month arrows |

(There's also `searchParams`, which isn't a hook — it's a **prop** Next.js passes to server pages.)

---

## Exercises (do these to make it stick)

Ordered easiest → hardest. Try each, then reload the page to see the effect.

1. **Props:** In [AvailabilityView](components/AvailabilityView.tsx), change the "Showing N of M"
   text to also print the current mission, e.g. `Showing 3 of 6 datatakes · Sentinel-2`.
   *(You already have `mission` in state.)*
2. **New state:** Add a "Show only incomplete" checkbox to Availability that, when checked, hides
   datatakes whose `pct` is `"100%"`. (Hint: one new `useState(false)`, one more condition in the
   `filtered` filter.)
3. **Derived, not stored:** Convince yourself Part 6 is real — add a `console.log(filtered.length)`
   right after the `useMemo` in EventsView, open the browser devtools console, and watch it recompute
   as you type.
4. **URL state:** Make the Processors **Mission** selector live in the URL (`/processors?mission=2`)
   like the Events month, instead of `useState`. You'll read it in the server page from
   `searchParams` and pass it down. (This is the Part 10 pattern applied again.)
5. **Effect deps:** Temporarily change `RevealInit`'s effect back to depending on `usePathname()`
   and reproduce the disappearing-calendar bug — then revert. Understanding a bug by re-creating it
   is the best way to remember the fix.

---

## Where each concept lives (quick index)

- Server component / data fetching → [app/events/page.tsx](app/events/page.tsx), [lib/data.ts](lib/data.ts)
- Client component + `useState` + events → [components/EventsView.tsx](components/EventsView.tsx), [components/AvailabilityView.tsx](components/AvailabilityView.tsx), [components/ProcessorsView.tsx](components/ProcessorsView.tsx)
- Derived state / `useMemo` → any `*View.tsx` (`filtered`)
- Lists + keys → [components/AvailabilityView.tsx](components/AvailabilityView.tsx)
- Conditional rendering → [components/ProcessorsView.tsx](components/ProcessorsView.tsx)
- `useEffect` + cleanup → [components/RevealInit.tsx](components/RevealInit.tsx)
- URL/server state + `useRouter` → [app/events/page.tsx](app/events/page.tsx) + [components/EventsView.tsx](components/EventsView.tsx)
- `key` to remount → [app/events/page.tsx](app/events/page.tsx), [components/ProcessorsView.tsx](components/ProcessorsView.tsx)
- Grid computed from props → [components/EventsCalendar.tsx](components/EventsCalendar.tsx)
</content>
