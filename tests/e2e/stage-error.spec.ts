import { expect, test } from "@playwright/test";

// A stage that throws while mounting (here: WebGL refuses to start once the
// tier is chosen) falls back to the posters; the page keeps working.

test("a stage that throws falls back to the posters", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.startsWith("webgl")) {
        throw new Error("e2e: WebGL is broken");
      }
      return (getContext as (...args: unknown[]) => unknown).call(
        this,
        type,
        ...rest,
      );
    } as typeof getContext;
  });

  // ?tier=1 skips the GPU probe, so the throw happens inside the stage.
  await page.goto("/en?tier=1");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-canvas", "poster", {
    timeout: 30_000,
  });
  await expect(page.locator(".stage-layer")).toHaveCount(0);
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS("opacity", "1");
  await expect(page.locator(".hero-poster img")).toBeVisible();

  await page.locator("#contact").scrollIntoViewIfNeeded();
  await expect(page.locator("#contact")).toBeInViewport();
  await expect(
    page.getByRole("form", { name: "Send a message" }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);
});
