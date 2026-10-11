import type { ReactNode } from "react";
import { SectionPoster } from "@/components/sections/SectionPoster";
import {
  SECTION_POSTERS,
  type SectionPosterName,
} from "@/experience/poster-shots";

export type SceneId = "hero" | "about" | "skills" | "experience" | "contact";

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** The stage's scene for this section; sections with one get its poster too. */
  scene?: SceneId;
  children: ReactNode;
};

export function Section({ id, title, intro, scene, children }: SectionProps) {
  const titleId = `${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-scene={scene}
      className="py-section"
    >
      {SECTION_POSTERS.includes(scene as SectionPosterName) ? (
        <SectionPoster name={scene as SectionPosterName} />
      ) : null}
      <div className="section-body relative mx-auto w-full max-w-content px-gutter">
        <h2 id={titleId} className="text-title text-ink">
          {title}
        </h2>
        {intro ? (
          <p className="mt-5 max-w-[60ch] text-lead text-ink-muted lg:w-1/2">
            {intro}
          </p>
        ) : null}
        <div className="mt-12 md:mt-16">{children}</div>
      </div>
    </section>
  );
}
