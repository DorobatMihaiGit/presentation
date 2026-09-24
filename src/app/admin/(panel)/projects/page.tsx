import type { Metadata } from "next";
import Link from "next/link";
import { MissingBadge } from "@/components/admin/fields";
import { button } from "@/components/admin/styles";
import { missingTranslation } from "@/content/localize";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listProjectsForAdmin } from "@/server/queries/admin/projects";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  await requireAdmin();
  const projects = await listProjectsForAdmin(getDb());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Projects</h1>
        <Link href="/admin/projects/new" className={button}>
          Add project
        </Link>
      </div>
      <ul className="flex flex-col gap-3">
        {projects.map((item) => (
          <li
            key={item.slug}
            className="flex flex-wrap items-center gap-3 rounded-panel bg-surface p-4 ring-1 ring-line"
          >
            <Link
              href={`/admin/projects/${item.slug}`}
              className="text-ink underline underline-offset-4"
            >
              {item.en?.title ?? item.slug}
            </Link>
            <span className="font-mono text-label text-ink-subtle">
              {item.year}
            </span>
            {item.published ? null : (
              <span className="font-mono text-label uppercase text-ink-muted">
                Draft
              </span>
            )}
            {missingTranslation(item.en, item.ro, [
              "title",
              "summary",
              "role",
              "outcome",
            ]) ? (
              <MissingBadge />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
