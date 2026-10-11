import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";

/** Links to the same page in every locale (a project stays the same project). */
export function LocaleSwitcher({
  locale,
  path,
}: {
  locale: Locale;
  /** The page below the locale, e.g. "/" or "/projects/tramline". */
  path: string;
}) {
  const t = useTranslations("LocaleSwitcher");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
        {routing.locales.map((target) => (
          <li key={target}>
            <Link
              href={path}
              locale={target}
              lang={target}
              aria-current={target === locale ? "page" : undefined}
              className="flex items-center rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink pointer-coarse:min-h-11"
            >
              {t(target)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
