import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh, MeshStandardMaterial, PerspectiveCamera } from "three";
import { STACK_OBJECTS } from "../scenes/stack-layout";
import { coverViewOffset, orientationOf, REFERENCE_SIZE } from "./framing";
import { heroFrame } from "./shots";
import type { StageStore } from "./store";

/** Vertical field of view per reference frame (a long product lens). */
const FOV = { landscape: 30, portrait: 42 } as const;

/** Shot S1: applies `heroFrame(progress)` to the camera, environment and etching. */
export function HeroShot({ store }: { store: StageStore }) {
  const etch = useRef<Mesh | undefined>(undefined);

  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const orientation = orientationOf(width, height);
    const reference = REFERENCE_SIZE[orientation];
    const frame = heroFrame(store.getState().progress.hero, orientation);

    const view = coverViewOffset(
      width,
      height,
      reference.width / reference.height,
    );
    camera.fov = FOV[orientation];
    camera.aspect = reference.width / reference.height;
    camera.setViewOffset(
      view.fullWidth,
      view.fullHeight,
      view.x,
      view.y,
      view.width,
      view.height,
    );
    camera.position.set(...frame.position);
    camera.lookAt(...frame.target);
    camera.updateProjectionMatrix();

    state.scene.environmentRotation.y = frame.envRotation;
    etch.current ??= state.scene.getObjectByName(STACK_OBJECTS.engraveHero) as
      | Mesh
      | undefined;
    const material = etch.current?.material as MeshStandardMaterial | undefined;
    if (material) {
      material.opacity = 0.2 + frame.engrave * 0.55;
      material.emissiveIntensity = frame.engrave * 0.15 + frame.glint * 1.4;
    }
  });

  return null;
}
