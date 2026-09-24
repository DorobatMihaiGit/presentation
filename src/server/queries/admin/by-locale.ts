import type { Locale } from "@/i18n/routing";

/** The `<entity>_i18n` row for one locale, if it exists. */
export function byLocale<Row extends { locale: Locale }>(
  rows: Row[],
  locale: Locale,
): Row | undefined {
  return rows.find((row) => row.locale === locale);
}
