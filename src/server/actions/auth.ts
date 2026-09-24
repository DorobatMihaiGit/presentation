"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";

export type SignInState = { error?: string };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(128),
});

export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Enter your email and password." };
  }
  let twoFactor = false;
  try {
    const result = await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    });
    twoFactor =
      "twoFactorRedirect" in result && result.twoFactorRedirect === true;
  } catch (error) {
    if (isAPIError(error)) {
      // One message for every failure: never reveal whether the email exists.
      return {
        error:
          error.statusCode === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Wrong email or password.",
      };
    }
    throw error;
  }
  // With 2FA on, the password only earns a short-lived "two factor" cookie.
  redirect(twoFactor ? "/admin/login/two-factor" : "/admin");
}

const totpCode = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

/** Second sign-in step: the authenticator code turns the 2FA cookie into a session. */
export async function verifySignInCode(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = totpCode.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }
  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        error:
          error.statusCode === 429
            ? "Too many attempts. Wait a minute and try again."
            : "That code is not valid, or the sign-in expired. Try again.",
      };
    }
    throw error;
  }
  redirect("/admin");
}

export async function signOut(): Promise<void> {
  await auth.api.signOut({ headers: await headers() });
  redirect("/admin/login");
}
