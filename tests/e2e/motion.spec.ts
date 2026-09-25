import { expect, test } from "@playwright/test";

test("the Motion switch is on by default and remembers being turned off", async ({
  page,
}) => {
  await page.goto("/en");
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });

  await expect(motion).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");

  await motion.click();
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");

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

  test("starts with motion off: poster only, hero not pinned", async ({
    page,
  }) => {
    await page.goto("/en");
    const html = page.locator("html");

    await expect(html).toHaveAttribute("data-motion", "off");
    await expect(html).toHaveAttribute("data-canvas", "poster");
    await expect(
      page.getByRole("banner").getByRole("button", { name: "Motion" }),
    ).toHaveAttribute("aria-pressed", "false");
    const { hero, viewport } = await page.evaluate(() => ({
      hero: document.querySelector(".hero")?.getBoundingClientRect().height,
      viewport: window.innerHeight,
    }));
    expect(hero).toBeLessThan(1.5 * viewport);
  });

  test("the visitor can still turn motion on", async ({ page }) => {
    await page.goto("/en?tier=1");
    const motion = page
      .getByRole("banner")
      .getByRole("button", { name: "Motion" });
    await motion.click();

    await expect(motion).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
      timeout: 60_000,
    });
  });
});
