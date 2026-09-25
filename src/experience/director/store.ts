import { createStore } from "zustand/vanilla";
import type { SceneId } from "@/components/ui/Section";

/** Changes smaller than this do not trigger a new frame. */
const EPSILON = 1e-4;

export type StageState = {
  /** Scroll progress through each section's ScrollTrigger, 0..1. */
  progress: Record<SceneId, number>;
  /** The section crossing the middle of the viewport; picks the shot. */
  active: SceneId;
  /** Opacity of the fixed canvas layer (fades out after the hero). */
  opacity: number;
  /** Something changed since the last rendered frame. */
  dirty: boolean;
  setProgress: (scene: SceneId, value: number) => void;
  setOpacity: (value: number) => void;
  setActive: (scene: SceneId) => void;
  /** Forces a frame (resize, tier change, new textures). */
  invalidate: () => void;
  /** Returns whether a frame is due and clears the flag. */
  consume: () => boolean;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function createStageStore() {
  return createStore<StageState>()((set, get) => ({
    progress: { hero: 0, about: 0, skills: 0, experience: 0, contact: 0 },
    active: "hero",
    opacity: 1,
    dirty: true,
    setProgress: (scene, value) => {
      const next = clamp01(value);
      const { progress } = get();
      if (Math.abs(progress[scene] - next) < EPSILON) {
        return;
      }
      set({ progress: { ...progress, [scene]: next }, dirty: true });
    },
    setOpacity: (value) => {
      const next = clamp01(value);
      if (Math.abs(get().opacity - next) < EPSILON) {
        return;
      }
      set({ opacity: next, dirty: true });
    },
    setActive: (scene) => {
      if (get().active !== scene) {
        set({ active: scene, dirty: true });
      }
    },
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
