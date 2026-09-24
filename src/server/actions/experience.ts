"use server";

import { asc, desc, eq, gt, lt, max } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import {
  type ActionContext,
  notFound,
  runAdminAction,
} from "@/server/admin/run-action";
import {
  type ExperienceInput,
  experienceInput,
  moveInput,
} from "@/server/admin/schemas/experience";
import { idInput } from "@/server/admin/schemas/fields";
import { experience, experienceI18n } from "@/server/db/schema";

export async function createExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    experienceInput,
    async (input, { db, audit }) => {
      const id = crypto.randomUUID();
      const [{ last }] = await db
        .select({ last: max(experience.sortOrder) })
        .from(experience);
      await db
        .insert(experience)
        .values({ id, ...baseRow(input), sortOrder: (last ?? 0) + 1 });
      await writeTranslations(db, id, input);
      await audit({
        action: "create",
        entity: "experience",
        entityId: id,
        diff: input,
      });
      return {
        status: "ok",
        message: "Experience added.",
        redirectTo: `/admin/experience/${id}`,
      };
    },
  );
}

export async function updateExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    experienceInput.and(idInput),
    async (input, { db, audit }) => {
      const updated = await db
        .update(experience)
        .set(baseRow(input))
        .where(eq(experience.id, input.id))
        .returning({ id: experience.id });
      if (updated.length === 0) {
        return notFound("This experience entry no longer exists.");
      }
      await writeTranslations(db, input.id, input);
      await audit({
        action: "update",
        entity: "experience",
        entityId: input.id,
        diff: input,
      });
      return { status: "ok", message: "Experience saved." };
    },
  );
}

export async function deleteExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, idInput, async ({ id }, { db, audit }) => {
    const deleted = await db
      .delete(experience)
      .where(eq(experience.id, id))
      .returning({ id: experience.id });
    if (deleted.length === 0) {
      return notFound("This experience entry no longer exists.");
    }
    await audit({ action: "delete", entity: "experience", entityId: id });
    return {
      status: "ok",
      message: "Experience deleted.",
      redirectTo: "/admin/experience",
    };
  });
}

/** Swaps sort_order with the neighbour above or below (spec §5 reorder). */
export async function moveExperience(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    moveInput,
    async ({ id, direction }, { db, audit }) => {
      const [current] = await db
        .select({ sortOrder: experience.sortOrder })
        .from(experience)
        .where(eq(experience.id, id));
      if (!current) {
        return notFound("This experience entry no longer exists.");
      }
      const [neighbour] = await db
        .select({ id: experience.id, sortOrder: experience.sortOrder })
        .from(experience)
        .where(
          direction === "up"
            ? lt(experience.sortOrder, current.sortOrder)
            : gt(experience.sortOrder, current.sortOrder),
        )
        .orderBy(
          direction === "up"
            ? desc(experience.sortOrder)
            : asc(experience.sortOrder),
        )
        .limit(1);
      if (!neighbour) {
        return { status: "ok", message: "Already at the edge." };
      }
      await db
        .update(experience)
        .set({ sortOrder: neighbour.sortOrder })
        .where(eq(experience.id, id));
      await db
        .update(experience)
        .set({ sortOrder: current.sortOrder })
        .where(eq(experience.id, neighbour.id));
      await audit({
        action: "reorder",
        entity: "experience",
        entityId: id,
        diff: { direction },
      });
      return { status: "ok", message: "Order saved." };
    },
  );
}

function baseRow(input: ExperienceInput) {
  return {
    company: input.company,
    url: input.url,
    startDate: input.startDate,
    endDate: input.endDate,
    employmentType: input.employmentType,
    isPublished: input.isPublished,
  };
}

async function writeTranslations(
  db: ActionContext["db"],
  id: string,
  input: ExperienceInput,
) {
  for (const locale of ["en", "ro"] as const) {
    const t = input[locale];
    const row = {
      roleTitle: t.roleTitle,
      descriptionMd: t.description,
      highlights: t.highlights,
    };
    await db
      .insert(experienceI18n)
      .values({ experienceId: id, locale, ...row })
      .onConflictDoUpdate({
        target: [experienceI18n.experienceId, experienceI18n.locale],
        set: row,
      });
  }
}
