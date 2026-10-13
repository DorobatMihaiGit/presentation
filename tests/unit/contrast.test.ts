import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  luminance,
  parseRgb,
  worstBackground,
} from "@/lib/contrast";

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBe(1);
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    // #767676 on white is the classic 4.54:1 grey.
    expect(contrastRatio([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(
      4.54,
      2,
    );
  });

  it("passes the site's muted ink on its canvas", () => {
    expect(
      contrastRatio([0xa9, 0xaf, 0xba], [0x0b, 0x0c, 0x0f]),
    ).toBeGreaterThan(4.5);
  });

  it("parses computed colours", () => {
    expect(parseRgb("rgb(236, 238, 242)")).toEqual([236, 238, 242]);
    expect(parseRgb("rgba(169, 175, 186, 0.9)")).toEqual([169, 175, 186]);
    expect(() => parseRgb("transparent")).toThrow();
  });

  it("ranks background pixels by the contrast they leave", () => {
    const dark = [11, 12, 15];
    const light = [200, 200, 200];
    // 99 dark pixels and one light one: the light outlier is ignored at the
    // 95th percentile, decisive at the 100th.
    const pixels = new Uint8Array([
      ...Array.from({ length: 99 }, () => dark).flat(),
      ...light,
    ]);
    const text: [number, number, number] = [236, 238, 242];
    expect(worstBackground(pixels, 3, text).colour).toEqual(dark);
    expect(worstBackground(pixels, 3, text, 1).colour).toEqual(light);
  });
});
