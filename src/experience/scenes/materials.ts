import {
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Texture,
} from "three";
import type { StackLayer } from "@/content/types";
import type { Tier } from "../gpu-tier";

export type StackMaterials = {
  layers: Record<StackLayer, MeshPhysicalMaterial>;
  copper: MeshPhysicalMaterial;
  etchHero: MeshStandardMaterial;
  etchContact: MeshStandardMaterial;
  led: MeshStandardMaterial;
};

function etching(alphaMap: Texture) {
  // Frosted etching: invisible until a shot raises opacity; emissive adds
  // the glint while the softbox sweep passes over it.
  return new MeshStandardMaterial({
    color: "#f2f6fb",
    alphaMap,
    transparent: true,
    opacity: 0,
    roughness: 0.9,
    metalness: 0,
    emissive: "#e8f3ff",
    emissiveIntensity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
}

/** Tier 1 drops transmission (an extra full-scene render pass per frame). */
export function createStackMaterials(
  tier: Tier,
  textures: {
    pcb: Texture;
    etchHero: Texture;
    etchContact: Texture;
  },
): StackMaterials {
  const transmissive = tier >= 2;
  return {
    layers: {
      interface: new MeshPhysicalMaterial({
        color: "#e4f3ff",
        roughness: 0.04,
        metalness: 0,
        ior: 1.5,
        transmission: transmissive ? 1 : 0,
        thickness: 0.05,
        attenuationColor: "#bfe2ff",
        attenuationDistance: 0.6,
        transparent: !transmissive,
        opacity: transmissive ? 1 : 0.4,
        iridescence: 1,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [140, 420],
        specularIntensity: 1,
      }),
      api: new MeshPhysicalMaterial({
        color: "#c9ced6",
        metalness: 1,
        roughness: 0.3,
        anisotropy: 0.9,
        anisotropyRotation: Math.PI / 2,
      }),
      data: new MeshPhysicalMaterial({
        color: "#e6e1d6",
        metalness: 0,
        roughness: 0.45,
        clearcoat: 0.8,
        clearcoatRoughness: 0.14,
      }),
      infra: new MeshPhysicalMaterial({
        map: textures.pcb,
        metalness: 0.15,
        roughness: 0.55,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
      }),
      craft: new MeshPhysicalMaterial({
        color: "#6f7a8c",
        metalness: 1,
        roughness: 0.4,
        anisotropy: 0.45,
        clearcoat: 0.25,
        clearcoatRoughness: 0.2,
      }),
    },
    copper: new MeshPhysicalMaterial({
      color: "#c27a46",
      metalness: 1,
      roughness: 0.26,
      emissive: "#ff9d5c",
      emissiveIntensity: 0,
    }),
    etchHero: etching(textures.etchHero),
    etchContact: etching(textures.etchContact),
    led: new MeshStandardMaterial({
      color: "#0a1720",
      emissive: "#7cc5ff",
      emissiveIntensity: 0.8,
      roughness: 0.3,
    }),
  };
}

export function disposeMaterials(materials: StackMaterials): void {
  const all: Material[] = [
    ...Object.values(materials.layers),
    materials.copper,
    materials.etchHero,
    materials.etchContact,
    materials.led,
  ];
  for (const material of all) {
    material.dispose();
  }
}
