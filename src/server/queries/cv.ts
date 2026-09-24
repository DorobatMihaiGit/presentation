import { asc } from "drizzle-orm";
import type { CvRecords, I18n, SkillRecord, YearMonth } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import {
  experience,
  experienceI18n,
  profile,
  profileI18n,
  project,
  projectI18n,
  projectSkill,
  skill,
  skillCategory,
  skillCategoryI18n,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/**
 * Reads all CV content with both locales. The EN fallback itself happens in
 * `resolveCv` → `localize()`: per field, blank = missing, and it remembers
 * which locale each value came from (for `lang="en"` on /ro).
 */
export async function loadCvRecords(db: Db): Promise<CvRecords> {
  const [
    profiles,
    profileRows,
    jobs,
    jobRows,
    categories,
    categoryRows,
    skills,
    projects,
    projectRows,
    projectSkills,
  ] = await Promise.all([
    db.select().from(profile),
    db.select().from(profileI18n),
    db.select().from(experience).orderBy(asc(experience.sortOrder)),
    db.select().from(experienceI18n),
    db.select().from(skillCategory),
    db.select().from(skillCategoryI18n),
    db.select().from(skill).orderBy(asc(skill.sortOrder), asc(skill.slug)),
    db.select().from(project),
    db.select().from(projectI18n),
    db
      .select()
      .from(projectSkill)
      .orderBy(asc(projectSkill.projectSlug), asc(projectSkill.position)),
  ]);

  const p = profiles[0];
  if (!p) {
    throw new Error(
      "CV profile row is missing. Run `pnpm db:migrate` and `pnpm db:seed`.",
    );
  }

  return {
    profile: {
      emailPublic: p.emailPublic,
      location: p.location,
      countryCode: p.countryCode,
      socials: p.socials,
      available: p.available,
      yearsExp: p.yearsExp,
      i18n: toI18n("profile", profileRows, (row) => ({
        fullName: row.fullName,
        headline: row.headline,
        summary: row.summaryMd,
        seoTitle: row.seoTitle,
        seoDescription: row.seoDescription,
      })),
    },
    experience: jobs.map((job) => ({
      id: job.id,
      company: job.company,
      url: job.url ?? undefined,
      startDate: job.startDate as YearMonth,
      endDate: job.endDate as YearMonth | null,
      employmentType: job.employmentType,
      sortOrder: job.sortOrder,
      isPublished: job.isPublished,
      i18n: toI18n(
        `experience ${job.id}`,
        jobRows.filter((row) => row.experienceId === job.id),
        (row) => ({
          roleTitle: row.roleTitle,
          description: row.descriptionMd,
          highlights: row.highlights,
        }),
      ),
    })),
    skillCategories: categories.map((category) => ({
      slug: category.slug,
      layer: category.layer,
      i18n: toI18n(
        `skill category ${category.slug}`,
        categoryRows.filter((row) => row.categorySlug === category.slug),
        (row) => ({ name: row.name }),
      ),
    })),
    skills: skills.map((s) => ({
      slug: s.slug,
      categorySlug: s.categorySlug,
      name: s.name,
      level: s.level as SkillRecord["level"],
      years: s.years,
      featured: s.featured,
    })),
    projects: projects.map((item) => ({
      slug: item.slug,
      repoUrl: item.repoUrl ?? undefined,
      liveUrl: item.liveUrl ?? undefined,
      year: item.year,
      featured: item.featured,
      published: item.published,
      skills: projectSkills
        .filter((row) => row.projectSlug === item.slug)
        .map((row) => row.skillSlug),
      i18n: toI18n(
        `project ${item.slug}`,
        projectRows.filter((row) => row.projectSlug === item.slug),
        (row) => ({
          title: row.title,
          summary: row.summary,
          role: row.role,
          outcome: row.outcome,
        }),
      ),
    })),
  };
}

/** Folds `<entity>_i18n` rows into `{ en, ro? }`. English is required. */
function toI18n<Row extends { locale: Locale }, T>(
  what: string,
  rows: Row[],
  pick: (row: Row) => T,
): I18n<T> {
  const en = rows.find((row) => row.locale === "en");
  if (!en) {
    throw new Error(`${what} has no English translation row.`);
  }
  const ro = rows.find((row) => row.locale === "ro");
  return ro ? { en: pick(en), ro: pick(ro) } : { en: pick(en) };
}
