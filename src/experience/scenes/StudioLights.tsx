import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
} from "three";
import type { Tier } from "../gpu-tier";
import { contactShadow, SHADOW_PLANE, studioBackground } from "./studio";

type Softbox = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number];
  intensity: number;
  color?: string;
};

/**
 * Softboxes of a dark studio, drawn the way drei's Lightformer draws them:
 * unlit planes brighter than 1 that only exist inside the environment map.
 */
const SOFTBOXES: Softbox[] = [
  // Overhead
  {
    position: [0, 3, 0.6],
    rotation: [Math.PI / 2, 0, 0],
    scale: [3.2, 1.6],
    intensity: 2.6,
  },
  // Key strip, front left: the one the sweep drags across
  {
    position: [-2.4, 1.1, 2.2],
    rotation: [0, Math.PI / 4, 0],
    scale: [0.7, 3.6],
    intensity: 6,
  },
  // Cool rim, back right: the bright line along the far edges
  {
    position: [2.6, 0.8, -1.6],
    rotation: [0, -Math.PI / 1.6, 0],
    scale: [0.5, 3],
    intensity: 3.5,
    color: "#cfe6ff",
  },
  // Floor bounce
  {
    position: [0, -2, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [10, 10],
    intensity: 0.25,
  },
  // Soft cyclorama behind and above the stack: what top faces and the
  // glass reflect at the journey's high camera angles
  {
    position: [0, 2.6, -3],
    rotation: [-Math.PI / 7, 0, 0],
    scale: [12, 4.5],
    intensity: 0.7,
  },
  // Dim wall behind the camera, so brushed metal never reflects pure black
  {
    position: [0, 0.5, 4],
    rotation: [0, Math.PI, 0],
    scale: [10, 6],
    intensity: 0.6,
  },
];

function studioScene(): Scene {
  const studio = new Scene();
  const plane = new PlaneGeometry(1, 1);
  for (const box of SOFTBOXES) {
    const mesh = new Mesh(
      plane,
      new MeshBasicMaterial({
        color: new Color(box.color ?? "#ffffff").multiplyScalar(box.intensity),
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    mesh.position.set(...box.position);
    mesh.rotation.set(...box.rotation);
    mesh.scale.set(box.scale[0], box.scale[1], 1);
    studio.add(mesh);
  }
  return studio;
}

/** Name of the contact shadow; shots turn it with the stack. */
export const STACK_SHADOW = "stack_shadow";

/** The contact shadow as an alpha map (three reads its green channel). */
function shadowTexture(): DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const value = Math.round(
        255 *
          contactShadow(
            ((column + 0.5) / size - 0.5) * SHADOW_PLANE,
            ((row + 0.5) / size - 0.5) * SHADOW_PLANE,
          ),
      );
      data.fill(
        value,
        (row * size + column) * 4,
        (row * size + column) * 4 + 3,
      );
      data[(row * size + column) * 4 + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size);
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  // The hero's macro shot looks along the floor.
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Studio lighting without an HDRI: the softbox scene is rendered once into a
 * PMREM environment map (like three's RoomEnvironment). Shots rotate it
 * (`scene.environmentRotation`) to sweep the reflections.
 */
export function StudioLights({ tier }: { tier: Tier }) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const shadow = useMemo(shadowTexture, []);
  const background = useMemo(() => studioBackground(tier), [tier]);

  useEffect(() => () => shadow.dispose(), [shadow]);

  useEffect(() => {
    const studio = studioScene();
    const pmrem = new PMREMGenerator(gl);
    const target = pmrem.fromScene(studio, 0.02);
    pmrem.dispose();
    studio.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    scene.environment = target.texture;
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <color attach="background" args={[background]} />
      <mesh
        name={STACK_SHADOW}
        rotation-x={-Math.PI / 2}
        position-y={0.0002}
        renderOrder={-1}
      >
        <planeGeometry args={[SHADOW_PLANE, SHADOW_PLANE]} />
        <meshBasicMaterial
          color="#000000"
          alphaMap={shadow}
          transparent
          opacity={0.85}
          depthWrite={false}
          dithering
        />
      </mesh>
    </>
  );
}
