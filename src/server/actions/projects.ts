"use server";

import { eq } from "drizzle-orm";
import type { ActionResult } from "@/server/admin/action-result";
import {
  type ActionContext,
  notFound,
  runAdminAction,
} from "@/server/admin/run-action";
import { slugInput } from "@/server/admin/schemas/fields";
import {
  type ProjectInput,
  projectInput,
} from "@/server/admin/schemas/projects";
import { project, projectI18n, projectSkill } from "@/server/db/schema";

export async function createProject(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    projectInput,
    async (input, { db, audit }) => {
      await db.insert(project).values({ slug: input.slug, ...baseRow(input) });
      await writeDetails(db, input);
      await audit({
        action: "create",
        entity: "project",
        entityId: input.slug,
        diff: input,
      });
      return {
        status: "ok",
        message: "Project added.",
        redirectTo: `/admin/projects/${input.slug}`,
      };
    },
  );
}

/** The slug is the project's identity and cannot change after creation. */
export async function updateProject(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    projectInput,
    async (input, { db, audit }) => {
      const updated = await db
        .update(project)
        .set(baseRow(input))
        .where(eq(project.slug, input.slug))
        .returning({ slug: project.slug });
      if (updated.length === 0) {
        return notFound("This project no longer exists.");
      }
      await writeDetails(db, input);
      await audit({
        action: "update",
        entity: "project",
        entityId: input.slug,
        diff: input,
      });
      return { status: "ok", message: "Project saved." };
    },
  );
}

export async function deleteProject(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAdminAction(
    formData,
    slugInput,
    async ({ slug }, { db, audit }) => {
      const deleted = await db
        .delete(project)
        .where(eq(project.slug, slug))
        .returning({ slug: project.slug });
      if (deleted.length === 0) {
        return notFound("This project no longer exists.");
      }
      await audit({ action: "delete", entity: "project", entityId: slug });
      return {
        status: "ok",
        message: "Project deleted.",
        redirectTo: "/admin/projects",
      };
    },
  );
}

function baseRow(input: ProjectInput) {
  return {
    year: input.year,
    repoUrl: input.repoUrl,
    liveUrl: input.liveUrl,
    coverMediaId: input.coverMediaId,
    featured: input.featured,
    published: input.published,
  };
}

/** Upserts both translations and replaces the ordered skill list. */
async function writeDetails(db: ActionContext["db"], input: ProjectInput) {
  for (const locale of ["en", "ro"] as const) {
    const t = input[locale];
    const row = {
      title: t.title,
      summary: t.summary,
      bodyMd: t.body,
      role: t.role,
      outcome: t.outcome,
    };
    await db
      .insert(projectI18n)
      .values({ projectSlug: input.slug, locale, ...row })
      .onConflictDoUpdate({
        target: [projectI18n.projectSlug, projectI18n.locale],
        set: row,
      });
  }
  await db.delete(projectSkill).where(eq(projectSkill.projectSlug, input.slug));
  if (input.skills.length > 0) {
    await db.insert(projectSkill).values(
      input.skills.map((skillSlug, index) => ({
        projectSlug: input.slug,
        skillSlug,
        position: index + 1,
      })),
    );
  }
}
