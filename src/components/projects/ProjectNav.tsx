import Link from "next/link";
import { useTranslations } from "next-intl";
import { fallbackLang } from "@/content/localize";
import type { Locale } from "@/i18n/routing";
import type { Project } from "@/lib/project-pages";
import { projectPath } from "@/lib/seo";

/** Previous and next project, in the order of the Projects grid. */
export function ProjectNav({
  locale,
  previous,
  next,
}: {
  locale: Locale;
  previous: Project | null;
  next: Project | null;
}) {
  const t = useTranslations("Project");

  if (!previous && !next) {
    return null;
  }
  const card =
    "flex min-h-24 flex-col justify-center gap-1 rounded-panel bg-surface p-6 ring-1 ring-line transition-colors hover:bg-raised";
  return (
    <nav
      aria-label={t("more")}
      className="relative mx-auto w-full max-w-content px-gutter pt-24 pb-section"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {previous ? (
          <li>
            <Link
              href={`/${locale}${projectPath(previous.slug)}`}
              className={card}
            >
              <span className="font-mono text-label uppercase text-ink-subtle">
                <span aria-hidden="true">← </span>
                {t("previous")}
              </span>
              <span
                lang={fallbackLang(previous.title, locale)}
                className="text-heading text-ink"
              >
                {previous.title.value}
              </span>
            </Link>
          </li>
        ) : null}
        {next ? (
          <li className="sm:col-start-2">
            <Link
              href={`/${locale}${projectPath(next.slug)}`}
              className={`${card} sm:items-end sm:text-right`}
            >
              <span className="font-mono text-label uppercase text-ink-subtle">
                {t("next")}
                <span aria-hidden="true"> →</span>
              </span>
              <span
                lang={fallbackLang(next.title, locale)}
                className="text-heading text-ink"
              >
                {next.title.value}
              </span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
