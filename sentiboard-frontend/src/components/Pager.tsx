/* Server-rendered pager with Link elements (no client component).
   Previous/Next are hidden (not rendered) at the boundary pages rather than disabled,
   to avoid the accessible-focus problem of aria-disabled links. */

import Link from "next/link";
import s from "./pager.module.css";

interface Props {
  page: number;
  count: number;   // total page count
  basePath: string; // e.g. "/news"
  label?: string;  // aria-label for the <nav> landmark
}

export default function Pager({ page, count, basePath, label }: Props) {
  const prevHref = page === 2 ? basePath : `${basePath}?page=${page - 1}`;
  const nextHref = `${basePath}?page=${page + 1}`;

  return (
    <nav className={s.pager} aria-label={label}>
      {page > 1 && (
        <Link href={prevHref} className={s.pagerBtn}>
          ← Previous
        </Link>
      )}
      <span className={s.plabel}>Page {page} of {count}</span>
      {page < count && (
        <Link href={nextHref} className={s.pagerBtn}>
          Next →
        </Link>
      )}
    </nav>
  );
}
