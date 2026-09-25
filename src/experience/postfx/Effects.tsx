import { useFrame, useThree } from "@react-three/fiber";
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  FXAAEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { useEffect, useMemo } from "react";
import { HalfFloatType } from "three";

/**
 * Tier 2+ post chain, built on `postprocessing` directly (the
 * @react-three/postprocessing bundle also ships N8AO and every other effect).
 * The composer renders into a float buffer, where the renderer's tone mapping
 * does not apply, so AgX runs as an effect, before anti-aliasing. FXAA, not
 * SMAA: SMAA embeds its lookup textures (+54 KB gz in the lazy chunk).
 * Tier 3 extras (bokeh DOF, N8AO, chromatic aberration) arrive in M6.
 */
export function Effects() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const dpr = useThree((state) => state.viewport.dpr);

  const composer = useMemo(() => {
    const composer = new EffectComposer(gl, {
      frameBufferType: HalfFloatType,
      multisampling: 0,
    });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new EffectPass(
        camera,
        new BloomEffect({
          mipmapBlur: true,
          luminanceThreshold: 0.9,
          intensity: 0.35,
        }),
        new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      ),
    );
    composer.addPass(new EffectPass(camera, new FXAAEffect()));
    return composer;
  }, [gl, scene, camera]);

  // setSize reads the renderer's pixel ratio, so a DPR change resizes too.
  useEffect(() => {
    if (dpr > 0) composer.setSize(size.width, size.height);
  }, [composer, size, dpr]);

  useEffect(() => () => composer.dispose(), [composer]);

  // Priority 1 takes over rendering from R3F.
  useFrame((_, delta) => composer.render(delta), 1);

  return null;
}
