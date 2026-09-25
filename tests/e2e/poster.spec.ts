import { expect, type Page, test } from "@playwright/test";

type Lcp = { tag?: string; url: string; startTime: number };

function largestContentfulPaint(page: Page): Promise<Lcp> {
  return page.evaluate(
    () =>
      new Promise<Lcp>((resolve) => {
        new PerformanceObserver((list) => {
          const entry = list.getEntries().at(-1) as PerformanceEntry & {
            element?: Element;
            url: string;
          };
          resolve({
            tag: entry.element?.tagName,
            url: new URL(entry.url || location.href).pathname,
            startTime: entry.startTime,
          });
        }).observe({ type: "largest-contentful-paint", buffered: true });
      }),
  );
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

  const lcp = await largestContentfulPaint(page);
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
    expect(start).toBeGreaterThan(lcp.startTime);
  }
});
