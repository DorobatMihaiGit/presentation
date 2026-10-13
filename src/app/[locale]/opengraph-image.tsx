import { cacheLife, cacheTag } from "next/cache";
import { getCv } from "@/content/get-cv";
import { type Locale, routing } from "@/i18n/routing";
import { OG_SIZE, ogPng, pngResponse } from "@/lib/og-image";
import { CV_TAG } from "@/server/cache-tags";

export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Cached under the CV tag like the page, so an admin edit renders a new card
// on the next request (rendering outside a cache is refused at runtime).
async function homeCard(locale: Locale): Promise<Uint8Array> {
  "use cache";
  cacheTag(CV_TAG);
  cacheLife("max");
  const cv = await getCv(locale);
  const role = cv.experience.find((job) => job.endDate === null)?.roleTitle;
  return ogPng({
    eyebrow: role?.value ?? cv.profile.location,
    title: cv.profile.fullName.value,
    lines: [cv.profile.headline.value],
  });
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return pngResponse(await homeCard(locale as Locale));
}
