// Shared by the contact Server Action and the public form (client bundle):
// types and constants only, no imports.

export type ContactField = "name" | "email" | "company" | "message";
export type ContactFieldError = "required" | "invalid" | "tooLong";

/**
 * What the contact action returns. The client shows localized text for each
 * case, so no message strings travel over the wire.
 */
export type ContactState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "error";
      reason: "invalid";
      fieldErrors: Partial<Record<ContactField, ContactFieldError>>;
    }
  | { status: "error"; reason: "tooFast" | "rateLimited" | "failed" };

export const CONTACT_IDLE: ContactState = { status: "idle" };

/** Hidden field that people never see; bots that fill every input do. */
export const HONEYPOT_FIELD = "website";

/** Spec §5: a form sent sooner than this after the page loaded is refused. */
export const MIN_FILL_MS = 3000;
