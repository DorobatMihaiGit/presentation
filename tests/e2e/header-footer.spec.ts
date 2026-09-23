import { expect, test } from "@playwright/test";

test("exposes banner, footer and both navigations", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Sections" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Language" }),
  ).toBeVisible();
});

test("every section link points at a section on the page", async ({ page }) => {
  await page.goto("/en");

  const hrefs = await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual([
    "#about",
    "#skills",
    "#experience",
    "#projects",
    "#contact",
  ]);
  for (const href of hrefs) {
    await expect(page.locator(`section${href}`)).toHaveCount(1);
  }
});

test("switching language keeps the choice for the next visit to /", async ({
  page,
}) => {
  await page.goto("/en");

  const romanian = page
    .getByRole("navigation", { name: "Language" })
    .getByRole("link", { name: "Română" });
  await expect(romanian).toBeVisible();
  await romanian.click();
  await expect(page).toHaveURL("/ro");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(
    page
      .getByRole("navigation", { name: "Limbă" })
      .getByRole("link", { name: "Română" }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/");
  await expect(page).toHaveURL("/ro");
});

test("footer links back to the top of the page", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("contentinfo").getByRole("link", { name: "Înapoi sus" }),
  ).toHaveAttribute("href", "#top");
  await expect(page.getByRole("banner")).toHaveAttribute("id", "top");
});
