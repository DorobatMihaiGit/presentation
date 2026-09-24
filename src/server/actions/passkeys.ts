"use server";

import { isAPIError } from "better-auth/api";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import type { ActionResult } from "@/server/admin/action-result";
import { formToObject } from "@/server/admin/form-data";
import { UNAUTHORIZED } from "@/server/admin/run-action";
import { idInput } from "@/server/admin/schemas/fields";
import { auth, getAdminSession } from "@/server/auth";

export async function deletePasskey(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!(await getAdminSession())) {
    return UNAUTHORIZED;
  }
  const parsed = idInput.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { status: "error", code: 400, message: "Unknown passkey." };
  }
  try {
    await auth.api.deletePasskey({
      body: { id: parsed.data.id },
      headers: await headers(),
    });
  } catch (error) {
    if (isAPIError(error)) {
      return {
        status: "error",
        code: 404,
        message: "This passkey no longer exists.",
      };
    }
    throw error;
  }
  // Passkeys are not CV content, so there is no tag to expire: re-render the page.
  refresh();
  return { status: "ok", message: "Passkey removed." };
}
