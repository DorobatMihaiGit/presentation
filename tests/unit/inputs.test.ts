import { afterEach, describe, expect, it, vi } from "vitest";
import { wireInputs } from "@/experience/director/inputs";
import { createStageStore } from "@/experience/director/store";
import { CONTACT_SENT_EVENT } from "@/experience/events";

/** Just enough of a browser for wireInputs (the unit tests run in Node). */
function fakeBrowser({ finePointer }: { finePointer: boolean }) {
  const window = Object.assign(new EventTarget(), {
    innerWidth: 1000,
    innerHeight: 500,
  });
  const root = new EventTarget();
  const footer = {};
  let onFooter: (entries: { isIntersecting: boolean }[]) => void = () => {};
  vi.stubGlobal("window", window);
  vi.stubGlobal("document", {
    documentElement: root,
    querySelector: (selector: string) =>
      selector === "body > footer" ? footer : null,
  });
  vi.stubGlobal("matchMedia", () => ({ matches: finePointer }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof onFooter) {
        onFooter = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("performance", { now: () => 1234 });
  const pointer = (type: string, x: number, y: number) =>
    Object.assign(new Event(type), {
      pointerType: "mouse",
      clientX: x,
      clientY: y,
    });
  return {
    move: (x: number, y: number) =>
      window.dispatchEvent(pointer("pointermove", x, y)),
    showFooter: (isIntersecting: boolean) => onFooter([{ isIntersecting }]),
    sendMessage: () => window.dispatchEvent(new Event(CONTACT_SENT_EVENT)),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wireInputs", () => {
  it("tilts towards a fine pointer, from -1 to 1 across the viewport", () => {
    const browser = fakeBrowser({ finePointer: true });
    const store = createStageStore();
    wireInputs(store);

    browser.move(750, 0);
    expect(store.getState().pointer).toEqual({ x: 0.5, y: -1 });
  });

  it("ignores the pointer on touch screens", () => {
    const browser = fakeBrowser({ finePointer: false });
    const store = createStageStore();
    wireInputs(store);

    browser.move(750, 0);
    expect(store.getState().pointer).toEqual({ x: 0, y: 0 });
  });

  it("turns the stack while the footer is on screen", () => {
    const browser = fakeBrowser({ finePointer: true });
    const store = createStageStore();
    wireInputs(store);

    browser.showFooter(true);
    expect(store.getState().idle).toBe(true);
    browser.showFooter(false);
    expect(store.getState().idle).toBe(false);
  });

  it("pulses the LED when the contact form says a message was sent", () => {
    const browser = fakeBrowser({ finePointer: true });
    const store = createStageStore();
    wireInputs(store);

    browser.sendMessage();
    expect(store.getState().ledPulseAt).toBe(1234);
  });

  it("stops listening once cleaned up", () => {
    const browser = fakeBrowser({ finePointer: true });
    const store = createStageStore();
    const stop = wireInputs(store);

    stop();
    browser.move(750, 0);
    browser.sendMessage();
    expect(store.getState().pointer).toEqual({ x: 0, y: 0 });
    expect(store.getState().ledPulseAt).toBeNull();
  });
});
