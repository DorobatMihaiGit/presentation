import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a new skill appears in its stack layer on the public page", async ({
  page,
}) => {
  await page.goto("/admin/skills/new");
  await page.getByLabel("Slug").fill("rust");
  await page.getByLabel("Name").fill("Rust");
  await page.getByLabel("Stack layer").selectOption("api");
  await page.getByRole("button", { name: "Add skill" }).click();
  await expect(page).toHaveURL("/admin/skills");

  await page.goto("/en");
  await expect(page.locator('#skills [data-layer="api"]')).toContainText(
    "Rust",
  );

  await page.goto("/admin/skills/rust");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/skills");
});

const PATHS = ["/admin/skills", "/admin/skills/new", "/admin/skills/postgres"];

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
