import { createStore } from "zustand/vanilla";
import type { StackLayer } from "@/content/types";

/** Changes smaller than this do not trigger a new frame. */
const EPSILON = 1e-4;

export type Pointer = { x: number; y: number };

export type StageState = {
  /** Journey time the scroll position asks for (0..JOURNEY_END). */
  journey: number;
  /** Fine pointer, -1..1 per axis from the viewport centre; 0,0 when away. */
  pointer: Pointer;
  /** Stack layer under the pointer or keyboard focus in Skills. */
  hoverLayer: StackLayer | null;
  /** The footer is on screen: the stack turns slowly (turntable). */
  idle: boolean;
  /** performance.now() of the last contact message sent (LED pulse). */
  ledPulseAt: number | null;
  /** The model's detail maps are in (poster capture waits for them). */
  ready: boolean;
  /** Something changed since the last rendered frame. */
  dirty: boolean;
  setJourney: (value: number) => void;
  setPointer: (x: number, y: number) => void;
  setHoverLayer: (layer: StackLayer | null) => void;
  setIdle: (idle: boolean) => void;
  pulseLed: (at: number) => void;
  setReady: () => void;
  /** Forces a frame (resize, tier change, new textures, moving springs). */
  invalidate: () => void;
  /** Returns whether a frame is due and clears the flag. */
  consume: () => boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function createStageStore() {
  return createStore<StageState>()((set, get) => ({
    journey: 0,
    pointer: { x: 0, y: 0 },
    hoverLayer: null,
    idle: false,
    ledPulseAt: null,
    ready: false,
    dirty: true,
    setJourney: (value) => {
      const next = Math.max(0, value);
      if (Math.abs(get().journey - next) < EPSILON) {
        return;
      }
      set({ journey: next, dirty: true });
    },
    setPointer: (x, y) => {
      const next = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
      const { pointer } = get();
      if (
        Math.abs(pointer.x - next.x) < EPSILON &&
        Math.abs(pointer.y - next.y) < EPSILON
      ) {
        return;
      }
      set({ pointer: next, dirty: true });
    },
    setHoverLayer: (layer) => {
      if (get().hoverLayer !== layer) {
        set({ hoverLayer: layer, dirty: true });
      }
    },
    setIdle: (idle) => {
      if (get().idle !== idle) {
        set({ idle, dirty: true });
      }
    },
    pulseLed: (at) => set({ ledPulseAt: at, dirty: true }),
    setReady: () => set({ ready: true, dirty: true }),
    invalidate: () => set({ dirty: true }),
    consume: () => {
      if (!get().dirty) {
        return false;
      }
      set({ dirty: false });
      return true;
    },
  }));
}

export type StageStore = ReturnType<typeof createStageStore>;
