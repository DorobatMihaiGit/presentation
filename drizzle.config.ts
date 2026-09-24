import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only diffs the schema against drizzle/meta, so it
// needs no database. Migrations are applied by `pnpm db:migrate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
});
