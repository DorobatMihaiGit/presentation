import { describe, expect, it } from "vitest";
import {
  coverViewOffset,
  orientationOf,
  REFERENCE_SIZE,
} from "@/experience/director/framing";

describe("orientationOf", () => {
  it("matches the CSS (orientation: portrait) rule, square included", () => {
    expect(orientationOf(1440, 900)).toBe("landscape");
    expect(orientationOf(390, 844)).toBe("portrait");
    expect(orientationOf(800, 800)).toBe("portrait");
  });
});

describe("coverViewOffset", () => {
  const wide = REFERENCE_SIZE.landscape.width / REFERENCE_SIZE.landscape.height;

  it("is the identity at the reference aspect", () => {
    expect(coverViewOffset(1920, 1080, wide)).toEqual({
      fullWidth: 1920,
      fullHeight: 1080,
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    });
  });

  it("crops the sides of a narrower viewport, like object-fit: cover", () => {
    const view = coverViewOffset(1440, 1080, wide);

    expect(view.fullHeight).toBe(1080);
    expect(view.fullWidth).toBeCloseTo(1920);
    expect(view.x).toBeCloseTo(240);
    expect(view.y).toBe(0);
  });

  it("crops top and bottom of a wider viewport", () => {
    const view = coverViewOffset(2560, 1080, wide);

    expect(view.fullWidth).toBe(2560);
    expect(view.fullHeight).toBeCloseTo(1440);
    expect(view.y).toBeCloseTo(180);
    expect(view.x).toBe(0);
  });
});
