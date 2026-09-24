import type { Locale } from "@/i18n/routing";
import type { I18n, Localized } from "./types";

function isFilled(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isFilled);
  }
  return value !== undefined && value !== null;
}

/**
 * Reads one translatable field for `locale`, falling back to English when the
 * translation is missing or blank (same rule as M2's `COALESCE(ro, en)`).
 */
export function localize<T, K extends keyof T>(
  i18n: I18n<T>,
  locale: Locale,
  key: K,
): Localized<T[K]> {
  if (locale !== "en") {
    const translated = i18n[locale]?.[key];
    if (translated !== undefined && isFilled(translated)) {
      return { value: translated as T[K], lang: locale };
    }
  }
  return { value: i18n.en[key], lang: "en" };
}

/** `lang` attribute for an element showing `text` on a `pageLocale` page (only set on fallbacks). */
export function fallbackLang(
  text: Localized<unknown>,
  pageLocale: Locale,
): Locale | undefined {
  return text.lang === pageLocale ? undefined : text.lang;
}

/**
 * True when some field is filled in English but blank in Romanian: the admin
 * shows a "RO missing" badge because /ro falls back to English there.
 */
export function missingTranslation<T extends Record<string, unknown>>(
  en: T | undefined,
  ro: T | undefined,
  keys: ReadonlyArray<keyof T>,
): boolean {
  return keys.some((key) => isFilled(en?.[key]) && !isFilled(ro?.[key]));
}
