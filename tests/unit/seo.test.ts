import { describe, expect, it } from "vitest";
import { getCv } from "@/content/get-cv";
import {
  buildRobots,
  buildSitemap,
  languageAlternates,
  localeUrl,
  personJsonLd,
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

  it("allows crawling and points at the sitemap", () => {
    expect(buildRobots(SITE)).toEqual({
      rules: { userAgent: "*", allow: "/" },
      sitemap: "https://cv.example.dev/sitemap.xml",
    });
  });
});

describe("personJsonLd", () => {
  it("describes the person in the page locale", async () => {
    const data = personJsonLd(await getCv("ro"), SITE);

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
    const cv = await getCv("en");
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
