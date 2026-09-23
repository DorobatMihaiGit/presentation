import { expect, test } from "@playwright/test";

test("skip link is the first tab stop and moves focus to main", async ({
  page,
}) => {
  await page.goto("/en");

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/en#main");
  await expect(page.getByRole("main")).toBeFocused();
});

test("loads the latin-ext webfont subset for Romanian diacritics", async ({
  page,
}) => {
  await page.goto("/ro");

  const loadedRanges = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === "loaded")
      .map((face) => face.unicodeRange);
  });

  // Google's latin-ext subset starts at U+0100 and holds ș ț ă (U+0219, U+021B, U+0103).
  expect(loadedRanges.some((range) => range.includes("U+100-2BA"))).toBe(true);
});

test("has no horizontal overflow on a 320px phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/ro");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
