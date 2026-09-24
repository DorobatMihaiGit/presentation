import type { Auth } from "./create-auth";

export type AdminSession = {
  userId: string;
  email: string;
  name: string;
};

/**
 * The signed-in owner for these request headers, or null. A valid session for
 * any other email (for example after ADMIN_EMAIL changed) counts as signed out.
 */
export async function readAdminSession(
  auth: Auth,
  headers: Headers,
  adminEmail: string,
): Promise<AdminSession | null> {
  const result = await auth.api.getSession({ headers });
  if (!result || result.user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }
  return {
    userId: result.user.id,
    email: result.user.email,
    name: result.user.name,
  };
}
