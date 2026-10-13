import { existsSync, readFileSync } from "node:fs";
import { readMigrationFiles } from "drizzle-orm/migrator";
import pg from "pg";
import { deployChecks, parseEnvFile } from "../src/lib/deploy-check";

// `pnpm deploy:check [env file] [--online]`: a read-only preflight before a
// deploy (docs/deploy.md). It loads an env file (default
// .env.production.local, git-ignored), checks it with the app's schema plus
// the production rules, and prints variable names and pass/fail only, never
// values. --online also connects to DATABASE_URL and counts the migrations.

async function main() {
  const args = process.argv.slice(2);
  const online = args.includes("--online");
  const file =
    args.find((arg) => !arg.startsWith("--")) ?? ".env.production.local";
  if (!existsSync(file)) {
    console.error(`✘ ${file} not found (copy .env.example and fill it in)`);
    process.exitCode = 1;
    return;
  }
  const env = parseEnvFile(readFileSync(file, "utf8"));
  const checks = deployChecks(env);
  for (const check of checks) {
    console.log(`${check.ok ? "✓" : "✘"} ${check.name}: ${check.message}`);
  }
  let failed = checks.filter((check) => !check.ok).length;

  if (online && env.DATABASE_URL) {
    const total = readMigrationFiles({ migrationsFolder: "drizzle" }).length;
    const client = new pg.Client({ connectionString: env.DATABASE_URL });
    try {
      await client.connect();
      const { rows } = await client.query<{ count: string }>(
        'select count(*) from "drizzle"."__drizzle_migrations"',
      );
      const applied = Number(rows[0]?.count ?? 0);
      const ok = applied === total;
      console.log(
        `${ok ? "✓" : "✘"} database: ${applied} of ${total} migrations applied`,
      );
      failed += ok ? 0 : 1;
    } catch (error) {
      console.log(
        `✘ database: cannot read the migrations (${(error as { code?: string }).code ?? "connection failed"})`,
      );
      failed += 1;
    } finally {
      await client.end().catch(() => {});
    }
  }

  console.log(failed ? `${failed} check(s) failed` : "ready to deploy");
  process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "deploy:check failed");
  process.exit(1);
});
