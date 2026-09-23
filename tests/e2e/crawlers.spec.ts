import { expect, test } from "@playwright/test";

const ORIGIN = "http://localhost:3100";

test("sitemap lists both locales with hreflang alternates", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/xml");
  expect(body).toContain(`<loc>${ORIGIN}/en</loc>`);
  expect(body).toContain(`<loc>${ORIGIN}/ro</loc>`);
  expect(body).toContain(
    `<xhtml:link rel="alternate" hreflang="ro" href="${ORIGIN}/ro" />`,
  );
  expect(body).toContain(
    `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}" />`,
  );
});

test("robots.txt allows crawling and points at the sitemap", async ({
  request,
}) => {
  const response = await request.get("/robots.txt");
  const body = await response.text();

  expect(response.status()).toBe(200);
  expect(body).toContain("Allow: /");
  expect(body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
});

test("pages do not repeat hreflang in a Link header", async ({ request }) => {
  const response = await request.get("/en");

  expect(response.status()).toBe(200);
  expect(response.headers().link ?? "").not.toContain("hreflang");
});
