import { STACK_LAYERS, type StackLayer } from "@/content/types";

/**
 * Asset contract v1 (docs/superpowers/specs, amendment 2026-09-24): a monolith
 * of five slabs, footprint 0.40 x 0.40 m, 0.25 m tall, base plate on the
 * ground centred on the origin, metres. Each layer's origin is the centre of
 * its own bottom face. An artist-made `stack.glb` must use the same names.
 */
export const STACK_OBJECTS = {
  engraveHero: "engrave_hero",
  engraveContact: "engrave_contact",
  led: "led_status",
  pcbTraces: "pcb_traces",
} as const;

export type LayerObjectName = `layer_${StackLayer}`;

export const layerObjectName = (layer: StackLayer): LayerObjectName =>
  `layer_${layer}`;

export const STACK_FOOTPRINT = 0.4;
export const STACK_HEIGHT = 0.25;
export const STACK_GAP = 0.005;

/** Slab heights; with four gaps they add up to STACK_HEIGHT. */
export const LAYER_HEIGHT: Record<StackLayer, number> = {
  interface: 0.05,
  api: 0.05,
  data: 0.05,
  infra: 0.035,
  craft: 0.045,
};

export type LayerPlacement = {
  layer: StackLayer;
  name: LayerObjectName;
  height: number;
  /** World y of the layer's origin (its bottom face). */
  y: number;
};

/**
 * Bottom-up placement. `explode` (0..1) opens extra space between the
 * layers for shot S2; 0 is the closed monolith.
 */
export function stackLayout(explode = 0): LayerPlacement[] {
  const spread = Math.min(1, Math.max(0, explode)) * 0.12;
  let y = 0;
  return [...STACK_LAYERS].reverse().map((layer, index) => {
    const placement: LayerPlacement = {
      layer,
      name: layerObjectName(layer),
      height: LAYER_HEIGHT[layer],
      y: y + index * spread,
    };
    y += LAYER_HEIGHT[layer] + STACK_GAP;
    return placement;
  });
}
