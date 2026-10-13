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
  // The poster fades out over the first live frames: SwiftShader can take a
  // while to draw them under load, so wait for the state, not 5 s.
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS("opacity", "0", {
    timeout: 30_000,
  });

  const { hero, viewport } = await page.evaluate(() => ({
    hero: document.querySelector(".hero")?.getBoundingClientRect().height ?? 0,
    viewport: window.innerHeight,
  }));
  expect(Math.round(hero / viewport)).toBe(3);
});

/** Scrolls so that the top of `selector` sits `offset` viewports below the top. */
async function scrollToSection(page: Page, selector: string, offset = 0) {
  await page.evaluate(
    ({ selector, offset }) => {
      const top = document.querySelector(selector)?.getBoundingClientRect().top;
      window.scrollTo(0, window.scrollY + (top ?? 0) + offset * innerHeight);
    },
    { selector, offset },
  );
}

test("the stage stays for About and steps back behind Projects", async ({
  page,
}) => {
  // SwiftShader frames are slow and the springs take a few seconds to settle.
  test.setTimeout(120_000);
  const settle = { timeout: 30_000 };
  await page.goto("/en?tier=1");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  const layer = page.locator(".stage-layer");

  await scrollToSection(page, "#about");
  await expect(layer).toHaveAttribute("data-journey", /^1\./, settle);
  await expect(layer).toHaveCSS("visibility", "visible");
  await expect(layer).toHaveCSS("opacity", "1");

  await scrollToSection(page, "#projects", 0.2);
  await expect(layer).toHaveCSS("visibility", "hidden", settle);
  await expect(layer).toHaveCSS("opacity", "0");

  await scrollToSection(page, "#contact");
  await expect(layer).toHaveAttribute("data-journey", /^5\./, settle);
  await expect(layer).toHaveCSS("visibility", "visible");
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

  const settle = { timeout: 30_000 };
  await expect(page.locator("html")).toHaveAttribute(
    "data-canvas",
    "poster",
    settle,
  );
  await expect(page.locator(".stage-layer")).toHaveCount(0, settle);
  await expect(page.locator('[data-stage="hero"]')).toHaveCSS(
    "opacity",
    "1",
    settle,
  );
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

test("with the live stage, section links glide there (Lenis)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/en?tier=1");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  await page.evaluate(() => {
    const seen: number[] = [];
    (window as unknown as { __scrolls: number[] }).__scrolls = seen;
    addEventListener("scroll", () => seen.push(Math.round(window.scrollY)));
  });

  await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link", { name: "Experience" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.getElementById("experience")?.getBoundingClientRect().top,
      ),
    )
    .toBeLessThan(2);
  const { scrolls, end } = await page.evaluate(() => ({
    scrolls: (window as unknown as { __scrolls: number[] }).__scrolls,
    end: Math.round(window.scrollY),
  }));
  // A jump lands in one step; a glide passes through the page on its way
  // (SwiftShader draws few frames, so only "some" positions in between).
  expect(scrolls.filter((y) => y > 50 && y < end - 50).length).toBeGreaterThan(
    0,
  );
});

test.describe("after a project page", () => {
  // Next keeps a page it leaves in a hidden <Activity>: its effects are
  // cleaned up (R3F loses the WebGL context) and come back when it is shown.
  test.setTimeout(120_000);

  test("the stage lets go of the GPU and comes back live", async ({ page }) => {
    // Every journey time the stage shows, from any stage instance.
    await page.addInitScript(() => {
      const shown: number[] = [];
      (window as unknown as { __journeys: number[] }).__journeys = shown;
      new MutationObserver((records) => {
        for (const record of records) {
          shown.push(Number((record.target as HTMLElement).dataset.journey));
        }
        // Init scripts run before <html> exists: watch the document.
      }).observe(document, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-journey"],
      });
    });
    await page.goto("/en?tier=1");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-canvas", "live", {
      timeout: 60_000,
    });

    await page.locator("#projects").scrollIntoViewIfNeeded();
    await page
      .locator("#projects")
      .getByRole("link", { name: "Tramline", exact: true })
      .click();
    await expect(page).toHaveURL("/en/projects/tramline");
    // Nothing 3D while reading a project, not even hidden.
    await expect(page.locator(".stage-layer")).toHaveCount(0);
    await expect(html).not.toHaveAttribute("data-canvas", "live");

    await page.evaluate(() => {
      (window as unknown as { __journeys: number[] }).__journeys.length = 0;
    });
    await page.goBack();
    await expect(page).toHaveURL("/en?tier=1");
    // The stage steps back behind Projects, so its first frame is drawn
    // (and data-canvas turns "live") once Contact brings it back.
    await expect(page.locator(".stage-layer canvas")).toHaveCount(1, {
      timeout: 60_000,
    });
    await page.locator("#contact").scrollIntoViewIfNeeded();
    await expect(html).toHaveAttribute("data-canvas", "live", {
      timeout: 60_000,
    });
    const canvases = page.locator(".stage-layer canvas");
    await expect(canvases).toHaveCount(1);
    expect(
      await canvases.evaluate(
        (canvas: HTMLCanvasElement) =>
          canvas.getContext("webgl2")?.isContextLost() ?? true,
      ),
    ).toBe(false);
    // The new stage starts at the Projects stop (T 4..5) and goes on to
    // Contact; it never flies there from the hero behind the grid.
    const shown = await page.evaluate(
      () => (window as unknown as { __journeys: number[] }).__journeys,
    );
    expect(shown.length).toBeGreaterThan(0);
    expect(Math.min(...shown)).toBeGreaterThanOrEqual(4);
  });

  test("the canvas fades in when it goes live", async ({ page }) => {
    await page.goto("/en?tier=1");
    const canvas = page.locator(".stage-layer canvas");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
      timeout: 60_000,
    });

    await expect(canvas).toHaveCSS("opacity", "1");
    await expect(canvas).toHaveCSS("transition-property", "opacity");
    await expect(canvas).toHaveCSS("transition-duration", "0.6s");
  });
});
