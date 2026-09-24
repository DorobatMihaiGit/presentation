import type { Locale } from "@/i18n/routing";
import { fixtures } from "./fixtures";
import { resolveCv } from "./resolve-cv";
import type { Cv } from "./types";

/**
 * CV content for one locale. Async on purpose: the next task swaps the
 * fixture source for cached Drizzle queries (`'use cache'` + `cacheTag('cv')`)
 * behind this signature.
 */
export async function getCv(locale: Locale): Promise<Cv> {
  return resolveCv(fixtures, locale);
}
