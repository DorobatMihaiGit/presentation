import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

// M8 audit: every admin page, signed in, on a laptop and on a phone.

const PAGES = [
  "/admin/profile",
  "/admin/experience",
  "/admin/experience/new",
  "/admin/skills",
  "/admin/skills/new",
  "/admin/projects",
  "/admin/projects/new",
  "/admin/projects/ledger-lens",
  "/admin/media",
  "/admin/messages",
  "/admin/security",
];

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
]) {
  test(`every admin page has no axe violations at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await signInAsOwner(page);
    const found: Record<string, string[]> = {};
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      if (violations.length > 0) {
        found[path] = violations.map(
          (v) =>
            `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
        );
      }
    }
    expect(found).toEqual({});
  });
}
