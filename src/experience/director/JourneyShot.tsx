import { useFrame } from "@react-three/fiber";
import { type RefObject, useMemo } from "react";
import type {
  Material,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
} from "three";
import { STACK_LAYERS } from "@/content/types";
import { edgeObjectName } from "../scenes/edges";
import type { PulseUniforms } from "../scenes/materials";
import { STACK_SHADOW } from "../scenes/StudioLights";
import { STACK_OBJECTS, stackLayout } from "../scenes/stack-layout";
import { coverViewOffset, orientationOf, REFERENCE_SIZE } from "./framing";
import { type JourneyFrame, litJob } from "./journey";
import type { Motion } from "./motion";
import { anchorRows, findPageLinks, markLit } from "./page-links";
import { SHOT_FOV } from "./shots";

/** Pointer parallax: camera orbit (rad) and rim-light swing at full tilt. */
const PARALLAX = { yaw: 0.06, pitch: 0.035, light: 0.3 } as const;

/** Journey time during which Skills rows follow their layers. */
const ANCHORED = { from: 1.8, to: 3.3 } as const;

function materialOf<T extends Material = MeshStandardMaterial>(
  scene: Object3D,
  name: string,
): T | undefined {
  const mesh = scene.getObjectByName(name) as
    | (Object3D & { material: T })
    | undefined;
  return mesh?.material;
}

/**
 * Applies the current journey frame (Director) to the scene: camera framed
 * like the posters (cover crop of a reference frame), pointer parallax,
 * stack pose (yaw, glass lift, explode, turntable) and the etchings. Objects
 * are found by their asset-contract names only (StackModel seam).
 */
export function JourneyShot({
  motion,
  frame,
}: {
  motion: Motion;
  frame: RefObject<JourneyFrame>;
}) {
  const links = useMemo(findPageLinks, []);

  useFrame((state) => {
    const current = frame.current;
    const camera = state.camera as PerspectiveCamera;
    const { width, height } = state.size;
    const orientation = orientationOf(width, height);
    const reference = REFERENCE_SIZE[orientation];

    const view = coverViewOffset(
      width,
      height,
      reference.width / reference.height,
    );
    camera.fov = SHOT_FOV[orientation];
    camera.aspect = reference.width / reference.height;
    camera.setViewOffset(
      view.fullWidth,
      view.fullHeight,
      view.x,
      view.y,
      view.width,
      view.height,
    );

    // Orbit the camera around its target, a few degrees towards the pointer.
    const [px, py, pz] = current.position;
    const [tx, ty, tz] = current.target;
    const yaw = -motion.pointerX.value * PARALLAX.yaw;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const dx = px - tx;
    const dz = pz - tz;
    const reach = Math.hypot(dx, py - ty, dz);
    camera.position.set(
      tx + dx * cos + dz * sin,
      py + motion.pointerY.value * PARALLAX.pitch * reach,
      tz - dx * sin + dz * cos,
    );
    camera.lookAt(tx, ty, tz);
    camera.updateProjectionMatrix();

    const { scene } = state;
    scene.environmentRotation.y =
      current.envRotation + motion.pointerX.value * PARALLAX.light;

    const turn = current.yaw + motion.turntable.value;
    for (const placement of stackLayout(current.explode)) {
      const layer = scene.getObjectByName(placement.name);
      if (layer) {
        layer.position.y =
          placement.y + (placement.layer === "interface" ? current.lift : 0);
        layer.rotation.y = turn;
      }
    }
    const shadow = scene.getObjectByName(STACK_SHADOW);
    if (shadow) {
      shadow.rotation.z = turn;
    }

    const hero = materialOf(scene, STACK_OBJECTS.engraveHero);
    if (hero) {
      hero.opacity = 0.2 + current.engraveHero * 0.55;
      hero.emissiveIntensity = current.engraveHero * 0.15 + current.glint * 1.4;
    }
    const contact = materialOf(scene, STACK_OBJECTS.engraveContact);
    if (contact) {
      contact.opacity = current.engraveContact * 0.75;
      contact.emissiveIntensity = current.engraveContact * 0.2;
    }
    const led = materialOf(scene, STACK_OBJECTS.led);
    if (led) {
      led.emissiveIntensity = 0.8 + motion.led * 9;
    }
    const pulse = materialOf(scene, STACK_OBJECTS.pcbTraces)?.userData.pulse as
      | PulseUniforms
      | undefined;
    if (pulse) {
      pulse.uPulse.value = current.pulse;
      pulse.uPulseGlow.value = current.pulseGlow;
    }
    for (const layer of STACK_LAYERS) {
      const edge = scene.getObjectByName(edgeObjectName(layer)) as
        | (Object3D & { material: Material })
        | undefined;
      if (edge) {
        const glow = motion.glow[layer].value;
        edge.visible = glow > 0.01;
        edge.material.opacity = glow;
      }
    }

    if (current.time > ANCHORED.from && current.time < ANCHORED.to) {
      anchorRows(links, scene, camera, width, height, current.skillRows);
    }
    markLit(links, motion.lit, litJob(current, links.jobs.length));
  });

  return null;
}
