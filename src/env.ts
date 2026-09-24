import { createAppEnv } from "./lib/create-app-env";

export const env = createAppEnv({
  DATABASE_URL: process.env.DATABASE_URL,
  SITE_URL: process.env.SITE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL,
  CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL,
  NEXT_PUBLIC_ASSET_BASE: process.env.NEXT_PUBLIC_ASSET_BASE,
});
