import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CaseStudy } from "@/components/projects/CaseStudy";
import { CoverTransition } from "@/components/projects/CoverTransition";
import { ProjectCover } from "@/components/projects/ProjectCover";
import { ProjectLinks } from "@/components/projects/ProjectLinks";
import { ProjectNav } from "@/components/projects/ProjectNav";
import { PageShell } from "@/components/site/PageShell";
import { getCv } from "@/content/get-cv";
import { fallbackLang } from "@/content/localize";
import type { Localized } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import {
  findProject,
  neighbours,
  staticProjectParams,
} from "@/lib/project-pages";
import {
  languageAlternates,
  localeUrl,
  projectJsonLd,
  projectPath,
  serializeJsonLd,
} from "@/lib/seo";
import { siteUrl } from "@/site";

export async function generateStaticParams({
  params,
}: {
  params: { locale: string };
}) {
  return staticProjectParams(await getCv(params.locale as Locale));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const cv = await getCv(locale);
  const project = findProject(cv, slug);
  if (!project) {
    return {};
  }
  const t = await getTranslations("Project");
  const path = projectPath(slug);
  const url = localeUrl(siteUrl, locale, path);
  const title = t("title", {
    title: project.title.value,
    name: cv.profile.fullName.value,
  });

  return {
    title,
    description: project.summary.value,
    alternates: {
      canonical: url,
      languages: languageAlternates(siteUrl, path),
    },
    openGraph: {
      type: "article",
      url,
      siteName: cv.profile.fullName.value,
      title,
      description: project.summary.value,
      locale: locale === "ro" ? "ro_RO" : "en_US",
      // og:image comes from ./opengraph-image.tsx (it draws the cover).
    },
  };
}

/**
 * A project's case study: title, facts and links, the cover, the markdown
 * body and the neighbouring projects. Static like the home page (one page
 * per published project and locale, cached under the CV tag); no 3D here.
 */
export default async function ProjectPage({
  params,
}: PageProps<"/[locale]/projects/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const cv = await getCv(locale);
  const project = findProject(cv, slug);
  if (!project) {
    notFound();
  }
  const t = await getTranslations("Project");
  const { previous, next } = neighbours(cv, slug);
  const lang = (text: Localized<unknown>) => fallbackLang(text, locale);

  return (
    <PageShell cv={cv} path={projectPath(slug)}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: serializeJsonLd escapes "<", so content cannot close the tag.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(projectJsonLd(cv, project, siteUrl)),
        }}
      />
      <article aria-labelledby="project-title">
        <div aria-hidden="true" className="project-backdrop" />
        <header className="relative mx-auto w-full max-w-content px-gutter pt-36 md:pt-40">
          <Link
            href={`/${locale}#projects`}
            transitionTypes={["nav-back"]}
            className="-ml-1 inline-flex min-h-11 items-center gap-2 px-1 font-mono text-label uppercase text-ink-muted transition-colors hover:text-ink"
          >
            <span aria-hidden="true">←</span>
            {t("back")}
          </Link>
          <p className="mt-8 font-mono text-label uppercase text-ink-subtle">
            {project.year}
          </p>
          <h1
            id="project-title"
            lang={lang(project.title)}
            className="mt-4 max-w-[20ch] text-title text-ink"
          >
            {project.title.value}
          </h1>
          <p
            lang={lang(project.summary)}
            className="mt-6 max-w-[60ch] text-lead text-ink-muted"
          >
            {project.summary.value}
          </p>
          <dl className="mt-12 grid gap-8 border-t pt-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="font-mono text-label uppercase text-ink-subtle">
                {t("role")}
              </dt>
              <dd lang={lang(project.role)} className="mt-2 text-ink">
                {project.role.value}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-label uppercase text-ink-subtle">
                {t("outcome")}
              </dt>
              <dd lang={lang(project.outcome)} className="mt-2 text-ink">
                {project.outcome.value}
              </dd>
            </div>
            {project.skills.length > 0 ? (
              <div>
                <dt className="font-mono text-label uppercase text-ink-subtle">
                  {t("stack")}
                </dt>
                <dd className="mt-2">
                  <ul className="flex flex-wrap gap-2">
                    {project.skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full bg-surface px-3 py-1 text-sm text-ink-muted ring-1 ring-line"
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            {project.liveUrl || project.repoUrl ? (
              <div>
                <dt className="font-mono text-label uppercase text-ink-subtle">
                  {t("links")}
                </dt>
                <dd className="mt-1">
                  <ProjectLinks project={project} />
                </dd>
              </div>
            ) : null}
          </dl>
        </header>
        {project.cover ? (
          <figure className="relative mx-auto mt-16 w-full max-w-content px-gutter">
            <CoverTransition slug={project.slug}>
              <div className="overflow-hidden rounded-panel ring-1 ring-line">
                <ProjectCover
                  cover={project.cover}
                  locale={locale}
                  sizes="(min-width: 76rem) 76rem, 100vw"
                  preload
                />
              </div>
            </CoverTransition>
          </figure>
        ) : null}
        {project.body.value ? (
          <section
            aria-label={t("caseStudy")}
            lang={lang(project.body)}
            className="relative mx-auto mt-16 w-full max-w-content px-gutter"
          >
            <CaseStudy markdown={project.body.value} />
          </section>
        ) : null}
        <ProjectNav locale={locale} previous={previous} next={next} />
      </article>
    </PageShell>
  );
}
