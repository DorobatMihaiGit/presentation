import { expect, test } from "@playwright/test";

test("the Motion switch is on by default and remembers being turned off", async ({
  page,
}) => {
  await page.goto("/en");
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });

  await expect(motion).toHaveAttribute("aria-pressed", "true");

  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
});

test("the Motion switch is translated", async ({ page }) => {
  await page.goto("/ro");

  await expect(
    page.getByRole("banner").getByRole("button", { name: "Animație" }),
  ).toBeVisible();
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("starts with motion off, and the visitor can turn it on", async ({
    page,
  }) => {
    await page.goto("/en");
    const motion = page
      .getByRole("banner")
      .getByRole("button", { name: "Motion" });

    await expect(motion).toHaveAttribute("aria-pressed", "false");
    await motion.click();
    await expect(motion).toHaveAttribute("aria-pressed", "true");
  });
});
