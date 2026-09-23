import { createAppEnv } from "./lib/create-app-env";

export const env = createAppEnv({
  DATABASE_URL: process.env.DATABASE_URL,
  NEXT_PUBLIC_ASSET_BASE: process.env.NEXT_PUBLIC_ASSET_BASE,
});
