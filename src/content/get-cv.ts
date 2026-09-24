import { cacheLife, cacheTag } from "next/cache";
import type { Locale } from "@/i18n/routing";
import { CV_TAG } from "@/server/cache-tags";
import { getDb } from "@/server/db";
import { loadCvRecords } from "@/server/queries/cv";
import { resolveCv } from "./resolve-cv";
import type { Cv } from "./types";

/**
 * CV content for one locale, read from Postgres. Cached across requests and
 * prerendered into the static /en and /ro pages; admin mutations call
 * `updateTag(CV_TAG)` so the next request renders fresh content.
 */
export async function getCv(locale: Locale): Promise<Cv> {
  "use cache";
  cacheTag(CV_TAG);
  cacheLife("max");
  return resolveCv(await loadCvRecords(getDb()), locale);
}
