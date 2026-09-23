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
