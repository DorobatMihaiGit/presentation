import { attachDatabasePool } from "@vercel/functions";
import { env } from "@/env";
import { createDb } from "./create-db";
import type { Db } from "./types";

export type { Db } from "./types";

// One pool per server process. `globalThis` keeps it across dev hot reloads.
const globalForDb = globalThis as unknown as { cvDb?: Db };

/** The app's database (Neon pooled in production, docker Postgres locally). */
export function getDb(): Db {
  if (!globalForDb.cvDb) {
    const { db, pool } = createDb(env.DATABASE_URL);
    // On Vercel Fluid compute, closes idle clients before the instance suspends.
    // A no-op everywhere else.
    attachDatabasePool(pool);
    globalForDb.cvDb = db;
  }
  return globalForDb.cvDb;
}
