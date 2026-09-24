import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

// Without RESEND_API_KEY (playwright.config.ts clears it) the app writes every
// mail to this folder as JSON; e2e reads it back instead of a real inbox.
export const OUTBOX = path.join(process.cwd(), ".data", "mail");

export type StoredMail = {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
};

/**
 * The owner notification (reply-to = visitor) and the auto-reply (to =
 * visitor) for one visitor address. Both are sent at once, so file order says
 * nothing about which is which.
 */
export async function contactMails(
  visitorEmail: string,
): Promise<{ owner?: StoredMail; reply?: StoredMail }> {
  let files: string[];
  try {
    files = (await readdir(OUTBOX)).filter((file) => file.endsWith(".json"));
  } catch {
    return {};
  }
  const mails = await Promise.all(
    files.map(
      async (file) =>
        JSON.parse(
          await readFile(path.join(OUTBOX, file), "utf8"),
        ) as StoredMail,
    ),
  );
  return {
    owner: mails.find((mail) => mail.replyTo === visitorEmail),
    reply: mails.find((mail) => mail.to === visitorEmail),
  };
}

/** A visitor address no other test uses. */
export function uniqueVisitor(name: string): string {
  return `${name}.${crypto.randomUUID().slice(0, 8)}@example.org`;
}
