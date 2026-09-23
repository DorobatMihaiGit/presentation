import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export type RuntimeEnv = {
  DATABASE_URL?: string;
  NEXT_PUBLIC_ASSET_BASE?: string;
};

export function createAppEnv(
  runtimeEnv: RuntimeEnv,
  options: { isServer?: boolean } = {},
) {
  return createEnv({
    server: {
      DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    },
    client: {
      NEXT_PUBLIC_ASSET_BASE: z.url().optional(),
    },
    runtimeEnv: {
      DATABASE_URL: runtimeEnv.DATABASE_URL,
      NEXT_PUBLIC_ASSET_BASE: runtimeEnv.NEXT_PUBLIC_ASSET_BASE,
    },
    emptyStringAsUndefined: true,
    isServer: options.isServer,
  });
}
