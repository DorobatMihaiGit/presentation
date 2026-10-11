import type { MetadataRoute } from "next";
import type { Cv } from "@/content/types";
import { type Locale, routing } from "@/i18n/routing";

/**
 * Public origin used for canonical URLs, hreflang, the sitemap and JSON-LD.
 * `SITE_URL` wins; on Vercel production builds the project's production domain
 * is used; local and CI fall back to the dev server.
 */
export function resolveSiteUrl(input: {
  siteUrl?: string;
  vercelProductionHost?: string;
}): string {
  const raw =
    input.siteUrl ??
    (input.vercelProductionHost
      ? `https://${input.vercelProductionHost}`
      : "http://localhost:3000");
  return new URL(raw).origin;
}

/** Absolute URL of `pathname` (always starting with `/`) in `locale`. */
export function localeUrl(
  siteUrl: string,
  locale: Locale,
  pathname = "/",
): string {
  const suffix = pathname === "/" ? "" : pathname;
  return `${siteUrl}/${locale}${suffix}`;
}

/** hreflang map for one page: every locale plus `x-default` (the detecting root). */
export function languageAlternates(
  siteUrl: string,
  pathname = "/",
): Record<Locale | "x-default", string> {
  const entries = routing.locales.map(
    (locale) => [locale, localeUrl(siteUrl, locale, pathname)] as const,
  );
  return {
    ...(Object.fromEntries(entries) as Record<Locale, string>),
    "x-default": pathname === "/" ? siteUrl : `${siteUrl}${pathname}`,
  };
}

/** Path of a project's case study page, below the locale. */
export function projectPath(slug: string): string {
  return `/projects/${slug}`;
}

/** Both locale homes, then every published project in both locales. */
export function buildSitemap(
  siteUrl: string,
  projectSlugs: readonly string[] = [],
): MetadataRoute.Sitemap {
  const pages = [
    { pathname: "/", priority: 1 },
    ...projectSlugs.map((slug) => ({
      pathname: projectPath(slug),
      priority: 0.7,
    })),
  ];
  return pages.flatMap(({ pathname, priority }) =>
    routing.locales.map((locale) => ({
      url: localeUrl(siteUrl, locale, pathname),
      changeFrequency: "monthly" as const,
      priority,
      alternates: { languages: languageAlternates(siteUrl, pathname) },
    })),
  );
}

export function buildRobots(siteUrl: string): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

/** schema.org `Person` for the home page of `cv.locale`. */
export function personJsonLd(cv: Cv, siteUrl: string) {
  const { profile } = cv;
  const current = cv.experience.find((job) => job.endDate === null);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/#person`,
    name: profile.fullName.value,
    description: profile.summary.value,
    url: localeUrl(siteUrl, cv.locale),
    email: `mailto:${profile.email}`,
    address: {
      "@type": "PostalAddress",
      addressLocality: profile.location,
      addressCountry: profile.countryCode,
    },
    sameAs: profile.socials.map((social) => social.url),
    knowsAbout: cv.stack.flatMap((layer) =>
      layer.skills.filter((s) => s.featured).map((s) => s.name),
    ),
    knowsLanguage: [...routing.locales],
    ...(current
      ? {
          jobTitle: current.roleTitle.value,
          worksFor: { "@type": "Organization", name: current.company },
        }
      : {}),
  };
}

/** schema.org `CreativeWork` for a project page, authored by the home page's Person. */
export function projectJsonLd(
  cv: Cv,
  project: Cv["projects"][number],
  siteUrl: string,
) {
  const url = localeUrl(siteUrl, cv.locale, projectPath(project.slug));
  const links = [project.liveUrl, project.repoUrl].filter(
    (link): link is string => Boolean(link),
  );

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#work`,
    name: project.title.value,
    description: project.summary.value,
    url,
    inLanguage: cv.locale,
    dateCreated: String(project.year),
    author: {
      "@type": "Person",
      "@id": `${siteUrl}/#person`,
      name: cv.profile.fullName.value,
    },
    keywords: project.skills.join(", "),
    ...(project.cover
      ? { image: new URL(project.cover.url, siteUrl).href }
      : {}),
    ...(links.length > 0 ? { sameAs: links } : {}),
  };
}

/** JSON for an inline `<script type="application/ld+json">`; `<` is escaped so content cannot close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
