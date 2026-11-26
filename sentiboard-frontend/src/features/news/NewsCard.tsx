import type { InstantMessage } from "@/features/home/adapter";
import { newsTypeToVariant, type NewsVariant } from "./news-format";
import s from "./news-card.module.css";

/* SVG paths keyed by variant.
   success → check circle  (fa-check-circle equivalent)
   info    → info circle   (fa-info-circle equivalent)
   warning → exclamation circle
   danger  → warning triangle
   unknown → neutral dash circle */
const ICON_PATH: Record<NewsVariant, string> = {
  success: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  info:    "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  warning: "M12 9v4m0 4h.01M10.3 3.3L2.1 17a1 1 0 0 0 .9 1.5h18a1 1 0 0 0 .9-1.5L13.7 3.3a1 1 0 0 0-1.4 0z",
  danger:  "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  unknown: "M20 12H4",
};

interface StatusIconProps {
  variant: NewsVariant;
}

function StatusIcon({ variant }: StatusIconProps) {
  return (
    <svg
      className={s.icon}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={ICON_PATH[variant]} />
    </svg>
  );
}

interface Props {
  item: InstantMessage;
  style?: React.CSSProperties;
  group?: string;
  /** When true: date moves from the header to the body ("Published: …"); card gets a panel look. */
  pageLayout?: boolean;
}

export default function NewsCard({ item, style, group, pageLayout }: Props) {
  const variant = newsTypeToVariant(item.messageType);

  return (
    <details
      className={s.card}
      data-variant={variant}
      data-layout={pageLayout ? "page" : undefined}
      style={style}
      name={group}
    >
      <summary className={s.head}>
        <StatusIcon variant={variant} />
        <div className={s.headText}>
          <span className={s.title}>{item.title}</span>
          {!pageLayout && <time className={s.date}>{item.headerDate}</time>}
        </div>
        <svg
          className={s.chev}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden="true"
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </summary>
      <div className={s.body}>
        <p className={s.text}>{item.text}</p>
        {item.link && (
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={s.readMore}
          >
            Read more
          </a>
        )}
        {pageLayout && (
          <p className={s.publishedLine}>Published: {item.headerDate}</p>
        )}
      </div>
    </details>
  );
}
