import { describe, expect, it, vi } from "vitest";
import { watchContextLoss } from "@/experience/context-loss";

const lose = (canvas: EventTarget) => {
  const event = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(event);
  return event;
};

describe("watchContextLoss", () => {
  it("reports a lost context and keeps it restorable", () => {
    const canvas = new EventTarget();
    const onLost = vi.fn();
    watchContextLoss(canvas, onLost);

    expect(lose(canvas).defaultPrevented).toBe(true);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it("stays silent once the stage that owned the canvas is gone", () => {
    const canvas = new EventTarget();
    const onLost = vi.fn();
    const unwatch = watchContextLoss(canvas, onLost);

    unwatch();
    lose(canvas);

    expect(onLost).not.toHaveBeenCalled();
  });
});
