import Link from "next/link";
import { useTranslations } from "next-intl";
import { CoverTransition } from "@/components/projects/CoverTransition";
import { ProjectCover } from "@/components/projects/ProjectCover";
import { ProjectLinks } from "@/components/projects/ProjectLinks";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";
import { projectPath } from "@/lib/seo";

/**
 * The grid of published projects, featured first. Each card opens its
 * project page (the title link covers the whole card); the live and source
 * links stay clickable on top of it.
 */
export function Projects({ cv }: { cv: Cv }) {
  const t = useTranslations("Projects");
  const { locale } = cv;

  return (
    <Section id="projects" title={t("title")}>
      <ul className="grid gap-4 md:grid-cols-6">
        {cv.projects.map((project, index) => {
          const wide = index === 0;
          return (
            <li
              key={project.slug}
              className={wide ? "md:col-span-6" : "md:col-span-2"}
            >
              <article className="relative h-full rounded-panel bg-surface p-1.5 ring-1 ring-line transition-[box-shadow,transform] duration-(--motion-press) hover:ring-line-strong motion-safe:active:scale-[0.99]">
                <div
                  className={`flex h-full flex-col gap-6 rounded-[calc(var(--radius-panel)-0.375rem)] bg-raised p-6 shadow-[inset_0_1px_0_var(--color-line)] md:p-8 ${wide && project.cover ? "md:grid md:grid-cols-2 md:items-center md:gap-10" : ""}`}
                >
                  {project.cover ? (
                    <CoverTransition slug={project.slug}>
                      <div
                        className={`overflow-hidden rounded-control ring-1 ring-line ${wide ? "md:order-last" : ""}`}
                      >
                        <ProjectCover
                          cover={project.cover}
                          locale={locale}
                          sizes={
                            wide
                              ? "(min-width: 48rem) 36rem, 100vw"
                              : "(min-width: 48rem) 24rem, 100vw"
                          }
                        />
                      </div>
                    </CoverTransition>
                  ) : null}
                  <div className="flex flex-1 flex-col">
                    <p className="font-mono text-label uppercase text-ink-subtle">
                      {project.year}
                    </p>
                    <h3
                      lang={fallbackLang(project.title, locale)}
                      className="mt-3 text-heading text-ink"
                    >
                      <Link
                        href={`/${locale}${projectPath(project.slug)}`}
                        transitionTypes={["nav-forward"]}
                        className="after:absolute after:inset-0 after:rounded-panel focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-signal"
                      >
                        {project.title.value}
                      </Link>
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
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-x-6 pt-6">
                      <ProjectLinks project={project} />
                      <span
                        aria-hidden="true"
                        className="ml-auto inline-flex min-h-11 items-center font-mono text-label uppercase text-ink-subtle"
                      >
                        {t("open")} →
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
