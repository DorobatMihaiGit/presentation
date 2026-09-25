import { STACK_LAYERS, type StackLayer } from "@/content/types";
import { CONTACT_SENT_EVENT } from "../events";
import type { StageStore } from "./store";

const FINE_POINTER = "(hover: hover) and (pointer: fine)";

/**
 * Everything the page tells the stage, written into the store: the fine
 * pointer (parallax; never on touch), the Skills layer under the pointer or
 * keyboard focus, whether the footer is on screen (turntable), and a sent
 * contact message (LED pulse). Returns the cleanup.
 */
export function wireInputs(store: StageStore): () => void {
  const { setPointer, setHoverLayer, setIdle, pulseLed } = store.getState();
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof WindowEventMap>(
    target: Window | Element,
    type: K,
    handler: (event: WindowEventMap[K]) => void,
  ) => {
    target.addEventListener(type, handler as EventListener);
    cleanups.push(() =>
      target.removeEventListener(type, handler as EventListener),
    );
  };

  if (matchMedia(FINE_POINTER).matches) {
    listen(window, "pointermove", (event) => {
      if (event.pointerType === "mouse") {
        setPointer(
          (event.clientX / window.innerWidth) * 2 - 1,
          (event.clientY / window.innerHeight) * 2 - 1,
        );
      }
    });
    listen(document.documentElement, "pointerleave", () => setPointer(0, 0));
  }

  const layerOf = (target: EventTarget | null): StackLayer | null => {
    const layer = (target as Element | null)
      ?.closest?.("#skills [data-layer]")
      ?.getAttribute("data-layer");
    return STACK_LAYERS.includes(layer as StackLayer)
      ? (layer as StackLayer)
      : null;
  };
  listen(document.documentElement, "pointerover", (event) =>
    setHoverLayer(layerOf(event.target)),
  );
  listen(document.documentElement, "focusin", (event) =>
    setHoverLayer(layerOf(event.target)),
  );
  listen(document.documentElement, "focusout", () => setHoverLayer(null));

  const footer = document.querySelector("body > footer");
  if (footer) {
    const observer = new IntersectionObserver(([entry]) =>
      setIdle(entry.isIntersecting),
    );
    observer.observe(footer);
    cleanups.push(() => observer.disconnect());
  }

  listen(window, CONTACT_SENT_EVENT as keyof WindowEventMap, () =>
    pulseLed(performance.now()),
  );

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
