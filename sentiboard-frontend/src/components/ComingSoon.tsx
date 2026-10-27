/* Placeholder for a page that is not ported yet, and the 404 page. Same frame as the prototype's
   NotFoundPage (src/pages/Simple.tsx), without its scroll-reveal animation. */

import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "./PageHeader";
import { ROUTES, type PageRoute } from "@/lib/routes";

/** Placeholders are kept out of search results (and out of the sitemap). */
export function comingSoonMetadata(route: PageRoute): Metadata {
  return {
    title: `${route.title} — SentiBoard`,
    robots: { index: false, follow: true },
  };
}

export function MessagePage({
  crumb,
  title,
  big,
  text,
}: {
  crumb: string;
  title: string;
  big: string;
  text: string;
}) {
  return (
    <>
      <PageHeader crumb={crumb} title={title} />
      <section className="wrap pad">
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <div className="stat" style={{ alignItems: "center" }}>
            <span className="v" style={{ fontSize: 72 }}>
              {big}
            </span>
          </div>
          <p style={{ color: "var(--text-dim)" }}>{text}</p>
          <Link
            className="btn primary"
            href={ROUTES.processors.path}
            style={{ marginTop: 16 }}
          >
            Go to Processors <span className="arrow">→</span>
          </Link>
        </div>
      </section>
    </>
  );
}

export default function ComingSoon({ route }: { route: PageRoute }) {
  return (
    <MessagePage
      crumb={route.title}
      title={route.title}
      big="Soon"
      text="This page will be available here soon."
    />
  );
}
