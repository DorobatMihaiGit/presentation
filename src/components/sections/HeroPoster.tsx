import type { PosterManifest } from "@/experience/poster-shots";
import posterManifest from "@/experience/posters.json";
import { PosterPicture } from "./PosterPicture";

const { shots } = posterManifest as PosterManifest;
const start = shots["hero-start"];
const end = shots["hero-end"];

/**
 * The hero's poster: the LCP element, and what tier 0 keeps. Art-directed
 * per orientation with the same `(orientation: portrait)` rule the live
 * camera uses, so the canvas that replaces it starts on the same frame.
 * Reduced motion gets the last frame.
 */
export function HeroPoster() {
  return (
    <div
      aria-hidden="true"
      data-stage="hero"
      className="stage hero-poster absolute inset-0"
    >
      <PosterPicture
        priority
        sources={[
          {
            media:
              "(prefers-reduced-motion: reduce) and (orientation: portrait)",
            image: end.portrait,
          },
          { media: "(prefers-reduced-motion: reduce)", image: end.landscape },
          { media: "(orientation: portrait)", image: start.portrait },
          { image: start.landscape },
        ]}
      />
    </div>
  );
}
