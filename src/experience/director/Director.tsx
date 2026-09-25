import { advance, useThree } from "@react-three/fiber";
import {
  type ComponentType,
  type RefObject,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import type { SceneId } from "@/components/ui/Section";
import type { Capture } from "../capture-mode";
import { startLoop, trackSections } from "../scroll/loop";
import { createFrameMonitor } from "./frame-monitor";
import { HeroShot } from "./HeroShot";
import type { StageStore } from "./store";

export type ShotProps = { store: StageStore };

/**
 * One shot per section. M6 registers about, skills, experience and contact;
 * until then a section without a shot keeps the last one (the stage has
 * faded out by then anyway).
 */
const SHOTS: Partial<Record<SceneId, ComponentType<ShotProps>>> = {
  hero: HeroShot,
};

type DirectorProps = {
  store: StageStore;
  /** The fixed layer around the canvas; its opacity follows the store. */
  layer: RefObject<HTMLDivElement | null>;
  capture: Capture | null;
  onDecline: () => void;
};

/**
 * Owns the frame loop: renders (R3F `advance`) only when the store says
 * something changed, never while the tab is hidden, and reports sustained
 * slow frames through `onDecline`.
 */
export function Director({ store, layer, capture, onDecline }: DirectorProps) {
  const three = useThree((state) => state.get);
  const active = useSyncExternalStore(
    store.subscribe,
    () => store.getState().active,
  );
  const Shot = SHOTS[active] ?? HeroShot;
  const decline = useRef(onDecline);

  useEffect(() => {
    decline.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    const root = document.documentElement;
    const monitor = createFrameMonitor();
    let frames = 0;
    let shown = -1;
    let size = three().size;
    let dpr = three().viewport.dpr;
    if (capture) {
      store.getState().setProgress(capture.scene, capture.progress);
    }

    const stopLoop = startLoop(
      (seconds) => {
        if (document.hidden) {
          return;
        }
        const { opacity, consume, invalidate } = store.getState();
        const { size: nextSize, viewport } = three();
        if (nextSize !== size || viewport.dpr !== dpr) {
          size = nextSize;
          dpr = viewport.dpr;
          invalidate();
        }
        if (layer.current && opacity !== shown) {
          shown = opacity;
          layer.current.style.opacity = String(opacity);
          layer.current.style.visibility = opacity > 0 ? "" : "hidden";
        }
        const due = opacity > 0 && consume();
        if (due) {
          advance(seconds);
          frames += 1;
          if (frames === 1) {
            root.dataset.canvas = "live";
            // A second frame, so capture waits for everything drawn once.
            invalidate();
          } else if (frames === 2 && capture) {
            root.dataset.canvas = "captured";
          }
        }
        if (!capture && monitor.tick(seconds * 1000, due) === "decline") {
          decline.current();
        }
      },
      { smooth: !capture },
    );
    const stopSections = capture ? null : trackSections(store);

    return () => {
      stopSections?.();
      stopLoop();
    };
  }, [store, layer, capture, three]);

  return <Shot store={store} />;
}
