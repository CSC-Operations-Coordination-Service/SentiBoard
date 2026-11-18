/**
 * Returns a copy of `items` with the first item satisfying `isSelected` moved to index 0.
 * If no item satisfies the predicate, returns `items` unchanged.
 */
export function pinnedFirstBy<T>(items: readonly T[], isSelected: (t: T) => boolean): T[] {
  const idx = items.findIndex(isSelected);
  if (idx <= 0) return [...items];
  return [items[idx], ...items.slice(0, idx), ...items.slice(idx + 1)];
}

/** Returns the label of the option matching `value`, or `value` itself if not found. */
export function filterHeaderLabel<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T,
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
