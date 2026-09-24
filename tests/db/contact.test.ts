import { count, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type SubmitContactDeps, submitContact } from "@/server/contact/submit";
import { message } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import type { Mail, Mailer } from "@/server/email/mailer";
import { form } from "./form";
import { createTestDb } from "./test-db";

let db: Db;
let close: () => Promise<void>;
let sent: Mail[];

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedContent(db);
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await db.delete(message);
  sent = [];
});

const recordingMailer: Mailer = {
  async send(mail) {
    sent.push(mail);
    return { id: `mail-${sent.length}` };
  },
};

function deps(overrides: Partial<SubmitContactDeps> = {}): SubmitContactDeps {
  return {
    db,
    mailer: recordingMailer,
    ipHash: "ip-a",
    from: "contact@example.com",
    ownerInbox: "owner@example.com",
    siteUrl: "https://cv.example.com",
    ...overrides,
  };
}

function contactForm(overrides: Record<string, string> = {}): FormData {
  return form({
    name: "Ana Pop",
    email: "ana@example.org",
    company: "",
    message: "We need a dashboard.",
    locale: "en",
    elapsedMs: "4200",
    website: "",
    ...overrides,
  });
}

async function messageCount(): Promise<number> {
  const [{ value }] = await db.select({ value: count() }).from(message);
  return value;
}

describe("submitContact", () => {
  it("stores the message, then mails the owner and the visitor", async () => {
    const result = await submitContact(contactForm(), deps());

    expect(result).toEqual({ status: "sent" });
    const [row] = await db.select().from(message);
    expect(row).toMatchObject({
      name: "Ana Pop",
      email: "ana@example.org",
      company: null,
      body: "We need a dashboard.",
      locale: "en",
      ipHash: "ip-a",
      status: "new",
      emailStatus: "sent",
    });
    expect(sent.map((mail) => [mail.to, mail.replyTo])).toEqual([
      ["owner@example.com", "ana@example.org"],
      ["ana@example.org", "hello@example.com"],
    ]);
    expect(sent[0].html).toContain(`/admin/messages/${row.id}`);
    expect(sent[1].from).toBe('"Alex Marin" <contact@example.com>');
  });

  it("keeps the message with email_status failed when sending fails", async () => {
    const down: Mailer = {
      async send() {
        throw new Error("Resend refused the email (application_error): down");
      },
    };

    const result = await submitContact(contactForm(), deps({ mailer: down }));

    expect(result).toEqual({ status: "sent" });
    const [row] = await db.select().from(message);
    expect(row.emailStatus).toBe("failed");
    expect(row.body).toBe("We need a dashboard.");
  });

  it("a failed auto-reply alone does not mark the message failed", async () => {
    const visitorBounces: Mailer = {
      async send(mail) {
        if (mail.to === "ana@example.org") {
          throw new Error("Resend refused the email (validation_error): bad");
        }
        return recordingMailer.send(mail);
      },
    };

    await submitContact(contactForm(), deps({ mailer: visitorBounces }));

    const [row] = await db.select().from(message);
    expect(row.emailStatus).toBe("sent");
  });

  it("answers in Romanian for a message sent from /ro", async () => {
    await submitContact(contactForm({ locale: "ro" }), deps());

    const [row] = await db.select().from(message);
    expect(row.locale).toBe("ro");
    expect(sent[1].subject).toBe("Mulțumesc pentru mesaj");
  });

  it("pretends to accept a submission with the honeypot filled, and drops it", async () => {
    const result = await submitContact(
      contactForm({ website: "https://spam.example" }),
      deps(),
    );

    expect(result).toEqual({ status: "sent" });
    expect(await messageCount()).toBe(0);
    expect(sent).toEqual([]);
  });

  it("rejects a form sent less than 3 seconds after the page loaded", async () => {
    for (const elapsedMs of ["2999", "", "soon"]) {
      const result = await submitContact(contactForm({ elapsedMs }), deps());

      expect(result).toEqual({ status: "error", reason: "tooFast" });
    }
    expect(await messageCount()).toBe(0);
  });

  it("reports invalid fields and stores nothing", async () => {
    const result = await submitContact(
      contactForm({
        name: "  ",
        email: "not-an-email",
        company: "c".repeat(101),
        message: "m".repeat(5001),
      }),
      deps(),
    );

    expect(result).toEqual({
      status: "error",
      reason: "invalid",
      fieldErrors: {
        name: "required",
        email: "invalid",
        company: "tooLong",
        message: "tooLong",
      },
    });
    expect(await messageCount()).toBe(0);
  });

  it("accepts 5 messages per address in 10 minutes and rejects the 6th", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await submitContact(contactForm(), deps())).toEqual({
        status: "sent",
      });
    }

    const sixth = await submitContact(contactForm(), deps());

    expect(sixth).toEqual({ status: "error", reason: "rateLimited" });
    expect(await messageCount()).toBe(5);
    expect(sent).toHaveLength(10);
    expect(
      await submitContact(contactForm(), deps({ ipHash: "ip-b" })),
    ).toEqual({ status: "sent" });
  });

  it("only counts the last 10 minutes", async () => {
    await db.insert(message).values(
      Array.from({ length: 5 }, () => ({
        name: "Old",
        email: "old@example.org",
        body: "Earlier",
        locale: "en" as const,
        ipHash: "ip-a",
        createdAt: sql`now() - interval '11 minutes'`,
      })),
    );

    const result = await submitContact(contactForm(), deps());

    expect(result).toEqual({ status: "sent" });
  });

  it("never lets parallel requests from one address past the limit", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => submitContact(contactForm(), deps())),
    );

    expect(results.filter((r) => r.status === "sent")).toHaveLength(5);
    expect(
      await db
        .select({ value: count() })
        .from(message)
        .where(eq(message.ipHash, "ip-a")),
    ).toEqual([{ value: 5 }]);
  });
});
