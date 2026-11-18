/**
 * Returns true when a FLIP animation should be skipped because one of the
 * rects is from a hidden element (getBoundingClientRect returns all zeros
 * when the element has display:none).
 */
export function shouldSkipFlip(from: DOMRect, to: DOMRect): boolean {
  return (
    (from.width === 0 && from.height === 0) ||
    (to.width === 0 && to.height === 0)
  );
}
