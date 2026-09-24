import { count, eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { fixtures } from "@/content/fixtures";
import { resolveCv } from "@/content/resolve-cv";
import { saveProfile } from "@/server/actions/profile";
import { IDLE } from "@/server/admin/action-result";
import { auditLog } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { loadCvRecords } from "@/server/queries/cv";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);

let close: () => Promise<void>;

beforeAll(async () => {
  close = await setupActionDb();
});

afterAll(async () => {
  await close();
});

beforeEach(async () => {
  await seedContent(mocks.db, { reset: true });
  mocks.session = OWNER;
  mocks.updateTag.mockClear();
});

/** The fixture profile as the admin form would post it. */
function profileForm(overrides: Record<string, string> = {}): FormData {
  const { en, ro } = fixtures.profile.i18n;
  return form({
    emailPublic: fixtures.profile.emailPublic,
    location: fixtures.profile.location,
    countryCode: fixtures.profile.countryCode,
    yearsExp: String(fixtures.profile.yearsExp),
    available: "on",
    github: "https://example.com/alex-marin/github",
    linkedin: "https://example.com/alex-marin/linkedin",
    avatarMediaId: "",
    "en.fullName": en.fullName,
    "en.headline": en.headline,
    "en.summary": en.summary,
    "en.seoTitle": en.seoTitle,
    "en.seoDescription": en.seoDescription,
    "en.cvPdfMediaId": "",
    "ro.fullName": ro?.fullName ?? "",
    "ro.headline": ro?.headline ?? "",
    "ro.summary": ro?.summary ?? "",
    "ro.seoTitle": ro?.seoTitle ?? "",
    "ro.seoDescription": ro?.seoDescription ?? "",
    "ro.cvPdfMediaId": "",
    ...overrides,
  });
}

async function auditCount(): Promise<number> {
  const [{ value }] = await mocks.db.select({ value: count() }).from(auditLog);
  return value;
}

describe("saveProfile", () => {
  it("returns 401 and writes nothing without an owner session", async () => {
    mocks.session = null;

    const result = await saveProfile(
      IDLE,
      profileForm({ "ro.headline": "Titlu nou" }),
    );

    expect(result).toMatchObject({ status: "error", code: 401 });
    const cv = resolveCv(await loadCvRecords(mocks.db), "ro");
    expect(cv.profile.headline.value).not.toBe("Titlu nou");
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("saves the Romanian headline, audits it and expires the CV cache", async () => {
    const before = await auditCount();

    const result = await saveProfile(
      IDLE,
      profileForm({ "ro.headline": "Titlu nou din admin" }),
    );

    expect(result).toEqual({ status: "ok", message: "Profile saved." });
    const cv = resolveCv(await loadCvRecords(mocks.db), "ro");
    expect(cv.profile.headline).toEqual({
      value: "Titlu nou din admin",
      lang: "ro",
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("cv");
    expect(await auditCount()).toBe(before + 1);
    const [entry] = await mocks.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entity, "profile"));
    expect(entry).toMatchObject({ userId: "owner", action: "update" });
  });

  it("accepts a blank Romanian field and falls back to English on /ro", async () => {
    await saveProfile(IDLE, profileForm({ "ro.headline": "  " }));

    const cv = resolveCv(await loadCvRecords(mocks.db), "ro");
    expect(cv.profile.headline).toEqual({
      value: fixtures.profile.i18n.en.headline,
      lang: "en",
    });
  });

  it("requires every English field", async () => {
    const result = await saveProfile(IDLE, profileForm({ "en.headline": "" }));

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { "en.headline": ["Required"] },
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("rejects javascript: URLs for social links", async () => {
    const result = await saveProfile(
      IDLE,
      profileForm({ github: "javascript:alert(1)" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { github: ["Use an http(s) URL"] },
    });
  });

  it("drops a social link that is left blank", async () => {
    await saveProfile(IDLE, profileForm({ linkedin: "" }));

    const cv = resolveCv(await loadCvRecords(mocks.db), "en");
    expect(cv.profile.socials).toEqual([
      { network: "github", url: "https://example.com/alex-marin/github" },
    ]);
  });
});
