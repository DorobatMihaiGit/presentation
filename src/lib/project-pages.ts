import type { Cv } from "@/content/types";

export type Project = Cv["projects"][number];

/**
 * Stand-in slug for a build with no published project: Cache Components
 * refuses an empty `generateStaticParams`. It can never be a real slug (the
 * admin only accepts lowercase letters, digits and dashes), so its page is a
 * 404.
 */
export const NO_PROJECT = "_";

/** Every published project gets a prerendered page. */
export function staticProjectParams(cv: Cv): { slug: string }[] {
  const params = cv.projects.map(({ slug }) => ({ slug }));
  return params.length > 0 ? params : [{ slug: NO_PROJECT }];
}

export function findProject(cv: Cv, slug: string): Project | undefined {
  return cv.projects.find((project) => project.slug === slug);
}

/** The projects before and after `slug` in the order of the Projects grid. */
export function neighbours(
  cv: Cv,
  slug: string,
): { previous: Project | null; next: Project | null } {
  const index = cv.projects.findIndex((project) => project.slug === slug);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: cv.projects[index - 1] ?? null,
    next: cv.projects[index + 1] ?? null,
  };
}
