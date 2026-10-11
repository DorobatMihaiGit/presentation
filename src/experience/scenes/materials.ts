import {
  type Material,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Texture,
  Vector2,
} from "three";
import type { StackLayer } from "@/content/types";
import type { Tier } from "../gpu-tier";
import type { SurfaceMaps } from "./surface-maps";

/** Shader inputs of the light pulse that runs along `pcb_traces`. */
export type PulseUniforms = {
  /** Head position along the trace (U, 0..1). */
  uPulse: { value: number };
  /** Brightness, 0 = dark. */
  uPulseGlow: { value: number };
};

export type StackMaterials = {
  layers: Record<StackLayer, MeshPhysicalMaterial>;
  /** The circuit board's four cut edges and its underside (FR4). */
  pcbEdge: MeshPhysicalMaterial;
  copper: MeshPhysicalMaterial;
  pulse: PulseUniforms;
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

type ShaderSource = {
  uniforms: Record<string, { value: unknown }>;
  vertexShader: string;
  fragmentShader: string;
};

/**
 * Adds the pulse to a standard/physical material's shader: a bright head at
 * `uPulse` along the ribbon's U coordinate and a fading trail behind it,
 * added to the emissive light (so bloom picks it up).
 */
export function injectPulse(shader: ShaderSource, pulse: PulseUniforms): void {
  shader.uniforms.uPulse = pulse.uPulse;
  shader.uniforms.uPulseGlow = pulse.uPulseGlow;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying float vTraceU;")
    .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTraceU = uv.x;");
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying float vTraceU;\nuniform float uPulse;\nuniform float uPulseGlow;",
    )
    .replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
float pulseHead = exp(-pow((vTraceU - uPulse) / 0.03, 2.0));
float pulseTrail = step(vTraceU, uPulse) * smoothstep(uPulse - 0.3, uPulse, vTraceU);
totalEmissiveRadiance += vec3(1.0, 0.6, 0.32) * uPulseGlow * (pulseHead * 7.0 + pulseTrail * 0.8);`,
    );
}

/**
 * Tier 1 drops transmission (an extra full-scene render pass per frame).
 * `maps` are the Poly Haven detail maps (neutral stand-ins until loaded):
 * brushed grooves on the two metals, smudges on glass and ceramic.
 */
export function createStackMaterials(
  tier: Tier,
  textures: {
    pcb: Texture;
    pcbSurface: Texture;
    pcbEdge: Texture;
    etchHero: Texture;
    etchContact: Texture;
  },
  maps: SurfaceMaps,
): StackMaterials {
  const transmissive = tier >= 2;
  const pulse: PulseUniforms = {
    uPulse: { value: 0 },
    uPulseGlow: { value: 0 },
  };
  const copper = new MeshPhysicalMaterial({
    color: "#c27a46",
    metalness: 1,
    roughness: 0.26,
  });
  copper.userData.pulse = pulse;
  copper.onBeforeCompile = (shader) => injectPulse(shader, pulse);
  copper.customProgramCacheKey = () => "pcb-pulse";
  const brushed = maps["brushed-normal"];
  const smudge = maps["smudge-roughness"];
  return {
    layers: {
      // Frosted glass: the smudged roughness blurs what lies beneath instead
      // of refracting it into a hard dark band.
      interface: new MeshPhysicalMaterial({
        color: "#eef7ff",
        roughness: 0.2,
        roughnessMap: smudge,
        metalness: 0,
        ior: 1.5,
        transmission: transmissive ? 1 : 0,
        thickness: 0.012,
        attenuationColor: "#d6ecff",
        attenuationDistance: 1.2,
        transparent: !transmissive,
        opacity: transmissive ? 1 : 0.55,
        // A hint of thin-film colour; no clearcoat: its second, 0.04-rough
        // highlight broke into dots along the far edges.
        iridescence: 0.3,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [140, 420],
        specularIntensity: 1,
      }),
      api: new MeshPhysicalMaterial({
        color: "#d3d8e0",
        metalness: 1,
        roughness: 0.34,
        normalMap: brushed,
        normalScale: new Vector2(0.18, 0.18),
        anisotropy: 0.35,
      }),
      data: new MeshPhysicalMaterial({
        color: "#e6e1d6",
        metalness: 0,
        roughness: 0.5,
        clearcoat: 0.8,
        clearcoatRoughness: 0.35,
        clearcoatRoughnessMap: smudge,
      }),
      // Copper that reflects like metal, a solder mask that does not
      // (the surface map sets both, per pixel).
      infra: new MeshPhysicalMaterial({
        map: textures.pcb,
        metalnessMap: textures.pcbSurface,
        roughnessMap: textures.pcbSurface,
        metalness: 1,
        roughness: 1,
        clearcoat: 0.4,
        clearcoatRoughness: 0.3,
      }),
      craft: new MeshPhysicalMaterial({
        color: "#7b8698",
        metalness: 1,
        roughness: 0.42,
        normalMap: brushed,
        normalScale: new Vector2(0.12, 0.12),
        anisotropy: 0.45,
        clearcoat: 0.25,
        clearcoatRoughness: 0.2,
      }),
    },
    pcbEdge: new MeshPhysicalMaterial({
      map: textures.pcbEdge,
      metalness: 0,
      roughness: 0.6,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
    }),
    copper,
    pulse,
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

/**
 * A layer's material(s): the circuit board prints its texture on the top
 * face only (RoundedBoxGeometry keeps BoxGeometry's face groups: +x, -x, +y,
 * -y, +z, -z); every other slab is one material all round.
 */
export function layerMaterials(
  materials: StackMaterials,
  layer: StackLayer,
): Material | Material[] {
  if (layer !== "infra") {
    return materials.layers[layer];
  }
  const edge = materials.pcbEdge;
  return [edge, edge, materials.layers.infra, edge, edge, edge];
}

export function disposeMaterials(materials: StackMaterials): void {
  const all: Material[] = [
    materials.pcbEdge,
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
