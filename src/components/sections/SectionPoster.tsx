import type {
  PosterManifest,
  SectionPosterName,
} from "@/experience/poster-shots";
import posterManifest from "@/experience/posters.json";
import { PosterPicture } from "./PosterPicture";

const { shots } = posterManifest as PosterManifest;

/**
 * A section's scene as a still, behind the section's first screen where the
 * live stage would show it. Only while the stage is off (tier 0, reduced
 * motion, Motion off, a lost context): globals.css shows it for
 * html[data-canvas="poster"], and it loads lazily, so live visitors never
 * download it.
 */
export function SectionPoster({ name }: { name: SectionPosterName }) {
  const shot = shots[name];

  return (
    <div aria-hidden="true" data-poster={name} className="section-poster">
      <PosterPicture
        sources={[
          { media: "(orientation: portrait)", image: shot.portrait },
          { image: shot.landscape },
        ]}
      />
    </div>
  );
}
