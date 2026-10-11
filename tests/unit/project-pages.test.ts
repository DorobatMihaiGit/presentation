import { describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import {
  NO_PROJECT,
  neighbours,
  staticProjectParams,
} from "@/lib/project-pages";

const cv = resolveCv(fixtures, "en");

describe("staticProjectParams", () => {
  it("prerenders every published project", () => {
    expect(staticProjectParams(cv)).toEqual([
      { slug: "ledger-lens" },
      { slug: "tramline" },
      { slug: "atelier-cms" },
      { slug: "pulse-check" },
    ]);
  });

  it("still gives the build one param when nothing is published", () => {
    // Cache Components refuses an empty generateStaticParams; the placeholder
    // is not a valid slug, so its page is a 404 and never a real project.
    expect(staticProjectParams({ ...cv, projects: [] })).toEqual([
      { slug: NO_PROJECT },
    ]);
    expect(NO_PROJECT).not.toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe("neighbours", () => {
  const slugs = (pair: ReturnType<typeof neighbours>) => ({
    previous: pair.previous?.slug ?? null,
    next: pair.next?.slug ?? null,
  });

  it("follows the order of the Projects grid", () => {
    expect(slugs(neighbours(cv, "tramline"))).toEqual({
      previous: "ledger-lens",
      next: "atelier-cms",
    });
  });

  it("has no previous project first and no next project last", () => {
    expect(slugs(neighbours(cv, "ledger-lens")).previous).toBeNull();
    expect(slugs(neighbours(cv, "pulse-check")).next).toBeNull();
  });

  it("knows nothing about a slug that is not published", () => {
    expect(slugs(neighbours(cv, "draft-project"))).toEqual({
      previous: null,
      next: null,
    });
  });
});
