import { STACK_LAYERS, type StackLayer } from "@/content/types";
import { createSpring, type Spring, springAtRest, stepSpring } from "./spring";

/**
 * The weight of the stage (Oryzo-style inertia): every input the store holds
 * is followed through a critically damped spring, so the camera trails the
 * scroll, settles and never overshoots. Smoothing times in seconds.
 */
export const SMOOTH = {
  journey: 0.55,
  pointer: 0.45,
  turntable: 1.2,
  glow: 0.18,
} as const;

/** Footer turntable speed (rad/s). */
export const TURNTABLE_SPEED = 0.12;

/** Length of the LED pulse after a contact message was sent (ms). */
export const LED_PULSE_MS = 2400;

const TURN = Math.PI * 2;

export type Motion = {
  /** Journey time actually shown (trails the store's `journey`). */
  journey: Spring;
  pointerX: Spring;
  pointerY: Spring;
  /** Extra stack yaw from the footer turntable (rad). */
  turntable: Spring;
  turntableTarget: number;
  /** LED brightness boost, 0..1. */
  led: number;
  /** Edge glow per stack layer, 0..1, and the layer it is heading for. */
  glow: Record<StackLayer, Spring>;
  lit: StackLayer | null;
};

export function createMotion(journey = 0): Motion {
  return {
    journey: createSpring(journey),
    pointerX: createSpring(0),
    pointerY: createSpring(0),
    turntable: createSpring(0),
    turntableTarget: 0,
    led: 0,
    glow: Object.fromEntries(
      STACK_LAYERS.map((layer) => [layer, createSpring(0)]),
    ) as Record<StackLayer, Spring>,
    lit: null,
  };
}

/**
 * Fades the edge glow towards `lit` (the hovered or focused Skills row,
 * else the layer the scroll is on) and out on the others. Returns whether a
 * glow is still changing.
 */
export function stepGlow(
  motion: Motion,
  lit: StackLayer | null,
  dt: number,
  snap = false,
): boolean {
  motion.lit = lit;
  let moving = false;
  for (const layer of STACK_LAYERS) {
    const target = layer === lit ? 1 : 0;
    const spring = motion.glow[layer];
    stepSpring(spring, target, snap ? 0 : SMOOTH.glow, dt);
    moving ||= !springAtRest(spring, target, 1e-3);
  }
  return moving;
}

/** What the page asks of the stage (the stage store holds these fields). */
export type MotionInputs = {
  /** Journey time the scroll position asks for. */
  journey: number;
  /** Fine pointer, -1..1 per axis. */
  pointer: { x: number; y: number };
  /** The footer is on screen. */
  idle: boolean;
  /** performance.now() of the last sent contact message. */
  ledPulseAt: number | null;
};

/**
 * Advances every spring by `dt` seconds towards the store's inputs; `snap`
 * jumps straight there (poster capture). Returns whether anything is still
 * moving, i.e. whether another frame must be drawn.
 */
export function stepMotion(
  motion: Motion,
  inputs: MotionInputs,
  dt: number,
  now: number,
  snap = false,
): boolean {
  const smooth = (time: number) => (snap ? 0 : time);

  if (inputs.idle) {
    motion.turntableTarget += TURNTABLE_SPEED * dt;
  } else {
    // Back to the nearest full turn, never unwinding the turns already made.
    motion.turntableTarget = Math.round(motion.turntable.value / TURN) * TURN;
  }
  stepSpring(motion.journey, inputs.journey, smooth(SMOOTH.journey), dt);
  stepSpring(motion.pointerX, inputs.pointer.x, smooth(SMOOTH.pointer), dt);
  stepSpring(motion.pointerY, inputs.pointer.y, smooth(SMOOTH.pointer), dt);
  stepSpring(
    motion.turntable,
    motion.turntableTarget,
    smooth(SMOOTH.turntable),
    dt,
  );

  const pulse =
    inputs.ledPulseAt === null ? 1 : (now - inputs.ledPulseAt) / LED_PULSE_MS;
  const pulsing = pulse >= 0 && pulse < 1;
  // Three soft beats that fade out.
  motion.led = pulsing
    ? 0.5 * (1 - Math.cos(pulse * Math.PI * 6)) * (1 - pulse)
    : 0;

  return (
    inputs.idle ||
    pulsing ||
    !springAtRest(motion.journey, inputs.journey) ||
    !springAtRest(motion.pointerX, inputs.pointer.x) ||
    !springAtRest(motion.pointerY, inputs.pointer.y) ||
    !springAtRest(motion.turntable, motion.turntableTarget)
  );
}
