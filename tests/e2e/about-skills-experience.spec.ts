import { expect, test } from "@playwright/test";

test("pluralises years of experience in Romanian", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("region", { name: "Despre" }).getByText("9 ani"),
  ).toBeVisible();
});

test("shows the five stack layers top to bottom", async ({ page }) => {
  await page.goto("/en");

  const layers = page.locator("#skills ol > li");
  await expect(layers).toHaveCount(5);
  expect(
    await layers.evaluateAll((items) =>
      items.map((item) => item.getAttribute("data-layer")),
    ),
  ).toEqual(["interface", "api", "data", "infra", "craft"]);
  await expect(layers.first().getByRole("heading")).toHaveText("Interface");
});

test("formats experience dates per locale", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page
      .getByRole("region", { name: "Experiență" })
      .getByText("apr. 2022 - Prezent"),
  ).toBeVisible();
});

test("marks English fallback text with lang=en on /ro", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByText(
      "Built marketing sites and small web apps for agency clients on tight launch dates.",
    ),
  ).toHaveAttribute("lang", "en");
});
