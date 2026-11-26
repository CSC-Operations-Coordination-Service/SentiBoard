import { Suspense } from "react";
import { connection } from "next/server";
import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Pager from "@/components/Pager";
import SpaceBackdrop from "@/components/SpaceBackdrop";
import { ROUTES, SITE_NAME } from "@/lib/routes";
import { getAllInstantMessages } from "@/features/home/data";
import NewsCard from "@/features/news/NewsCard";
import NewsSkeleton from "@/features/news/NewsSkeleton";
import { NEWS_HERO_IMG, NEWS_SUBTITLE, NEWS_TITLE, SEO } from "@/features/news/copy";
import { clampPage, pageCount, parsePage, slicePage } from "@/features/news/url-state";
import s from "@/features/events/events.module.css";
import ns from "@/features/news/news.module.css";

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  keywords: SEO.keywords,
  alternates: { canonical: ROUTES.news.path },
  openGraph: {
    siteName: SITE_NAME,
    title: SEO.title,
    description: SEO.description,
    type: "website",
    url: ROUTES.news.path,
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

async function NewsContent({
  searchParams,
}: {
  searchParams: PageProps<"/news">["searchParams"];
}) {
  // connection() opts into dynamic rendering so searchParams is the actual request value.
  await connection();
  const params = await searchParams;
  const result = await getAllInstantMessages();

  if (!result.ok) {
    return (
      <div className={s.inner}>
        <div className={ns.content}>
          <div className={s.evErrorWrap}>
            <div className={s.evError} role="alert">
              <span aria-hidden="true" className={s.evErrorIcon}>⚠</span>
              <span>
                {result.kind === "unreachable"
                  ? "Backend unreachable — "
                  : "Could not load news — "}
                {result.message}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { items } = result;

  if (items.length === 0) {
    return (
      <div className={s.inner}>
        <div className={ns.content}>
          <p className={ns.empty}>No news available.</p>
        </div>
      </div>
    );
  }

  const page = clampPage(parsePage(params["page"]), items.length);
  const count = pageCount(items.length);
  const pageItems = slicePage(items, page);

  return (
    <div className={s.inner}>
      <div className={ns.content}>
        {count > 1 && (
          <div className={ns.pagerWrapTop}>
            <Pager page={page} count={count} basePath={ROUTES.news.path} label="News pages, top" />
          </div>
        )}
        <div className={ns.cardList}>
          {pageItems.map((item) => (
            <NewsCard key={item.id} item={item} group="news-page" pageLayout />
          ))}
        </div>
        {count > 1 && (
          <div className={ns.pagerWrap}>
            <Pager page={page} count={count} basePath={ROUTES.news.path} label="News pages, bottom" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewsPage(props: PageProps<"/news">) {
  return (
    <>
      <div className={s.headArt}>
        <PageHeader
          title={NEWS_TITLE}
          subtitle={NEWS_SUBTITLE}
          img={NEWS_HERO_IMG}
        />
      </div>
      <div className={`${s.page} ${ns.newsPageBg}`}>
        <SpaceBackdrop page={1} />
        <Suspense fallback={<NewsSkeleton />}>
          <NewsContent searchParams={props.searchParams} />
        </Suspense>
      </div>
    </>
  );
}
