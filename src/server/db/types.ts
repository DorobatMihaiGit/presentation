import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/**
 * Any Drizzle Postgres database or transaction over the app schema: node-postgres
 * in the app and scripts, PGlite in tests. Queries and mutations take a `Db`
 * argument so both drivers run the same code.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
