/**
 * Returns a copy of `items` with `selected` moved to index 0.
 * If `selected` is not found, returns `items` unchanged.
 */
export function pinnedFirst<T>(items: readonly T[], selected: T): T[] {
  const idx = items.indexOf(selected);
  if (idx <= 0) return [...items];
  return [selected, ...items.slice(0, idx), ...items.slice(idx + 1)];
}
