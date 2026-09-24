import { describe, expect, it } from "vitest";
import {
  buildContactMails,
  type ContactMailInput,
} from "@/server/email/contact-mails";
import { headerText, mailbox } from "@/server/email/headers";

const VISITOR = "ana@example.org";

function input(overrides: Partial<ContactMailInput["message"]> = {}) {
  return {
    message: {
      id: "0b6f3a52-6b1f-4a8e-9a55-2f1f0f9d8c11",
      name: "Ana Pop",
      email: VISITOR,
      company: "Acme",
      body: "Hello!\nWe need a <b>dashboard</b> & an API.",
      locale: "en",
      createdAt: new Date("2026-09-24T10:00:00Z"),
      ...overrides,
    },
    owner: { name: "Alex Marin", publicEmail: "hello@example.com" },
    from: "contact@example.com",
    ownerInbox: "owner@example.com",
    siteUrl: "https://cv.example.com",
  } satisfies ContactMailInput;
}

describe("headerText", () => {
  it("turns CR, LF and other control characters into single spaces", () => {
    expect(headerText("Ana\r\nBcc: victim@example.net\t\u0000x")).toBe(
      "Ana Bcc: victim@example.net x",
    );
  });

  it("shortens long values with an ellipsis", () => {
    expect(headerText("a".repeat(20), 10)).toBe(`${"a".repeat(9)}…`);
  });
});

describe("mailbox", () => {
  it("quotes the display name and escapes quotes and backslashes", () => {
    expect(mailbox('Alex "AM" Marin\\', "contact@example.com")).toBe(
      '"Alex \\"AM\\" Marin\\\\" <contact@example.com>',
    );
  });
});

describe("buildContactMails: owner notification", () => {
  it("goes from the site to the owner; the visitor is only the reply-to", async () => {
    const { owner } = await buildContactMails(input());

    expect(owner.from).toBe('"CV contact form" <contact@example.com>');
    expect(owner.to).toBe("owner@example.com");
    expect(owner.replyTo).toBe(VISITOR);
    expect(owner.from).not.toContain(VISITOR);
    expect(owner.to).not.toContain(VISITOR);
    expect(owner.subject).toBe("New message from Ana Pop");
    expect(owner.idempotencyKey).toBe(
      "contact-0b6f3a52-6b1f-4a8e-9a55-2f1f0f9d8c11-owner",
    );
  });

  it("shows the message escaped, with a link to the inbox", async () => {
    const { owner } = await buildContactMails(input());

    expect(owner.html).toContain("&lt;b&gt;dashboard&lt;/b&gt; &amp; an API.");
    expect(owner.html).not.toContain("<b>dashboard</b>");
    expect(owner.html).toContain(
      'href="https://cv.example.com/admin/messages/0b6f3a52-6b1f-4a8e-9a55-2f1f0f9d8c11"',
    );
    expect(owner.text).toContain(
      "Hello!\nWe need a <b>dashboard</b> & an API.",
    );
    expect(owner.text).toContain("Acme");
    expect(owner.text).toContain("English");
  });

  it("keeps line breaks in the name out of the subject (header injection)", async () => {
    const { owner } = await buildContactMails(
      input({ name: "Ana\r\nBcc: victim@example.net" }),
    );

    expect(owner.subject).toBe("New message from Ana Bcc: victim@example.net");
    expect(owner.subject).not.toMatch(/[\r\n]/);
  });
});

describe("buildContactMails: auto-reply", () => {
  it("answers in English from the owner, replies go to the public address", async () => {
    const { autoReply } = await buildContactMails(input());

    expect(autoReply.from).toBe('"Alex Marin" <contact@example.com>');
    expect(autoReply.to).toBe(VISITOR);
    expect(autoReply.replyTo).toBe("hello@example.com");
    expect(autoReply.subject).toBe("Thanks for your message");
    expect(autoReply.html).toContain('lang="en"');
    expect(autoReply.text).toContain("within two working days");
    expect(autoReply.text).toContain("Alex Marin");
  });

  it("answers in Romanian for a message sent from /ro", async () => {
    const { autoReply } = await buildContactMails(input({ locale: "ro" }));

    expect(autoReply.subject).toBe("Mulțumesc pentru mesaj");
    expect(autoReply.html).toContain('<html dir="ltr" lang="ro">');
    expect(autoReply.html).not.toContain('lang="en"');
    expect(autoReply.text).toContain("în două zile lucrătoare");
  });

  it("repeats nothing the visitor typed, so it cannot relay spam", async () => {
    const { autoReply } = await buildContactMails(
      input({
        name: "Cheap pills https://spam.example",
        company: "Spam Inc",
        body: "Visit https://spam.example now",
      }),
    );

    for (const part of [autoReply.subject, autoReply.html, autoReply.text]) {
      expect(part).not.toContain("spam.example");
      expect(part).not.toContain("Spam Inc");
    }
  });
});
