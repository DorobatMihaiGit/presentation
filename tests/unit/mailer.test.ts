import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLocalMailer,
  createMailer,
  createResendMailer,
  type Mail,
} from "@/server/email/mailer";

// The Resend SDK is replaced by a stub: tests never reach the network.
const resend = vi.hoisted(() => ({
  keys: [] as Array<string | undefined>,
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: resend.send };
    constructor(key?: string) {
      resend.keys.push(key);
    }
  },
}));

const MAIL: Mail = {
  from: "CV contact form <contact@example.com>",
  to: "owner@example.com",
  replyTo: "ana@example.org",
  subject: "New message from Ana Pop",
  html: "<p>Hello</p>",
  text: "Hello",
};

beforeEach(() => {
  resend.keys.length = 0;
  resend.send.mockReset();
});

describe("createLocalMailer", () => {
  it("writes each mail as a JSON file in the outbox", async () => {
    const dir = path.join(
      await mkdtemp(path.join(tmpdir(), "cv-mail-")),
      "outbox",
    );

    const { id } = await createLocalMailer(dir).send(MAIL);

    expect(await readdir(dir)).toEqual([`${id}.json`]);
    const stored = JSON.parse(
      await readFile(path.join(dir, `${id}.json`), "utf8"),
    );
    expect(stored).toEqual(MAIL);
  });

  it("fails when the outbox cannot be written", async () => {
    const blocked = path.join(
      await mkdtemp(path.join(tmpdir(), "cv-mail-")),
      "outbox",
    );
    await writeFile(blocked, "not a directory");

    await expect(createLocalMailer(blocked).send(MAIL)).rejects.toThrow();
  });
});

describe("createResendMailer", () => {
  it("sends through the Resend SDK with an idempotency key", async () => {
    resend.send.mockResolvedValue({
      data: { id: "email_123" },
      error: null,
      headers: null,
    });

    const result = await createResendMailer("re_test_key").send({
      ...MAIL,
      idempotencyKey: "contact/42/owner",
    });

    expect(result).toEqual({ id: "email_123" });
    expect(resend.keys).toEqual(["re_test_key"]);
    expect(resend.send).toHaveBeenCalledWith(MAIL, {
      idempotencyKey: "contact/42/owner",
    });
  });

  it("throws when Resend answers with an error", async () => {
    resend.send.mockResolvedValue({
      data: null,
      error: {
        name: "invalid_from_address",
        message: "The example.com domain is not verified.",
        statusCode: 403,
      },
      headers: null,
    });

    await expect(createResendMailer("re_test_key").send(MAIL)).rejects.toThrow(
      "Resend refused the email (invalid_from_address): The example.com domain is not verified.",
    );
  });

  it("lets network errors through", async () => {
    resend.send.mockRejectedValue(new TypeError("fetch failed"));

    await expect(createResendMailer("re_test_key").send(MAIL)).rejects.toThrow(
      "fetch failed",
    );
  });
});

describe("createMailer", () => {
  it("uses Resend when a key is set", async () => {
    resend.send.mockResolvedValue({
      data: { id: "email_1" },
      error: null,
      headers: null,
    });

    const mailer = createMailer({
      resendApiKey: "re_live",
      onVercel: true,
      localDir: "/nonexistent",
    });

    expect(await mailer.send(MAIL)).toEqual({ id: "email_1" });
  });

  it("writes to the local outbox without a key", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cv-mail-"));

    await createMailer({ onVercel: false, localDir: dir }).send(MAIL);

    expect(await readdir(dir)).toHaveLength(1);
    expect(resend.send).not.toHaveBeenCalled();
  });

  it("fails every send on Vercel without a key (read-only filesystem)", async () => {
    const mailer = createMailer({ onVercel: true, localDir: "/nonexistent" });

    await expect(mailer.send(MAIL)).rejects.toThrow(
      "RESEND_API_KEY is not set",
    );
  });
});
