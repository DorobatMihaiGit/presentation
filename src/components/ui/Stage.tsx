import { STACK_LAYERS } from "@/content/types";
import type { SceneId } from "./Section";

type StageProps = {
  scene: SceneId;
  className?: string;
};

/**
 * Decorative placeholder that reserves the box a scene will occupy in M5
 * (fixed aspect ratio, so swapping in a canvas or poster causes no layout shift).
 */
export function Stage({ scene, className = "" }: StageProps) {
  return (
    <div
      aria-hidden="true"
      data-stage={scene}
      className={`stage flex aspect-[4/5] flex-col justify-center gap-[3%] px-[14%] ${className}`}
    >
      {STACK_LAYERS.map((layer) => (
        <div key={layer} data-layer={layer} className="slab" />
      ))}
    </div>
  );
}
