import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";

const SEEDED_RO_HEADLINE =
  "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.";
const SEEDED_EN_HEADLINE =
  "Fullstack developer building fast, accessible web products from database to pixel.";

test.beforeEach(async ({ page }) => {
  await signInAsOwner(page);
});

test("a Romanian headline edited in the admin shows on /ro", async ({
  page,
}) => {
  const headline = page.getByLabel("Headline (RO)");
  await expect(headline).toHaveValue(SEEDED_RO_HEADLINE);

  await headline.fill("Construiesc produse web rapide, de la bază la pixel.");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await expect(headline).toHaveValue(
    "Construiesc produse web rapide, de la bază la pixel.",
  );

  await page.goto("/ro");
  await expect(
    page.getByText("Construiesc produse web rapide, de la bază la pixel."),
  ).toBeVisible();

  await page.goto("/admin/profile");
  await page.getByLabel("Headline (RO)").fill(SEEDED_RO_HEADLINE);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
});

test("a blank Romanian headline falls back to English on /ro", async ({
  page,
}) => {
  await page.getByLabel("Headline (RO)").fill("");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
  await expect(
    page.getByRole("group", { name: "Headline RO missing" }),
  ).toBeVisible();

  await page.goto("/ro");
  const fallback = page.getByText(SEEDED_EN_HEADLINE);
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("lang", "en");

  await page.goto("/admin/profile");
  await page.getByLabel("Headline (RO)").fill(SEEDED_RO_HEADLINE);
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toHaveText("Profile saved.");
});

test("shows field errors and keeps the typed values", async ({ page }) => {
  await page.getByLabel("GitHub URL").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Check the highlighted fields.",
  );
  await expect(page.getByText("Use an http(s) URL")).toBeVisible();
  await expect(page.getByLabel("GitHub URL")).toHaveValue(
    "javascript:alert(1)",
  );
});

test("the profile page has no axe violations", async ({ page }) => {
  const { violations } = await new AxeBuilder({ page }).analyze();

  expect(violations.map((v) => v.id)).toEqual([]);
});
