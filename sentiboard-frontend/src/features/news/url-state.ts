/* News page URL state — page parameter only. Pure functions; no browser deps. */

export const NEWS_PAGE_SIZE = 10;

/** Parses the raw ?page= search parameter. Returns 1 for any invalid value. */
export function parsePage(raw: string | string[] | undefined): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  if (!str) return 1;
  const n = Number(str);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

/** Total page count for a list of `total` items. Always at least 1. */
export function pageCount(total: number): number {
  return Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
}

/** Clamps `page` to [1, pageCount(total)]. */
export function clampPage(page: number, total: number): number {
  return Math.max(1, Math.min(page, pageCount(total)));
}

/** Returns the slice of `items` for the given page (1-based). Page is clamped. */
export function slicePage<T>(items: T[], page: number): T[] {
  const p = clampPage(page, items.length);
  const start = (p - 1) * NEWS_PAGE_SIZE;
  return items.slice(start, start + NEWS_PAGE_SIZE);
}
