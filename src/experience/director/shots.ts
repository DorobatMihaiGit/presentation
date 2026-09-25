import type { Orientation } from "./framing";

export type Vec3 = readonly [number, number, number];

export type CameraKey = {
  /** Shot progress (0..1) at which the camera passes this key. */
  at: number;
  position: Vec3;
  target: Vec3;
};

/** Vertical field of view per reference frame (a long product lens). */
export const SHOT_FOV: Record<Orientation, number> = {
  landscape: 30,
  portrait: 42,
};

export const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** 0 below `from`, 1 above `to`, smooth in between. */
export function smoothstep(from: number, to: number, value: number): number {
  const t = clamp01((value - from) / (to - from));
  return t * t * (3 - 2 * t);
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (3 * p1 - p0 - 3 * p2 + p3) * t2 * t)
  );
}

function spline(points: readonly Vec3[], index: number, t: number): Vec3 {
  const p0 = points[Math.max(0, index - 1)];
  const p1 = points[index];
  const p2 = points[Math.min(points.length - 1, index + 1)];
  const p3 = points[Math.min(points.length - 1, index + 2)];
  return [
    catmullRom(p0[0], p1[0], p2[0], p3[0], t),
    catmullRom(p0[1], p1[1], p2[1], p3[1], t),
    catmullRom(p0[2], p1[2], p2[2], p3[2], t),
  ];
}

/**
 * Camera position and target at `progress`: a Catmull-Rom spline through the
 * keys (the camera never stops at a key), clamped to the first and last key.
 */
export function sampleCameraKeys(
  keys: readonly CameraKey[],
  progress: number,
): { position: Vec3; target: Vec3 } {
  const p = Math.min(keys[keys.length - 1].at, Math.max(keys[0].at, progress));
  let index = 0;
  while (index < keys.length - 2 && p > keys[index + 1].at) {
    index += 1;
  }
  const from = keys[index];
  const to = keys[Math.min(keys.length - 1, index + 1)];
  const span = to.at - from.at;
  const t = span > 0 ? clamp01((p - from.at) / span) : 0;
  return {
    position: spline(
      keys.map((key) => key.position),
      index,
      t,
    ),
    target: spline(
      keys.map((key) => key.target),
      index,
      t,
    ),
  };
}

/**
 * Shot S1 (hero), metres, stack centred on the origin (asset contract):
 * macro dolly along the anodized base plate, up the front faces, over the
 * glass top where a softbox sweep reveals `engrave_hero`, then a pull-back to
 * the whole monolith. Landscape keeps the monolith right of the copy; portrait
 * keeps it in the lower half.
 */
export const HERO_KEYS: Record<Orientation, readonly CameraKey[]> = {
  landscape: [
    { at: 0, position: [0.34, 0.03, 0.34], target: [0.06, 0.022, 0.19] },
    { at: 0.28, position: [0.02, 0.12, 0.42], target: [-0.02, 0.1, 0.19] },
    { at: 0.55, position: [-0.05, 0.52, 0.3], target: [-0.07, 0.25, 0.02] },
    { at: 1, position: [0.6, 0.5, 1.1], target: [-0.34, 0.12, 0] },
  ],
  portrait: [
    { at: 0, position: [0.3, 0.035, 0.42], target: [0.04, 0.03, 0.19] },
    { at: 0.28, position: [0.02, 0.13, 0.52], target: [0, 0.12, 0.19] },
    { at: 0.55, position: [0, 0.62, 0.36], target: [0, 0.25, 0.04] },
    { at: 1, position: [0.72, 0.78, 1.72], target: [0, 0.2, 0] },
  ],
};

export type HeroFrame = {
  position: Vec3;
  target: Vec3;
  /** Environment yaw in radians: moves the softbox reflections (the sweep). */
  envRotation: number;
  /** Visibility of the `engrave_hero` etching, 0..1. */
  engrave: number;
  /** Extra glow while the sweep passes over the etching, 0..1. */
  glint: number;
};

export function heroFrame(
  progress: number,
  orientation: Orientation,
): HeroFrame {
  const p = clamp01(progress);
  const { position, target } = sampleCameraKeys(HERO_KEYS[orientation], p);
  const sweep = smoothstep(0.3, 0.7, p);
  const glint = Math.max(0, 1 - Math.abs(p - 0.5) / 0.12);
  return {
    position,
    target,
    envRotation: -0.9 + sweep * 1.8,
    engrave: smoothstep(0.38, 0.52, p),
    glint: glint * glint * (3 - 2 * glint),
  };
}
