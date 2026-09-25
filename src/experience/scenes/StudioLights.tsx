import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  CanvasTexture,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
} from "three";

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
    intensity: 2.2,
  },
  // Key strip, front left: the one the sweep drags across
  {
    position: [-2.4, 1.1, 2.2],
    rotation: [0, Math.PI / 4, 0],
    scale: [0.7, 3.6],
    intensity: 5,
  },
  // Cool rim, back right
  {
    position: [2.6, 0.8, -1.6],
    rotation: [0, -Math.PI / 1.6, 0],
    scale: [0.5, 3],
    intensity: 2.4,
    color: "#cfe6ff",
  },
  // Floor bounce
  {
    position: [0, -2, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [10, 10],
    intensity: 0.25,
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

/** Soft square falloff, baked once: the monolith's contact shadow. */
function shadowTexture(): CanvasTexture {
  const size = 256;
  const element = document.createElement("canvas");
  element.width = size;
  element.height = size;
  const context = element.getContext("2d");
  if (context) {
    context.filter = "blur(18px)";
    context.fillStyle = "#fff";
    context.fillRect(size * 0.22, size * 0.22, size * 0.56, size * 0.56);
  }
  return new CanvasTexture(element);
}

/**
 * Studio lighting without an HDRI: the softbox scene is rendered once into a
 * PMREM environment map (like three's RoomEnvironment). Shots rotate it
 * (`scene.environmentRotation`) to sweep the reflections.
 */
export function StudioLights() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const shadow = useMemo(shadowTexture, []);

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
      <color attach="background" args={["#0b0c0f"]} />
      <mesh rotation-x={-Math.PI / 2} position-y={0.0002} renderOrder={-1}>
        <planeGeometry args={[0.62, 0.62]} />
        <meshBasicMaterial
          color="#000000"
          alphaMap={shadow}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
