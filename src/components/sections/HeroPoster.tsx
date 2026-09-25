import { env } from "@/env";
import { type PosterManifest, srcSet } from "@/experience/poster-shots";
import posterManifest from "@/experience/posters.json";

const { shots } = posterManifest as PosterManifest;
const start = shots["hero-start"];
const end = shots["hero-end"];
const base = env.NEXT_PUBLIC_ASSET_BASE?.replace(/\/$/, "") ?? "";

/**
 * The hero's poster: the LCP element, and what tier 0 keeps. Pre-encoded
 * AVIF/WebP (scripts/posters.ts), art-directed per orientation with the same
 * `(orientation: portrait)` rule the live camera uses, so the canvas that
 * replaces it starts on the same frame. Reduced motion gets the last frame.
 */
export function HeroPoster() {
  const sources = [
    {
      media: "(prefers-reduced-motion: reduce) and (orientation: portrait)",
      image: end.portrait,
    },
    { media: "(prefers-reduced-motion: reduce)", image: end.landscape },
    { media: "(orientation: portrait)", image: start.portrait },
    { media: undefined, image: start.landscape },
  ];
  const fallback = start.landscape.webp[1] ?? start.landscape.webp[0];

  return (
    <div
      aria-hidden="true"
      data-stage="hero"
      className="stage hero-poster absolute inset-0"
    >
      <picture>
        {sources.flatMap(({ media, image }) =>
          (["avif", "webp"] as const).map((format) => (
            <source
              key={`${media ?? "default"}-${format}`}
              media={media}
              type={`image/${format}`}
              srcSet={srcSet(image[format], base)}
              sizes="100vw"
            />
          )),
        )}
        <img
          src={`${base}${fallback.src}`}
          alt=""
          width={start.landscape.width}
          height={start.landscape.height}
          fetchPriority="high"
          className="size-full object-cover"
        />
      </picture>
    </div>
  );
}
