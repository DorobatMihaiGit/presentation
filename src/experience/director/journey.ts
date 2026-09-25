import { STACK_LAYERS, type StackLayer } from "@/content/types";
import { PCB_TRACE_PATH, pointOnPath } from "../scenes/pcb-traces";
import { LAYER_HEIGHT, stackLayout } from "../scenes/stack-layout";
import type { Orientation } from "./framing";
import {
  type CameraKey,
  clamp01,
  HERO_KEYS,
  heroFrame,
  sampleCameraKeys,
  smoothstep,
  type Vec3,
} from "./shots";

/**
 * One continuous camera journey through the whole page (M6). The page is cut
 * into stops, in scroll order; journey time T runs from 0 to JOURNEY_END and
 * each stop owns one unit of it: T = index + progress through that stop.
 */
export const JOURNEY_STOPS = [
  "hero",
  "about",
  "skills",
  "experience",
  "projects",
  "contact",
] as const;

export type JourneyStop = (typeof JOURNEY_STOPS)[number];

export const JOURNEY_END = JOURNEY_STOPS.length;

/** Journey time of a stop at `progress` (0..1) through it, e.g. for posters. */
export function stopTime(stop: JourneyStop, progress: number): number {
  return JOURNEY_STOPS.indexOf(stop) + clamp01(progress);
}

/**
 * Journey time at a scroll position. `knots` holds the scroll offset (px)
 * where each stop starts, then the page's last scroll offset: one more knot
 * than there are stops, never decreasing. Linear between knots, so T moves
 * exactly as fast as the reader scrolls through each stop.
 */
export function journeyTime(scroll: number, knots: readonly number[]): number {
  if (scroll <= knots[0]) {
    return 0;
  }
  for (let index = 0; index < knots.length - 1; index += 1) {
    const from = knots[index];
    const to = knots[index + 1];
    if (scroll < to) {
      return index + (to > from ? (scroll - from) / (to - from) : 1);
    }
  }
  return knots.length - 1;
}

/** How a track eases into a key: "in" accelerates, so things land with a click. */
type Ease = "smooth" | "linear" | "in";

/** [journey time, value, easing of the segment that ends at this key]. */
export type TrackKey = readonly [at: number, value: number, ease?: Ease];

const EASE: Record<Ease, (t: number) => number> = {
  smooth: (t) => smoothstep(0, 1, t),
  linear: (t) => t,
  in: (t) => t * t * t,
};

/** Value of a scalar track at T; holds the first and last value outside it. */
export function sampleTrack(keys: readonly TrackKey[], t: number): number {
  if (t <= keys[0][0]) {
    return keys[0][1];
  }
  for (let index = 1; index < keys.length; index += 1) {
    const [at, value, ease = "smooth"] = keys[index];
    if (t < at) {
      const [fromAt, fromValue] = keys[index - 1];
      const amount = EASE[ease]((t - fromAt) / (at - fromAt));
      return fromValue + (value - fromValue) * amount;
    }
  }
  return keys[keys.length - 1][1];
}

/**
 * Camera path, metres, stack centred on the origin. T 0..1 is shot S1 (the
 * hero keys, unchanged). Then: About yaws the stack and lifts the glass,
 * Skills pulls back from the exploded stack, Experience dives between the
 * layers and follows the PCB trace (see `trackPcb`), Projects retreats while
 * the stage fades out, Contact comes back to the closed stack's front face.
 * Landscape keeps the stack right of the copy; portrait keeps it centred.
 */
export const JOURNEY_KEYS: Record<Orientation, readonly CameraKey[]> = {
  landscape: [
    ...HERO_KEYS.landscape,
    { at: 1.55, position: [0.8, 0.74, 1.38], target: [-0.44, 0.19, 0] },
    { at: 2.2, position: [1, 1.02, 1.95], target: [-0.62, 0.36, 0] },
    { at: 2.8, position: [0.74, 1.1, 2.15], target: [-0.66, 0.36, 0] },
    { at: 4.4, position: [2.1, 1.3, 3.4], target: [-0.3, 0.2, 0] },
    { at: 5.25, position: [0.95, 0.4, 1.65], target: [-0.52, 0.1, 0] },
    { at: 6, position: [0.68, 0.28, 1.25], target: [-0.4, 0.08, 0] },
  ],
  portrait: [
    ...HERO_KEYS.portrait,
    { at: 1.55, position: [0.45, 0.62, 1.35], target: [0, 0.26, 0] },
    { at: 2.2, position: [0.9, 0.9, 2.5], target: [0, 0.38, 0] },
    { at: 2.8, position: [0.6, 1, 2.65], target: [0, 0.38, 0] },
    { at: 4.4, position: [2, 1.6, 4.2], target: [0, 0.2, 0] },
    { at: 5.25, position: [0.85, 0.55, 2.4], target: [0, 0.14, 0] },
    { at: 6, position: [0.66, 0.44, 2.05], target: [0, 0.12, 0] },
  ],
};

/** Stack yaw (radians): About turns it 30°, Skills and Contact show the front. */
const YAW: readonly TrackKey[] = [
  [1, 0],
  [1.5, Math.PI / 6],
  [1.8, Math.PI / 6],
  [2.2, -0.35],
  [2.85, -0.2],
  [3.2, 0],
  [3.85, 0],
  [4.5, 0.3],
  [5.3, -0.42],
];

/** Extra height of the glass layer (m) while About looks at it. */
const LIFT: readonly TrackKey[] = [
  [1.05, 0],
  [1.5, 0.07],
  [1.8, 0.07],
  [2.1, 0],
];

/**
 * Exploded view (0 = closed monolith), fully open by the time Skills pins;
 * Contact shuts it with a click.
 */
const EXPLODE: readonly TrackKey[] = [
  [1.75, 0],
  [2.15, 1],
  [4.8, 1],
  [5.35, 0, "in"],
];

/** Position of the light pulse along `pcb_traces` (U, 0..1). */
const PULSE: readonly TrackKey[] = [
  [3.12, 0],
  [3.88, 1, "linear"],
];

/** Brightness of the pulse: only while Experience is on screen. */
const PULSE_GLOW: readonly TrackKey[] = [
  [3, 0],
  [3.15, 1],
  [3.85, 1],
  [4, 0],
];

/** Weight of the PCB-tracking camera over the keyed path. */
const TRACK_PCB: readonly TrackKey[] = [
  [3, 0],
  [3.22, 1],
  [3.8, 1],
  [4.05, 0],
];

const ENGRAVE_CONTACT: readonly TrackKey[] = [
  [5.3, 0],
  [5.6, 1],
];

/**
 * Canvas opacity. The stage steps back behind the Projects grid; portrait
 * also dims it behind longer copy, which runs over the whole width there.
 */
const OPACITY: Record<Orientation, readonly TrackKey[]> = {
  landscape: [
    [4.05, 1],
    [4.3, 0],
    [4.7, 0],
    [4.95, 1],
  ],
  portrait: [
    [1, 1],
    [1.3, 0.3],
    [1.9, 0.3],
    [2.1, 1],
    [2.95, 1],
    [3.1, 0.6],
    [4.05, 0.6],
    [4.3, 0],
    [4.7, 0],
    [4.95, 0.35],
  ],
};

/** Where the camera sits relative to the pulse while it follows the trace. */
const PCB_EYE: Record<Orientation, { offset: Vec3; aim: Vec3 }> = {
  landscape: { offset: [0.02, 0.055, 0.15], aim: [-0.07, 0, 0] },
  portrait: { offset: [0, 0.07, 0.2], aim: [0, 0, 0] },
};

/**
 * Skills rows next to their layers (wide screens): shown only while Skills
 * is pinned and the layers are apart, so they never collide.
 */
const SKILL_ROWS: readonly TrackKey[] = [
  [2.1, 0],
  [2.2, 1],
  [2.8, 1],
  [2.9, 0],
];

/** Skills lights the layers one after another, top to bottom, as it scrolls. */
const SCAN = { from: 2.2, to: 2.8 } as const;

const SURFACE = 0.0008;

export type JourneyFrame = {
  /** Journey time this frame shows. */
  time: number;
  position: Vec3;
  target: Vec3;
  /** Environment yaw: the hero's softbox sweep, then a slow drift. */
  envRotation: number;
  /** `engrave_hero` visibility and the glint of the sweep, 0..1. */
  engraveHero: number;
  glint: number;
  /** Stack yaw (rad), glass lift (m), explode (0..1). */
  yaw: number;
  lift: number;
  explode: number;
  /** Light pulse along `pcb_traces`: position (U) and brightness. */
  pulse: number;
  pulseGlow: number;
  /** `engrave_contact` visibility, 0..1. */
  engraveContact: number;
  /** Canvas layer opacity, 0..1. */
  opacity: number;
  /** The layer Skills lights while scrolling, if any. */
  highlight: StackLayer | null;
  /** Visibility of the Skills rows anchored to the layers, 0..1. */
  skillRows: number;
  /**
   * The point to keep sharp (depth of field): the glass while About lifts
   * it, the pulse while Experience follows it, else the stack's middle.
   */
  focus: Vec3;
};

/** World position of the trace at `u` on top of `layer_infra`. */
export function pcbPoint(u: number, explode: number, yaw: number): Vec3 {
  const infra = stackLayout(explode).find((layer) => layer.layer === "infra");
  const [x, z] = pointOnPath(PCB_TRACE_PATH, u);
  const y = (infra?.y ?? 0) + LAYER_HEIGHT.infra + SURFACE;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [x * cos + z * sin, y, -x * sin + z * cos];
}

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Height of the glass layer's centre when the stack is closed (m). */
const GLASS_CENTRE = 0.225;

function focusOf(
  tracking: number,
  spot: Vec3,
  lift: number,
  target: Vec3,
): Vec3 {
  if (tracking > 0.5) {
    return spot;
  }
  if (lift > 0.035) {
    return [0, GLASS_CENTRE + lift, 0];
  }
  return [0, target[1], 0];
}

export function journeyFrame(
  t: number,
  orientation: Orientation,
): JourneyFrame {
  const time = Math.min(JOURNEY_END, Math.max(0, t));
  const hero = heroFrame(Math.min(1, time), orientation);
  const keyed = sampleCameraKeys(JOURNEY_KEYS[orientation], time);
  const yaw = sampleTrack(YAW, time);
  const explode = sampleTrack(EXPLODE, time);
  const pulse = sampleTrack(PULSE, time);

  const tracking = sampleTrack(TRACK_PCB, time);
  const spot = pcbPoint(pulse, explode, yaw);
  const eye = PCB_EYE[orientation];
  const position = mix(keyed.position, add(spot, eye.offset), tracking);
  const target = mix(keyed.target, add(spot, eye.aim), tracking);

  const lift = sampleTrack(LIFT, time);
  const scan = (time - SCAN.from) / (SCAN.to - SCAN.from);
  const highlight =
    scan >= 0 && scan < 1
      ? STACK_LAYERS[Math.floor(scan * STACK_LAYERS.length)]
      : null;

  return {
    time,
    position,
    target,
    envRotation: hero.envRotation + Math.max(0, time - 1) * 0.22,
    engraveHero: hero.engrave,
    glint: time <= 1 ? hero.glint : 0,
    yaw,
    lift,
    explode,
    pulse,
    pulseGlow: sampleTrack(PULSE_GLOW, time),
    engraveContact: sampleTrack(ENGRAVE_CONTACT, time),
    opacity: sampleTrack(OPACITY[orientation], time),
    highlight,
    skillRows: sampleTrack(SKILL_ROWS, time),
    focus: focusOf(tracking, spot, lift, target),
  };
}

/**
 * Which job the pulse is lighting: jobs sit at equal steps along the trace,
 * in page order. -1 while the pulse is dark.
 */
export function litJob(frame: JourneyFrame, jobs: number): number {
  if (jobs <= 0 || frame.pulseGlow < 0.5) {
    return -1;
  }
  return Math.min(jobs - 1, Math.floor(frame.pulse * jobs));
}
