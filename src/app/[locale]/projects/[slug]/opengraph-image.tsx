import { cacheLife, cacheTag } from "next/cache";
import { getCv } from "@/content/get-cv";
import { type Locale, routing } from "@/i18n/routing";
import { OG_SIZE, ogImageData, ogPng, pngResponse } from "@/lib/og-image";
import { findProject, staticProjectParams } from "@/lib/project-pages";
import { CV_TAG } from "@/server/cache-tags";

export const size = OG_SIZE;
export const contentType = "image/png";

// Prerendered like the project pages, one per published project and locale.
// A route handler gets no params from the [locale] layout, so it lists both.
export async function generateStaticParams() {
  const pages = await Promise.all(
    routing.locales.map(async (locale) =>
      staticProjectParams(await getCv(locale)).map(({ slug }) => ({
        locale,
        slug,
      })),
    ),
  );
  return pages.flat();
}

// Cached under the CV tag like the page (see ../../opengraph-image.tsx).
async function projectCard(locale: Locale, slug: string): Promise<Uint8Array> {
  "use cache";
  cacheTag(CV_TAG);
  cacheLife("max");
  const cv = await getCv(locale);
  const project = findProject(cv, slug);
  if (!project) {
    return ogPng({ eyebrow: "", title: cv.profile.fullName.value, lines: [] });
  }
  return ogPng({
    eyebrow: `${cv.profile.fullName.value} · ${project.year}`,
    title: project.title.value,
    lines: [project.summary.value],
    background: project.cover ? await ogImageData(project.cover.url) : null,
  });
}

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  return pngResponse(await projectCard(locale as Locale, slug));
}
