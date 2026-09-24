import { describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { fallbackLang, localize } from "@/content/localize";
import { resolveCv } from "@/content/resolve-cv";
import { type CvRecords, STACK_LAYERS } from "@/content/types";

describe("localize", () => {
  const i18n = {
    en: { title: "Ledger", tags: ["a", "b"] },
    ro: { title: "Registru", tags: [] as string[] },
  };

  it("returns the requested locale when it is translated", () => {
    expect(localize(i18n, "ro", "title")).toEqual({
      value: "Registru",
      lang: "ro",
    });
  });

  it("returns English for the English locale", () => {
    expect(localize(i18n, "en", "title")).toEqual({
      value: "Ledger",
      lang: "en",
    });
  });

  it("falls back to English when the translation row is missing", () => {
    expect(localize({ en: { title: "Ledger" } }, "ro", "title")).toEqual({
      value: "Ledger",
      lang: "en",
    });
  });

  it("falls back to English when the translation is blank", () => {
    expect(
      localize(
        { en: { title: "Ledger" }, ro: { title: "   " } },
        "ro",
        "title",
      ),
    ).toEqual({ value: "Ledger", lang: "en" });
  });

  it("falls back to English when a translated list is empty", () => {
    expect(localize(i18n, "ro", "tags")).toEqual({
      value: ["a", "b"],
      lang: "en",
    });
  });

  it("marks only fallbacks with a lang attribute", () => {
    expect(fallbackLang({ value: "x", lang: "ro" }, "ro")).toBeUndefined();
    expect(fallbackLang({ value: "x", lang: "en" }, "ro")).toBe("en");
  });
});

describe("resolveCv", () => {
  it("resolves Romanian copy with diacritics", async () => {
    const cv = resolveCv(fixtures, "ro");

    expect(cv.locale).toBe("ro");
    expect(cv.profile.headline.value).toContain("construiește");
    expect(cv.profile.headline.lang).toBe("ro");
  });

  it("falls back per field, not per record", async () => {
    const cv = resolveCv(fixtures, "ro");
    const meridian = cv.experience.find((job) => job.id === "studio-meridian");

    expect(meridian?.roleTitle).toEqual({
      value: "Dezvoltator Frontend",
      lang: "ro",
    });
    expect(meridian?.description.lang).toBe("en");
  });

  it("drops unpublished experience and projects", async () => {
    const cv = resolveCv(fixtures, "en");

    expect(cv.experience.map((job) => job.id)).not.toContain("draft-role");
    expect(cv.projects.map((p) => p.slug)).not.toContain("draft-project");
  });

  it("orders experience by sortOrder and projects featured-first, newest first", () => {
    const records: CvRecords = {
      ...fixtures,
      experience: fixtures.experience.toReversed(),
      projects: fixtures.projects.toReversed(),
    };
    const cv = resolveCv(records, "en");

    expect(cv.experience.map((job) => job.id)).toEqual([
      "ardea-health",
      "ferrum-freight",
      "studio-meridian",
    ]);
    expect(cv.projects.map((p) => p.slug)).toEqual([
      "ledger-lens",
      "tramline",
      "atelier-cms",
      "pulse-check",
    ]);
  });

  it("returns one stack entry per layer, top to bottom", async () => {
    const cv = resolveCv(fixtures, "en");

    expect(cv.stack.map((entry) => entry.layer)).toEqual([...STACK_LAYERS]);
  });

  it("resolves project skill slugs to display names", async () => {
    const cv = resolveCv(fixtures, "en");
    const ledger = cv.projects.find((p) => p.slug === "ledger-lens");

    expect(ledger?.skills).toEqual([
      "Next.js",
      "PostgreSQL",
      "Drizzle ORM",
      "Vitest and Playwright",
    ]);
  });
});

describe("fixtures", () => {
  it("maps every skill category to exactly one distinct stack layer", () => {
    const layers = fixtures.skillCategories.map((c) => c.layer).sort();

    expect(layers).toEqual([...STACK_LAYERS].sort());
  });

  it("only references skills and categories that exist", () => {
    const skillSlugs = new Set(fixtures.skills.map((s) => s.slug));
    const categorySlugs = new Set(fixtures.skillCategories.map((c) => c.slug));

    for (const skill of fixtures.skills) {
      expect(categorySlugs).toContain(skill.categorySlug);
    }
    for (const project of fixtures.projects) {
      for (const slug of project.skills) {
        expect(skillSlugs).toContain(slug);
      }
    }
  });

  it("uses unique slugs and ids", () => {
    const unique = (values: string[]) => new Set(values).size === values.length;

    expect(unique(fixtures.projects.map((p) => p.slug))).toBe(true);
    expect(unique(fixtures.skills.map((s) => s.slug))).toBe(true);
    expect(unique(fixtures.experience.map((e) => e.id))).toBe(true);
  });

  it("uses YYYY-MM dates with a start before the end", () => {
    for (const job of fixtures.experience) {
      expect(job.startDate).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      if (job.endDate !== null) {
        expect(job.endDate).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
        expect(job.endDate >= job.startDate).toBe(true);
      }
    }
  });
});
