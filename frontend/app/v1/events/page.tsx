import EventsView from "@/components/EventsView";
import { getCalendarEvents } from "@/lib/data";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toInt(v: string | undefined, def: number, lo: number, hi: number): number {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= lo && n <= hi ? n : def;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { year?: string; month?: string };
}) {
  // The selected month lives in the URL (?year=&month=) — so it is bookmarkable,
  // shareable, and refetched ON THE SERVER, unlike the client-only chip/search filters.
  const year = toInt(searchParams.year, 2026, 2000, 2100);
  const month = toInt(searchParams.month, 6, 1, 12); // 1–12; default June 2026 (matches the demo data)
  const events = await getCalendarEvents(year, month); // re-runs on the server for each month

  // Highlight "today" only when the displayed month is the real current month.
  const now = new Date();
  const todayDay = year === now.getFullYear() && month === now.getMonth() + 1 ? now.getDate() : null;

  return (
    <>
      <div className="page-head"><div className="wrap">
        <nav className="crumbs" aria-label="Breadcrumb">
          <a href="/v1"><svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" /></svg> Home</a>
          <span className="sep">/</span><span className="cur">Events</span>
        </nav>
        <h1>Events</h1>
        <p>This view shows the events occurred on a given date and the possible impact on user products completeness. Events are categorized according to their issue type.</p>
      </div></div>

      <section className="wrap pad">
        {/* key remounts EventsView on month change → filters + selected day reset cleanly */}
        <EventsView
          key={`${year}-${month}`}
          events={events}
          year={year}
          month={month}
          monthLabel={`${MONTH_NAMES[month - 1]} ${year}`}
          todayDay={todayDay}
        />
      </section>
    </>
  );
}
