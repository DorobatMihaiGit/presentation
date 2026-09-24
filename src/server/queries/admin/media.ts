import { desc } from "drizzle-orm";
import { media } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export async function listMediaForAdmin(db: Db) {
  return db.select().from(media).orderBy(desc(media.createdAt));
}

/** `<select>` options for picking an uploaded file of one kind. */
export async function mediaOptions(db: Db, kind: "image" | "document") {
  const items = await listMediaForAdmin(db);
  return items
    .filter((item) => item.kind === kind)
    .map((item) => ({ value: item.id, label: item.altEn || item.pathname }));
}
