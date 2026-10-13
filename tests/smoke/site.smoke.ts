import { type APIRequestContext, expect, test } from "@playwright/test";
import { expectSecurityHeaders, watchCsp } from "../e2e/csp";

// Read-only production smoke suite (playwright.smoke.config.ts).

const ORIGIN = new URL(process.env.SMOKE_URL ?? "http://localhost").origin;
const HTTPS = ORIGIN.startsWith("https://");

async function firstProjectPath(request: APIRequestContext) {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const url = sitemap.match(/<loc>([^<]+\/en\/projects\/[^<]+)<\/loc>/)?.[1];
  expect(url, "a project page in the sitemap").toBeTruthy();
  return new URL(url ?? "").pathname;
}

test("the root redirects to a locale", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toMatch(/^\/(en|ro)$/);
});

for (const locale of ["en", "ro"] as const) {
  test(`/${locale} renders with its metadata`, async ({ page, request }) => {
    const response = await page.goto(`/${locale}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page).toHaveTitle(/\S/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      `${ORIGIN}/${locale}`,
    );
    for (const lang of ["en", "ro", "x-default"]) {
      await expect(
        page.locator(`link[rel="alternate"][hreflang="${lang}"]`),
      ).toHaveCount(1);
    }
    const jsonLd = JSON.parse(
      (await page
        .locator('script[type="application/ld+json"]')
        .first()
        .textContent()) ?? "{}",
    );
    expect(jsonLd["@type"]).toBe("Person");
    const og = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    const image = await request.get(og ?? "");
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  });
}

test("the first project page renders", async ({ page }) => {
  const path = await firstProjectPath(page.request);
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}${path}`,
  );
});

test("robots.txt and sitemap.xml point at this origin", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain("<urlset");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(locs.length).toBeGreaterThan(1);
  for (const loc of locs) {
    expect(new URL(loc).origin).toBe(ORIGIN);
  }
});

for (const path of ["/en", "/admin/login"]) {
  test(`${path} sends every security header`, async ({ request }) => {
    test.skip(
      !HTTPS,
      "HSTS and upgrade-insecure-requests are only checked on https://",
    );
    const response = await request.get(path, { maxRedirects: 0 });
    expectSecurityHeaders(response.headers());
  });

  test(`${path} sends the CSP and the framing headers`, async ({ request }) => {
    const headers = (await request.get(path, { maxRedirects: 0 })).headers();
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
  });
}

test("posters and static chunks are immutable", async ({ page, request }) => {
  await page.goto("/en");
  const poster = await page
    .locator('[data-stage="hero"] img')
    .evaluate((img: HTMLImageElement) => new URL(img.currentSrc).pathname);
  const chunk = await page
    .locator('script[src*="/_next/static/"]')
    .first()
    .getAttribute("src");
  for (const path of [poster, chunk ?? ""]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["cache-control"], path).toBe(
      "public, max-age=31536000, immutable",
    );
  }
});

test("/admin sends a logged-out visitor to the sign-in page", async ({
  request,
}) => {
  const response = await request.get("/admin", { maxRedirects: 0 });
  expect([307, 308]).toContain(response.status());
  expect(response.headers().location).toMatch(/\/admin\/login$/);
});

test("the auth API refuses a request without a session", async ({
  request,
}) => {
  const response = await request.get("/api/auth/list-sessions");
  expect(response.status()).toBe(401);
});

test("an unknown project is a 404", async ({ request }) => {
  const response = await request.get("/en/projects/no-such-project-smoke");
  expect(response.status()).toBe(404);
});

test("the contact form renders (it is not sent)", async ({ page }) => {
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });
  await expect(form).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Send message" }),
  ).toBeVisible();
});

test("no console error or CSP violation on /en and a project page", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const check = await watchCsp(page);
  await page.goto("/en");
  await page.waitForLoadState("networkidle");
  await page.goto(await firstProjectPath(page.request));
  await page.waitForLoadState("networkidle");
  await check();
  expect(errors).toEqual([]);
});
