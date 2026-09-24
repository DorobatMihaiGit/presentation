import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("reordering experience changes the public timeline", async ({ page }) => {
  await page.goto("/admin/experience");
  await page.getByRole("button", { name: "Move Ferrum Freight up" }).click();
  // First in the list: the "up" button disappears once the action is done.
  await expect(
    page.getByRole("button", { name: "Move Ferrum Freight up" }),
  ).toHaveCount(0);

  await page.goto("/en");
  await expect(
    page.locator("#experience").getByRole("heading", { level: 3 }).first(),
  ).toHaveText("Fullstack Developer");

  await page.goto("/admin/experience");
  await page.getByRole("button", { name: "Move Ferrum Freight down" }).click();
  await expect(
    page.getByRole("button", { name: "Move Ardea Health up" }),
  ).toHaveCount(0);
});

const PATHS = [
  "/admin/experience",
  "/admin/experience/new",
  "/admin/experience/ardea-health",
];

for (const path of PATHS) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}
