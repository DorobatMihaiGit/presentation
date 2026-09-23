import { env } from "@/env";
import { resolveSiteUrl } from "@/lib/seo";

export const siteUrl = resolveSiteUrl({
  siteUrl: env.SITE_URL,
  vercelProductionHost: process.env.VERCEL_PROJECT_PRODUCTION_URL,
});
