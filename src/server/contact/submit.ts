import { and, count, eq, gt, sql } from "drizzle-orm";
import { formToObject } from "@/server/admin/form-data";
import { message, profile, profileI18n } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { buildContactMails } from "@/server/email/contact-mails";
import type { Mailer } from "@/server/email/mailer";
import { contactFieldErrors, contactInput } from "./schema";
import { type ContactState, HONEYPOT_FIELD, MIN_FILL_MS } from "./state";

/** Spec §5: at most 5 messages per ip_hash in 10 minutes. */
export const RATE_LIMIT = { max: 5, windowMinutes: 10 } as const;

export type SubmitContactDeps = {
  db: Db;
  mailer: Mailer;
  /** hashIp(clientIp(headers), secret) */
  ipHash: string;
  from: string;
  ownerInbox: string;
  siteUrl: string;
};

/**
 * The contact pipeline (spec §5): honeypot, zod, minimum fill time, rate
 * limit, insert first, then the owner notification and the auto-reply. A
 * failed notification leaves the message stored with email_status = failed.
 */
export async function submitContact(
  formData: FormData,
  deps: SubmitContactDeps,
): Promise<ContactState> {
  const raw = formToObject(formData);

  // Bots get the same answer as people, so they do not learn to skip the field.
  if (typeof raw[HONEYPOT_FIELD] === "string" && raw[HONEYPOT_FIELD] !== "") {
    return { status: "sent" };
  }

  const parsed = contactInput.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "error",
      reason: "invalid",
      fieldErrors: contactFieldErrors(parsed.error.issues),
    };
  }

  const elapsed = Number(raw.elapsedMs);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return { status: "error", reason: "tooFast" };
  }

  const input = parsed.data;
  const stored = await deps.db.transaction(async (tx) => {
    // Serializes requests from one address, so parallel posts cannot all pass
    // the count before any of them inserts.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`contact:${deps.ipHash}`}))`,
    );
    const [{ recent }] = await tx
      .select({ recent: count() })
      .from(message)
      .where(
        and(
          eq(message.ipHash, deps.ipHash),
          gt(
            message.createdAt,
            sql`now() - make_interval(mins => ${RATE_LIMIT.windowMinutes})`,
          ),
        ),
      );
    if (recent >= RATE_LIMIT.max) {
      return null;
    }
    const [row] = await tx
      .insert(message)
      .values({
        name: input.name,
        email: input.email,
        company: input.company,
        body: input.message,
        locale: input.locale,
        ipHash: deps.ipHash,
      })
      .returning({ id: message.id, createdAt: message.createdAt });
    return row;
  });
  if (!stored) {
    return { status: "error", reason: "rateLimited" };
  }

  let emailStatus: "sent" | "failed" = "failed";
  try {
    const mails = await buildContactMails({
      message: {
        id: stored.id,
        name: input.name,
        email: input.email,
        company: input.company,
        body: input.message,
        locale: input.locale,
        createdAt: stored.createdAt,
      },
      owner: await loadOwner(deps.db, deps.from),
      from: deps.from,
      ownerInbox: deps.ownerInbox,
      siteUrl: deps.siteUrl,
    });
    const [owner, reply] = await Promise.allSettled([
      deps.mailer.send(mails.owner),
      deps.mailer.send(mails.autoReply),
    ]);
    if (owner.status === "fulfilled") {
      emailStatus = "sent";
    } else {
      console.error("contact: owner notification failed", owner.reason);
    }
    if (reply.status === "rejected") {
      console.warn("contact: auto-reply failed", reply.reason);
    }
  } catch (error) {
    console.error("contact: could not build the mails", error);
  }

  await deps.db
    .update(message)
    .set({ emailStatus })
    .where(eq(message.id, stored.id));
  return { status: "sent" };
}

/** Name and public address from the profile (English row); signs the auto-reply. */
async function loadOwner(
  db: Db,
  fallbackEmail: string,
): Promise<{ name: string; publicEmail: string }> {
  const [row] = await db
    .select({ name: profileI18n.fullName, publicEmail: profile.emailPublic })
    .from(profile)
    .innerJoin(
      profileI18n,
      and(eq(profileI18n.profileId, profile.id), eq(profileI18n.locale, "en")),
    );
  return {
    name: row?.name || "CV",
    publicEmail: row?.publicEmail || fallbackEmail,
  };
}
