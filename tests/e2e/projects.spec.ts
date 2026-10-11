import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const ORIGIN = "http://localhost:3100";

test("a project has a page of its own in each language", async ({ page }) => {
  const response = await page.goto("/en/projects/ledger-lens");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Ledger Lens · Alex Marin");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Ledger Lens",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /^Reconciliation dashboard/,
  );
  const project = page.getByRole("article");
  await expect(
    project.getByText("Month-end close went from three days to one."),
  ).toBeVisible();
  await expect(
    project.getByRole("listitem").filter({ hasText: "PostgreSQL" }),
  ).toBeVisible();
  await expect(
    project.getByRole("link", { name: "Live site: Ledger Lens" }),
  ).toHaveAttribute("href", "https://example.com/ledger-lens");

  await page.goto("/ro/projects/ledger-lens");
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
  await expect(
    page.getByText("Închiderea de lună a scăzut de la trei zile la una."),
  ).toBeVisible();
});

test("declares canonical, hreflang and a CreativeWork", async ({ page }) => {
  await page.goto("/ro/projects/tramline");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${ORIGIN}/ro/projects/tramline`,
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
    ["en", `${ORIGIN}/en/projects/tramline`],
    ["ro", `${ORIGIN}/ro/projects/tramline`],
    ["x-default", `${ORIGIN}/projects/tramline`],
  ]);
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    "content",
    "article",
  );
  const json = await page
    .locator('script[type="application/ld+json"]')
    .textContent();
  expect(JSON.parse(json ?? "{}")).toMatchObject({
    "@type": "CreativeWork",
    name: "Tramline",
    url: `${ORIGIN}/ro/projects/tramline`,
    author: { "@id": `${ORIGIN}/#person` },
  });
});

test("drafts and unknown slugs are not found", async ({ page }) => {
  for (const path of [
    "/en/projects/draft-project",
    "/en/projects/no-such-project",
    "/ro/projects/_",
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("walks the projects in grid order and back to the grid", async ({
  page,
}) => {
  await page.goto("/en/projects/tramline");
  const more = page.getByRole("navigation", { name: "More work" });

  await expect(
    more.getByRole("link", { name: /Previous.*Ledger Lens/ }),
  ).toHaveAttribute("href", "/en/projects/ledger-lens");
  await expect(
    more.getByRole("link", { name: /Next.*Atelier CMS/ }),
  ).toHaveAttribute("href", "/en/projects/atelier-cms");
  await expect(page.getByRole("link", { name: "All work" })).toHaveAttribute(
    "href",
    "/en#projects",
  );

  await page.goto("/en/projects/ledger-lens");
  await expect(more.getByRole("link", { name: /Previous/ })).toHaveCount(0);
});

test("the header leads back to the home page sections and keeps the project across languages", async ({
  page,
}) => {
  await page.goto("/en/projects/atelier-cms");

  const hrefs = await page
    .getByRole("navigation", { name: "Sections" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  expect(hrefs).toEqual([
    "/en#about",
    "/en#skills",
    "/en#experience",
    "/en#projects",
    "/en#contact",
  ]);

  await page
    .getByRole("navigation", { name: "Language" })
    .getByRole("link", { name: "Română" })
    .click();
  await expect(page).toHaveURL("/ro/projects/atelier-cms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atelier CMS",
  );
});

test("the sitemap lists every project in both languages", async ({
  request,
}) => {
  const body = await (await request.get("/sitemap.xml")).text();

  for (const slug of [
    "ledger-lens",
    "tramline",
    "atelier-cms",
    "pulse-check",
  ]) {
    expect(body).toContain(`<loc>${ORIGIN}/en/projects/${slug}</loc>`);
    expect(body).toContain(`<loc>${ORIGIN}/ro/projects/${slug}</loc>`);
  }
  expect(body).not.toContain("draft-project");
});

for (const viewport of [
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
] as const) {
  test(`a project page has no axe violations (${viewport.name})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/ro/projects/ledger-lens");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ledger Lens",
    );

    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(
      violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });
}

test("a project page never scrolls sideways on a 320px phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/ro/projects/atelier-cms");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Atelier CMS",
  );

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
