import type { Metadata } from "next";
import { ActionForm } from "@/components/admin/ActionForm";
import { SkillFields } from "@/components/admin/SkillFields";
import { createSkill } from "@/server/actions/skills";
import { requireAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Add skill" };

export default async function NewSkillPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-title text-ink">Add skill</h1>
      <ActionForm action={createSkill} submitLabel="Add skill">
        <SkillFields
          isNew
          value={{
            slug: "",
            layer: "interface",
            name: "",
            level: 3,
            years: 1,
            featured: false,
          }}
        />
      </ActionForm>
    </div>
  );
}
