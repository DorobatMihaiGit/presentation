import { describe, expect, it } from "vitest";
import {
  createMotion,
  LED_PULSE_MS,
  stepMotion,
} from "@/experience/director/motion";

const still = {
  journey: 0,
  pointer: { x: 0, y: 0 },
  idle: false,
  ledPulseAt: null,
};

/** Steps at 60 fps until nothing moves; returns the number of frames drawn. */
function framesUntilRest(
  motion: ReturnType<typeof createMotion>,
  inputs: typeof still,
  limit = 600,
) {
  for (let frame = 0; frame < limit; frame += 1) {
    if (!stepMotion(motion, inputs, 1 / 60, frame * (1000 / 60))) {
      return frame;
    }
  }
  return limit;
}

describe("stepMotion", () => {
  it("keeps drawing while the camera catches up with the scroll, then stops", () => {
    const motion = createMotion(0);
    const frames = framesUntilRest(motion, { ...still, journey: 1 });

    expect(frames).toBeGreaterThan(30);
    expect(frames).toBeLessThan(300);
    expect(motion.journey.value).toBeCloseTo(1, 3);
    expect(stepMotion(motion, { ...still, journey: 1 }, 1 / 60, 0)).toBe(false);
  });

  it("trails the scroll instead of jumping with it", () => {
    const motion = createMotion(0);
    stepMotion(motion, { ...still, journey: 1 }, 1 / 60, 0);

    expect(motion.journey.value).toBeGreaterThan(0);
    expect(motion.journey.value).toBeLessThan(0.05);
  });

  it("snaps for poster capture", () => {
    const motion = createMotion(0);
    const moving = stepMotion(
      motion,
      { ...still, journey: 2.5, pointer: { x: 1, y: 0 } },
      0,
      0,
      true,
    );

    expect(motion.journey.value).toBe(0);
    expect(moving).toBe(true);
    stepMotion(motion, { ...still, journey: 2.5 }, 1 / 60, 0, true);
    expect(motion.journey.value).toBe(2.5);
  });

  it("turns the turntable only while idle, then settles on a full turn", () => {
    const motion = createMotion(0);
    for (let frame = 0; frame < 120; frame += 1) {
      expect(stepMotion(motion, { ...still, idle: true }, 1 / 60, 0)).toBe(
        true,
      );
    }
    expect(motion.turntable.value).toBeGreaterThan(0.05);

    framesUntilRest(motion, still);
    expect(motion.turntable.value).toBeCloseTo(0, 3);
  });

  it("pulses the LED after a message is sent, for a limited time", () => {
    const motion = createMotion(0);
    const inputs = { ...still, ledPulseAt: 1000 };

    expect(stepMotion(motion, inputs, 1 / 60, 1000 + LED_PULSE_MS / 6)).toBe(
      true,
    );
    expect(motion.led).toBeGreaterThan(0.5);
    expect(stepMotion(motion, inputs, 1 / 60, 1000 + LED_PULSE_MS + 1)).toBe(
      false,
    );
    expect(motion.led).toBe(0);
  });
});
