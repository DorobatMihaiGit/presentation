import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { STACK_LAYERS, type StackLayer } from "@/content/types";
import type { Tier } from "../gpu-tier";
import surfaceMapManifest from "../textures.json";
import { edgeFrameGeometry, edgeObjectName } from "./edges";
import { createStackMaterials, disposeMaterials } from "./materials";
import {
  jobChipU,
  PCB_TRACE_PATH,
  pointOnPath,
  traceRibbon,
} from "./pcb-traces";
import {
  LAYER_HEIGHT,
  STACK_FOOTPRINT,
  STACK_OBJECTS,
  stackLayout,
} from "./stack-layout";
import {
  loadSurfaceMaps,
  neutralSurfaceMaps,
  type SurfaceMapManifest,
} from "./surface-maps";
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
export function StackModel(props: StackModelProps) {
  return <ProceduralStack {...props} />;
}

export type StackModelProps = {
  tier: Tier;
  /** The detail maps are in (or failed): time for a new frame. */
  onReady: () => void;
  /** Jobs in the Experience section: one chip each along the PCB trace. */
  jobs: number;
};

const ASSET_BASE = (process.env.NEXT_PUBLIC_ASSET_BASE ?? "").replace(
  /\/$/,
  "",
);

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
    edge: edgeFrameGeometry(STACK_FOOTPRINT + 0.003, 0.0045, 0.008),
    chip: new BoxGeometry(0.022, 0.003, 0.016),
  };
}

function createDecor() {
  return {
    edges: Object.fromEntries(
      STACK_LAYERS.map((layer) => [
        layer,
        new MeshBasicMaterial({
          color: "#9fd6ff",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          toneMapped: false,
        }),
      ]),
    ) as Record<StackLayer, MeshBasicMaterial>,
    chip: new MeshStandardMaterial({
      color: "#15181d",
      roughness: 0.35,
      metalness: 0.2,
    }),
  };
}

function ProceduralStack({ tier, onReady, jobs }: StackModelProps) {
  const geometries = useMemo(createGeometries, []);
  const decor = useMemo(createDecor, []);
  const maps = useMemo(neutralSurfaceMaps, []);
  const textures = useMemo(
    () => ({
      pcb: pcbTexture(),
      etchHero: etchingTexture(ENGRAVE_HERO_TEXT),
      etchContact: etchingTexture(ENGRAVE_CONTACT_TEXT),
    }),
    [],
  );
  const materials = useMemo(
    () => createStackMaterials(tier, textures, maps),
    [tier, textures, maps],
  );

  useEffect(() => () => disposeMaterials(materials), [materials]);
  useEffect(() => {
    let current = true;
    loadSurfaceMaps(
      maps,
      surfaceMapManifest as SurfaceMapManifest,
      ASSET_BASE,
    ).then(() => {
      if (current) onReady();
    });
    return () => {
      current = false;
    };
  }, [maps, onReady]);
  useEffect(
    () => () => {
      for (const texture of Object.values(textures)) texture.dispose();
      for (const texture of Object.values(maps)) texture.dispose();
      for (const geometry of Object.values(geometries.layers))
        geometry.dispose();
      geometries.traces.dispose();
      geometries.etchHero.dispose();
      geometries.etchContact.dispose();
      geometries.led.dispose();
      geometries.edge.dispose();
      geometries.chip.dispose();
      for (const material of Object.values(decor.edges)) material.dispose();
      decor.chip.dispose();
    },
    [geometries, textures, maps, decor],
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
          <mesh
            name={edgeObjectName(layer)}
            position-y={height + 0.0006}
            geometry={geometries.edge}
            material={decor.edges[layer]}
            renderOrder={2}
            visible={false}
          />
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
            <>
              <mesh
                name={STACK_OBJECTS.pcbTraces}
                position-y={height + SURFACE}
                geometry={geometries.traces}
                material={materials.copper}
              />
              {Array.from({ length: jobs }, (_, index) => {
                const [x, z] = pointOnPath(
                  PCB_TRACE_PATH,
                  jobChipU(index, jobs),
                );
                return (
                  <mesh
                    // biome-ignore lint/suspicious/noArrayIndexKey: chips are positional
                    key={index}
                    position={[x, height + 0.0015, z]}
                    geometry={geometries.chip}
                    material={decor.chip}
                  />
                );
              })}
            </>
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
