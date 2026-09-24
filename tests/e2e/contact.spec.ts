import { expect, type Page, test } from "@playwright/test";
import { E2E_ADMIN } from "./admin-credentials";
import { contactMails, uniqueVisitor } from "./contact-outbox";

// `next start` keeps an x-forwarded-for header it receives, so each test posts
// from its own documentation address (RFC 5737) and gets its own rate-limit
// bucket. On Vercel the proxy overwrites the header.
function postFrom(ip: string) {
  test.use({ extraHTTPHeaders: { "x-forwarded-for": ip } });
}

async function fillContactForm(
  page: Page,
  values: { name: string; email: string; message: string },
) {
  const form = page.getByRole("form", {
    name: /Send a message|Trimite un mesaj/,
  });
  await form.getByRole("textbox", { name: /^(Name|Nume)$/ }).fill(values.name);
  await form.getByRole("textbox", { name: "Email" }).fill(values.email);
  await form
    .getByRole("textbox", { name: /^(Message|Mesaj)$/ })
    .fill(values.message);
  return form;
}

test.describe("sending a message", () => {
  postFrom("192.0.2.10");

  test("the owner and the visitor each get a mail", async ({ page }) => {
    const email = uniqueVisitor("ana");
    await page.goto("/en");
    const form = await fillContactForm(page, {
      name: "Ana Pop",
      email,
      message: "We need a dashboard for our clinic.",
    });
    // Spec §5: a form sent sooner than 3 s after the page loaded is refused.
    await page.waitForTimeout(3_100);

    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "Thanks! Your message is on its way. I reply within two working days.",
    );
    await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue("");
    await expect
      .poll(async () => {
        const { owner, reply } = await contactMails(email);
        return Boolean(owner && reply);
      })
      .toBe(true);
    const { owner, reply } = await contactMails(email);
    expect(owner).toMatchObject({
      from: '"CV contact form" <contact@e2e.example.com>',
      to: E2E_ADMIN.email,
      replyTo: email,
      subject: "New message from Ana Pop",
    });
    expect(owner?.text).toContain("We need a dashboard for our clinic.");
    expect(reply).toMatchObject({
      from: '"Alex Marin" <contact@e2e.example.com>',
      to: email,
      subject: "Thanks for your message",
    });
  });
});

test.describe("sending a message from /ro", () => {
  postFrom("192.0.2.11");

  test("confirms and auto-replies in Romanian", async ({ page }) => {
    const email = uniqueVisitor("ioana");
    await page.goto("/ro");
    const form = await fillContactForm(page, {
      name: "Ioana",
      email,
      message: "Salut!",
    });
    await page.waitForTimeout(3_100);

    await form.getByRole("button", { name: "Trimite mesajul" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "Mulțumesc! Mesajul tău a plecat. Îți răspund în două zile lucrătoare.",
    );
    await expect
      .poll(async () => (await contactMails(email)).reply?.subject)
      .toBe("Mulțumesc pentru mesaj");
  });
});

test.describe("a form sent too quickly", () => {
  postFrom("192.0.2.12");

  test("is refused with a hint to try again", async ({ page }) => {
    const email = uniqueVisitor("bot");
    await page.goto("/en");
    const form = await fillContactForm(page, {
      name: "Quick",
      email,
      message: "Instant",
    });

    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "That was quick. Take a moment to check your message, then send it again.",
    );
    await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Quick",
    );
    expect(await contactMails(email)).toEqual({});
  });
});

test.describe("the rate limit", () => {
  postFrom("192.0.2.13");

  test("refuses the sixth message in ten minutes", async ({ page }) => {
    await page.goto("/en");
    await page.waitForTimeout(3_100);
    const form = page.getByRole("form", { name: "Send a message" });

    for (let i = 1; i <= 5; i++) {
      await fillContactForm(page, {
        name: `Sender ${i}`,
        email: uniqueVisitor("limit"),
        message: `Message ${i}`,
      });
      await form.getByRole("button", { name: "Send message" }).click();
      // A sent form is cleared, so an empty name means this one went through.
      await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue("");
    }
    await fillContactForm(page, {
      name: "Sender 6",
      email: uniqueVisitor("limit"),
      message: "Message 6",
    });
    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByRole("status")).toHaveText(
      "You have sent several messages in a short time. Try again in a few minutes, or email me directly.",
    );
    await expect(form.getByRole("textbox", { name: "Name" })).toHaveValue(
      "Sender 6",
    );
  });
});

test("the honeypot field is hidden from people and assistive technology", async ({
  page,
}) => {
  await page.goto("/en");
  const form = page.getByRole("form", { name: "Send a message" });

  await expect(form.getByRole("textbox")).toHaveCount(4);
  const honeypot = form.locator('input[name="website"]');
  await expect(honeypot).toHaveAttribute("tabindex", "-1");
  await expect(honeypot).not.toBeInViewport();
});
