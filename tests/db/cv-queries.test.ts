import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import {
  media,
  profile,
  profileI18n,
  project,
  projectI18n,
} from "@/server/db/schema";
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

describe("covers, case studies, the avatar and the CV PDF", () => {
  const uuid = () => crypto.randomUUID();

  async function addImage(alt: { en: string; ro: string }) {
    const key = `${uuid()}.webp`;
    const [row] = await db
      .insert(media)
      .values({
        blobUrl: `/api/media/${key}`,
        pathname: key,
        kind: "image",
        mime: "image/webp",
        width: 1600,
        height: 1000,
        bytes: 48_000,
        lqip: "data:image/webp;base64,UklGRg==",
        altEn: alt.en,
        altRo: alt.ro,
      })
      .returning({ id: media.id, url: media.blobUrl });
    return row;
  }

  async function addPdf() {
    const key = `${uuid()}.pdf`;
    const [row] = await db
      .insert(media)
      .values({
        blobUrl: `/api/media/${key}`,
        pathname: key,
        kind: "document",
        mime: "application/pdf",
        bytes: 91_000,
      })
      .returning({ id: media.id, url: media.blobUrl });
    return row;
  }

  it("gives a project its cover and case study, RO falling back to EN", async () => {
    await seedContent(db, { reset: true });
    const cover = await addImage({ en: "The reconciliation board", ro: "" });
    await db
      .update(project)
      .set({ coverMediaId: cover.id })
      .where(eq(project.slug, "ledger-lens"));
    await db
      .update(projectI18n)
      .set({ bodyMd: "## Why\n\nMonth-end took three days." })
      .where(
        and(
          eq(projectI18n.projectSlug, "ledger-lens"),
          eq(projectI18n.locale, "en"),
        ),
      );

    const ledger = resolveCv(await loadCvRecords(db), "ro").projects.find(
      (p) => p.slug === "ledger-lens",
    );

    expect(ledger?.cover).toEqual({
      url: cover.url,
      width: 1600,
      height: 1000,
      lqip: "data:image/webp;base64,UklGRg==",
      alt: { value: "The reconciliation board", lang: "en" },
    });
    expect(ledger?.body).toEqual({
      value: "## Why\n\nMonth-end took three days.",
      lang: "en",
    });
  });

  it("leaves projects without a cover or case study plain", async () => {
    await seedContent(db, { reset: true });

    const tramline = resolveCv(await loadCvRecords(db), "en").projects.find(
      (p) => p.slug === "tramline",
    );

    expect(tramline?.cover).toBeNull();
    expect(tramline?.body).toEqual({ value: "", lang: "en" });
  });

  it("never shows a document as a cover", async () => {
    await seedContent(db, { reset: true });
    const pdf = await addPdf();
    await db
      .update(project)
      .set({ coverMediaId: pdf.id })
      .where(eq(project.slug, "ledger-lens"));

    const ledger = resolveCv(await loadCvRecords(db), "en").projects.find(
      (p) => p.slug === "ledger-lens",
    );

    expect(ledger?.cover).toBeNull();
  });

  it("resolves the avatar and each locale's CV PDF, RO falling back to EN", async () => {
    await seedContent(db, { reset: true });
    const avatar = await addImage({ en: "Portrait", ro: "Portret" });
    const pdf = await addPdf();
    await db.update(profile).set({ avatarMediaId: avatar.id });
    await db
      .update(profileI18n)
      .set({ cvPdfMediaId: pdf.id })
      .where(eq(profileI18n.locale, "en"));

    const ro = resolveCv(await loadCvRecords(db), "ro").profile;

    expect(ro.avatar?.alt).toEqual({ value: "Portret", lang: "ro" });
    expect(ro.cvPdf).toEqual({
      value: { url: pdf.url, bytes: 91_000 },
      lang: "en",
    });
  });

  it("has no avatar or CV PDF until the owner picks them", async () => {
    await seedContent(db, { reset: true });

    const en = resolveCv(await loadCvRecords(db), "en").profile;

    expect(en.avatar).toBeNull();
    expect(en.cvPdf).toBeNull();
  });
});
