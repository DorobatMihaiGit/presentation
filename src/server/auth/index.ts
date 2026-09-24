import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "@/env";
import { getDb } from "@/server/db";
import { siteUrl } from "@/site";
import { createAuth } from "./create-auth";
import { type AdminSession, readAdminSession } from "./read-session";

export type { AdminSession } from "./read-session";

export const auth = createAuth({
  db: getDb(),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: siteUrl,
  adminEmail: env.ADMIN_EMAIL,
});

/**
 * Data-access-layer session check (spec §5, CVE-2025-29927): the proxy's cookie
 * check is only a redirect hint, so every admin layout, page and server action
 * calls this. Deduplicated per request.
 */
export const getAdminSession = cache(
  async (): Promise<AdminSession | null> =>
    readAdminSession(auth, await headers(), env.ADMIN_EMAIL),
);

/** For admin layouts and pages: the owner, or a redirect to the login page. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  return session;
}
