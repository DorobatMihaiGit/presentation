import type { SceneId } from "@/components/ui/Section";
import type { Orientation } from "./director/framing";

/** Frames captured as posters by scripts/posters.ts (`?capture=<scene>&p=<progress>`). */
export const POSTER_SHOTS = [
  // First frame of shot S1: the LCP image, and what the live canvas starts on.
  { name: "hero-start", scene: "hero", progress: 0 },
  // Last frame of S1: the hero for reduced motion (nothing will play).
  { name: "hero-end", scene: "hero", progress: 1 },
] as const satisfies readonly {
  name: string;
  scene: SceneId;
  progress: number;
}[];

export type PosterName = (typeof POSTER_SHOTS)[number]["name"];

/** Encoded widths per reference frame (spec §3: 1920/1280/640 landscape, 828 portrait). */
export const POSTER_WIDTHS: Record<Orientation, readonly number[]> = {
  landscape: [640, 1280, 1920],
  portrait: [828],
};

export type PosterSource = { width: number; src: string };

export type PosterImage = {
  width: number;
  height: number;
  avif: PosterSource[];
  webp: PosterSource[];
};

export type PosterManifest = {
  /** posterSourceHash() of the scene code the posters were captured from. */
  sourceHash: string;
  shots: Record<PosterName, Record<Orientation, PosterImage>>;
};

/** `srcset` value; `base` is NEXT_PUBLIC_ASSET_BASE (empty = same origin). */
export function srcSet(sources: readonly PosterSource[], base = ""): string {
  return sources.map(({ src, width }) => `${base}${src} ${width}w`).join(", ");
}
