"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { type Capture, captureFromSearch } from "./capture-mode";
import {
  classifyTier,
  type LiveTier,
  readGpuSignals,
  tierOverride,
} from "./gpu-tier";
import { useMotion } from "./use-motion";

// three.js, R3F, GSAP and Lenis live in this chunk only.
const Stage = dynamic(() => import("./Stage"), { ssr: false });

/**
 * Decides, after the page has loaded (so after the poster, the LCP element),
 * whether this visitor gets the live stage, and at which tier. Sets on <html>:
 * - data-motion="on|off": the visitor's motion preference;
 * - data-canvas="poster|loading|live|captured": what the hero shows.
 *   "loading" and "live" turn on the pinned (scroll-scrubbed) hero.
 */
export function StageLoader() {
  const motion = useMotion();
  const [live, setLive] = useState<{
    tier: LiveTier;
    capture: Capture | null;
    pinned: boolean;
  } | null>(null);

  useEffect(() => {
    if (motion === null) {
      return;
    }
    const root = document.documentElement;
    const capture = captureFromSearch(location.search);
    if (capture) {
      root.dataset.capture = capture.scene;
    }
    root.dataset.motion = motion || capture ? "on" : "off";
    if (!motion && !capture) {
      root.dataset.canvas = "poster";
      setLive(null);
      return;
    }
    let cancelled = false;
    const cancel = afterLoadAndIdle(async () => {
      const forced = tierOverride(location.search);
      const tier = forced ?? (capture ? 2 : classifyTier(readGpuSignals()));
      if (tier === 0) {
        root.dataset.canvas = "poster";
        return;
      }
      if (capture) {
        // The etching is drawn with the page font: wait for it.
        await document.fonts.ready;
      }
      if (!cancelled) {
        root.dataset.canvas = "loading";
        setLive({ tier, capture, pinned: forced !== null });
      }
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [motion]);

  if (!live) {
    return null;
  }
  return (
    <Stage
      tier={live.tier}
      capture={live.capture}
      pinned={live.pinned}
      onFallback={() => {
        document.documentElement.dataset.canvas = "poster";
        setLive(null);
      }}
    />
  );
}

/** Runs `task` once the load event has fired and the main thread is idle. */
function afterLoadAndIdle(task: () => void): () => void {
  let cancel = () => {};
  // Safari has no requestIdleCallback.
  const idle = window.requestIdleCallback as
    | typeof requestIdleCallback
    | undefined;
  const schedule = () => {
    if (idle) {
      const handle = idle(task, { timeout: 2000 });
      cancel = () => cancelIdleCallback(handle);
    } else {
      const handle = window.setTimeout(task, 200);
      cancel = () => clearTimeout(handle);
    }
  };
  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }
  return () => {
    window.removeEventListener("load", schedule);
    cancel();
  };
}
