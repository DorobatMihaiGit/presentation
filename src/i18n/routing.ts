import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ro"],
  defaultLocale: "en",
  localePrefix: "always",
  // hreflang is emitted by page metadata and the sitemap (one source, based on SITE_URL).
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
