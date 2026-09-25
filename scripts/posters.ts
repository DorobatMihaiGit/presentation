import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";
import {
  type Orientation,
  REFERENCE_SIZE,
} from "@/experience/director/framing";
import {
  POSTER_SHOTS,
  POSTER_WIDTHS,
  type PosterImage,
  type PosterManifest,
  type PosterName,
} from "@/experience/poster-shots";
import { posterSourceHash } from "./poster-sources";

// Captures every POSTER_SHOTS frame from the production build (`?capture=`
// mode, tier 2) and writes content-hashed AVIF + WebP files to public/posters
// and the manifest to src/experience/posters.json. Run after `pnpm build`.
// POSTERS_SOFTWARE=1 renders with SwiftShader instead of the GPU (CI, VMs).

const PORT = 3400;
const BASE = `http://localhost:${PORT}`;
const OUT_DIR = "public/posters";
const MANIFEST = "src/experience/posters.json";
const GPU_ARGS = [
  "--use-angle=vulkan",
  "--enable-features=Vulkan",
  "--enable-gpu",
  "--ignore-gpu-blocklist",
];

async function startServer(): Promise<ChildProcess> {
  if (!existsSync(".next/BUILD_ID")) {
    throw new Error("No production build: run `pnpm build` first.");
  }
  const server = spawn("pnpm", ["exec", "next", "start", "--port", `${PORT}`], {
    stdio: "ignore",
    detached: true,
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      if ((await fetch(`${BASE}/en`)).ok) return server;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`next start did not answer on port ${PORT}`);
}

async function encode(
  png: Buffer,
  name: string,
  orientation: Orientation,
  written: Set<string>,
): Promise<PosterImage> {
  const { width, height } = REFERENCE_SIZE[orientation];
  const image: PosterImage = { width, height, avif: [], webp: [] };
  for (const size of POSTER_WIDTHS[orientation]) {
    const resized = sharp(png).resize({ width: size });
    const files = {
      avif: await resized.clone().avif({ quality: 50, effort: 6 }).toBuffer(),
      webp: await resized.clone().webp({ quality: 75 }).toBuffer(),
    };
    for (const [format, bytes] of Object.entries(files) as [
      "avif" | "webp",
      Buffer,
    ][]) {
      const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 8);
      const file = `${name}-${orientation}-${size}.${hash}.${format}`;
      writeFileSync(join(OUT_DIR, file), bytes);
      written.add(file);
      image[format].push({ width: size, src: `/posters/${file}` });
      console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} KB`);
    }
  }
  return image;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({
    args: process.env.POSTERS_SOFTWARE === "1" ? [] : GPU_ARGS,
  });
  const written = new Set<string>();
  const shots = {} as PosterManifest["shots"];
  try {
    for (const orientation of ["landscape", "portrait"] as const) {
      const page = await browser.newPage({
        viewport: REFERENCE_SIZE[orientation],
        deviceScaleFactor: 1,
      });
      for (const shot of POSTER_SHOTS) {
        await page.goto(
          `${BASE}/en?capture=${shot.scene}&p=${shot.progress}&tier=2`,
        );
        await page.waitForFunction(
          () => document.documentElement.dataset.canvas === "captured",
          null,
          { timeout: 120_000 },
        );
        const png = await page.screenshot();
        shots[shot.name as PosterName] ??= {} as Record<
          Orientation,
          PosterImage
        >;
        shots[shot.name as PosterName][orientation] = await encode(
          png,
          shot.name,
          orientation,
          written,
        );
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (server.pid) process.kill(-server.pid);
  }

  for (const file of readdirSync(OUT_DIR)) {
    if (!written.has(file)) rmSync(join(OUT_DIR, file));
  }
  const manifest: PosterManifest = { sourceHash: posterSourceHash(), shots };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${written.size} files and ${MANIFEST}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
