import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

/** One rendered email. Header values (addresses, subject) must be single-line. */
export type Mail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  /** Resend drops a repeat of the same key within 24 hours. */
  idempotencyKey?: string;
};

export type Mailer = {
  send(mail: Mail): Promise<{ id: string }>;
};

/** Resend (production). The SDK returns errors instead of throwing; this throws. */
export function createResendMailer(apiKey: string): Mailer {
  const resend = new Resend(apiKey);
  return {
    async send({ idempotencyKey, ...mail }) {
      const { data, error } = await resend.emails.send(
        mail,
        idempotencyKey ? { idempotencyKey } : undefined,
      );
      if (error) {
        throw new Error(
          `Resend refused the email (${error.name}): ${error.message}`,
        );
      }
      return { id: data.id };
    },
  };
}

/**
 * Local outbox (dev, tests, CI: no RESEND_API_KEY). Each mail becomes one
 * JSON file; names start with a timestamp, so `ls` lists them in order.
 */
export function createLocalMailer(dir: string): Mailer {
  return {
    async send(mail) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const id = `${stamp}-${crypto.randomUUID()}`;
      await mkdir(dir, { recursive: true });
      await writeFile(
        path.join(dir, `${id}.json`),
        `${JSON.stringify(mail, null, 2)}\n`,
      );
      return { id };
    },
  };
}

export const LOCAL_MAIL_DIR = path.join(process.cwd(), ".data", "mail");

/**
 * Resend when a key is set; otherwise the local outbox. Vercel's filesystem is
 * read-only, so a deploy without a key fails every send: messages are still
 * stored, with email_status = failed.
 */
export function createMailer(options: {
  resendApiKey?: string;
  onVercel: boolean;
  localDir: string;
}): Mailer {
  if (options.resendApiKey) {
    return createResendMailer(options.resendApiKey);
  }
  if (options.onVercel) {
    return {
      async send() {
        throw new Error(
          "RESEND_API_KEY is not set: mail cannot be sent from Vercel without it.",
        );
      },
    };
  }
  return createLocalMailer(options.localDir);
}
