import type { YearMonth } from "@/content/types";
import type { Locale } from "@/i18n/routing";

/**
 * Formats `YYYY-MM` as a short month + year (`Mar 2021`, `mar. 2021`).
 * Pinned to UTC so the month never shifts with the server's time zone.
 */
export function formatYearMonth(value: YearMonth, locale: Locale): string {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** A file size as the visitor reads it: `89 kB`, `1.4 MB` (`1,4 MB` in RO). */
export function formatFileSize(bytes: number, locale: Locale): string {
  const mb = bytes >= 1024 * 1024;
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    unitDisplay: "short",
    maximumFractionDigits: mb ? 1 : 0,
  }).format(bytes / (mb ? 1024 * 1024 : 1024));
}
