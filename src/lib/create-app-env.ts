import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  SITE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  ADMIN_EMAIL?: string;
  BLOB_READ_WRITE_TOKEN?: string;
  NEXT_PUBLIC_ASSET_BASE?: string;
};

export function createAppEnv(
  runtimeEnv: RuntimeEnv,
  options: { isServer?: boolean } = {},
) {
  return createEnv({
    server: {
      DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
      SITE_URL: z.url({ protocol: /^https?$/ }).optional(),
      BETTER_AUTH_SECRET: z.string().min(32),
      ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
      BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
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
      NEXT_PUBLIC_ASSET_BASE: runtimeEnv.NEXT_PUBLIC_ASSET_BASE,
    },
    emptyStringAsUndefined: true,
    isServer: options.isServer,
  });
}
