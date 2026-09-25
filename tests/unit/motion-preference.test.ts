import { describe, expect, it } from "vitest";
import { resolveMotion } from "@/experience/motion-preference";

describe("resolveMotion", () => {
  it("animates by default", () => {
    expect(
      resolveMotion({ choice: null, reducedMotion: false, saveData: false }),
    ).toBe(true);
  });

  it("stops for prefers-reduced-motion and for Save-Data", () => {
    expect(
      resolveMotion({ choice: null, reducedMotion: true, saveData: false }),
    ).toBe(false);
    expect(
      resolveMotion({ choice: null, reducedMotion: false, saveData: true }),
    ).toBe(false);
  });

  it("lets the visitor's toggle override both", () => {
    expect(
      resolveMotion({ choice: "on", reducedMotion: true, saveData: true }),
    ).toBe(true);
    expect(
      resolveMotion({ choice: "off", reducedMotion: false, saveData: false }),
    ).toBe(false);
  });
});
