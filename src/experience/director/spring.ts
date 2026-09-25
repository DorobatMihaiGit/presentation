/**
 * Inertia for the journey: a critically damped spring pulls a value towards
 * its target, so the camera lags behind the scroll, settles and never
 * overshoots. Stepped with the exact solution of the spring's differential
 * equation, so the result depends only on the elapsed time, not on how many
 * frames it was split into (60, 120 or 30 fps land in the same place).
 */
export type Spring = { value: number; velocity: number };

export function createSpring(value = 0): Spring {
  return { value, velocity: 0 };
}

/**
 * Advances `spring` towards `target` by `dt` seconds, in place (no garbage
 * per frame). `smoothTime` is roughly the time to cover most of a step.
 */
export function stepSpring(
  spring: Spring,
  target: number,
  smoothTime: number,
  dt: number,
): void {
  if (dt <= 0) {
    return;
  }
  if (smoothTime <= 0) {
    spring.value = target;
    spring.velocity = 0;
    return;
  }
  const omega = 2 / smoothTime;
  const decay = Math.exp(-omega * dt);
  const offset = spring.value - target;
  const impulse = (spring.velocity + omega * offset) * dt;
  spring.velocity = (spring.velocity - omega * impulse) * decay;
  spring.value = target + (offset + impulse) * decay;
}

/** Close enough to `target` and slow enough to stop rendering frames. */
export function springAtRest(
  spring: Spring,
  target: number,
  epsilon = 1e-4,
): boolean {
  return (
    Math.abs(spring.value - target) < epsilon &&
    Math.abs(spring.velocity) < epsilon
  );
}
