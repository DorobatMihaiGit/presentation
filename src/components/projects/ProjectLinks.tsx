import { useTranslations } from "next-intl";
import type { Project } from "@/lib/project-pages";

/**
 * "Live site" and "Source code", named after the project for screen readers.
 * Raised above a grid card's own link, so they stay clickable.
 */
export function ProjectLinks({ project }: { project: Project }) {
  const t = useTranslations("Projects");
  const title = project.title.value;

  if (!project.liveUrl && !project.repoUrl) {
    return null;
  }
  return (
    <div className="relative z-10 flex flex-wrap gap-x-6 text-sm font-medium">
      {project.liveUrl ? (
        <a
          href={project.liveUrl}
          aria-label={t("liveLabel", { title })}
          className="inline-flex min-h-11 items-center text-signal underline-offset-4 hover:underline"
        >
          {t("live")}
        </a>
      ) : null}
      {project.repoUrl ? (
        <a
          href={project.repoUrl}
          aria-label={t("sourceLabel", { title })}
          className="inline-flex min-h-11 items-center text-signal underline-offset-4 hover:underline"
        >
          {t("source")}
        </a>
      ) : null}
    </div>
  );
}
