import { describe, expect, it } from "vitest";
import { createStageStore } from "@/experience/director/store";

describe("createStageStore", () => {
  it("starts dirty, so the first frame always renders", () => {
    const store = createStageStore();

    expect(store.getState().consume()).toBe(true);
    expect(store.getState().consume()).toBe(false);
  });

  it("asks for a frame only when the journey really moves", () => {
    const store = createStageStore();
    store.getState().consume();

    store.getState().setJourney(0.00005);
    expect(store.getState().consume()).toBe(false);

    store.getState().setJourney(2.4);
    expect(store.getState().journey).toBe(2.4);
    expect(store.getState().consume()).toBe(true);
  });

  it("clamps the journey at 0 and the pointer to -1..1", () => {
    const store = createStageStore();

    store.getState().setJourney(-3);
    store.getState().setPointer(1.7, -4);

    expect(store.getState().journey).toBe(0);
    expect(store.getState().pointer).toEqual({ x: 1, y: -1 });
  });

  it("marks a frame due when hover, idle, the LED or the size change", () => {
    const store = createStageStore();
    store.getState().consume();

    store.getState().setHoverLayer(null);
    store.getState().setIdle(false);
    expect(store.getState().consume()).toBe(false);

    store.getState().setHoverLayer("data");
    expect(store.getState().consume()).toBe(true);
    store.getState().setIdle(true);
    expect(store.getState().consume()).toBe(true);
    store.getState().pulseLed(1234);
    expect(store.getState().ledPulseAt).toBe(1234);
    expect(store.getState().consume()).toBe(true);

    store.getState().invalidate();
    expect(store.getState().consume()).toBe(true);
  });

  it("records when the detail maps are in, with a frame to show them", () => {
    const store = createStageStore();
    store.getState().consume();
    expect(store.getState().ready).toBe(false);

    store.getState().setReady();

    expect(store.getState().ready).toBe(true);
    expect(store.getState().consume()).toBe(true);
  });
});
