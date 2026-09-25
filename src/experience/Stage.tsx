"use client";

import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgXToneMapping } from "three";
import type { Capture } from "./capture-mode";
import { Director } from "./director/Director";
import { createStageStore } from "./director/store";
import { type LiveTier, lowerTier } from "./gpu-tier";
import { Effects } from "./postfx/Effects";
import { StackModel } from "./scenes/StackModel";
import { StudioLights } from "./scenes/StudioLights";

export type StageProps = {
  tier: LiveTier;
  capture: Capture | null;
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
  onFallback,
}: StageProps) {
  const [tier, setTier] = useState<LiveTier>(initialTier);
  const store = useMemo(createStageStore, []);
  const layer = useRef<HTMLDivElement>(null);

  const decline = useCallback(() => {
    const next = lowerTier(tier);
    if (next === null) {
      onFallback();
    } else {
      setTier(next);
    }
  }, [tier, onFallback]);

  useEffect(() => {
    document.documentElement.dataset.tier = String(tier);
    store.getState().invalidate();
  }, [tier, store]);

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
          gl.domElement.addEventListener("webglcontextlost", (event) => {
            event.preventDefault();
            onFallback();
          });
        }}
      >
        <Director
          store={store}
          layer={layer}
          capture={capture}
          onDecline={decline}
        />
        <StudioLights />
        <StackModel tier={tier} />
        {tier >= 2 ? <Effects /> : null}
      </Canvas>
    </div>
  );
}
