import type { SceneId } from "@/components/ui/Section";

/** Every section that hosts a scene, in page order. */
export const SCENE_IDS = [
  "hero",
  "about",
  "skills",
  "experience",
  "contact",
] as const satisfies readonly SceneId[];
