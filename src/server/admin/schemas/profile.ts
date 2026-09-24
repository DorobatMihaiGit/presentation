import { z } from "zod";
import {
  checkbox,
  optionalMediaId,
  optionalUrl,
  required,
  text,
} from "./fields";

export const profileInput = z.object({
  emailPublic: z.email("Enter an email address"),
  location: required(80),
  countryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Two-letter country code"),
  yearsExp: z.coerce.number().int().min(0).max(80),
  available: checkbox,
  github: optionalUrl,
  linkedin: optionalUrl,
  avatarMediaId: optionalMediaId,
  en: z.object({
    fullName: required(120),
    headline: required(200),
    summary: required(2000),
    seoTitle: required(70),
    seoDescription: required(200),
    cvPdfMediaId: optionalMediaId,
  }),
  ro: z.object({
    fullName: text(120),
    headline: text(200),
    summary: text(2000),
    seoTitle: text(70),
    seoDescription: text(200),
    cvPdfMediaId: optionalMediaId,
  }),
});
export type ProfileInput = z.infer<typeof profileInput>;
