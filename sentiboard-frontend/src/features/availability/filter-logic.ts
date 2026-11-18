/** Pure filter-selection helpers for the Data Availability dropdowns. No DOM, no React. */

/** Toggle one option in an "off-set": adds it if present, removes it if absent. */
export function toggleOption<T extends string>(
  off: ReadonlySet<T>,
  item: T,
): ReadonlySet<T> {
  const next = new Set(off);
  if (next.has(item)) {
    next.delete(item);
  } else {
    next.add(item);
  }
  return next;
}

/** Select everything — returns an empty off-set. */
export function selectAll<T extends string>(): ReadonlySet<T> {
  return new Set<T>();
}

/** True when every option is on (the off-set is empty). */
export function isAllSelected<T extends string>(off: ReadonlySet<T>): boolean {
  return off.size === 0;
}

/**
 * Returns the ON option ids in `order`.
 * Returns null when every option is on (nothing to show).
 * Returns [] when every option is off.
 */
export function selectedIds<T extends string>(
  order: readonly T[],
  off: ReadonlySet<T>,
): T[] | null {
  if (off.size === 0) return null;
  return order.filter((id) => !off.has(id));
}
