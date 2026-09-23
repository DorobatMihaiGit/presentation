import { expect, test } from "@playwright/test";

test("renders the hero and five sections in order (en)", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Alex Marin",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "About",
    "The stack",
    "Experience",
    "Selected work",
    "Let's build",
  ]);
});

test("renders the hero and five sections in order (ro)", async ({ page }) => {
  await page.goto("/ro");

  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Despre",
    "Stiva",
    "Experiență",
    "Proiecte alese",
    "Hai să construim",
  ]);
});

test("hero calls to action lead to the contact and work sections", async ({
  page,
}) => {
  await page.goto("/en");
  const hero = page.getByRole("region", { name: "Alex Marin" });

  await expect(hero.getByRole("link", { name: "Contact" })).toHaveAttribute(
    "href",
    "#contact",
  );
  await expect(hero.getByRole("link", { name: "Work" })).toHaveAttribute(
    "href",
    "#projects",
  );
  await expect(page.locator("#contact")).toHaveCount(1);
  await expect(page.locator("#projects")).toHaveCount(1);
});

test("lists published projects only, with descriptive link names", async ({
  page,
}) => {
  await page.goto("/en");
  const work = page.getByRole("region", { name: "Selected work" });

  await expect(work.getByRole("heading", { level: 3 })).toHaveText([
    "Ledger Lens",
    "Tramline",
    "Atelier CMS",
    "Pulse Check",
  ]);
  await expect(
    work.getByRole("link", { name: "Live site: Ledger Lens" }),
  ).toHaveAttribute("href", "https://example.com/ledger-lens");
});

test("contact form is labelled and cannot submit before M3", async ({
  page,
}) => {
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });

  await expect(form.getByLabel("Name")).toHaveAttribute("autocomplete", "name");
  await expect(form.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(form.getByLabel("Company (optional)")).toBeVisible();
  await expect(form.getByLabel("Message")).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Send message" }),
  ).toBeDisabled();

  await form.getByLabel("Name").fill("Ana Pop");
  await form.getByLabel("Name").press("Enter");
  await expect(page).toHaveURL("/en");
});

test("plays the studio light sweep once", async ({ page }) => {
  await page.goto("/en");

  const stage = page.locator('[data-stage="hero"]');
  await expect(stage).toBeVisible();
  const sweep = await stage.evaluate(
    (el) => getComputedStyle(el, "::after").animationName,
  );
  expect(sweep).toBe("studio-sweep");
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("skips the light sweep", async ({ page }) => {
    await page.goto("/en");

    const stage = page.locator('[data-stage="hero"]');
    await expect(stage).toBeVisible();
    const sweep = await stage.evaluate(
      (el) => getComputedStyle(el, "::after").animationName,
    );
    expect(sweep).toBe("none");
  });
});
