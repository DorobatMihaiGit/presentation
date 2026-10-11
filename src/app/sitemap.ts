import type { MetadataRoute } from "next";
import { getCv } from "@/content/get-cv";
import { buildSitemap } from "@/lib/seo";
import { siteUrl } from "@/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Slugs are the same in every locale; getCv is cached under the CV tag.
  const { projects } = await getCv("en");
  return buildSitemap(
    siteUrl,
    projects.map((project) => project.slug),
  );
}
