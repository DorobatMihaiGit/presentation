import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { FormSection, TranslatedField } from "@/components/admin/fields";
import { button } from "@/components/admin/styles";
import { STACK_LAYERS } from "@/content/types";
import { saveCategories } from "@/server/actions/skills";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listStackForAdmin } from "@/server/queries/admin/skills";

export const metadata: Metadata = { title: "Skills" };

export default async function SkillsPage() {
  await requireAdmin();
  const { categories, names, skills } = await listStackForAdmin(getDb());
  const nameOf = (slug: string | undefined, locale: "en" | "ro") =>
    names.find((row) => row.categorySlug === slug && row.locale === locale)
      ?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Skills</h1>
        <Link href="/admin/skills/new" className={button}>
          Add skill
        </Link>
      </div>
      <ActionForm action={saveCategories} submitLabel="Save layer names">
        <FormSection title="Stack layers">
          {STACK_LAYERS.map((layer) => {
            const slug = categories.find((c) => c.layer === layer)?.slug;
            return (
              <TranslatedField
                key={layer}
                name={`${layer}`}
                label={`Layer ${layer}`}
                en={nameOf(slug, "en")}
                ro={nameOf(slug, "ro")}
              />
            );
          })}
        </FormSection>
      </ActionForm>
      {STACK_LAYERS.map((layer) => {
        const slug = categories.find((c) => c.layer === layer)?.slug;
        const inLayer = skills.filter((s) => s.categorySlug === slug);
        return (
          <section
            key={layer}
            className="flex flex-col gap-3 rounded-panel bg-surface p-6 ring-1 ring-line"
          >
            <h2 className="text-heading text-ink">
              {nameOf(slug, "en")}{" "}
              <span className="font-mono text-label text-ink-subtle">
                ({layer})
              </span>
            </h2>
            <ul className="flex flex-wrap gap-2">
              {inLayer.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/admin/skills/${s.slug}`}
                    className="inline-block rounded-full px-3 py-1 text-sm text-ink ring-1 ring-line-strong hover:bg-raised"
                  >
                    {s.name}
                    {s.featured ? " ★" : ""}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
