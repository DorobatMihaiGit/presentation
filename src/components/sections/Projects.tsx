import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";

export function Projects({ cv }: { cv: Cv }) {
  const t = useTranslations("Projects");
  const { locale } = cv;

  return (
    <Section id="projects" title={t("title")}>
      <ul className="grid gap-4 md:grid-cols-6">
        {cv.projects.map((project, index) => (
          <li
            key={project.slug}
            className={index === 0 ? "md:col-span-6" : "md:col-span-2"}
          >
            <article className="h-full rounded-panel bg-surface p-1.5 ring-1 ring-line">
              <div className="flex h-full flex-col rounded-[calc(var(--radius-panel)-0.375rem)] bg-raised p-6 shadow-[inset_0_1px_0_var(--color-line)] md:p-8">
                <p className="font-mono text-label uppercase text-ink-subtle">
                  {project.year}
                </p>
                <h3
                  lang={fallbackLang(project.title, locale)}
                  className="mt-3 text-heading text-ink"
                >
                  {project.title.value}
                </h3>
                <p
                  lang={fallbackLang(project.summary, locale)}
                  className="mt-3 max-w-[60ch] text-ink-muted"
                >
                  {project.summary.value}
                </p>
                <dl className="mt-6 grid gap-3 text-sm">
                  <div>
                    <dt className="font-mono text-label uppercase text-ink-subtle">
                      {t("role")}
                    </dt>
                    <dd
                      lang={fallbackLang(project.role, locale)}
                      className="mt-1 text-ink"
                    >
                      {project.role.value}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-label uppercase text-ink-subtle">
                      {t("outcome")}
                    </dt>
                    <dd
                      lang={fallbackLang(project.outcome, locale)}
                      className="mt-1 text-ink"
                    >
                      {project.outcome.value}
                    </dd>
                  </div>
                </dl>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {project.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted ring-1 ring-line"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-6 text-sm font-medium">
                  {project.liveUrl ? (
                    <a
                      href={project.liveUrl}
                      aria-label={t("liveLabel", {
                        title: project.title.value,
                      })}
                      className="text-signal underline-offset-4 hover:underline"
                    >
                      {t("live")}
                    </a>
                  ) : null}
                  {project.repoUrl ? (
                    <a
                      href={project.repoUrl}
                      aria-label={t("sourceLabel", {
                        title: project.title.value,
                      })}
                      className="text-signal underline-offset-4 hover:underline"
                    >
                      {t("source")}
                    </a>
                  ) : null}
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Section>
  );
}
