import type { Auth } from "./create-auth";

export type UpsertAdminResult = "created" | "updated";

/**
 * Creates the owner account, or resets its password (and signs out every
 * session) when it already exists. Public sign-up is disabled, so this is the
 * only way an account comes into being.
 */
export async function upsertAdmin(
  auth: Auth,
  input: {
    email: string;
    password: string;
    name: string;
    adminEmail: string;
  },
): Promise<UpsertAdminResult> {
  const email = input.email.toLowerCase();
  if (email !== input.adminEmail.toLowerCase()) {
    throw new Error(`Refusing to create ${email}: it is not ADMIN_EMAIL.`);
  }

  const ctx = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (
    input.password.length < minPasswordLength ||
    input.password.length > maxPasswordLength
  ) {
    throw new Error(
      `The password must be ${minPasswordLength} to ${maxPasswordLength} characters long.`,
    );
  }
  const hash = await ctx.password.hash(input.password);

  const existing = await ctx.internalAdapter.findUserByEmail(email, {
    includeAccounts: true,
  });
  if (existing) {
    const userId = existing.user.id;
    const credential = existing.accounts.find(
      (account) => account.providerId === "credential",
    );
    if (credential) {
      await ctx.internalAdapter.updatePassword(userId, hash);
    } else {
      await ctx.internalAdapter.linkAccount({
        userId,
        providerId: "credential",
        accountId: userId,
        password: hash,
      });
    }
    await ctx.internalAdapter.deleteUserSessions(userId);
    return "updated";
  }

  const user = await ctx.internalAdapter.createUser(
    { email, name: input.name, emailVerified: true },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return "created";
}
