import { env } from "@/env";
import { createMailer, LOCAL_MAIL_DIR, type Mailer } from "./mailer";

export type { Mail, Mailer } from "./mailer";

/** The app's mail transport (see createMailer). */
export function getMailer(): Mailer {
  return createMailer({
    resendApiKey: env.RESEND_API_KEY,
    onVercel: Boolean(process.env.VERCEL),
    localDir: LOCAL_MAIL_DIR,
  });
}

/** Sender and owner inbox. CONTACT_TO_EMAIL defaults to ADMIN_EMAIL. */
export function getMailAddresses(): { from: string; ownerInbox: string } {
  return {
    from: env.CONTACT_FROM_EMAIL ?? "contact@example.com",
    ownerInbox: env.CONTACT_TO_EMAIL ?? env.ADMIN_EMAIL,
  };
}
