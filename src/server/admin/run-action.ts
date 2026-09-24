import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { type AdminSession, getAdminSession } from "@/server/auth";
import { CV_TAG } from "@/server/cache-tags";
import { getDb } from "@/server/db";
import { auditLog } from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import type { ActionResult } from "./action-result";
import { formToObject } from "./form-data";

type ActionError = Extract<ActionResult, { status: "error" }>;

export type ActionContext = {
  /** The transaction the whole action runs in. */
  db: Db;
  session: AdminSession;
  audit: (entry: {
    action: "create" | "update" | "delete" | "reorder";
    entity: string;
    entityId?: string;
    diff?: Record<string, unknown>;
  }) => Promise<void>;
};

export type ActionOutcome =
  | { status: "ok"; message: string; redirectTo?: string }
  | ActionError;

export const UNAUTHORIZED: ActionError = {
  status: "error",
  code: 401,
  message: "Your session has ended. Sign in again.",
};

export function notFound(message: string): ActionError {
  return { status: "error", code: 404, message };
}

/**
 * The one entry point for admin mutations:
 * 1. re-checks the owner session (never trusts the proxy): 401 without it;
 * 2. validates the form with zod: 400 with per-field messages;
 * 3. runs the mutation and its audit row in one transaction;
 * 4. on success expires the public CV cache (`updateTag`), then redirects or
 *    returns a message.
 */
export async function runAdminAction<S extends z.ZodType>(
  formData: FormData,
  schema: S,
  run: (input: z.output<S>, ctx: ActionContext) => Promise<ActionOutcome>,
): Promise<ActionResult> {
  const session = await getAdminSession();
  if (!session) {
    return UNAUTHORIZED;
  }

  const parsed = schema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      status: "error",
      code: 400,
      message: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error.issues),
    };
  }

  let outcome: ActionOutcome;
  try {
    outcome = await getDb().transaction(async (tx) =>
      run(parsed.data, {
        db: tx,
        session,
        audit: async (entry) => {
          await tx
            .insert(auditLog)
            .values({ userId: session.userId, ...entry });
        },
      }),
    );
  } catch (error) {
    const conflict = conflictMessage(error);
    if (conflict) {
      return { status: "error", code: 409, message: conflict };
    }
    throw error;
  }

  if (outcome.status === "error") {
    return outcome;
  }
  updateTag(CV_TAG);
  if (outcome.redirectTo) {
    redirect(outcome.redirectTo);
  }
  return { status: "ok", message: outcome.message };
}

function fieldErrors(issues: z.core.$ZodIssue[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.join(".") || "form";
    result[key] = [...(result[key] ?? []), issue.message];
  }
  return result;
}

/** Postgres constraint violations (drizzle wraps the driver error in `cause`). */
function conflictMessage(error: unknown): string | null {
  const code = (error as { cause?: { code?: string } }).cause?.code;
  if (code === "23505") {
    return "Something with this slug already exists.";
  }
  if (code === "23503") {
    return "This change refers to something that no longer exists, or is still in use.";
  }
  return null;
}
