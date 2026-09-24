import { asc } from "drizzle-orm";
import { skill, skillCategory, skillCategoryI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export async function listStackForAdmin(db: Db) {
  const [categories, names, skills] = await Promise.all([
    db.select().from(skillCategory),
    db.select().from(skillCategoryI18n),
    db.select().from(skill).orderBy(asc(skill.sortOrder), asc(skill.slug)),
  ]);
  return { categories, names, skills };
}
