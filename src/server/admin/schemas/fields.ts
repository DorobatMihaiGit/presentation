import { z } from "zod";

// Field schemas shared by the admin forms. English text is required, Romanian
// may be left blank (blank = not translated = English fallback on /ro).

export const text = (max: number) => z.string().trim().max(max);
export const required = (max: number) => text(max).min(1, "Required");

/** An unchecked checkbox is absent from FormData. */
export const checkbox = z.preprocess((value) => value === "on", z.boolean());

/** "" means "none"; anything else must be an http(s) URL. */
export const optionalUrl = z
  .union([
    z.literal(""),
    z.url({ protocol: /^https?$/, message: "Use an http(s) URL" }),
  ])
  .optional()
  .transform((value) => value || null);

/** A media library pick: "" means "none". */
export const optionalMediaId = z
  .union([z.literal(""), z.uuid()])
  .optional()
  .transform((value) => value || null);

export const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

/** Textarea with one entry per line; blank lines are dropped. */
export const lines = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  )
  .pipe(z.array(z.string().max(300)).max(12));

/** A checkbox group: absent = [], one value = [value]. */
export const stringList = z.preprocess(
  (value) =>
    value === undefined ? [] : Array.isArray(value) ? value : [value],
  z.array(z.string()),
);

export const slug = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and dashes")
  .max(60);

export const idInput = z.object({ id: z.string().min(1).max(100) });
export const slugInput = z.object({ slug });
