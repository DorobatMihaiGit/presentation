import { existsSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  POSTER_SHOTS,
  POSTER_WIDTHS,
  type PosterManifest,
  SECTION_POSTERS,
  srcSet,
} from "@/experience/poster-shots";
import posters from "@/experience/posters.json";
import { SCENE_IDS } from "@/experience/scene-ids";
import { posterSourceHash } from "../../scripts/poster-sources";

const manifest = posters as PosterManifest;

describe("committed posters", () => {
  it("were captured from the current scene code", () => {
    // Fails after any change to the scene, shots or post chain:
    // run `pnpm build && pnpm assets:posters` and commit the result.
    expect(manifest.sourceHash).toBe(posterSourceHash());
  });

  it("cover every shot, orientation, width and format", () => {
    for (const shot of POSTER_SHOTS) {
      for (const orientation of ["landscape", "portrait"] as const) {
        const image = manifest.shots[shot.name][orientation];
        for (const format of ["avif", "webp"] as const) {
          expect(image[format].map((source) => source.width)).toEqual(
            POSTER_WIDTHS[orientation],
          );
        }
      }
    }
  });

  it("include one poster per scene section after the hero", () => {
    expect(SECTION_POSTERS).toEqual(SCENE_IDS.filter((id) => id !== "hero"));
    for (const name of SECTION_POSTERS) {
      expect(manifest.shots[name], name).toBeDefined();
    }
  });

  it("point at files in public/posters, and nothing else is there", () => {
    const referenced = Object.values(manifest.shots)
      .flatMap((shot) => Object.values(shot))
      .flatMap((image) => [...image.avif, ...image.webp])
      .map((source) => source.src.replace("/posters/", ""));

    for (const file of referenced) {
      expect(existsSync(`public/posters/${file}`), file).toBe(true);
    }
    expect(readdirSync("public/posters").sort()).toEqual(referenced.sort());
  });

  it("cost a visitor at most 400 KB (spec §3 budget)", () => {
    // A browser picks one file per poster: at worst the widest WebP of every
    // shot in its orientation (both hero frames counted, though it gets one).
    for (const orientation of ["landscape", "portrait"] as const) {
      const worst = Object.values(manifest.shots).reduce((sum, shot) => {
        const sizes = [
          ...shot[orientation].avif,
          ...shot[orientation].webp,
        ].map((source) => statSync(`public${source.src}`).size);
        return sum + Math.max(...sizes);
      }, 0);
      expect(worst / 1024, orientation).toBeLessThanOrEqual(400);
    }
  });
});

describe("srcSet", () => {
  const sources = [
    { width: 640, src: "/posters/a-640.1.avif" },
    { width: 1280, src: "/posters/a-1280.2.avif" },
  ];

  it("lists each file with its width", () => {
    expect(srcSet(sources)).toBe(
      "/posters/a-640.1.avif 640w, /posters/a-1280.2.avif 1280w",
    );
  });

  it("prefixes NEXT_PUBLIC_ASSET_BASE when set", () => {
    expect(srcSet(sources, "https://cdn.example.com")).toBe(
      "https://cdn.example.com/posters/a-640.1.avif 640w, https://cdn.example.com/posters/a-1280.2.avif 1280w",
    );
  });
});
