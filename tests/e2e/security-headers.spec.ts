import { expect, type Page, test } from "@playwright/test";
import { expectSecurityHeaders, watchCsp } from "./csp";

// Spec §7 (M8): hardening headers on every route, and a CSP that the live
// stage, the View Transitions and the forms run under without a violation.

for (const path of [
  "/en",
  "/ro",
  "/en/projects/ledger-lens",
  "/admin/login",
  "/sitemap.xml",
]) {
  test(`${path} sends the security headers`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(200);
    expectSecurityHeaders(response.headers());
  });
}

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= height; y += 600) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(50);
  }
}

for (const tier of [0, 1, 2]) {
  test(`a full scroll at tier ${tier} raises no CSP violation`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const check = await watchCsp(page);
    await page.goto(`/en?tier=${tier}`);
    if (tier > 0) {
      await expect(page.locator("html")).toHaveAttribute(
        "data-canvas",
        "live",
        { timeout: 60_000 },
      );
    }
    await scrollThrough(page);
    await check();
  });
}

test("a project page round trip raises no CSP violation", async ({ page }) => {
  const check = await watchCsp(page);
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("data-motion", /on|off/);
  await page.locator("#projects").scrollIntoViewIfNeeded();
  await page
    .locator("#projects")
    .getByRole("link", { name: "Ledger Lens", exact: true })
    .click();
  await expect(page).toHaveURL("/en/projects/ledger-lens");
  await page.getByRole("link", { name: "All work" }).click();
  await expect(page).toHaveURL("/en#projects");
  await check();
});

test.describe("the contact form", () => {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": "192.0.2.90" } });

  test("submits without a CSP violation", async ({ page }) => {
    const check = await watchCsp(page);
    await page.goto("/en");
    const form = page.getByRole("form", { name: "Send a message" });
    await form.getByRole("textbox", { name: "Name" }).fill("Csp Check");
    await form
      .getByRole("textbox", { name: "Email" })
      .fill(`csp-${Date.now()}@e2e.example.com`);
    await form.getByRole("textbox", { name: "Message" }).fill("Headers test.");
    await page.waitForTimeout(3_100);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByRole("status")).toContainText("Thanks!");
    await check();
  });
});

test("the sign-in pages raise no CSP violation", async ({ page }) => {
  const check = await watchCsp(page);
  await page.goto("/admin/login");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.goto("/admin/login/two-factor");
  await expect(page.getByLabel("Authenticator code")).toBeVisible();
  await check();
});
