import { z } from "zod";
import { STACK_LAYERS } from "@/content/types";
import { checkbox, required, slug, text } from "./fields";

/** One name per stack layer, as posted by TranslatedField (`en.api`, `ro.api`). */
function layerNames(name: z.ZodString) {
  return z.object(
    Object.fromEntries(STACK_LAYERS.map((layer) => [layer, name])) as Record<
      (typeof STACK_LAYERS)[number],
      z.ZodString
    >,
  );
}

export const categoriesInput = z.object({
  en: layerNames(required(60)),
  ro: layerNames(text(60)),
});

export const skillInput = z.object({
  slug,
  layer: z.enum(STACK_LAYERS),
  name: required(60),
  level: z.coerce.number().int().min(1).max(5),
  years: z.coerce.number().int().min(0).max(80),
  featured: checkbox,
});
export type SkillInput = z.infer<typeof skillInput>;
