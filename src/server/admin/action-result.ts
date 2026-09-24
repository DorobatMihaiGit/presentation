/**
 * What every admin server action returns. Errors carry an HTTP-like code so
 * callers (and tests) can tell "not signed in" (401) from bad input (400),
 * a missing record (404) and a conflict (409).
 */
export type ActionResult =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | {
      status: "error";
      code: 400 | 401 | 404 | 409;
      message: string;
      /** Keyed by form field name, e.g. `en.headline`. */
      fieldErrors?: Record<string, string[]>;
    };

export const IDLE: ActionResult = { status: "idle" };

/** Signature shared by every admin action, so each works with useActionState. */
export type AdminFormAction = (
  previous: ActionResult,
  formData: FormData,
) => Promise<ActionResult>;
