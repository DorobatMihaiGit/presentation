import { expect, type Page, test } from "@playwright/test";

// Headless Chromium renders WebGL with SwiftShader, which the tier classifier
// sends to posters, so these tests force a live tier with ?tier=.

/** Script URLs in the server HTML: everything else was loaded later. */
async function initialScripts(page: Page, path: string): Promise<Set<string>> {
  const html = await (await page.request.get(path)).text();
  return new Set(
    [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((match) => match[1]),
  );
}

function recordScripts(page: Page): string[] {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") {
      urls.push(new URL(request.url()).pathname);
    }
  });
  return urls;
}

test("tier 2 puts one hidden canvas behind a pinned hero", async ({ page }) => {
  await page.goto("/en?tier=2");
  const html = page.locator("html");

  await expect(html).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  await expect(html).toHaveAttribute("data-tier", "2");
  const layer = page.locator(".stage-layer");
  await expect(layer).toHaveAttribute("aria-hidden", "true");
  await expect(layer.locator("canvas")).toHaveCount(1);
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS("opacity", "0");

  const { hero, viewport } = await page.evaluate(() => ({
    hero: document.querySelector(".hero")?.getBoundingClientRect().height ?? 0,
    viewport: window.innerHeight,
  }));
  expect(Math.round(hero / viewport)).toBe(3);
});

test("the stage fades out once the hero has scrolled away", async ({
  page,
}) => {
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  await page.locator("#about").scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const about = document.querySelector("#about");
    window.scrollTo(
      0,
      window.scrollY + (about?.getBoundingClientRect().top ?? 0),
    );
  });

  const layer = page.locator(".stage-layer");
  await expect(layer).toHaveCSS("visibility", "hidden");
  await expect(layer).toHaveCSS("opacity", "0");
});

test("a lost WebGL context falls back to the poster", async ({ page }) => {
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  await page.evaluate(() => {
    const canvas = document.querySelector(".stage-layer canvas");
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  });

  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");
  await expect(page.locator(".stage-layer")).toHaveCount(0);
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS("opacity", "1");
});

test("a context lost by an old canvas leaves the new stage alone", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/en?tier=1");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  const old = await page.locator(".stage-layer canvas").elementHandle();
  const motion = page
    .getByRole("banner")
    .getByRole("button", { name: "Motion" });

  await motion.click();
  await expect(html).toHaveAttribute("data-canvas", "poster");
  await motion.click();
  await expect(html).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  // R3F forces a context loss on an unmounted canvas a little later; if the
  // new stage is up by then, it must not go back to the posters.
  await old?.evaluate((canvas) =>
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );

  await page.waitForTimeout(500);
  await expect(html).toHaveAttribute("data-canvas", "live");
  await expect(page.locator(".stage-layer canvas")).toHaveCount(1);
});

test("a software renderer gets posters and never downloads the 3D chunk", async ({
  page,
}) => {
  const initial = await initialScripts(page, "/en");
  const loaded = recordScripts(page);
  await page.goto("/en");

  await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");
  await page.waitForTimeout(1000);
  expect(loaded.filter((url) => !initial.has(url))).toEqual([]);
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("never downloads the 3D chunk", async ({ page }) => {
    const initial = await initialScripts(page, "/en");
    const loaded = recordScripts(page);
    await page.goto("/en?tier=3");

    await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");
    await page.waitForTimeout(1000);
    expect(loaded.filter((url) => !initial.has(url))).toEqual([]);
  });
});
