"use server";

import { eq, max } from "drizzle-orm";
import { STACK_LAYERS } from "@/content/types";
import type { ActionResult } from "@/server/admin/action-result";
import {
  type ActionContext,
  notFound,
  runAdminAction,
} from "@/server/admin/run-action";
import { slugInput } from "@/server/admin/schemas/fields";
import {
  categoriesInput,
  type SkillInput,
  skillInput,
} from "@/server/admin/schemas/skills";
import { skill, skillCategory, skillCategoryI18n } from "@/server/db/schema";

/** Renames the five stack-layer categories (EN required, RO optional). */
export async function saveCategories(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    categoriesInput,
    async (input, { db, audit }) => {
      const categories = await db.select().from(skillCategory);
      for (const layer of STACK_LAYERS) {
        const category = categories.find((c) => c.layer === layer);
        if (!category) {
          return notFound(
            `The ${layer} layer has no category. Run \`pnpm db:seed\`.`,
          );
        }
        for (const locale of ["en", "ro"] as const) {
          await db
            .insert(skillCategoryI18n)
            .values({
              categorySlug: category.slug,
              locale,
              name: input[locale][layer],
            })
            .onConflictDoUpdate({
              target: [
                skillCategoryI18n.categorySlug,
                skillCategoryI18n.locale,
              ],
              set: { name: input[locale][layer] },
            });
        }
      }
      await audit({ action: "update", entity: "skill_category", diff: input });
      return { status: "ok", message: "Layer names saved." };
    },
  );
}

export async function createSkill(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, skillInput, async (input, { db, audit }) => {
    const categorySlug = await categoryFor(db, input);
    if (!categorySlug) {
      return notFound(`The ${input.layer} layer has no category.`);
    }
    const [{ last }] = await db
      .select({ last: max(skill.sortOrder) })
      .from(skill)
      .where(eq(skill.categorySlug, categorySlug));
    await db.insert(skill).values({
      slug: input.slug,
      categorySlug,
      name: input.name,
      level: input.level,
      years: input.years,
      featured: input.featured,
      sortOrder: (last ?? 0) + 1,
    });
    await audit({
      action: "create",
      entity: "skill",
      entityId: input.slug,
      diff: input,
    });
    return {
      status: "ok",
      message: "Skill added.",
      redirectTo: "/admin/skills",
    };
  });
}

export async function updateSkill(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(formData, skillInput, async (input, { db, audit }) => {
    const categorySlug = await categoryFor(db, input);
    if (!categorySlug) {
      return notFound(`The ${input.layer} layer has no category.`);
    }
    const updated = await db
      .update(skill)
      .set({
        categorySlug,
        name: input.name,
        level: input.level,
        years: input.years,
        featured: input.featured,
      })
      .where(eq(skill.slug, input.slug))
      .returning({ slug: skill.slug });
    if (updated.length === 0) {
      return notFound("This skill no longer exists.");
    }
    await audit({
      action: "update",
      entity: "skill",
      entityId: input.slug,
      diff: input,
    });
    return { status: "ok", message: "Skill saved." };
  });
}

export async function deleteSkill(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    slugInput,
    async ({ slug }, { db, audit }) => {
      const deleted = await db
        .delete(skill)
        .where(eq(skill.slug, slug))
        .returning({ slug: skill.slug });
      if (deleted.length === 0) {
        return notFound("This skill no longer exists.");
      }
      await audit({ action: "delete", entity: "skill", entityId: slug });
      return {
        status: "ok",
        message: "Skill deleted.",
        redirectTo: "/admin/skills",
      };
    },
  );
}

async function categoryFor(
  db: ActionContext["db"],
  input: SkillInput,
): Promise<string | undefined> {
  const [category] = await db
    .select({ slug: skillCategory.slug })
    .from(skillCategory)
    .where(eq(skillCategory.layer, input.layer));
  return category?.slug;
}
