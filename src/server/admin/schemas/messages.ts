import { z } from "zod";

export const MESSAGE_STATUSES = ["new", "read", "archived", "spam"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const messageStatusInput = z.object({
  id: z.uuid(),
  status: z.enum(MESSAGE_STATUSES),
});

export const messageIdInput = z.object({ id: z.uuid() });
