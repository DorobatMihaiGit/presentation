import { z } from "zod";
import {
  checkbox,
  lines,
  optionalUrl,
  required,
  text,
  yearMonth,
} from "./fields";

export const experienceInput = z
  .object({
    company: required(120),
    url: optionalUrl,
    startDate: yearMonth,
    endDate: z.union([z.literal(""), yearMonth]).transform((v) => v || null),
    employmentType: z.enum(["full_time", "part_time", "contract", "freelance"]),
    isPublished: checkbox,
    en: z.object({
      roleTitle: required(120),
      description: required(2000),
      highlights: lines,
    }),
    ro: z.object({
      roleTitle: text(120),
      description: text(2000),
      highlights: lines,
    }),
  })
  .refine((v) => v.endDate === null || v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "The end date is before the start date",
  });
export type ExperienceInput = z.infer<typeof experienceInput>;

export const moveInput = z.object({
  id: z.string().min(1).max(100),
  direction: z.enum(["up", "down"]),
});
