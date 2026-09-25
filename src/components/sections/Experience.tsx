import { useTranslations } from "next-intl";
import { Section } from "@/components/ui/Section";
import { fallbackLang } from "@/content/localize";
import type { Cv } from "@/content/types";
import { formatYearMonth } from "@/lib/format";

export function Experience({ cv }: { cv: Cv }) {
  const t = useTranslations("Experience");
  const { locale } = cv;

  return (
    <Section id="experience" title={t("title")} scene="experience">
      <ol className="flex flex-col gap-4 lg:w-7/12">
        {cv.experience.map((job) => (
          <li
            key={job.id}
            className="flex flex-col gap-3 rounded-panel bg-surface p-6 ring-1 ring-line md:p-8"
          >
            <p className="font-mono text-label uppercase text-ink-subtle">
              <time dateTime={job.startDate}>
                {formatYearMonth(job.startDate, locale)}
              </time>
              {" - "}
              {job.endDate ? (
                <time dateTime={job.endDate}>
                  {formatYearMonth(job.endDate, locale)}
                </time>
              ) : (
                t("present")
              )}
            </p>
            <div>
              <h3
                lang={fallbackLang(job.roleTitle, locale)}
                className="text-heading text-ink"
              >
                {job.roleTitle.value}
              </h3>
              <p className="mt-1 text-ink-muted">
                {job.company} · {t(`employmentType.${job.employmentType}`)}
              </p>
              <p
                lang={fallbackLang(job.description, locale)}
                className="mt-4 max-w-[65ch] text-ink-muted"
              >
                {job.description.value}
              </p>
              {job.highlights.value.length > 0 ? (
                <ul
                  lang={fallbackLang(job.highlights, locale)}
                  className="mt-4 flex max-w-[65ch] list-disc flex-col gap-2 pl-5 text-ink-muted marker:text-ink-subtle"
                >
                  {job.highlights.value.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
