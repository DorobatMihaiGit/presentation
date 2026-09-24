import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { ProjectFields } from "@/components/admin/ProjectFields";
import { deleteProject, updateProject } from "@/server/actions/projects";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import {
  listProjectsForAdmin,
  projectPickers,
} from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: PageProps<"/admin/projects/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const db = getDb();
  const [projects, pickers] = await Promise.all([
    listProjectsForAdmin(db),
    projectPickers(db),
  ]);
  const item = projects.find((p) => p.slug === slug);
  if (!item) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">{item.en?.title ?? item.slug}</h1>
        <ActionButton
          action={deleteProject}
          fields={{ slug: item.slug }}
          label="Delete"
          confirmMessage={`Delete ${item.en?.title ?? item.slug}? This cannot be undone.`}
        />
      </div>
      <ActionForm action={updateProject} submitLabel="Save project">
        <ProjectFields value={item} isNew={false} {...pickers} />
      </ActionForm>
    </div>
  );
}
