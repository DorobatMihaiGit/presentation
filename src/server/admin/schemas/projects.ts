import { z } from "zod";
import {
  checkbox,
  optionalMediaId,
  optionalUrl,
  required,
  slug,
  stringList,
  text,
} from "./fields";

export const projectInput = z.object({
  slug,
  year: z.coerce.number().int().min(1990).max(2100),
  repoUrl: optionalUrl,
  liveUrl: optionalUrl,
  coverMediaId: optionalMediaId,
  featured: checkbox,
  published: checkbox,
  skills: stringList.pipe(z.array(slug).max(12)),
  en: z.object({
    title: required(120),
    summary: required(400),
    role: required(120),
    outcome: required(300),
    body: text(20_000),
  }),
  ro: z.object({
    title: text(120),
    summary: text(400),
    role: text(120),
    outcome: text(300),
    body: text(20_000),
  }),
});
export type ProjectInput = z.infer<typeof projectInput>;
