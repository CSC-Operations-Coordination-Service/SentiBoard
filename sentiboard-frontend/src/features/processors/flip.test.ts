import { describe, expect, it } from "vitest";
import { shouldSkipFlip } from "./flip";

const rect = (w: number, h: number): DOMRect =>
  ({
    width: w,
    height: h,
    left: 10,
    top: 20,
    right: 10 + w,
    bottom: 20 + h,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  }) as DOMRect;

describe("shouldSkipFlip", () => {
  it("returns true when 'from' is a zero rect (element was hidden)", () => {
    expect(shouldSkipFlip(rect(0, 0), rect(400, 600))).toBe(true);
  });

  it("returns true when 'to' is a zero rect (element just became hidden)", () => {
    expect(shouldSkipFlip(rect(400, 600), rect(0, 0))).toBe(true);
  });

  it("returns true when both rects are zero", () => {
    expect(shouldSkipFlip(rect(0, 0), rect(0, 0))).toBe(true);
  });

  it("returns false when both rects have non-zero dimensions", () => {
    expect(shouldSkipFlip(rect(400, 600), rect(600, 400))).toBe(false);
  });

  it("returns false when width is zero but height is not (narrow-but-visible element)", () => {
    expect(shouldSkipFlip(rect(0, 100), rect(400, 600))).toBe(false);
  });

  it("returns false when height is zero but width is not", () => {
    expect(shouldSkipFlip(rect(400, 0), rect(400, 600))).toBe(false);
  });
});
