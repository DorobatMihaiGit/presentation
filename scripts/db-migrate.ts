import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "@/server/db/create-db";
import { requireEnv } from "./require-env";

// Applies pending SQL migrations from ./drizzle to DATABASE_URL.
async function main() {
  const { db, pool } = createDb(requireEnv("DATABASE_URL"));
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
