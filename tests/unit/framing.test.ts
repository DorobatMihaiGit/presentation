import { describe, expect, it } from "vitest";
import {
  CROP_ANCHOR,
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

  it("can keep the right edge instead, like object-position: right", () => {
    // Landscape shots put the stack right of the copy: a 16:10 or 3:2
    // laptop loses the empty left of the frame, never the stack.
    const view = coverViewOffset(1440, 1080, wide, "right");

    expect(view.x).toBeCloseTo(480);
    expect(view.x + view.width).toBeCloseTo(view.fullWidth);
    expect(coverViewOffset(2560, 1080, wide, "right").y).toBeCloseTo(180);
  });

  it("can keep the bottom edge, like object-position: bottom", () => {
    // Portrait shots put the stack below the copy: a tablet (3:4) loses
    // the top of the frame, behind the copy, never the stack.
    const tall = REFERENCE_SIZE.portrait.width / REFERENCE_SIZE.portrait.height;
    const view = coverViewOffset(768, 1024, tall, "bottom");

    expect(view.y + view.height).toBeCloseTo(view.fullHeight);
    expect(view.y).toBeGreaterThan(0);
    expect(coverViewOffset(360, 800, tall, "bottom").y).toBe(0);
    expect(CROP_ANCHOR).toEqual({ landscape: "right", portrait: "bottom" });
  });

  it("crops top and bottom of a wider viewport", () => {
    const view = coverViewOffset(2560, 1080, wide);

    expect(view.fullWidth).toBe(2560);
    expect(view.fullHeight).toBeCloseTo(1440);
    expect(view.y).toBeCloseTo(180);
    expect(view.x).toBe(0);
  });
});
