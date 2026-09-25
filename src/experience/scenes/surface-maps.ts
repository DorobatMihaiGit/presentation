import { ImageBitmapLoader, RepeatWrapping, Texture } from "three";

/**
 * Detail maps for the materials (scripts/textures.ts, Poly Haven CC0):
 * brushed grooves for the metals, smudges for glass and ceramic.
 */
export const SURFACE_MAPS = ["brushed-normal", "smudge-roughness"] as const;

export type SurfaceMapName = (typeof SURFACE_MAPS)[number];

export type SurfaceMapFile = {
  src: string;
  size: number;
  bytes: number;
  source: string;
  author: string;
  license: "CC0-1.0";
};

export type SurfaceMapManifest = Record<SurfaceMapName, SurfaceMapFile>;

export type SurfaceMaps = Record<SurfaceMapName, Texture>;

/** Tiles per slab face (0.4 m): fine grooves, larger smudges. */
const REPEAT: Record<SurfaceMapName, number> = {
  "brushed-normal": 3,
  "smudge-roughness": 1,
};

/**
 * 1x1 stand-ins (a flat normal, full roughness), so the materials compile
 * with their maps from the first frame and swapping in the real images
 * later never recompiles a shader.
 */
export function neutralSurfaceMaps(): SurfaceMaps {
  const pixel = (r: number, g: number, b: number) => {
    const texture = new Texture(
      new ImageData(new Uint8ClampedArray([r, g, b, 255]), 1, 1),
    );
    texture.needsUpdate = true;
    return texture;
  };
  return {
    "brushed-normal": pixel(128, 128, 255),
    "smudge-roughness": pixel(255, 255, 255),
  };
}

/**
 * Fetches and decodes the maps off the main thread (createImageBitmap), and
 * copies each image into the matching stand-in texture. Resolves when all
 * are in; failures leave the stand-ins (the stack just looks cleaner).
 */
export async function loadSurfaceMaps(
  maps: SurfaceMaps,
  manifest: SurfaceMapManifest,
  base = "",
): Promise<void> {
  const loader = new ImageBitmapLoader().setOptions({
    imageOrientation: "flipY",
    premultiplyAlpha: "none",
    colorSpaceConversion: "none",
  });
  await Promise.all(
    SURFACE_MAPS.map(async (name) => {
      try {
        const bitmap = await loader.loadAsync(`${base}${manifest[name].src}`);
        const texture = maps[name];
        texture.image = bitmap;
        texture.flipY = false;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(REPEAT[name], REPEAT[name]);
        texture.anisotropy = 4;
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
      } catch {
        // Keep the neutral stand-in.
      }
    }),
  );
}
