import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { ExperienceFields } from "@/components/admin/ExperienceFields";
import {
  deleteExperience,
  updateExperience,
} from "@/server/actions/experience";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listExperienceForAdmin } from "@/server/queries/admin/experience";

export const metadata: Metadata = { title: "Edit experience" };

export default async function EditExperiencePage({
  params,
}: PageProps<"/admin/experience/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const job = (await listExperienceForAdmin(getDb())).find((j) => j.id === id);
  if (!job) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">{job.company}</h1>
        <ActionButton
          action={deleteExperience}
          fields={{ id: job.id }}
          label="Delete"
          confirmMessage={`Delete ${job.company}? This cannot be undone.`}
        />
      </div>
      <ActionForm action={updateExperience} submitLabel="Save experience">
        <input type="hidden" name="id" value={job.id} />
        <ExperienceFields value={job} />
      </ActionForm>
    </div>
  );
}
