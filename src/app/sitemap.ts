import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/seo";
import { siteUrl } from "@/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap(siteUrl);
}
