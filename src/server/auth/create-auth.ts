import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

export type AuthConfig = {
  db: Db;
  secret: string;
  baseURL: string;
  /** The only identity allowed to exist (spec §5: ADMIN_EMAIL allowlist). */
  adminEmail: string;
};

export const MIN_PASSWORD_LENGTH = 12;

/**
 * Single-owner Better Auth: email + password, public sign-up disabled, and
 * every user creation outside ADMIN_EMAIL rejected. The owner account is
 * created by `pnpm admin:create` (see ./admin.ts).
 */
export function createAuth(config: AuthConfig) {
  const adminEmail = config.adminEmail.toLowerCase();
  const origin = new URL(config.baseURL);

  return betterAuth({
    appName: "CV admin",
    baseURL: config.baseURL,
    secret: config.secret,
    database: drizzleAdapter(config.db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    databaseHooks: {
      user: {
        create: {
          // Runs for every user insert, including `pnpm admin:create`.
          before: async (user) => {
            if (user.email.toLowerCase() !== adminEmail) {
              throw new APIError("FORBIDDEN", {
                message: "Only ADMIN_EMAIL may have an account.",
              });
            }
          },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    // nextCookies() must stay last: it writes Set-Cookie from server actions.
    plugins: [
      twoFactor({ issuer: "CV admin" }),
      // WebAuthn is bound to the site's host name and exact origin.
      passkey({
        rpID: origin.hostname,
        rpName: "CV admin",
        origin: origin.origin,
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
