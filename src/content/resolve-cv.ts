import type { Locale } from "@/i18n/routing";
import { localize } from "./localize";
import { type Cv, type CvRecords, STACK_LAYERS } from "./types";

/** Resolves raw records into the locale-specific view model the sections render. */
export function resolveCv(records: CvRecords, locale: Locale): Cv {
  const { profile } = records;
  const skillName = new Map(records.skills.map((s) => [s.slug, s.name]));

  return {
    locale,
    profile: {
      fullName: localize(profile.i18n, locale, "fullName"),
      headline: localize(profile.i18n, locale, "headline"),
      summary: localize(profile.i18n, locale, "summary"),
      seoTitle: localize(profile.i18n, locale, "seoTitle"),
      seoDescription: localize(profile.i18n, locale, "seoDescription"),
      email: profile.emailPublic,
      location: profile.location,
      countryCode: profile.countryCode,
      socials: profile.socials,
      available: profile.available,
      yearsExp: profile.yearsExp,
    },
    experience: records.experience
      .filter((job) => job.isPublished)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((job) => ({
        id: job.id,
        company: job.company,
        url: job.url,
        startDate: job.startDate,
        endDate: job.endDate,
        employmentType: job.employmentType,
        roleTitle: localize(job.i18n, locale, "roleTitle"),
        description: localize(job.i18n, locale, "description"),
        highlights: localize(job.i18n, locale, "highlights"),
      })),
    stack: STACK_LAYERS.flatMap((layer) =>
      records.skillCategories
        .filter((category) => category.layer === layer)
        .map((category) => ({
          layer,
          name: localize(category.i18n, locale, "name"),
          skills: records.skills
            .filter((skill) => skill.categorySlug === category.slug)
            .map(({ slug, name, featured }) => ({ slug, name, featured })),
        })),
    ),
    projects: records.projects
      .filter((project) => project.published)
      .toSorted(
        (a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year,
      )
      .map((project) => ({
        slug: project.slug,
        repoUrl: project.repoUrl,
        liveUrl: project.liveUrl,
        year: project.year,
        featured: project.featured,
        skills: project.skills.flatMap((slug) => skillName.get(slug) ?? []),
        title: localize(project.i18n, locale, "title"),
        summary: localize(project.i18n, locale, "summary"),
        role: localize(project.i18n, locale, "role"),
        outcome: localize(project.i18n, locale, "outcome"),
      })),
  };
}
