import { Color, LinearSRGBColorSpace } from "three";
import type { Tier } from "../gpu-tier";

/** The page's background (globals.css --color-canvas). */
export const PAGE_CANVAS = "#0b0c0f";

/**
 * The linear colour the tier 2+ post chain's AgX tone mapping turns into
 * PAGE_CANVAS on screen (tests/unit/studio.test.ts ports AgX to check it).
 */
const TONE_MAPPED_CANVAS = [0.0072, 0.00745, 0.00879] as const;

/**
 * The studio behind the stack, so the stage meets the page without a seam:
 * tier 2+ tone-maps it in the post chain; tier 1 clears to it directly, and
 * clears are never tone mapped.
 */
export function studioBackground(tier: Tier): Color {
  return tier >= 2
    ? new Color().setRGB(...TONE_MAPPED_CANVAS, LinearSRGBColorSpace)
    : new Color(PAGE_CANVAS);
}

/** Side of the contact shadow's floor plane (m): the stack plus 0.2 m around. */
export const SHADOW_PLANE = 0.8;

/**
 * Darkness of the monolith's contact shadow at floor point (x, z), metres
 * from the stack's centre: 1 under the 0.4 m footprint, fading out over the
 * next 12 cm, exactly 0 long before the plane's border (M6 blurred a square
 * whose faint tail reached the border: a stepped outline on a lit floor).
 */
export function contactShadow(x: number, z: number): number {
  const half = 0.2 - 0.02;
  const outside =
    Math.hypot(
      Math.max(Math.abs(x) - half, 0),
      Math.max(Math.abs(z) - half, 0),
    ) - 0.02;
  const t = Math.min(1, Math.max(0, (outside + 0.01) / 0.13));
  const fade = 1 - t * t * (3 - 2 * t);
  return fade * fade;
}
