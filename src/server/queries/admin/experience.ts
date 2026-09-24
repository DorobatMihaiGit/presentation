import { asc } from "drizzle-orm";
import { experience, experienceI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { byLocale } from "./by-locale";

export async function listExperienceForAdmin(db: Db) {
  const [jobs, rows] = await Promise.all([
    db.select().from(experience).orderBy(asc(experience.sortOrder)),
    db.select().from(experienceI18n),
  ]);
  return jobs.map((job) => {
    const own = rows.filter((row) => row.experienceId === job.id);
    return { ...job, en: byLocale(own, "en"), ro: byLocale(own, "ro") };
  });
}
