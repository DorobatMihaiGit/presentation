import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  PlaneGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { StackLayer } from "@/content/types";
import type { Tier } from "../gpu-tier";
import { createStackMaterials, disposeMaterials } from "./materials";
import { PCB_TRACE_PATH, traceRibbon } from "./pcb-traces";
import {
  LAYER_HEIGHT,
  STACK_FOOTPRINT,
  STACK_OBJECTS,
  stackLayout,
} from "./stack-layout";
import {
  ENGRAVE_CONTACT_TEXT,
  ENGRAVE_HERO_TEXT,
  etchingTexture,
  pcbTexture,
} from "./textures";

/**
 * The seam between the director and the model. Shots only look objects up by
 * their asset-contract names (`scene.getObjectByName("engrave_hero")`), so an
 * artist-made `stack.glb` with the same names can replace ProceduralStack
 * without touching the director.
 */
export function StackModel({ tier }: { tier: Tier }) {
  return <ProceduralStack tier={tier} />;
}

const HALF = STACK_FOOTPRINT / 2;
const SURFACE = 0.0008;

function createGeometries() {
  const layers = Object.fromEntries(
    Object.entries(LAYER_HEIGHT).map(([layer, height]) => [
      layer,
      new RoundedBoxGeometry(
        STACK_FOOTPRINT,
        height,
        STACK_FOOTPRINT,
        4,
        layer === "interface" ? 0.008 : 0.005,
      ).translate(0, height / 2, 0),
    ]),
  ) as Record<StackLayer, RoundedBoxGeometry>;

  const ribbon = traceRibbon(PCB_TRACE_PATH, 0.004);
  const traces = new BufferGeometry();
  traces.setAttribute("position", new BufferAttribute(ribbon.positions, 3));
  traces.setAttribute("uv", new BufferAttribute(ribbon.uvs, 2));
  traces.setIndex(new BufferAttribute(ribbon.indices, 1));
  traces.computeVertexNormals();

  return {
    layers,
    traces,
    etchHero: new PlaneGeometry(0.34, 0.085).rotateX(-Math.PI / 2),
    etchContact: new PlaneGeometry(0.16, 0.04),
    led: new CylinderGeometry(0.0035, 0.0035, 0.002, 24).rotateX(Math.PI / 2),
  };
}

function ProceduralStack({ tier }: { tier: Tier }) {
  const geometries = useMemo(createGeometries, []);
  const textures = useMemo(
    () => ({
      pcb: pcbTexture(),
      etchHero: etchingTexture(ENGRAVE_HERO_TEXT),
      etchContact: etchingTexture(ENGRAVE_CONTACT_TEXT),
    }),
    [],
  );
  const materials = useMemo(
    () => createStackMaterials(tier, textures),
    [tier, textures],
  );

  useEffect(() => () => disposeMaterials(materials), [materials]);
  useEffect(
    () => () => {
      for (const texture of Object.values(textures)) texture.dispose();
      for (const geometry of Object.values(geometries.layers))
        geometry.dispose();
      geometries.traces.dispose();
      geometries.etchHero.dispose();
      geometries.etchContact.dispose();
      geometries.led.dispose();
    },
    [geometries, textures],
  );

  return (
    <group name="stack">
      {stackLayout().map(({ layer, name, height, y }) => (
        <mesh
          key={name}
          name={name}
          position-y={y}
          geometry={geometries.layers[layer]}
          material={materials.layers[layer]}
        >
          {layer === "interface" ? (
            <mesh
              name={STACK_OBJECTS.engraveHero}
              position={[0, height + SURFACE, 0.035]}
              geometry={geometries.etchHero}
              material={materials.etchHero}
              renderOrder={1}
            />
          ) : null}
          {layer === "infra" ? (
            <mesh
              name={STACK_OBJECTS.pcbTraces}
              position-y={height + SURFACE}
              geometry={geometries.traces}
              material={materials.copper}
            />
          ) : null}
          {layer === "craft" ? (
            <>
              <mesh
                name={STACK_OBJECTS.engraveContact}
                position={[0.06, height / 2, HALF + SURFACE]}
                geometry={geometries.etchContact}
                material={materials.etchContact}
                renderOrder={1}
              />
              <mesh
                name={STACK_OBJECTS.led}
                position={[-0.165, height / 2, HALF + 0.001]}
                geometry={geometries.led}
                material={materials.led}
              />
            </>
          ) : null}
        </mesh>
      ))}
    </group>
  );
}
