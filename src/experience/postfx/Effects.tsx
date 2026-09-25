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
import { type RefObject, useEffect, useMemo } from "react";
import { HalfFloatType, type Vector3 } from "three";

/** The tier 3 module (its own chunk): ambient occlusion and depth of field. */
export type Tier3Module = typeof import("./tier3");

/**
 * Tier 2+ post chain, built on `postprocessing` directly (the
 * @react-three/postprocessing bundle also ships every effect). The composer
 * renders into a float buffer, where the renderer's tone mapping does not
 * apply, so AgX runs as an effect, before anti-aliasing. FXAA, not SMAA:
 * SMAA embeds its lookup textures (+54 KB gz in the lazy chunk). Tier 3 adds
 * ambient occlusion (N8AO) and bokeh depth of field (`extras`).
 */
export function Effects({
  extras,
  focus,
  onChange,
  chain,
}: {
  extras: Tier3Module | null;
  /** World point the depth of field keeps sharp (tier 3). */
  focus: Vector3;
  /** Called when the chain changed and a new frame is due. */
  onChange: () => void;
  /** Receives the composer, so the stage can compile its passes early. */
  chain: RefObject<EffectComposer | null>;
}) {
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
    const t3 = extras?.tier3Effects(scene, camera, focus, 1, 1);
    if (t3) {
      composer.addPass(t3.ao);
    }
    composer.addPass(
      new EffectPass(
        camera,
        ...(t3 ? [t3.depthOfField] : []),
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
  }, [gl, scene, camera, extras, focus]);

  // setSize reads the renderer's pixel ratio, so a DPR change resizes too.
  useEffect(() => {
    if (dpr > 0) composer.setSize(size.width, size.height);
    onChange();
  }, [composer, size, dpr, onChange]);

  useEffect(() => {
    chain.current = composer;
    return () => {
      chain.current = null;
      composer.dispose();
    };
  }, [composer, chain]);

  // Priority 1 takes over rendering from R3F.
  useFrame((_, delta) => composer.render(delta), 1);

  return null;
}
