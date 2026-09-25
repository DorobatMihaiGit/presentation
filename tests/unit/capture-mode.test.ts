import { describe, expect, it } from "vitest";
import { captureFromSearch } from "@/experience/capture-mode";

describe("captureFromSearch", () => {
  it("reads the scene and progress", () => {
    expect(captureFromSearch("?capture=hero&p=0.5")).toEqual({
      scene: "hero",
      progress: 0.5,
    });
    expect(captureFromSearch("?capture=hero")).toEqual({
      scene: "hero",
      progress: 0,
    });
  });

  it("ignores unknown scenes and progress outside 0..1", () => {
    expect(captureFromSearch("")).toBeNull();
    expect(captureFromSearch("?capture=projects&p=0")).toBeNull();
    expect(captureFromSearch("?capture=hero&p=2")).toBeNull();
    expect(captureFromSearch("?capture=hero&p=-0.1")).toBeNull();
    expect(captureFromSearch("?capture=hero&p=abc")).toBeNull();
  });
});
