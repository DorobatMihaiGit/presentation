import { describe, expect, it } from "vitest";
import {
  contactShadow,
  PAGE_CANVAS,
  SHADOW_PLANE,
  studioBackground,
} from "@/experience/scenes/studio";

// three r186's AgXToneMapping (tonemapping_pars_fragment.glsl.js), which the
// tier 2+ post chain applies to every pixel, the studio background included.
// GLSL mat3(a, b, c) takes columns: out[row] = a[row]*v0 + b[row]*v1 + c[row]*v2.
type Mat3 = readonly (readonly [number, number, number])[];
const mul = (m: Mat3, v: number[]) =>
  [0, 1, 2].map(
    (row) => m[0][row] * v[0] + m[1][row] * v[1] + m[2][row] * v[2],
  );
const SRGB_TO_REC2020: Mat3 = [
  [0.6274, 0.0691, 0.0164],
  [0.3293, 0.9195, 0.088],
  [0.0433, 0.0113, 0.8956],
];
const REC2020_TO_SRGB: Mat3 = [
  [1.6605, -0.1246, -0.0182],
  [-0.5876, 1.1329, -0.1006],
  [-0.0728, -0.0083, 1.1187],
];
const INSET: Mat3 = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
];
const OUTSET: Mat3 = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
];
const MIN_EV = -12.47393;
const MAX_EV = 4.026069;
const sigmoid = (x: number) => {
  const x2 = x * x;
  const x4 = x2 * x2;
  return (
    15.5 * x4 * x2 -
    40.14 * x4 * x +
    31.96 * x4 -
    6.868 * x2 * x +
    0.4298 * x2 +
    0.1191 * x -
    0.00232
  );
};
function agx(linear: number[]): number[] {
  let c = mul(INSET, mul(SRGB_TO_REC2020, linear));
  c = c.map((v) =>
    Math.min(
      1,
      Math.max(0, (Math.log2(Math.max(v, 1e-10)) - MIN_EV) / (MAX_EV - MIN_EV)),
    ),
  );
  c = mul(OUTSET, c.map(sigmoid)).map((v) => Math.max(0, v) ** 2.2);
  return mul(REC2020_TO_SRGB, c).map((v) => Math.min(1, Math.max(0, v)));
}
const toSrgb8 = (linear: number) =>
  Math.round(
    (linear <= 0.0031308
      ? linear * 12.92
      : 1.055 * linear ** (1 / 2.4) - 0.055) * 255,
  );
const hex8 = (hex: string) =>
  [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));

describe("studioBackground", () => {
  it("lands on the page colour after the post chain's AgX (tier 2 and 3)", () => {
    // M6 cleared to the page colour itself, which AgX darkened to #030305:
    // a visible seam wherever the page and the stage met.
    for (const tier of [2, 3] as const) {
      const { r, g, b } = studioBackground(tier);
      const shown = agx([r, g, b]).map(toSrgb8);
      hex8(PAGE_CANVAS).forEach((channel, index) => {
        expect(Math.abs(shown[index] - channel)).toBeLessThanOrEqual(1);
      });
    }
  });

  it("is the page colour itself at tier 1 (no post chain, clears are not tone mapped)", () => {
    expect(`#${studioBackground(1).getHexString()}`).toBe(PAGE_CANVAS);
  });

  it("the port above matches what M6 measured on screen", () => {
    const page = hex8(PAGE_CANVAS).map((channel) => {
      const s = channel / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    expect(agx(page).map(toSrgb8)).toEqual([0x03, 0x03, 0x05]);
  });
});

describe("contactShadow", () => {
  it("is darkest under the footprint and gone 15 cm beyond it", () => {
    expect(contactShadow(0, 0)).toBe(1);
    expect(contactShadow(0.2, 0)).toBeGreaterThan(0.5);
    expect(contactShadow(0.26, 0)).toBeGreaterThan(0);
    expect(contactShadow(0.35, 0)).toBe(0);
    expect(contactShadow(0.3, 0.3)).toBe(0);
  });

  it("is exactly 0 all along the plane's border (no outline on the floor)", () => {
    const edge = SHADOW_PLANE / 2;
    for (let step = -10; step <= 10; step += 1) {
      const along = (step / 10) * edge;
      expect(contactShadow(edge, along)).toBe(0);
      expect(contactShadow(along, -edge)).toBe(0);
    }
  });
});
