import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/** A node-postgres pool plus a Drizzle client over it. Scripts close the pool when done. */
export function createDb(connectionString: string): {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  return { db: drizzle({ client: pool, schema }), pool };
}
