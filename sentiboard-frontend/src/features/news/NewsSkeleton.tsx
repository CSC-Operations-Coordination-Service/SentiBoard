/* Loading skeleton for the news page — renders 10 placeholder cards using real NewsCard classes
   so placeholders are as tall as real closed cards. No fixed heights; no new Date(). */

import s from "@/features/events/events.module.css";
import c from "./news-card.module.css";
import ns from "./news.module.css";

export default function NewsSkeleton() {
  return (
    <div role="status" className={s.skRoot}>
      <span className="sr-only">Loading news…</span>
      <div className={s.inner}>
        <div className={ns.content}>
          <div className={ns.cardList}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className={c.card} data-layout="page">
                {/* .head padding gives the placeholder its natural card-row height */}
                <div className={`${c.head} ${s.skPulse}`} aria-hidden="true">
                  <span className={c.title}>&nbsp;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
