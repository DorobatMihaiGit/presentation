import { asc, desc } from "drizzle-orm";
import { project, projectI18n, projectSkill, skill } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { byLocale } from "./by-locale";
import { mediaOptions } from "./media";

export async function listProjectsForAdmin(db: Db) {
  const [projects, rows, skills] = await Promise.all([
    db.select().from(project).orderBy(desc(project.year), asc(project.slug)),
    db.select().from(projectI18n),
    db.select().from(projectSkill).orderBy(asc(projectSkill.position)),
  ]);
  return projects.map((item) => {
    const own = rows.filter((row) => row.projectSlug === item.slug);
    return {
      ...item,
      en: byLocale(own, "en"),
      ro: byLocale(own, "ro"),
      skills: skills
        .filter((row) => row.projectSlug === item.slug)
        .map((row) => row.skillSlug),
    };
  });
}

/** Skill checkboxes and cover-image options for the project form. */
export async function projectPickers(db: Db) {
  const [skills, images] = await Promise.all([
    db
      .select({ slug: skill.slug, name: skill.name })
      .from(skill)
      .orderBy(asc(skill.sortOrder), asc(skill.slug)),
    mediaOptions(db, "image"),
  ]);
  return { skills, images };
}
