import { expect, type Page, test } from "@playwright/test";

type Lcp = { tag?: string; url: string; startTime: number };

/**
 * Every LCP candidate so far, once the hero poster has loaded and painted.
 * Reading the entries any sooner can catch an early candidate (the heading)
 * before the poster's entry exists, which made these tests flaky under load.
 */
async function lcpCandidates(page: Page): Promise<Lcp[]> {
  await page
    .locator('[data-stage="hero"] img')
    .evaluate((img: HTMLImageElement) => img.decode().catch(() => {}));
  return page.evaluate(
    () =>
      new Promise<Lcp[]>((resolve) => {
        // Two frames: the poster's paint (and its LCP entry) has happened.
        // LCP entries are only delivered to a buffered observer.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const observer = new PerformanceObserver((list) => {
              observer.disconnect();
              resolve(
                list.getEntries().map((entry) => {
                  const lcp = entry as PerformanceEntry & {
                    element?: Element;
                    url: string;
                  };
                  return {
                    tag: lcp.element?.tagName,
                    url: new URL(lcp.url || location.href).pathname,
                    startTime: lcp.startTime,
                  };
                }),
              );
            });
            observer.observe({
              type: "largest-contentful-paint",
              buffered: true,
            });
          }),
        );
      }),
  );
}

/** The largest contentful paint: the last candidate. */
async function largestContentfulPaint(page: Page): Promise<Lcp> {
  const candidates = await lcpCandidates(page);
  return candidates.at(-1) ?? { url: "", startTime: 0 };
}

test("the hero poster is the LCP element (desktop)", async ({ page }) => {
  await page.goto("/en");

  const lcp = await largestContentfulPaint(page);
  expect(lcp.tag).toBe("IMG");
  expect(lcp.url).toMatch(
    /^\/posters\/hero-start-landscape-\d+\.[0-9a-f]{8}\.avif$/,
  );
});

test("a phone gets the portrait poster", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  const lcp = await largestContentfulPaint(page);
  expect(lcp.tag).toBe("IMG");
  expect(lcp.url).toMatch(
    /^\/posters\/hero-start-portrait-828\.[0-9a-f]{8}\.avif$/,
  );
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("shows the finished monolith instead of the first frame", async ({
    page,
  }) => {
    await page.goto("/en");

    const lcp = await largestContentfulPaint(page);
    expect(lcp.url).toMatch(/^\/posters\/hero-end-landscape-\d+\./);
  });
});

test.describe("with the stage off", () => {
  test.use({ reducedMotion: "reduce" });

  test("every scene section shows its own poster", async ({ page }) => {
    await page.goto("/en");
    await expect(page.locator("html")).toHaveAttribute("data-canvas", "poster");

    for (const name of ["about", "skills", "experience", "contact"]) {
      const poster = page.locator(`#${name} > [data-poster="${name}"]`);
      await poster.scrollIntoViewIfNeeded();
      await expect(poster).toHaveAttribute("aria-hidden", "true");
      await expect
        .poll(() =>
          poster
            .locator("img")
            .evaluate(
              (img: HTMLImageElement) => img.complete && img.currentSrc,
            ),
        )
        .toMatch(
          new RegExp(`/posters/${name}-landscape-\\d+\\.[0-9a-f]{8}\\.avif$`),
        );
    }
  });
});

test("live visitors never download the section posters", async ({ page }) => {
  test.setTimeout(120_000);
  const posters: string[] = [];
  page.on("request", (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith("/posters/")) posters.push(pathname);
  });
  await page.goto("/en?tier=1");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });
  for (const id of ["about", "skills", "experience", "contact"]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(500);

  expect(posters.every((path) => path.startsWith("/posters/hero-"))).toBe(true);
});

test("posters are cached as immutable", async ({ page, request }) => {
  await page.goto("/en");
  const src = await page
    .locator('[data-stage="hero"] img')
    .evaluate((img: HTMLImageElement) => new URL(img.currentSrc).pathname);

  const response = await request.get(src);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe(
    "public, max-age=31536000, immutable",
  );
});

test("the 3D chunk is requested only after the LCP", async ({ page }) => {
  await page.goto("/en?tier=2");
  await expect(page.locator("html")).toHaveAttribute("data-canvas", "live", {
    timeout: 60_000,
  });

  // The poster's own LCP entry: later candidates (if any) do not move it.
  const lcp = (await lcpCandidates(page)).find((entry) =>
    entry.url.startsWith("/posters/hero-"),
  );
  expect(lcp, "the poster was an LCP candidate").toBeDefined();
  const html = await (await page.request.get("/en")).text();
  const initial = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map(
    (match) => match[1],
  );
  const lazy = await page.evaluate(
    (initial) =>
      performance
        .getEntriesByType("resource")
        .filter(
          (entry) =>
            entry.name.endsWith(".js") &&
            !initial.includes(new URL(entry.name).pathname),
        )
        .map((entry) => entry.startTime),
    initial,
  );

  expect(lazy.length).toBeGreaterThan(0);
  for (const start of lazy) {
    expect(start).toBeGreaterThan(lcp?.startTime ?? Number.POSITIVE_INFINITY);
  }
});
