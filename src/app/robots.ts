import type { MetadataRoute } from "next";
import { buildRobots } from "@/lib/seo";
import { siteUrl } from "@/site";

export default function robots(): MetadataRoute.Robots {
  return buildRobots(siteUrl);
}
