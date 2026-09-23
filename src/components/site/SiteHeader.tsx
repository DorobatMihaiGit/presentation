import { useTranslations } from "next-intl";
import type { Cv } from "@/content/types";
import { LocaleSwitcher } from "./LocaleSwitcher";

const SECTIONS = [
  "about",
  "skills",
  "experience",
  "projects",
  "contact",
] as const;

export function SiteHeader({ cv }: { cv: Cv }) {
  const t = useTranslations("Nav");

  return (
    <header
      id="top"
      className="mx-auto flex w-full max-w-content items-center justify-between gap-6 px-gutter pt-6"
    >
      <a
        href="#top"
        className="rounded-full py-1.5 text-sm font-semibold text-ink"
      >
        {cv.profile.fullName.value}
      </a>
      <nav aria-label={t("label")} className="hidden md:block">
        <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
          {SECTIONS.map((id) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                {t(id)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <LocaleSwitcher locale={cv.locale} />
    </header>
  );
}
