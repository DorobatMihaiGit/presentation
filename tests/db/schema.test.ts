import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  experience,
  profile,
  project,
  skill,
  skillCategory,
} from "@/server/db/schema";
import type { Db } from "@/server/db/types";
import { createTestDb } from "./test-db";

let db: Db;
let client: PGlite;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, client, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

/** Postgres error code of a failed statement (drizzle wraps the driver error in `cause`). */
async function pgCode(statement: Promise<unknown>): Promise<string> {
  try {
    await statement;
  } catch (error) {
    const cause = (error as { cause?: { code?: string } }).cause;
    return cause?.code ?? "no-code";
  }
  return "no-error";
}

describe("schema (migrations applied to PGlite)", () => {
  it("creates every spec §4 table plus the Better Auth tables", async () => {
    const result = await client.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
    );

    expect(result.rows.map((row) => row.table_name)).toEqual([
      "account",
      "audit_log",
      "experience",
      "experience_i18n",
      "experience_skill",
      "media",
      "message",
      "profile",
      "profile_i18n",
      "project",
      "project_i18n",
      "project_skill",
      "session",
      "skill",
      "skill_category",
      "skill_category_i18n",
      "two_factor",
      "user",
      "verification",
    ]);
  });

  it("keeps profile a singleton", async () => {
    const row = {
      emailPublic: "a@example.com",
      location: "Cluj-Napoca",
      countryCode: "RO",
      yearsExp: 9,
    };
    await db.insert(profile).values(row);

    expect(await pgCode(db.insert(profile).values({ ...row, id: 2 }))).toBe(
      "23514",
    );
    expect(await pgCode(db.insert(profile).values(row))).toBe("23505");
  });

  it("rejects dates that are not YYYY-MM and end dates before start dates", async () => {
    const base = {
      company: "Acme",
      employmentType: "full_time" as const,
      sortOrder: 1,
    };

    expect(
      await pgCode(
        db
          .insert(experience)
          .values({ ...base, id: "a", startDate: "2021-13" }),
      ),
    ).toBe("23514");
    expect(
      await pgCode(
        db.insert(experience).values({
          ...base,
          id: "b",
          startDate: "2021-03",
          endDate: "2020-01",
        }),
      ),
    ).toBe("23514");
  });

  it("allows one skill category per stack layer and levels 1 to 5", async () => {
    await db.insert(skillCategory).values({ slug: "api", layer: "api" });

    expect(
      await pgCode(
        db.insert(skillCategory).values({ slug: "api-2", layer: "api" }),
      ),
    ).toBe("23505");
    expect(
      await pgCode(
        db.insert(skill).values({
          slug: "node",
          categorySlug: "api",
          name: "Node.js",
          level: 6,
          years: 1,
          sortOrder: 1,
        }),
      ),
    ).toBe("23514");
  });

  it("rejects a project year outside 1990-2100", async () => {
    expect(
      await pgCode(db.insert(project).values({ slug: "x", year: 1899 })),
    ).toBe("23514");
  });
});
