import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionForm } from "@/components/admin/ActionForm";
import { SkillFields } from "@/components/admin/SkillFields";
import { deleteSkill, updateSkill } from "@/server/actions/skills";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listStackForAdmin } from "@/server/queries/admin/skills";

export const metadata: Metadata = { title: "Edit skill" };

export default async function EditSkillPage({
  params,
}: PageProps<"/admin/skills/[slug]">) {
  await requireAdmin();
  const { slug } = await params;
  const { categories, skills } = await listStackForAdmin(getDb());
  const found = skills.find((s) => s.slug === slug);
  const layer = categories.find((c) => c.slug === found?.categorySlug)?.layer;
  if (!found || !layer) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">{found.name}</h1>
        <ActionButton
          action={deleteSkill}
          fields={{ slug: found.slug }}
          label="Delete"
          confirmMessage={`Delete ${found.name}? Projects lose this tag.`}
        />
      </div>
      <ActionForm action={updateSkill} submitLabel="Save skill">
        <SkillFields isNew={false} value={{ ...found, layer }} />
      </ActionForm>
    </div>
  );
}
