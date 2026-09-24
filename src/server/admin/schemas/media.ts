import { z } from "zod";
import { text } from "./fields";

export const uploadInput = z.object({
  file: z.instanceof(File, { message: "Choose a file" }),
  altEn: text(300),
  altRo: text(300),
});

export const mediaAltInput = z.object({
  id: z.uuid(),
  altEn: text(300),
  altRo: text(300),
});
