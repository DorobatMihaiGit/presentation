import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { REFERENCE_SIZE } from "@/experience/director/framing";
import {
  HERO_KEYS,
  heroFrame,
  SHOT_FOV,
  sampleCameraKeys,
  smoothstep,
} from "@/experience/director/shots";
import {
  STACK_FOOTPRINT,
  STACK_HEIGHT,
} from "@/experience/scenes/stack-layout";

const distance = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("sampleCameraKeys", () => {
  for (const orientation of ["landscape", "portrait"] as const) {
    const keys = HERO_KEYS[orientation];

    it(`passes through every ${orientation} key`, () => {
      for (const key of keys) {
        const sample = sampleCameraKeys(keys, key.at);
        expect(distance(sample.position, key.position)).toBeLessThan(1e-9);
        expect(distance(sample.target, key.target)).toBeLessThan(1e-9);
      }
    });

    it(`clamps ${orientation} progress outside 0..1`, () => {
      expect(sampleCameraKeys(keys, -1)).toEqual(sampleCameraKeys(keys, 0));
      expect(sampleCameraKeys(keys, 2)).toEqual(sampleCameraKeys(keys, 1));
    });

    it(`clamps to the first and last of any ${orientation} keys`, () => {
      // The journey (M6) keys run past 1: T 0..6 over the whole page.
      const later = keys.map((key) => ({ ...key, at: key.at * 5 + 1 }));
      expect(sampleCameraKeys(later, 0)).toEqual(sampleCameraKeys(later, 1));
      expect(sampleCameraKeys(later, 9)).toEqual(sampleCameraKeys(later, 6));
      const last = keys[keys.length - 1].position;
      expect(distance(sampleCameraKeys(later, 6).position, last)).toBeLessThan(
        1e-9,
      );
    });

    it(`moves the ${orientation} camera without jumps`, () => {
      let previous = sampleCameraKeys(keys, 0).position;
      for (let step = 1; step <= 1000; step += 1) {
        const next = sampleCameraKeys(keys, step / 1000).position;
        expect(distance(previous, next)).toBeLessThan(0.01);
        previous = next;
      }
    });
  }
});

describe("heroFrame", () => {
  it("hides the etching at the start and shows it at the end", () => {
    expect(heroFrame(0, "landscape").engrave).toBe(0);
    expect(heroFrame(1, "landscape").engrave).toBe(1);
  });

  it("glints only while the sweep passes over the etching", () => {
    expect(heroFrame(0.2, "landscape").glint).toBe(0);
    expect(heroFrame(0.5, "landscape").glint).toBe(1);
    expect(heroFrame(0.8, "landscape").glint).toBe(0);
  });

  it("sweeps the environment one way as progress grows", () => {
    const start = heroFrame(0, "portrait").envRotation;
    const middle = heroFrame(0.5, "portrait").envRotation;
    const end = heroFrame(1, "portrait").envRotation;

    expect(start).toBeLessThan(middle);
    expect(middle).toBeLessThan(end);
  });

  it("frames the finished monolith from further away than the macro start", () => {
    for (const orientation of ["landscape", "portrait"] as const) {
      const origin = [0, 0.125, 0];
      expect(
        distance(heroFrame(1, orientation).position, origin),
      ).toBeGreaterThan(
        2.5 * distance(heroFrame(0, orientation).position, origin),
      );
    }
  });
});

describe("the hero's end frame", () => {
  for (const orientation of ["landscape", "portrait"] as const) {
    it(`shows the whole monolith (${orientation})`, () => {
      const { width, height } = REFERENCE_SIZE[orientation];
      const camera = new PerspectiveCamera(
        SHOT_FOV[orientation],
        width / height,
        0.01,
        30,
      );
      const end = heroFrame(1, orientation);
      camera.position.set(...end.position);
      camera.lookAt(...end.target);
      camera.updateMatrixWorld();
      const half = STACK_FOOTPRINT / 2;
      for (const x of [-half, half]) {
        for (const y of [0, STACK_HEIGHT]) {
          for (const z of [-half, half]) {
            const corner = new Vector3(x, y, z).project(camera);
            expect(Math.abs(corner.x), `x of ${x},${y},${z}`).toBeLessThan(0.9);
            expect(Math.abs(corner.y), `y of ${x},${y},${z}`).toBeLessThan(0.9);
          }
        }
      }
    });
  }
});

describe("smoothstep", () => {
  it("is 0 before, 1 after and 0.5 halfway", () => {
    expect(smoothstep(0.2, 0.4, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.4, 0.5)).toBe(1);
    expect(smoothstep(0.2, 0.4, 0.3)).toBeCloseTo(0.5);
  });
});
