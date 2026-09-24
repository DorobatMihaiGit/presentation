import { profile, profileI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { byLocale } from "./by-locale";

// Admin reads are uncached; callers must have run requireAdmin().

export async function getProfileForAdmin(db: Db) {
  const [row] = await db.select().from(profile);
  if (!row) {
    return null;
  }
  const rows = await db.select().from(profileI18n);
  return { ...row, en: byLocale(rows, "en"), ro: byLocale(rows, "ro") };
}
