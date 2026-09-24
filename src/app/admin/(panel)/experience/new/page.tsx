import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  EMPTY_EXPERIENCE,
  ExperienceFields,
} from "@/components/admin/ExperienceFields";
import { createExperience } from "@/server/actions/experience";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Add experience" };

export default async function NewExperiencePage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Add experience</h1>
      <ActionForm action={createExperience} submitLabel="Add experience">
        <ExperienceFields value={EMPTY_EXPERIENCE} />
      </ActionForm>
    </div>
  );
}
