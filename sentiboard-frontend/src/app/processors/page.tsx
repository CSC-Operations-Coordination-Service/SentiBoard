import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { SITE_NAME, ROUTES } from "@/lib/routes";
import s from "@/features/processors/processors.module.css";
import Explorer, { type ExplorerData } from "@/features/processors/Explorer";
import ReleaseList from "@/features/processors/ReleaseList";
import { getProcessors } from "@/features/processors/data";
import { parseView, resolveView } from "@/features/processors/url-state";
import {
  DESCRIPTION,
  PROCESSORS_HERO_IMG,
  PROCESSORS_SUBTITLE,
  PROCESSORS_TITLE,
  SEO,
} from "@/features/processors/copy";

// Every filtered or selected view (?mission=…&release=…) canonicalises to the bare page.
export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  keywords: SEO.keywords,
  alternates: { canonical: ROUTES.processors.path },
  openGraph: {
    siteName: SITE_NAME,
    title: SEO.title,
    description: SEO.description,
    type: "website",
    url: ROUTES.processors.path,
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

/* One complete HTML document, not a static shell with streamed content: a streamed Suspense
   boundary is swapped in by an inline script, so without JavaScript the visitor would be left on
   the fallback. The releases come from the 300 s cache, so blocking on them is cheap
   (docs/memory/DECISIONS.md). `instant = false` opts the route out of the static-shell check. */
export const instant = false;

/** Request-time part: reads the URL and the (cached) releases. */
async function ProcessorsContent({
  searchParams,
}: {
  searchParams: PageProps<"/processors">["searchParams"];
}) {
  const params = await searchParams;
  const result = await getProcessors();

  if (!result.ok) {
    const data: ExplorerData = {
      ok: false,
      unreachable: result.kind === "unreachable",
      message: result.message,
    };
    return <Explorer data={data} />;
  }

  const view = resolveView(parseView(params), result.groups);
  return (
    <Explorer
      data={{ ok: true, groups: result.groups, notes: result.notes, now: result.now }}
      releaseList={
        <ReleaseList
          groups={result.groups.filter((g) => g.mission === view.mission)}
          view={view}
        />
      }
    />
  );
}

export default function ProcessorsPage(props: PageProps<"/processors">) {
  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title={PROCESSORS_TITLE}
          subtitle={PROCESSORS_SUBTITLE}
          desc={DESCRIPTION}
          img={PROCESSORS_HERO_IMG}
        />
      </div>

      <ProcessorsContent searchParams={props.searchParams} />
    </>
  );
}
