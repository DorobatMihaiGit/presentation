import { describe, expect, it } from "vitest";
import {
  createSpring,
  springAtRest,
  stepSpring,
} from "@/experience/director/spring";

/** Runs a spring from 0 towards `target` for `seconds` at `fps`. */
function run(fps: number, seconds: number, target = 1, smoothTime = 0.4) {
  const spring = createSpring(0);
  const samples: number[] = [];
  for (let frame = 0; frame < Math.round(fps * seconds); frame += 1) {
    stepSpring(spring, target, smoothTime, 1 / fps);
    samples.push(spring.value);
  }
  return { spring, samples };
}

describe("stepSpring (critically damped)", () => {
  it("lands in the same place at 30, 60 and 144 fps", () => {
    const at60 = run(60, 0.5).spring.value;
    expect(run(30, 0.5).spring.value).toBeCloseTo(at60, 9);
    expect(run(144, 0.5).spring.value).toBeCloseTo(at60, 9);
  });

  it("lags behind a jump, then catches up without overshooting", () => {
    const { samples } = run(60, 3);

    expect(samples[0]).toBeGreaterThan(0);
    expect(samples[0]).toBeLessThan(0.05);
    for (let i = 1; i < samples.length; i += 1) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
      expect(samples[i]).toBeLessThanOrEqual(1);
    }
    expect(samples.at(-1)).toBeCloseTo(1, 4);
  });

  it("covers most of the step in about smoothTime", () => {
    const halfway = run(60, 0.4).spring.value;
    expect(halfway).toBeGreaterThan(0.5);
    expect(halfway).toBeLessThan(0.7);
  });

  it("comes to rest, so frames can stop", () => {
    const { spring } = run(60, 3);
    expect(springAtRest(spring, 1)).toBe(true);
    expect(springAtRest(createSpring(0), 1)).toBe(false);
  });

  it("snaps when smoothTime is 0 and ignores empty frames", () => {
    const spring = createSpring(0);
    stepSpring(spring, 1, 0.4, 0);
    expect(spring.value).toBe(0);
    stepSpring(spring, 1, 0, 1 / 60);
    expect(spring).toEqual({ value: 1, velocity: 0 });
  });
});
