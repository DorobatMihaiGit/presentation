import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { EMPTY_PROJECT, ProjectFields } from "@/components/admin/ProjectFields";
import { createProject } from "@/server/actions/projects";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { projectPickers } from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Add project" };

export default async function NewProjectPage() {
  await requireAdmin();
  const pickers = await projectPickers(getDb());
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Add project</h1>
      <ActionForm action={createProject} submitLabel="Add project">
        <ProjectFields value={EMPTY_PROJECT} isNew {...pickers} />
      </ActionForm>
    </div>
  );
}
