import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  SITE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  ADMIN_EMAIL?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  RESEND_API_KEY?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  NEXT_PUBLIC_ASSET_BASE?: string;
};

const email = z.email().transform((value) => value.toLowerCase());

export function createAppEnv(
  runtimeEnv: RuntimeEnv,
  options: { isServer?: boolean } = {},
) {
  return createEnv({
    server: {
      DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
      SITE_URL: z.url({ protocol: /^https?$/ }).optional(),
      BETTER_AUTH_SECRET: z.string().min(32),
      ADMIN_EMAIL: email,
      BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
      // Contact form mail (M3). No key = mails go to .data/mail/ instead.
      RESEND_API_KEY: z.string().startsWith("re_").optional(),
      CONTACT_FROM_EMAIL: email.optional(),
      CONTACT_TO_EMAIL: email.optional(),
    },
    client: {
      NEXT_PUBLIC_ASSET_BASE: z.url().optional(),
    },
    runtimeEnv: {
      DATABASE_URL: runtimeEnv.DATABASE_URL,
      SITE_URL: runtimeEnv.SITE_URL,
      BETTER_AUTH_SECRET: runtimeEnv.BETTER_AUTH_SECRET,
      ADMIN_EMAIL: runtimeEnv.ADMIN_EMAIL,
      BLOB_READ_WRITE_TOKEN: runtimeEnv.BLOB_READ_WRITE_TOKEN,
      RESEND_API_KEY: runtimeEnv.RESEND_API_KEY,
      CONTACT_FROM_EMAIL: runtimeEnv.CONTACT_FROM_EMAIL,
      CONTACT_TO_EMAIL: runtimeEnv.CONTACT_TO_EMAIL,
      NEXT_PUBLIC_ASSET_BASE: runtimeEnv.NEXT_PUBLIC_ASSET_BASE,
    },
    // Resend only sends from a verified domain, so a key without a sender
    // address is a configuration mistake: fail at boot, not on the first message.
    createFinalSchema: (shape, isServer) =>
      z.object(shape).superRefine((env, ctx) => {
        if (isServer && env.RESEND_API_KEY && !env.CONTACT_FROM_EMAIL) {
          ctx.addIssue({
            code: "custom",
            path: ["CONTACT_FROM_EMAIL"],
            message: "Required when RESEND_API_KEY is set",
          });
        }
      }),
    emptyStringAsUndefined: true,
    isServer: options.isServer,
  });
}
