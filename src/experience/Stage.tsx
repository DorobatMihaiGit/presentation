"use client";

import { Canvas, useThree } from "@react-three/fiber";
import type { EffectComposer } from "postprocessing";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AgXToneMapping, Vector3 } from "three";
import type { Capture } from "./capture-mode";
import { watchContextLoss } from "./context-loss";
import { Director } from "./director/Director";
import { createStageStore } from "./director/store";
import { type LiveTier, lowerTier } from "./gpu-tier";
import { Effects, type Tier3Module } from "./postfx/Effects";
import { StackModel } from "./scenes/StackModel";
import { StudioLights } from "./scenes/StudioLights";
import { precompile, warmPasses } from "./warmup";

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
 * The stage mounts in steps, each in its own task, so none blocks the main
 * thread for long (M5 mounted everything at once: tasks of up to 128 ms).
 * The renderer comes first (step 0), then:
 */
const STEP = {
  environment: 1,
  model: 2,
  effects: 3,
  programs: 4,
  director: 5,
} as const;

/** Runs `task` in an idle period (or soon after, where there is none). */
function whenIdle(task: () => void): () => void {
  const idle = window.requestIdleCallback as
    | typeof requestIdleCallback
    | undefined;
  if (idle) {
    const handle = idle(task, { timeout: 500 });
    return () => cancelIdleCallback(handle);
  }
  const handle = window.setTimeout(task, 50);
  return () => clearTimeout(handle);
}

/**
 * Compiles every shader program before the first frame (warmup.ts): the
 * scene's, then the post chain's, one wait per task.
 */
function Programs({
  offscreen,
  chain,
  onDone,
}: {
  offscreen: boolean;
  chain: RefObject<EffectComposer | null>;
  onDone: () => void;
}) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    let current = true;
    precompile(gl, scene, camera, offscreen)
      .then(() => (chain.current ? warmPasses(chain.current, scene) : null))
      .then(() => {
        if (current) onDone();
      });
    return () => {
      current = false;
    };
  }, [gl, scene, camera, offscreen, chain, onDone]);

  return null;
}

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
  const [step, setStep] = useState(0);
  const [extras, setExtras] = useState<Tier3Module | null>(null);
  const store = useMemo(createStageStore, []);
  // What the depth of field focuses on (tier 3); the director moves it.
  const focus = useMemo(() => new Vector3(), []);
  // One chip per job on the PCB trace, in page order (read once, like SSR).
  const [jobs] = useState(
    () => document.querySelectorAll("#experience ol > li").length,
  );
  const layer = useRef<HTMLDivElement>(null);
  const chain = useRef<EffectComposer | null>(null);
  const unwatch = useRef<(() => void) | null>(null);
  const next = useCallback(() => setStep((current) => current + 1), []);

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

  // Tier 3's effects are a chunk of their own, in before the chain is built.
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

  // Steps 1–3 follow each other; the programs step moves on by itself.
  const waiting = step === STEP.model && tier === 3 && extras === null;
  useEffect(() => {
    if (step >= STEP.environment && step < STEP.programs && !waiting) {
      return whenIdle(next);
    }
  }, [step, waiting, next]);

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
          whenIdle(next);
        }}
      >
        {step >= STEP.environment ? <StudioLights /> : null}
        {step >= STEP.model ? (
          <StackModel
            tier={tier}
            jobs={jobs}
            onReady={store.getState().setReady}
          />
        ) : null}
        {step >= STEP.effects && tier >= 2 ? (
          <Effects
            extras={tier === 3 ? extras : null}
            focus={focus}
            onChange={store.getState().invalidate}
            chain={chain}
          />
        ) : null}
        {step === STEP.programs ? (
          <Programs offscreen={tier >= 2} chain={chain} onDone={next} />
        ) : null}
        {step >= STEP.director ? (
          <Director
            store={store}
            layer={layer}
            capture={capture}
            onDecline={decline}
            focus={focus}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
