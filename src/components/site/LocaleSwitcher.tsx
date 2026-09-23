import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";

export function LocaleSwitcher({ locale }: { locale: Locale }) {
  const t = useTranslations("LocaleSwitcher");

  return (
    <nav aria-label={t("label")}>
      <ul className="flex gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
        {routing.locales.map((target) => (
          <li key={target}>
            <Link
              href="/"
              locale={target}
              lang={target}
              aria-current={target === locale ? "page" : undefined}
              className="block rounded-full px-3 py-1.5 text-sm text-ink-muted transition-colors hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink"
            >
              {t(target)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
