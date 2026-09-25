"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgXToneMapping, Vector3 } from "three";
import type { Capture } from "./capture-mode";
import { watchContextLoss } from "./context-loss";
import { Director } from "./director/Director";
import { createStageStore } from "./director/store";
import { type LiveTier, lowerTier } from "./gpu-tier";
import { Effects, type Tier3Module } from "./postfx/Effects";
import { StackModel } from "./scenes/StackModel";
import { StudioLights } from "./scenes/StudioLights";

export type StageProps = {
  tier: LiveTier;
  capture: Capture | null;
  /** `?tier=` chose the tier: keep it, however slow the frames. */
  pinned: boolean;
  /** Live 3D is over (context lost, or too slow even at tier 1): show posters. */
  onFallback: () => void;
};

const DPR: Record<LiveTier, number | [number, number]> = {
  1: 1,
  2: [1, 1.5],
  3: [1, 2],
};

/**
 * The persistent stage: one fixed, full-viewport canvas behind the page,
 * rendered on demand by the director. Loaded lazily by StageLoader.
 */
export default function Stage({
  tier: initialTier,
  capture,
  pinned,
  onFallback,
}: StageProps) {
  const [tier, setTier] = useState<LiveTier>(initialTier);
  const [extras, setExtras] = useState<Tier3Module | null>(null);
  const store = useMemo(createStageStore, []);
  // What the depth of field focuses on (tier 3); the director moves it.
  const focus = useMemo(() => new Vector3(), []);
  // One chip per job on the PCB trace, in page order (read once, like SSR).
  const [jobs] = useState(
    () => document.querySelectorAll("#experience ol > li").length,
  );
  const layer = useRef<HTMLDivElement>(null);
  const unwatch = useRef<(() => void) | null>(null);

  const decline = useCallback(() => {
    if (pinned) {
      return;
    }
    const lower = lowerTier(tier);
    if (lower === null) {
      onFallback();
    } else {
      setTier(lower);
    }
  }, [tier, pinned, onFallback]);

  useEffect(() => {
    document.documentElement.dataset.tier = String(tier);
    store.getState().invalidate();
  }, [tier, store]);

  // Tier 3's effects are a chunk of their own, loaded only here.
  useEffect(() => {
    if (tier < 3) {
      setExtras(null);
      return;
    }
    let current = true;
    import("./postfx/tier3").then(
      (module) => {
        if (current) setExtras(module);
      },
      () => {
        if (current) setTier(2);
      },
    );
    return () => {
      current = false;
    };
  }, [tier]);

  useEffect(() => () => unwatch.current?.(), []);

  return (
    <div ref={layer} className="stage-layer" aria-hidden="true">
      <Canvas
        frameloop="never"
        dpr={DPR[tier]}
        camera={{ fov: 30, near: 0.01, far: 30, position: [0.7, 0.6, 1.4] }}
        gl={{
          antialias: initialTier === 1,
          powerPreference: "high-performance",
          toneMapping: AgXToneMapping,
        }}
        onCreated={({ gl }) => {
          unwatch.current?.();
          unwatch.current = watchContextLoss(gl.domElement, onFallback);
        }}
      >
        <Director
          store={store}
          layer={layer}
          capture={capture}
          onDecline={decline}
          focus={focus}
        />
        <StudioLights />
        <StackModel
          tier={tier}
          jobs={jobs}
          onReady={store.getState().setReady}
        />
        {tier >= 2 ? (
          <Effects
            extras={tier === 3 ? extras : null}
            focus={focus}
            onChange={store.getState().invalidate}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
