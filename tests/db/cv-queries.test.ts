import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import { profileI18n, projectI18n } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import type { Db } from "@/server/db/types";
import { loadCvRecords } from "@/server/queries/cv";
import { createTestDb } from "./test-db";

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("seedContent + loadCvRecords", () => {
  it("explains how to fix an empty database", async () => {
    await expect(loadCvRecords(db)).rejects.toThrow(
      "CV profile row is missing. Run `pnpm db:migrate` and `pnpm db:seed`.",
    );
  });

  it("seeds an empty database from the fixtures", async () => {
    expect(await seedContent(db)).toBe("seeded");
  });

  it.each(["en", "ro"] as const)(
    "renders the same %s CV from Postgres as from the fixtures",
    async (locale) => {
      const records = await loadCvRecords(db);

      expect(resolveCv(records, locale)).toEqual(resolveCv(fixtures, locale));
    },
  );

  it("does not overwrite existing content unless asked to reset", async () => {
    await db
      .update(profileI18n)
      .set({ headline: "Edited in the admin" })
      .where(and(eq(profileI18n.profileId, 1), eq(profileI18n.locale, "ro")));

    expect(await seedContent(db)).toBe("skipped");
    expect(resolveCv(await loadCvRecords(db), "ro").profile.headline).toEqual({
      value: "Edited in the admin",
      lang: "ro",
    });

    expect(await seedContent(db, { reset: true })).toBe("seeded");
    expect(
      resolveCv(await loadCvRecords(db), "ro").profile.headline.value,
    ).toContain("construiește");
  });
});

describe("RO → EN fallback on database rows", () => {
  it("falls back per field when a Romanian value is blank", async () => {
    await seedContent(db, { reset: true });
    await db
      .update(profileI18n)
      .set({ headline: "   " })
      .where(and(eq(profileI18n.profileId, 1), eq(profileI18n.locale, "ro")));

    const cv = resolveCv(await loadCvRecords(db), "ro");

    expect(cv.profile.headline).toEqual({
      value: fixtures.profile.i18n.en.headline,
      lang: "en",
    });
    expect(cv.profile.summary.lang).toBe("ro");
  });

  it("falls back for a whole record when its Romanian row is missing", async () => {
    await seedContent(db, { reset: true });
    await db
      .delete(projectI18n)
      .where(
        and(
          eq(projectI18n.projectSlug, "tramline"),
          eq(projectI18n.locale, "ro"),
        ),
      );

    const tramline = resolveCv(await loadCvRecords(db), "ro").projects.find(
      (p) => p.slug === "tramline",
    );

    expect(tramline?.title).toEqual({ value: "Tramline", lang: "en" });
    expect(tramline?.summary.lang).toBe("en");
  });

  it("refuses to load a record without an English row", async () => {
    await seedContent(db, { reset: true });
    await db
      .delete(projectI18n)
      .where(
        and(
          eq(projectI18n.projectSlug, "tramline"),
          eq(projectI18n.locale, "en"),
        ),
      );

    await expect(loadCvRecords(db)).rejects.toThrow(
      "project tramline has no English translation row.",
    );
  });
});
