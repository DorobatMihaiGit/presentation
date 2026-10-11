import { describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import {
  buildRobots,
  buildSitemap,
  languageAlternates,
  localeUrl,
  personJsonLd,
  projectJsonLd,
  projectPath,
  resolveSiteUrl,
  serializeJsonLd,
} from "@/lib/seo";

const SITE = "https://cv.example.dev";

describe("resolveSiteUrl", () => {
  it("prefers SITE_URL and drops a trailing slash", () => {
    expect(
      resolveSiteUrl({
        siteUrl: "https://cv.example.dev/",
        vercelProductionHost: "cv.vercel.app",
      }),
    ).toBe(SITE);
  });

  it("uses the Vercel production host when SITE_URL is unset", () => {
    expect(resolveSiteUrl({ vercelProductionHost: "cv.vercel.app" })).toBe(
      "https://cv.vercel.app",
    );
  });

  it("falls back to the local dev server", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });
});

describe("locale URLs", () => {
  it("builds the home URL without a trailing slash", () => {
    expect(localeUrl(SITE, "ro")).toBe("https://cv.example.dev/ro");
  });

  it("builds nested paths", () => {
    expect(localeUrl(SITE, "en", "/projects/ledger-lens")).toBe(
      "https://cv.example.dev/en/projects/ledger-lens",
    );
  });

  it("lists every locale plus x-default", () => {
    expect(languageAlternates(SITE)).toEqual({
      en: "https://cv.example.dev/en",
      ro: "https://cv.example.dev/ro",
      "x-default": "https://cv.example.dev",
    });
  });
});

describe("sitemap and robots", () => {
  it("lists each locale home with hreflang alternates", () => {
    const sitemap = buildSitemap(SITE);

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://cv.example.dev/en",
      "https://cv.example.dev/ro",
    ]);
    for (const entry of sitemap) {
      expect(entry.alternates?.languages).toEqual(languageAlternates(SITE));
    }
  });

  it("adds every project page in both languages with its own alternates", () => {
    const sitemap = buildSitemap(SITE, ["ledger-lens", "tramline"]);

    expect(sitemap.map((entry) => entry.url)).toEqual([
      "https://cv.example.dev/en",
      "https://cv.example.dev/ro",
      "https://cv.example.dev/en/projects/ledger-lens",
      "https://cv.example.dev/ro/projects/ledger-lens",
      "https://cv.example.dev/en/projects/tramline",
      "https://cv.example.dev/ro/projects/tramline",
    ]);
    expect(sitemap[2].alternates?.languages).toEqual({
      en: "https://cv.example.dev/en/projects/ledger-lens",
      ro: "https://cv.example.dev/ro/projects/ledger-lens",
      "x-default": "https://cv.example.dev/projects/ledger-lens",
    });
  });

  it("allows crawling and points at the sitemap", () => {
    expect(buildRobots(SITE)).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://cv.example.dev/sitemap.xml",
    });
  });
});

describe("personJsonLd", () => {
  it("describes the person in the page locale", async () => {
    const data = personJsonLd(resolveCv(fixtures, "ro"), SITE);

    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "Person",
      "@id": "https://cv.example.dev/#person",
      name: "Alex Marin",
      jobTitle: "Inginer Fullstack Senior",
      url: "https://cv.example.dev/ro",
      email: "mailto:hello@example.com",
      address: { addressLocality: "Cluj-Napoca", addressCountry: "RO" },
      worksFor: { "@type": "Organization", name: "Ardea Health" },
      knowsLanguage: ["en", "ro"],
    });
    expect(data.knowsAbout).toContain("PostgreSQL");
    expect(data.sameAs).toHaveLength(2);
  });

  it("omits jobTitle and worksFor when no role is current", async () => {
    const cv = resolveCv(fixtures, "en");
    const data = personJsonLd(
      {
        ...cv,
        experience: cv.experience.filter((job) => job.endDate !== null),
      },
      SITE,
    );

    expect(data).not.toHaveProperty("jobTitle");
    expect(data).not.toHaveProperty("worksFor");
  });
});

describe("projectJsonLd", () => {
  it("describes a project page as a creative work by the person", () => {
    const cv = resolveCv(fixtures, "ro");
    const ledger = cv.projects[0];

    expect(projectPath(ledger.slug)).toBe("/projects/ledger-lens");
    expect(projectJsonLd(cv, ledger, SITE)).toEqual({
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      "@id": "https://cv.example.dev/ro/projects/ledger-lens#work",
      name: "Ledger Lens",
      description:
        "Panou de reconciliere care potrivește extrasele bancare cu facturile pentru firme mici de contabilitate.",
      url: "https://cv.example.dev/ro/projects/ledger-lens",
      inLanguage: "ro",
      dateCreated: "2025",
      author: {
        "@type": "Person",
        "@id": "https://cv.example.dev/#person",
        name: "Alex Marin",
      },
      keywords: "Next.js, PostgreSQL, Drizzle ORM, Vitest and Playwright",
      sameAs: [
        "https://example.com/ledger-lens",
        "https://example.com/ledger-lens/source",
      ],
    });
  });

  it("points at the cover with an absolute URL", () => {
    const cv = resolveCv(fixtures, "en");
    const cover = {
      url: "/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
      width: 1600,
      height: 1000,
      lqip: null,
      alt: { value: "Board", lang: "en" as const },
    };

    expect(projectJsonLd(cv, { ...cv.projects[1], cover }, SITE)).toMatchObject(
      {
        image:
          "https://cv.example.dev/api/media/0b4c3f7e-2c1a-4f6e-9d55-5b7c6f1e2a90.webp",
        sameAs: ["https://example.com/tramline"],
      },
    );
  });
});

describe("serializeJsonLd", () => {
  it("cannot be used to close the script tag", () => {
    const json = serializeJsonLd({
      name: "</script><script>alert(1)</script>",
    });

    expect(json).not.toContain("</script>");
    expect(JSON.parse(json)).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });
});
