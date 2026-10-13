import { expect, test } from "@playwright/test";

const ORIGIN = "http://localhost:3100";

test("declares canonical and hreflang alternates for /ro", async ({ page }) => {
  await page.goto("/ro");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}/ro`,
  );
  const alternates = await page
    .locator('link[rel="alternate"][hreflang]')
    .evaluateAll((links) =>
      links.map((link) => [
        link.getAttribute("hreflang"),
        link.getAttribute("href"),
      ]),
    );
  expect(alternates).toEqual([
    ["en", `${ORIGIN}/en`],
    ["ro", `${ORIGIN}/ro`],
    ["x-default", ORIGIN],
  ]);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "ro_RO",
  );
});

test("uses the localized SEO description", async ({ page }) => {
  await page.goto("/ro");

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^CV-ul și portofoliul lui Alex Marin/,
  );
});

test("embeds a Person JSON-LD matching the visible name", async ({ page }) => {
  await page.goto("/en");

  const script = page.locator('script[type="application/ld+json"]');
  await expect(script).toHaveCount(1);
  const json = await script.textContent();
  const person = JSON.parse(json ?? "{}");

  expect(person).toMatchObject({
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${ORIGIN}/#person`,
    url: `${ORIGIN}/en`,
    jobTitle: "Senior Fullstack Engineer",
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(person.name);
});

// M8: an Open Graph card per page, 1200x630 PNG, also used for X.
for (const path of ["/en", "/ro", "/en/projects/ledger-lens"]) {
  test(`${path} has an Open Graph image`, async ({ page, request }) => {
    await page.goto(path);
    const meta = (selector: string) =>
      page.locator(selector).first().getAttribute("content");

    const image = await meta('meta[property="og:image"]');
    expect(image).toMatch(/^http:\/\/localhost:3100\/.+opengraph-image/);
    expect(await meta('meta[property="og:image:width"]')).toBe("1200");
    expect(await meta('meta[property="og:image:height"]')).toBe("630");
    expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(await meta('meta[name="twitter:image"]')).toMatch(/twitter-image/);

    const response = await request.get(image ?? "");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const png = await response.body();
    // PNG signature, then the IHDR chunk: width and height, big-endian.
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });
}
