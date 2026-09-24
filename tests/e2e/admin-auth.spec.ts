import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./admin-credentials";
import { signInAsOwner } from "./admin-login";

test("redirects /admin to the login page when logged out", async ({
  page,
  request,
}) => {
  const response = await request.get("/admin/profile", { maxRedirects: 0 });

  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("/admin/login");

  await page.goto("/admin");
  await expect(page).toHaveURL("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Sign in to the admin" }),
  ).toBeVisible();
});

test("a forged session cookie passes the proxy but not the layout", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: "forged.signature",
      url: baseURL,
    },
  ]);

  await page.goto("/admin/profile");

  await expect(page).toHaveURL("/admin/login");
  await expect(page.getByRole("heading", { name: "Profile" })).toHaveCount(0);
});

test("rejects a wrong password without saying which field was wrong", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Wrong email or password.",
  );
  await expect(page).toHaveURL("/admin/login");
});

test("signs in, reaches the panel and signs out", async ({ page }) => {
  await signInAsOwner(page);
  await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/admin/login");

  await page.goto("/admin/profile");
  await expect(page).toHaveURL("/admin/login");
});

test("keeps admin pages out of search engines", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});
