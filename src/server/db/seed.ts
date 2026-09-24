import { count } from "drizzle-orm";
import { fixtures } from "@/content/fixtures";
import type { CvRecords } from "@/content/types";
import {
  experience,
  experienceI18n,
  experienceSkill,
  profile,
  profileI18n,
  project,
  projectI18n,
  projectSkill,
  skill,
  skillCategory,
  skillCategoryI18n,
} from "./schema";
import type { Db } from "./types";

export type SeedResult = "seeded" | "skipped";

/**
 * Loads CV content (profile, experience, stack, projects) into the database.
 * By default it only seeds an empty database, so admin edits survive a re-run.
 * `reset: true` deletes all CV content first (e2e runs, local resets).
 * Media, messages, users, sessions and the audit log are never touched.
 */
export async function seedContent(
  db: Db,
  options: { records?: CvRecords; reset?: boolean } = {},
): Promise<SeedResult> {
  const records = options.records ?? fixtures;

  return db.transaction(async (tx) => {
    if (!options.reset) {
      const [{ value }] = await tx.select({ value: count() }).from(profile);
      if (value > 0) {
        return "skipped";
      }
    }

    // Children first; FKs would cascade, but explicit order keeps it obvious.
    await tx.delete(projectSkill);
    await tx.delete(experienceSkill);
    await tx.delete(project);
    await tx.delete(experience);
    await tx.delete(skill);
    await tx.delete(skillCategory);
    await tx.delete(profile);

    const p = records.profile;
    await tx.insert(profile).values({
      emailPublic: p.emailPublic,
      location: p.location,
      countryCode: p.countryCode,
      socials: p.socials,
      available: p.available,
      yearsExp: p.yearsExp,
    });
    await tx.insert(profileI18n).values(
      localeRows(p.i18n, (locale, t) => ({
        profileId: 1,
        locale,
        fullName: t.fullName,
        headline: t.headline,
        summaryMd: t.summary,
        seoTitle: t.seoTitle,
        seoDescription: t.seoDescription,
      })),
    );

    for (const job of records.experience) {
      await tx.insert(experience).values({
        id: job.id,
        company: job.company,
        url: job.url ?? null,
        startDate: job.startDate,
        endDate: job.endDate,
        employmentType: job.employmentType,
        sortOrder: job.sortOrder,
        isPublished: job.isPublished,
      });
      await tx.insert(experienceI18n).values(
        localeRows(job.i18n, (locale, t) => ({
          experienceId: job.id,
          locale,
          roleTitle: t.roleTitle,
          descriptionMd: t.description,
          highlights: t.highlights,
        })),
      );
    }

    for (const category of records.skillCategories) {
      await tx
        .insert(skillCategory)
        .values({ slug: category.slug, layer: category.layer });
      await tx.insert(skillCategoryI18n).values(
        localeRows(category.i18n, (locale, t) => ({
          categorySlug: category.slug,
          locale,
          name: t.name,
        })),
      );
    }

    await tx.insert(skill).values(
      records.skills.map((s, index) => ({
        slug: s.slug,
        categorySlug: s.categorySlug,
        name: s.name,
        level: s.level,
        years: s.years,
        featured: s.featured,
        sortOrder: index + 1,
      })),
    );

    for (const item of records.projects) {
      await tx.insert(project).values({
        slug: item.slug,
        repoUrl: item.repoUrl ?? null,
        liveUrl: item.liveUrl ?? null,
        year: item.year,
        featured: item.featured,
        published: item.published,
      });
      await tx.insert(projectI18n).values(
        localeRows(item.i18n, (locale, t) => ({
          projectSlug: item.slug,
          locale,
          title: t.title,
          summary: t.summary,
          role: t.role,
          outcome: t.outcome,
        })),
      );
      if (item.skills.length > 0) {
        await tx.insert(projectSkill).values(
          item.skills.map((skillSlug, index) => ({
            projectSlug: item.slug,
            skillSlug,
            position: index + 1,
          })),
        );
      }
    }

    return "seeded";
  });
}

/** One row per locale present in `i18n`; a partial RO translation leaves the rest blank. */
function localeRows<T, R>(
  i18n: { en: T; ro?: Partial<T> },
  toRow: (locale: "en" | "ro", t: Partial<T>) => R,
): R[] {
  const rows = [toRow("en", i18n.en)];
  if (i18n.ro) {
    rows.push(toRow("ro", i18n.ro));
  }
  return rows;
}
