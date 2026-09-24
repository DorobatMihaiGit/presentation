import { rename, rm, writeFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, test } from "@playwright/test";
import { signInAsOwner } from "./admin-login";
import { OUTBOX } from "./contact-outbox";

/**
 * Sends one message through the public form in a fresh context that posts
 * from `ip` (next start keeps the x-forwarded-for it receives).
 */
async function sendFromSite(
  browser: Browser,
  ip: string,
  values: { name: string; message: string },
) {
  const context = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  const page = await context.newPage();
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });
  await form.getByRole("textbox", { name: "Name" }).fill(values.name);
  await form
    .getByRole("textbox", { name: "Email" })
    .fill(`${values.name.toLowerCase().replace(/\W+/g, ".")}@example.org`);
  await form.getByRole("textbox", { name: "Message" }).fill(values.message);
  await page.waitForTimeout(3_100);
  await form.getByRole("button", { name: "Send message" }).click();
  await expect(form.getByRole("status")).toHaveText(/^Thanks!/);
  await context.close();
}

test("a message from the site can be read, archived, flagged and deleted", async ({
  browser,
  page,
}) => {
  const name = `Visitor ${crypto.randomUUID().slice(0, 6)}`;
  await sendFromSite(browser, "192.0.2.20", {
    name,
    message: "Could you build our booking system?",
  });
  await signInAsOwner(page);

  await page.getByRole("link", { name: "Messages" }).click();
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("New");
  await row.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  // Next keeps the list page mounted but hidden, so match visible text only.
  await expect(
    page
      .getByText("Could you build our booking system?")
      .filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText("Emailed")).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => v.id)).toEqual([]);

  await page.getByRole("button", { name: "Mark as read" }).click();
  await expect(
    page.getByRole("button", { name: "Mark as unread" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(
    page.getByRole("button", { name: "Move to inbox" }),
  ).toBeVisible();

  await page.goto("/admin/messages");
  await expect(
    page.getByRole("listitem").filter({ hasText: name }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: /^Archived/ }).click();
  await page.getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Mark as spam" }).click();
  await expect(page.getByRole("button", { name: "Not spam" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL("/admin/messages?view=spam");
  await expect(page.getByRole("link", { name })).toHaveCount(0);
});

test("a message whose notification could not be sent is kept and flagged", async ({
  browser,
  page,
}) => {
  const name = `Outage ${crypto.randomUUID().slice(0, 6)}`;
  // Simulate a mail outage: a file where the outbox folder should be makes
  // every send fail, like Resend being down.
  const parked = `${OUTBOX}.parked-${Date.now()}`;
  await rename(OUTBOX, parked).catch(() => {});
  await writeFile(OUTBOX, "e2e: mail outage\n");
  try {
    await sendFromSite(browser, "192.0.2.21", {
      name,
      message: "Sent while mail was down.",
    });
  } finally {
    await rm(OUTBOX, { force: true });
    await rename(parked, OUTBOX).catch(() => {});
  }

  await signInAsOwner(page);
  await page.goto("/admin/messages");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("Email failed");
  await row.getByRole("link", { name }).click();
  await expect(
    page.getByText("Sent while mail was down.").filter({ visible: true }),
  ).toBeVisible();
});

test("a malformed message id shows the not-found page, not a server error", async ({
  page,
}) => {
  await signInAsOwner(page);

  const response = await page.goto("/admin/messages/not-a-uuid");

  // notFound() runs inside the admin <Suspense> after the shell has streamed,
  // so the status stays 200 (like redirect() in M2); the point is no 500.
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Page not found",
  );
});

for (const path of ["/admin/messages", "/admin/messages?view=spam"]) {
  test(`${path} has no axe violations`, async ({ page }) => {
    await signInAsOwner(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).analyze();

    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
