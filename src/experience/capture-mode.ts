import type { SceneId } from "@/components/ui/Section";
import { SCENE_IDS } from "./scene-ids";

/**
 * `?capture=<scene>&p=<0..1>`: deterministic poster capture (scripts/posters.ts).
 * The page hides its DOM, skips Lenis and ScrollTrigger, renders the scene at
 * the given progress and sets `data-canvas="captured"` on <html>.
 */
export type Capture = { scene: SceneId; progress: number };

export function captureFromSearch(search: string): Capture | null {
  const params = new URLSearchParams(search);
  const scene = params.get("capture");
  const progress = Number(params.get("p") ?? "0");
  if (
    !SCENE_IDS.includes(scene as SceneId) ||
    !Number.isFinite(progress) ||
    progress < 0 ||
    progress > 1
  ) {
    return null;
  }
  return { scene: scene as SceneId, progress };
}
