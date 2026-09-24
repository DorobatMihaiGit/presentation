import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { upsertAdmin } from "@/server/auth/admin";
import { createAuth } from "@/server/auth/create-auth";
import { createDb } from "@/server/db/create-db";
import { seedContent } from "@/server/db/seed";
import { requireEnv } from "./require-env";

// Prepares the e2e database named in DATABASE_URL (playwright.config.ts points
// it at `cv_e2e`, never the dev database): creates it if missing, applies the
// migrations, resets the CV content to the fixtures and (re)creates the owner
// account from ADMIN_EMAIL / ADMIN_PASSWORD.
async function main() {
  const url = new URL(requireEnv("DATABASE_URL"));
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`Unexpected e2e database name: ${name}`);
  }

  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const found = await client.query(
      "select 1 from pg_database where datname = $1",
      [name],
    );
    if (found.rowCount === 0) {
      await client.query(`create database "${name}"`);
    }
  } finally {
    await client.end();
  }

  const { db, pool } = createDb(url.toString());
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await seedContent(db, { reset: true });
    const adminEmail = requireEnv("ADMIN_EMAIL");
    const auth = createAuth({
      db,
      secret: requireEnv("BETTER_AUTH_SECRET"),
      baseURL: "http://localhost:3100",
      adminEmail,
    });
    await upsertAdmin(auth, {
      email: adminEmail,
      password: requireEnv("ADMIN_PASSWORD"),
      name: "E2E Owner",
      adminEmail,
      resetSecondFactors: { db },
    });
    console.log(`e2e database ${name} ready`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
