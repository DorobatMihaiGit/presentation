"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/server/admin/action-result";
import { formToObject } from "@/server/admin/form-data";
import { UNAUTHORIZED } from "@/server/admin/run-action";
import { auth, getAdminSession } from "@/server/auth";

/** ActionResult plus the one-time setup data shown after the password check. */
export type TwoFactorState =
  | ActionResult
  | { status: "setup"; secret: string; totpURI: string; backupCodes: string[] };

const passwordInput = z.object({ password: z.string().min(1).max(128) });
const codeInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/** Step 1: re-check the password, create a TOTP secret (not active yet). */
export async function startTwoFactor(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = passwordInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Enter your password." };
  }
  try {
    const setup = await auth.api.enableTwoFactor({
      body: { password: parsed.data.password, method: "totp" },
      headers: await headers(),
    });
    if (setup.method !== "totp") {
      return { status: "error", code: 400, message: "TOTP is not available." };
    }
    return {
      status: "setup",
      secret: new URL(setup.totpURI).searchParams.get("secret") ?? "",
      totpURI: setup.totpURI,
      backupCodes: setup.backupCodes,
    };
  } catch (error) {
    if (isAPIError(error)) {
      return { status: "error", code: 400, message: "Wrong password." };
    }
    throw error;
  }
}

/**
 * Step 2: the first valid code turns 2FA on. Better Auth rotates the session
 * at that moment, so the action redirects: re-rendering this request would
 * still carry the revoked cookie and bounce to the login page.
 */
export async function confirmTwoFactor(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = codeInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Enter the 6-digit code." };
  }
  try {
    await auth.api.verifyTOTP({
      body: { code: parsed.data.code },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        status: "error",
        code: 400,
        message: "That code is not valid. Try the next one.",
      };
    }
    throw error;
  }
  redirect("/admin/security");
}

export async function disableTwoFactor(
  _previous: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = passwordInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Enter your password." };
  }
  try {
    await auth.api.disableTwoFactor({
      body: { password: parsed.data.password },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return { status: "error", code: 400, message: "Wrong password." };
    }
    throw error;
  }
  // Disabling also rotates the session (see confirmTwoFactor).
  redirect("/admin/security");
}
