import { N8AOPostPass } from "n8ao";
import { DepthOfFieldEffect } from "postprocessing";
import type { Camera, Scene, Vector3 } from "three";

/**
 * Tier 3 extras, loaded as their own chunk only on tier 3 (spec §3: bokeh
 * DOF and ambient occlusion for discrete GPUs). Metres: the stack is 0.4 m
 * wide, so the AO radius and the focus range are small.
 */
export function tier3Effects(
  scene: Scene,
  camera: Camera,
  focus: Vector3,
  width: number,
  height: number,
) {
  const ao = new N8AOPostPass(scene, camera, width, height);
  ao.configuration.aoRadius = 0.06;
  ao.configuration.distanceFalloff = 0.3;
  ao.configuration.intensity = 2.5;
  ao.configuration.halfRes = true;
  ao.configuration.gammaCorrection = false;
  ao.setQualityMode("Medium");

  const depthOfField = new DepthOfFieldEffect(camera, {
    focusRange: 0.35,
    bokehScale: 2.5,
    resolutionScale: 0.5,
  });
  // Auto-focus on the point the journey looks at (Director keeps it current).
  depthOfField.target = focus;

  return { ao, depthOfField };
}
