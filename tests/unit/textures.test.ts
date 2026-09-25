import { existsSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  SURFACE_MAPS,
  type SurfaceMapManifest,
} from "@/experience/scenes/surface-maps";
import textures from "@/experience/textures.json";

const manifest = textures as SurfaceMapManifest;

// The texture budget: what the stage downloads besides its code, and what the
// maps cost in GPU memory (512 px RGBA with mipmaps is about 1.4 MB each).
const TEXTURE_BUDGET_KB = 256;
const MAX_SIZE = 512;

describe("committed surface maps", () => {
  it("cover every map the materials use, and nothing else is there", () => {
    const files = SURFACE_MAPS.map((name) =>
      manifest[name].src.replace("/textures/", ""),
    );
    for (const file of files) {
      expect(existsSync(`public/textures/${file}`), file).toBe(true);
    }
    expect(readdirSync("public/textures").sort()).toEqual(files.sort());
  });

  it(`stay within the texture budget (${TEXTURE_BUDGET_KB} KB, ${MAX_SIZE} px)`, () => {
    let total = 0;
    for (const name of SURFACE_MAPS) {
      const { src, size, bytes } = manifest[name];
      expect(statSync(`public${src}`).size).toBe(bytes);
      expect(size).toBeLessThanOrEqual(MAX_SIZE);
      total += bytes;
    }
    expect(total / 1024).toBeLessThanOrEqual(TEXTURE_BUDGET_KB);
  });

  it("are CC0 assets from Poly Haven, credited to their authors", () => {
    for (const name of SURFACE_MAPS) {
      const map = manifest[name];
      expect(map.license).toBe("CC0-1.0");
      expect(map.source).toMatch(/^https:\/\/polyhaven\.com\/a\/[a-z0-9_]+$/);
      expect(map.author.length).toBeGreaterThan(0);
    }
  });
});
