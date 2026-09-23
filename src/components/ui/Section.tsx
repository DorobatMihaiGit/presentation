import type { ReactNode } from "react";

export type SceneId = "hero" | "about" | "skills" | "experience" | "contact";

type SectionProps = {
  id: string;
  title: string;
  intro?: string;
  /** 3D/sequence scene this section will host from M5 on. */
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
      <div className="mx-auto w-full max-w-content px-gutter">
        <h2 id={titleId} className="text-title text-ink">
          {title}
        </h2>
        {intro ? (
          <p className="mt-5 max-w-[60ch] text-lead text-ink-muted">{intro}</p>
        ) : null}
        <div className="mt-12 md:mt-16">{children}</div>
      </div>
    </section>
  );
}
