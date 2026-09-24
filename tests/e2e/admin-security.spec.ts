import { expect, test } from "@playwright/test";
import { TOTP } from "otpauth";
import { E2E_ADMIN } from "./admin-credentials";
import { signInAsOwner } from "./admin-login";

test("TOTP: set up, sign in with a code, turn off", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/admin/security");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page
    .getByRole("button", { name: "Set up an authenticator app" })
    .click();

  const secret = await page.getByTestId("totp-secret").textContent();
  const totp = new TOTP({ secret: secret ?? "" });
  await page.getByLabel("Code from the app").fill(totp.generate());
  await page
    .getByRole("button", { name: "Turn on two-factor sign-in" })
    .click();
  await expect(page.getByText("Two-factor sign-in is on.")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/admin/login/two-factor");

  // The password alone is not a session.
  await page.goto("/admin/profile");
  await expect(page).toHaveURL("/admin/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_ADMIN.email);
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/admin/login/two-factor");

  await page.getByLabel("Authenticator code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "That code is not valid, or the sign-in expired. Try again.",
  );

  await page.getByLabel("Authenticator code").fill(totp.generate());
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL("/admin/profile");

  await page.goto("/admin/security");
  await page
    .getByRole("textbox", { name: "Password" })
    .fill(E2E_ADMIN.password);
  await page
    .getByRole("button", { name: "Turn off two-factor sign-in" })
    .click();
  await expect(page.getByText("Two-factor sign-in is off.")).toBeVisible();
});
