import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp, { type Sharp } from "sharp";
import type {
  SurfaceMapManifest,
  SurfaceMapName,
} from "@/experience/scenes/surface-maps";

// Surface detail maps for the stack's materials, from Poly Haven (CC0,
// https://polyhaven.com/license). Downloads each pinned 1k JPG once into
// .data/textures (checked against its sha256), turns it into a WebP and
// writes content-hashed files to public/textures plus the manifest
// src/experience/textures.json. Only this script touches the network; the
// site serves the committed WebP files itself.

type Source = {
  name: SurfaceMapName;
  asset: string;
  author: string;
  url: string;
  sha256: string;
  size: number;
  process: (image: Sharp) => Sharp;
};

const SOURCES: Source[] = [
  {
    // Fine linear grooves: reads as brushed metal at a few tiles per slab.
    name: "brushed-normal",
    asset: "https://polyhaven.com/a/brushed_concrete_04",
    author: "Amal Kumar",
    url: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/brushed_concrete_04/brushed_concrete_04_nor_gl_1k.jpg",
    sha256: "2b54d6df4c0c07e80d64a0ce55e70e44bc4a55bc375d81d3a89a8b17d502e088",
    size: 512,
    process: (image) => image,
  },
  {
    // Smudges and hairline scratches: breaks up glass and ceramic highlights.
    name: "smudge-roughness",
    asset: "https://polyhaven.com/a/smooth_concrete_floor",
    author: "Dimitrios Savva",
    url: "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/smooth_concrete_floor/smooth_concrete_floor_rough_1k.jpg",
    sha256: "89082ede1efd3a60fd600a49e381a5822c89ee3bf75456ad883b3057190042a5",
    size: 512,
    process: (image) => image.greyscale().normalise().blur(0.6),
  },
];

const CACHE = ".data/textures";
const OUT_DIR = "public/textures";
const MANIFEST = "src/experience/textures.json";

async function download(source: Source): Promise<Buffer> {
  const file = join(CACHE, `${source.name}.jpg`);
  if (!existsSync(file)) {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`${source.url}: HTTP ${response.status}`);
    }
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const bytes = readFileSync(file);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== source.sha256) {
    rmSync(file);
    throw new Error(`${source.url}: sha256 ${sha}, expected ${source.sha256}`);
  }
  return bytes;
}

async function main() {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });
  const manifest = {} as SurfaceMapManifest;
  const written = new Set<string>();
  for (const source of SOURCES) {
    const webp = await source
      .process(sharp(await download(source)).resize(source.size, source.size))
      .webp({ quality: 80 })
      .toBuffer();
    const hash = createHash("sha256").update(webp).digest("hex").slice(0, 8);
    const file = `${source.name}.${hash}.webp`;
    writeFileSync(join(OUT_DIR, file), webp);
    written.add(file);
    manifest[source.name] = {
      src: `/textures/${file}`,
      size: source.size,
      bytes: webp.length,
      source: source.asset,
      author: source.author,
      license: "CC0-1.0",
    };
    console.log(`${file}  ${(webp.length / 1024).toFixed(1)} KB`);
  }
  for (const file of readdirSync(OUT_DIR)) {
    if (!written.has(file)) rmSync(join(OUT_DIR, file));
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${written.size} files and ${MANIFEST}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
