"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import { notFound, runAdminAction } from "@/server/admin/run-action";
import { idInput } from "@/server/admin/schemas/fields";
import { mediaAltInput, uploadInput } from "@/server/admin/schemas/media";
import { media } from "@/server/db/schema";
import { getMediaStore } from "@/server/media";
import { inspectUpload } from "@/server/media/inspect";

export async function uploadMedia(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, uploadInput, async (input, { db, audit }) => {
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const inspected = await inspectUpload(bytes);
    if (!inspected.ok) {
      return {
        status: "error",
        code: 400,
        message: inspected.message,
        fieldErrors: { file: [inspected.message] },
      };
    }

    const store = getMediaStore();
    const stored = await store.put(
      `${crypto.randomUUID()}.${inspected.ext}`,
      bytes,
      inspected.mime,
    );
    try {
      const [row] = await db
        .insert(media)
        .values({
          blobUrl: stored.url,
          pathname: stored.pathname,
          kind: inspected.kind,
          mime: inspected.mime,
          width: inspected.width,
          height: inspected.height,
          bytes: bytes.length,
          lqip: inspected.lqip,
          altEn: input.altEn,
          altRo: input.altRo,
        })
        .returning({ id: media.id });
      await audit({
        action: "create",
        entity: "media",
        entityId: row.id,
        diff: {
          pathname: stored.pathname,
          mime: inspected.mime,
          bytes: bytes.length,
        },
      });
    } catch (error) {
      await store.delete(stored.pathname);
      throw error;
    }
    return { status: "ok", message: "Uploaded." };
  });
}

export async function saveMediaAlt(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    mediaAltInput,
    async (input, { db, audit }) => {
      const updated = await db
        .update(media)
        .set({ altEn: input.altEn, altRo: input.altRo })
        .where(eq(media.id, input.id))
        .returning({ id: media.id });
      if (updated.length === 0) {
        return notFound("This file no longer exists.");
      }
      await audit({
        action: "update",
        entity: "media",
        entityId: input.id,
        diff: input,
      });
      return { status: "ok", message: "Alt text saved." };
    },
  );
}

/** Deletes the row (references become NULL) and then the stored file. */
export async function deleteMedia(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, idInput, async ({ id }, { db, audit }) => {
    const [row] = await db
      .delete(media)
      .where(eq(media.id, id))
      .returning({ pathname: media.pathname });
    if (!row) {
      return notFound("This file no longer exists.");
    }
    await getMediaStore().delete(row.pathname);
    await audit({ action: "delete", entity: "media", entityId: id });
    return { status: "ok", message: "Deleted." };
  });
}
