import { z } from "zod";
import { routing } from "@/i18n/routing";
import type { ContactField, ContactFieldError } from "./state";

export const contactInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().min(1).max(254).pipe(z.email()),
  company: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || null),
  message: z.string().trim().min(1).max(5000),
  locale: z.enum(routing.locales),
});

export type ContactInput = z.output<typeof contactInput>;

const FIELDS = new Set<string>(["name", "email", "company", "message"]);

/** One error code per visible field; the form shows localized text for it. */
export function contactFieldErrors(
  issues: z.core.$ZodIssue[],
): Partial<Record<ContactField, ContactFieldError>> {
  const result: Partial<Record<ContactField, ContactFieldError>> = {};
  for (const issue of issues) {
    const field = String(issue.path[0]);
    if (!FIELDS.has(field) || result[field as ContactField]) {
      continue;
    }
    result[field as ContactField] =
      issue.code === "too_big"
        ? "tooLong"
        : issue.code === "invalid_format"
          ? "invalid"
          : "required";
  }
  return result;
}
