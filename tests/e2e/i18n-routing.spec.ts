import { expect, test } from "@playwright/test";

test.describe("locale routing", () => {
  test("redirects / to /en for an English browser", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/en");
  });

  test("serves /en with lang=en and English copy", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(
      page.getByRole("heading", { level: 1, name: "Alex Marin" }),
    ).toBeVisible();
    await expect(page).toHaveTitle("Fullstack Developer — CV");
  });

  test("serves /ro with lang=ro and Romanian diacritics intact", async ({
    page,
  }) => {
    const response = await page.goto("/ro");

    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(
      page.getByText(
        "Dezvoltator fullstack care construiește produse web rapide și accesibile, de la baza de date la pixel.",
      ),
    ).toBeVisible();
  });

  test("returns 404 for an unsupported locale", async ({ page }) => {
    const response = await page.goto("/de");

    expect(response?.status()).toBe(404);
  });

  test("returns a localized 404 below a valid locale", async ({ page }) => {
    const response = await page.goto("/ro/nu-exista");

    expect(response?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", "ro");
    await expect(
      page.getByRole("heading", { name: "Pagina nu a fost găsită" }),
    ).toBeVisible();
  });

  test("returns 404 for a file path the proxy skips", async ({ page }) => {
    const response = await page.goto("/missing.txt");

    expect(response?.status()).toBe(404);
  });
});

test.describe("locale detection", () => {
  test.use({ locale: "ro-RO" });

  test("redirects / to /ro for a Romanian browser", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL("/ro");
  });
});
