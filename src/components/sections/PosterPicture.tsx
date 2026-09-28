import { env } from "@/env";
import { type PosterImage, srcSet } from "@/experience/poster-shots";

const base = env.NEXT_PUBLIC_ASSET_BASE?.replace(/\/$/, "") ?? "";

export type PosterSources = { media?: string; image: PosterImage }[];

/**
 * A `<picture>` of pre-encoded posters (scripts/posters.ts): AVIF, then WebP,
 * for each media query in order; the `<img>` falls back to a mid-size WebP.
 * `priority` marks the LCP image; every other poster loads lazily.
 */
export function PosterPicture({
  sources,
  priority = false,
}: {
  sources: PosterSources;
  priority?: boolean;
}) {
  const fallback = sources[sources.length - 1].image;
  const img = fallback.webp[1] ?? fallback.webp[0];

  return (
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
        src={`${base}${img.src}`}
        alt=""
        width={fallback.width}
        height={fallback.height}
        fetchPriority={priority ? "high" : undefined}
        loading={priority ? undefined : "lazy"}
        decoding={priority ? undefined : "async"}
        className="size-full object-cover"
      />
    </picture>
  );
}
