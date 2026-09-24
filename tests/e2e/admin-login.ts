import { expect, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./admin-credentials";

/** Signs in through the real login form and waits for the admin panel. */
export async function signInAsOwner(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/admin/profile");
}
