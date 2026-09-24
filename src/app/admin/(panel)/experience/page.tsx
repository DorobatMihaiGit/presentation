import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton } from "@/components/admin/ActionButton";
import { MissingBadge } from "@/components/admin/fields";
import { button } from "@/components/admin/styles";
import { missingTranslation } from "@/content/localize";
import { moveExperience } from "@/server/actions/experience";
import { requireAdmin } from "@/server/auth";
import { getDb } from "@/server/db";
import { listExperienceForAdmin } from "@/server/queries/admin/experience";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperienceListPage() {
  await requireAdmin();
  const jobs = await listExperienceForAdmin(getDb());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Experience</h1>
        <Link href="/admin/experience/new" className={button}>
          Add experience
        </Link>
      </div>
      <ol className="flex flex-col gap-3">
        {jobs.map((job, index) => (
          <li
            key={job.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-panel bg-surface p-4 ring-1 ring-line"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/admin/experience/${job.id}`}
                className="text-ink underline underline-offset-4"
              >
                {job.company}: {job.en?.roleTitle}
              </Link>
              <span className="font-mono text-label text-ink-subtle">
                {job.startDate} to {job.endDate ?? "now"}
              </span>
              {job.isPublished ? null : (
                <span className="font-mono text-label uppercase text-ink-muted">
                  Draft
                </span>
              )}
              {missingTranslation(job.en, job.ro, [
                "roleTitle",
                "descriptionMd",
                "highlights",
              ]) ? (
                <MissingBadge />
              ) : null}
            </div>
            <div className="flex gap-2">
              {index > 0 ? (
                <ActionButton
                  action={moveExperience}
                  fields={{ id: job.id, direction: "up" }}
                  label={`Move ${job.company} up`}
                />
              ) : null}
              {index < jobs.length - 1 ? (
                <ActionButton
                  action={moveExperience}
                  fields={{ id: job.id, direction: "down" }}
                  label={`Move ${job.company} down`}
                />
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
