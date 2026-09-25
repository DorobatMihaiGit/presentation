import { describe, expect, it } from "vitest";
import {
  JOURNEY_END,
  JOURNEY_KEYS,
  JOURNEY_STOPS,
  journeyFrame,
  journeyTime,
  litJob,
  pcbPoint,
  sampleTrack,
  stopTime,
} from "@/experience/director/journey";
import { heroFrame } from "@/experience/director/shots";
import {
  STACK_FOOTPRINT,
  STACK_HEIGHT,
} from "@/experience/scenes/stack-layout";

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const ORIENTATIONS = ["landscape", "portrait"] as const;

describe("journeyTime", () => {
  // hero 0..2000 px (pinned), about, skills, experience, projects, contact, end
  const knots = [0, 2000, 2600, 4800, 6200, 8000, 9000];

  it("gives each stop one unit of journey time", () => {
    expect(journeyTime(0, knots)).toBe(0);
    expect(journeyTime(1000, knots)).toBe(0.5);
    expect(journeyTime(2000, knots)).toBe(1);
    expect(journeyTime(3700, knots)).toBe(2.5);
    expect(journeyTime(9000, knots)).toBe(JOURNEY_END);
  });

  it("clamps outside the page and survives empty stops", () => {
    expect(journeyTime(-50, knots)).toBe(0);
    expect(journeyTime(12_000, knots)).toBe(JOURNEY_END);
    expect(journeyTime(2600, [0, 2000, 2000, 2600, 2600, 2600, 2600])).toBe(
      JOURNEY_END,
    );
  });

  it("never runs backwards while scrolling down", () => {
    let previous = 0;
    for (let scroll = 0; scroll <= 9000; scroll += 25) {
      const t = journeyTime(scroll, knots);
      expect(t).toBeGreaterThanOrEqual(previous);
      previous = t;
    }
  });
});

describe("stopTime", () => {
  it("maps a stop and its progress onto journey time", () => {
    expect(JOURNEY_STOPS[0]).toBe("hero");
    expect(stopTime("hero", 0.8)).toBe(0.8);
    expect(stopTime("skills", 0.5)).toBe(2.5);
    expect(stopTime("contact", 1)).toBe(JOURNEY_END);
  });
});

describe("sampleTrack", () => {
  const keys = [
    [1, 0],
    [2, 10],
    [3, 0, "in"],
  ] as const;

  it("holds the ends and passes through every key", () => {
    expect(sampleTrack(keys, 0)).toBe(0);
    expect(sampleTrack(keys, 2)).toBe(10);
    expect(sampleTrack(keys, 9)).toBe(0);
  });

  it("eases smoothly by default and accelerates into an 'in' key", () => {
    expect(sampleTrack(keys, 1.5)).toBeCloseTo(5);
    // Cubic ease-in: after half the time only an eighth of the way.
    expect(sampleTrack(keys, 2.5)).toBeCloseTo(10 - 10 / 8);
  });
});

describe("journeyFrame", () => {
  for (const orientation of ORIENTATIONS) {
    it(`matches shot S1 during the hero (${orientation})`, () => {
      for (const p of [0, 0.3, 0.5, 1]) {
        const frame = journeyFrame(p, orientation);
        const hero = heroFrame(p, orientation);
        expect(distance(frame.position, hero.position)).toBeLessThan(1e-9);
        expect(frame.engraveHero).toBe(hero.engrave);
        expect(frame.explode).toBe(0);
        expect(frame.opacity).toBe(1);
      }
    });

    it(`moves the ${orientation} camera through the whole page without jumps`, () => {
      let previous = journeyFrame(0, orientation);
      for (let step = 1; step <= 6000; step += 1) {
        const next = journeyFrame(step / 1000, orientation);
        expect(distance(previous.position, next.position)).toBeLessThan(0.03);
        expect(distance(previous.target, next.target)).toBeLessThan(0.03);
        expect(Math.abs(next.yaw - previous.yaw)).toBeLessThan(0.01);
        previous = next;
      }
    });

    it(`keeps the ${orientation} camera outside the stack`, () => {
      for (let step = 0; step <= 600; step += 1) {
        const [x, y, z] = journeyFrame(step / 100, orientation).position;
        const inside =
          Math.abs(x) < STACK_FOOTPRINT / 2 &&
          Math.abs(z) < STACK_FOOTPRINT / 2 &&
          y > 0 &&
          y < STACK_HEIGHT;
        expect(inside, `T=${step / 100}`).toBe(false);
      }
    });
  }

  it("About yaws the stack 30 degrees and lifts the glass", () => {
    const about = journeyFrame(1.6, "landscape");
    expect(about.yaw).toBeCloseTo(Math.PI / 6);
    expect(about.lift).toBeGreaterThan(0.05);
    expect(about.explode).toBe(0);
    // Focus racks to the lifted glass.
    expect(about.focus[1]).toBeGreaterThan(0.25);
  });

  it("Skills explodes the stack and lights the layers top to bottom", () => {
    expect(journeyFrame(2.2, "landscape").explode).toBe(1);
    const lit = [2.21, 2.33, 2.45, 2.57, 2.69].map(
      (t) => journeyFrame(t, "landscape").highlight,
    );
    expect(lit).toEqual(["interface", "api", "data", "infra", "craft"]);
    expect(journeyFrame(2.1, "landscape").highlight).toBeNull();
    expect(journeyFrame(2.9, "landscape").highlight).toBeNull();
  });

  it("shows the anchored Skills rows only while the layers are apart", () => {
    expect(journeyFrame(2, "landscape").skillRows).toBe(0);
    expect(journeyFrame(2.5, "landscape").skillRows).toBe(1);
    expect(journeyFrame(2.5, "landscape").explode).toBe(1);
    expect(journeyFrame(3, "landscape").skillRows).toBe(0);
  });

  it("Experience runs the pulse along the trace and follows it", () => {
    const start = journeyFrame(3.12, "landscape");
    const middle = journeyFrame(3.5, "landscape");
    const end = journeyFrame(3.88, "landscape");
    expect(start.pulse).toBe(0);
    expect(middle.pulse).toBeCloseTo(0.5);
    expect(end.pulse).toBe(1);
    expect(middle.pulseGlow).toBe(1);
    expect(journeyFrame(2.9, "landscape").pulseGlow).toBe(0);
    // Macro: the camera is within 20 cm of the pulse, between the layers.
    const spot = pcbPoint(middle.pulse, middle.explode, middle.yaw);
    expect(distance(middle.position, spot)).toBeLessThan(0.2);
    expect(distance(middle.focus, spot)).toBe(0);
  });

  it("Projects hides the stage, Contact brings it back closed and engraved", () => {
    for (const orientation of ORIENTATIONS) {
      expect(journeyFrame(4.5, orientation).opacity).toBe(0);
      const contact = journeyFrame(5.8, orientation);
      expect(contact.opacity).toBeGreaterThan(0.3);
      expect(contact.explode).toBe(0);
      expect(contact.engraveContact).toBe(1);
    }
  });

  it("clicks the layers shut: they close fastest at the very end", () => {
    const gaps = [5.05, 5.15, 5.25, 5.35].map(
      (t) => journeyFrame(t, "landscape").explode,
    );
    const steps = gaps.slice(1).map((gap, i) => gaps[i] - gap);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1]);
    }
    expect(gaps.at(-1)).toBe(0);
  });

  it("has keys in time order for both orientations", () => {
    for (const orientation of ORIENTATIONS) {
      const times = JOURNEY_KEYS[orientation].map((key) => key.at);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(times.at(-1)).toBe(JOURNEY_END);
    }
  });
});

describe("litJob", () => {
  it("lights jobs in page order as the pulse passes, none while dark", () => {
    expect(litJob(journeyFrame(3.2, "landscape"), 3)).toBe(0);
    expect(litJob(journeyFrame(3.5, "landscape"), 3)).toBe(1);
    expect(litJob(journeyFrame(3.8, "landscape"), 3)).toBe(2);
    expect(litJob(journeyFrame(2.5, "landscape"), 3)).toBe(-1);
    expect(litJob(journeyFrame(3.5, "landscape"), 0)).toBe(-1);
  });
});
