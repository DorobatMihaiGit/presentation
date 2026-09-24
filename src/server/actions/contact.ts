"use server";

import { headers } from "next/headers";
import { env } from "@/env";
import { clientIp, hashIp } from "@/server/contact/ip";
import type { ContactState } from "@/server/contact/state";
import { submitContact } from "@/server/contact/submit";
import { getDb } from "@/server/db";
import { getMailAddresses, getMailer } from "@/server/email";
import { siteUrl } from "@/site";

/**
 * The public contact form's action: no session (visitors are anonymous). It
 * never expires a cache tag or refreshes the router, so /en and /ro stay
 * static; the answer is only the returned state.
 */
export async function sendContactMessage(
  _previous: ContactState,
  formData: FormData,
): Promise<ContactState> {
  try {
    const ip = clientIp(await headers());
    const { from, ownerInbox } = getMailAddresses();
    return await submitContact(formData, {
      db: getDb(),
      mailer: getMailer(),
      ipHash: hashIp(ip, env.BETTER_AUTH_SECRET),
      from,
      ownerInbox,
      siteUrl,
    });
  } catch (error) {
    console.error("contact: message not stored", error);
    return { status: "error", reason: "failed" };
  }
}
