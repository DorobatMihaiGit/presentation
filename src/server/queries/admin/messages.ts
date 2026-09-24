import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { MessageStatus } from "@/server/admin/schemas/messages";
import { message } from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** Inbox = new and read; archived and spam are folders of their own. */
export const MESSAGE_VIEWS = {
  inbox: ["new", "read"],
  archived: ["archived"],
  spam: ["spam"],
} as const satisfies Record<string, readonly MessageStatus[]>;

export type MessageView = keyof typeof MESSAGE_VIEWS;

export function listMessages(db: Db, view: MessageView) {
  return db
    .select({
      id: message.id,
      name: message.name,
      email: message.email,
      company: message.company,
      preview: sql<string>`left(${message.body}, 140)`,
      locale: message.locale,
      status: message.status,
      emailStatus: message.emailStatus,
      createdAt: message.createdAt,
    })
    .from(message)
    .where(inArray(message.status, [...MESSAGE_VIEWS[view]]))
    .orderBy(desc(message.createdAt));
}

export async function countMessages(db: Db) {
  const rows = await db
    .select({ status: message.status, value: count() })
    .from(message)
    .groupBy(message.status);
  const by = (status: MessageStatus) =>
    rows.find((row) => row.status === status)?.value ?? 0;
  return {
    inbox: by("new") + by("read"),
    unread: by("new"),
    archived: by("archived"),
    spam: by("spam"),
  };
}

/** One message, or null (also for an id that is not a UUID: no 500 on a crafted URL). */
export async function getMessage(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) {
    return null;
  }
  const [row] = await db.select().from(message).where(eq(message.id, id));
  return row ?? null;
}
