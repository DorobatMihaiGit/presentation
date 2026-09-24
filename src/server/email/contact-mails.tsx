import { render } from "react-email";
import type { Locale } from "@/i18n/routing";
import { headerText, mailbox } from "./headers";
import type { Mail } from "./mailer";
import { AUTO_REPLY_COPY, AutoReply } from "./templates/AutoReply";
import { OwnerNotification } from "./templates/OwnerNotification";

export type ContactMailInput = {
  message: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    body: string;
    locale: Locale;
    createdAt: Date;
  };
  /** The CV owner, from the profile: signs the auto-reply and receives replies to it. */
  owner: { name: string; publicEmail: string };
  /** Verified sender address (CONTACT_FROM_EMAIL). */
  from: string;
  /** Where notifications go (CONTACT_TO_EMAIL, default ADMIN_EMAIL). */
  ownerInbox: string;
  siteUrl: string;
};

/**
 * The two mails for one stored message. The visitor's address appears only
 * as the owner mail's reply-to and as the auto-reply's recipient.
 */
export async function buildContactMails(
  input: ContactMailInput,
): Promise<{ owner: Mail; autoReply: Mail }> {
  const { message } = input;

  const notification = (
    <OwnerNotification
      name={message.name}
      email={message.email}
      company={message.company}
      body={message.body}
      locale={message.locale}
      receivedAt={message.createdAt}
      inboxUrl={`${input.siteUrl}/admin/messages/${message.id}`}
    />
  );
  const reply = (
    <AutoReply
      locale={message.locale}
      ownerName={input.owner.name}
      siteUrl={input.siteUrl}
    />
  );

  return {
    owner: {
      from: mailbox("CV contact form", input.from),
      to: input.ownerInbox,
      replyTo: headerText(message.email, 254),
      subject: headerText(`New message from ${message.name}`, 150),
      html: await render(notification),
      text: await render(notification, { plainText: true }),
      idempotencyKey: `contact-${message.id}-owner`,
    },
    autoReply: {
      from: mailbox(input.owner.name, input.from),
      to: headerText(message.email, 254),
      replyTo: input.owner.publicEmail,
      subject: AUTO_REPLY_COPY[message.locale].subject,
      html: await render(reply),
      text: await render(reply, { plainText: true }),
      idempotencyKey: `contact-${message.id}-reply`,
    },
  };
}
