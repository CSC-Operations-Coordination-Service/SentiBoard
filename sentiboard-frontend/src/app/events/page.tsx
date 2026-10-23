import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import PageHeader from "@/components/PageHeader";
import { SITE_NAME, ROUTES } from "@/lib/routes";
import s from "@/features/events/events.module.css";
import Explorer, { type ExplorerData } from "@/features/events/Explorer";
import { getEvents } from "@/features/events/data";
import { toEventCard } from "@/features/events/adapter";
import { nowYM, parseView, resolveView, filterEvents } from "@/features/events/url-state";
import {
  EVENTS_HERO_IMG,
  EVENTS_SUBTITLE,
  EVENTS_TITLE,
  EventsDescription,
  SEO,
} from "@/features/events/copy";

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  keywords: SEO.keywords,
  alternates: { canonical: ROUTES.events.path },
  openGraph: {
    siteName: SITE_NAME,
    title: SEO.title,
    description: SEO.description,
    type: "website",
    url: ROUTES.events.path,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    site: "@sentinelonline_",
    creator: "@sentinelonline_",
    title: SEO.title,
    description: SEO.description,
  },
};

/* Block streaming so the calendar renders as a complete HTML document (docs/memory/DECISIONS.md). */
export const instant = false;

async function EventsContent({
  searchParams,
}: {
  searchParams: PageProps<"/events">["searchParams"];
}) {
  // Opting into dynamic rendering: searchParams is dynamic; connection() makes the boundary
  // explicit so the static shell (PageHeader, EventsDescription) can be prerendered separately.
  await connection();
  const params = await searchParams;
  const now = nowYM();
  const result = await getEvents();

  if (!result.ok) {
    const data: ExplorerData = {
      ok: false,
      unreachable: result.kind === "unreachable",
      message: result.message,
      now,
    };
    return <Explorer data={data} />;
  }

  const cards = result.events.map(toEventCard);
  const view = resolveView(parseView(params, now), cards);
  const selectedEvent =
    view.event != null ? (result.events.find((e) => e.id === view.event) ?? null) : null;
  // Build dayEvents from the same filterEvents(cards, view) the cell uses — not from result.events
  // directly — so active mission/satellite/category/q filters are respected in the drawer too.
  const monthCards = selectedEvent ? filterEvents(cards, view) : [];
  const dayEventIds = new Set(
    monthCards.filter((c) => c.startDate === selectedEvent?.startDate).map((c) => c.id),
  );
  const dayEvents = result.events
    .filter((e) => dayEventIds.has(e.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <Explorer
      data={{
        ok: true,
        cards,
        dayEvents,
        selectedEventId: selectedEvent?.id ?? null,
        now,
      }}
    />
  );
}

export default function EventsPage(props: PageProps<"/events">) {
  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title={EVENTS_TITLE}
          subtitle={EVENTS_SUBTITLE}
          img={EVENTS_HERO_IMG}
          desc={<EventsDescription />}
        />
      </div>
      <noscript>
        <p style={{ textAlign: "center", padding: "40px 20px", color: "var(--mf-muted, #888)", fontFamily: "var(--font-sans)" }}>
          The Events calendar requires JavaScript to display.
        </p>
      </noscript>
      <Suspense>
        <EventsContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
