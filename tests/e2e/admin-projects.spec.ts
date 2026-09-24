import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a project is created with a markdown preview and published", async ({
  page,
}) => {
  await page.goto("/admin/projects/new");
  await page.getByLabel("Slug").fill("orbit");
  await page.getByLabel("Year").fill("2026");
  await page.getByLabel("Title (EN)").fill("Orbit");
  await page.getByLabel("Summary (EN)").fill("Satellite pass planner.");
  await page.getByLabel("Role (EN)").fill("Lead developer");
  await page
    .getByLabel("Outcome (EN)")
    .fill("Planning went from hours to minutes.");
  await page
    .getByLabel("Case study (EN)")
    .fill("## Why\n\nPlain **bold**\n\n<script>alert(1)</script>");
  await page.getByRole("button", { name: "Preview Case study (EN)" }).click();
  await expect(page.getByRole("heading", { name: "Why" })).toBeVisible();
  await expect(page.locator("strong", { hasText: "bold" })).toBeVisible();
  await expect(page.locator("form script")).toHaveCount(0);
  await page.getByLabel("PostgreSQL").check();
  await page.getByLabel("Published").check();
  await page.getByRole("button", { name: "Add project" }).click();
  await expect(page).toHaveURL("/admin/projects/orbit");

  await page.goto("/en");
  await expect(page.locator("#projects")).toContainText("Orbit");

  await page.goto("/admin/projects/orbit");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/projects");
});

const PATHS = [
  "/admin/projects",
  "/admin/projects/new",
  "/admin/projects/ledger-lens",
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
