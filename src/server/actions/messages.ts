"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import { notFound, runAdminAction } from "@/server/admin/run-action";
import {
  type MessageStatus,
  messageIdInput,
  messageStatusInput,
} from "@/server/admin/schemas/messages";
import { message } from "@/server/db/schema";

const DONE: Record<MessageStatus, string> = {
  new: "Marked as unread.",
  read: "Marked as read.",
  archived: "Archived.",
  spam: "Marked as spam.",
};

export async function setMessageStatus(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    messageStatusInput,
    async ({ id, status }, { db, audit }) => {
      const updated = await db
        .update(message)
        .set({ status })
        .where(eq(message.id, id))
        .returning({ id: message.id });
      if (updated.length === 0) {
        return notFound("This message no longer exists.");
      }
      await audit({
        action: "update",
        entity: "message",
        entityId: id,
        diff: { status },
      });
      return { status: "ok", message: DONE[status] };
    },
    { publicContent: false },
  );
}

/** Deletes for good; the audit entry keeps the id only, not the visitor's text. */
export async function deleteMessage(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    messageIdInput,
    async ({ id }, { db, audit }) => {
      const [row] = await db
        .delete(message)
        .where(eq(message.id, id))
        .returning({ status: message.status });
      if (!row) {
        return notFound("This message no longer exists.");
      }
      await audit({ action: "delete", entity: "message", entityId: id });
      const view =
        row.status === "archived" || row.status === "spam"
          ? `?view=${row.status}`
          : "";
      return {
        status: "ok",
        message: "Deleted.",
        redirectTo: `/admin/messages${view}`,
      };
    },
    { publicContent: false },
  );
}
