import { useTranslations } from "next-intl";
import type { Localized, MediaFile } from "@/content/types";
import type { Locale } from "@/i18n/routing";
import { formatFileSize } from "@/lib/format";

/**
 * The CV PDF picked in the admin. On /ro without a Romanian PDF it offers
 * the English one and marks it with hreflang.
 */
export function CvDownload({
  cvPdf,
  locale,
  className = "",
}: {
  cvPdf: Localized<MediaFile>;
  locale: Locale;
  className?: string;
}) {
  const t = useTranslations("Cv");

  return (
    <a
      href={cvPdf.value.url}
      type="application/pdf"
      hrefLang={cvPdf.lang === locale ? undefined : cvPdf.lang}
      className={`inline-flex min-h-11 items-center gap-2 underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-signal ${className}`}
    >
      {t("download")}
      <span className="font-mono text-label uppercase text-ink-subtle">
        {t("format", { size: formatFileSize(cvPdf.value.bytes, locale) })}
      </span>
    </a>
  );
}
