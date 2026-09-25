import { advance, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef } from "react";
import type { Capture } from "../capture-mode";
import { startLoop, trackJourney } from "../scroll/loop";
import { createFrameMonitor } from "./frame-monitor";
import { orientationOf } from "./framing";
import { wireInputs } from "./inputs";
import { JourneyShot } from "./JourneyShot";
import { type JourneyFrame, journeyFrame, stopTime } from "./journey";
import { createMotion, stepGlow, stepMotion } from "./motion";
import type { StageStore } from "./store";

type DirectorProps = {
  store: StageStore;
  /** The fixed layer around the canvas; its opacity follows the journey. */
  layer: RefObject<HTMLDivElement | null>;
  capture: Capture | null;
  onDecline: () => void;
};

/**
 * Owns the frame loop: turns the store (scroll, pointer, footer, LED) into
 * springs and a journey frame, renders (R3F `advance`) only while something
 * changed or is still settling, never while the tab is hidden, and reports
 * sustained slow frames through `onDecline`.
 */
export function Director({ store, layer, capture, onDecline }: DirectorProps) {
  const three = useThree((state) => state.get);
  const motion = useRef(createMotion()).current;
  const frame = useRef<JourneyFrame>(journeyFrame(0, "landscape"));
  const decline = useRef(onDecline);

  useEffect(() => {
    decline.current = onDecline;
  }, [onDecline]);

  useEffect(() => {
    const root = document.documentElement;
    const monitor = createFrameMonitor();
    let frames = 0;
    let shown = -1;
    let last: number | null = null;
    let size = three().size;
    let dpr = three().viewport.dpr;
    if (capture) {
      store.getState().setJourney(stopTime(capture.scene, capture.progress));
    }

    const stopLoop = startLoop(
      (seconds) => {
        if (document.hidden) {
          last = null;
          return;
        }
        // The springs are exact for any step; the cap only keeps a stall
        // (debugger, GC) from skipping the motion altogether.
        const dt = last === null ? 0 : Math.min(0.5, seconds - last);
        last = seconds;
        const state = store.getState();
        const { size: nextSize, viewport } = three();
        if (nextSize !== size || viewport.dpr !== dpr) {
          size = nextSize;
          dpr = viewport.dpr;
          state.invalidate();
        }
        const snap = capture !== null;
        let moving = stepMotion(motion, state, dt, performance.now(), snap);
        frame.current = journeyFrame(
          motion.journey.value,
          orientationOf(size.width, size.height),
        );
        const lit =
          frame.current.explode > 0.5
            ? (state.hoverLayer ?? frame.current.highlight)
            : null;
        moving = stepGlow(motion, lit, dt, snap) || moving;
        if (moving) {
          state.invalidate();
        }
        const { opacity, time } = frame.current;
        const label = time.toFixed(2);
        if (layer.current && layer.current.dataset.journey !== label) {
          // Journey time on the layer (tests, debugging); not styled.
          layer.current.dataset.journey = label;
        }
        const pulsing = motion.led > 0;
        if (layer.current?.hasAttribute("data-led") !== pulsing) {
          // Likewise while the LED pulses after a sent message.
          layer.current?.toggleAttribute("data-led", pulsing);
        }
        if (layer.current && opacity !== shown) {
          shown = opacity;
          layer.current.style.opacity = String(opacity);
          layer.current.style.visibility = opacity > 0 ? "" : "hidden";
        }
        const due = opacity > 0 && state.consume();
        if (due) {
          advance(seconds);
          frames += 1;
          if (frames === 1) {
            root.dataset.canvas = "live";
            // A second frame, so capture waits for everything drawn once.
            state.invalidate();
          } else if (capture && state.ready) {
            // Drawn at least twice, the last time with the detail maps.
            root.dataset.canvas = "captured";
          }
        }
        if (!capture && monitor.tick(seconds * 1000, due) === "decline") {
          decline.current();
        }
      },
      { smooth: !capture },
    );
    const stopJourney = capture ? null : trackJourney(store);
    const stopInputs = capture ? null : wireInputs(store);

    return () => {
      stopInputs?.();
      stopJourney?.();
      stopLoop();
    };
  }, [store, layer, capture, three, motion]);

  return <JourneyShot motion={motion} frame={frame} />;
}
