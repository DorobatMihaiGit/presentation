import { createDb } from "@/server/db/create-db";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// `pnpm db:seed` fills an empty database with the fixture CV.
// `pnpm db:seed --reset` replaces all CV content with the fixtures.
async function main() {
  const reset = process.argv.includes("--reset");
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    const result = await seedContent(db, { reset });
    console.log(
      result === "seeded"
        ? "seeded CV content"
        : "skipped: CV content already exists (use --reset to replace it)",
    );
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
