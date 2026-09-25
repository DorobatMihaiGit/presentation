import { describe, expect, it } from "vitest";
import { createStageStore } from "@/experience/director/store";

describe("createStageStore", () => {
  it("starts dirty, so the first frame always renders", () => {
    const store = createStageStore();

    expect(store.getState().consume()).toBe(true);
    expect(store.getState().consume()).toBe(false);
  });

  it("asks for a frame only when progress really changes", () => {
    const store = createStageStore();
    store.getState().consume();

    store.getState().setProgress("hero", 0.00005);
    expect(store.getState().consume()).toBe(false);

    store.getState().setProgress("hero", 0.4);
    expect(store.getState().progress.hero).toBe(0.4);
    expect(store.getState().consume()).toBe(true);
  });

  it("clamps progress and opacity to 0..1", () => {
    const store = createStageStore();

    store.getState().setProgress("skills", 1.7);
    store.getState().setOpacity(-0.2);

    expect(store.getState().progress.skills).toBe(1);
    expect(store.getState().opacity).toBe(0);
  });

  it("marks a frame due when the active section or the size changes", () => {
    const store = createStageStore();
    store.getState().consume();

    store.getState().setActive("hero");
    expect(store.getState().consume()).toBe(false);

    store.getState().setActive("about");
    expect(store.getState().active).toBe("about");
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
