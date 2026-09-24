import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { resolveCv } from "@/content/resolve-cv";
import {
  createExperience,
  deleteExperience,
  moveExperience,
  updateExperience,
} from "@/server/actions/experience";
import { IDLE } from "@/server/admin/action-result";
import { experience } from "@/server/db/schema";
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
vi.mock("next/navigation", () =>
  import("./action-mocks").then((m) => m.navigationModule),
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

async function cv(locale: "en" | "ro" = "en") {
  return resolveCv(await loadCvRecords(mocks.db), locale);
}

const NEW_JOB = {
  company: "Nova Labs",
  url: "https://example.com/nova",
  startDate: "2016-02",
  endDate: "2017-05",
  employmentType: "contract",
  isPublished: "on",
  "en.roleTitle": "Web Developer",
  "en.description": "Built things.",
  "en.highlights": "First win\n\n  Second win  ",
  "ro.roleTitle": "",
  "ro.description": "",
  "ro.highlights": "",
};

describe("experience actions", () => {
  it("creates an entry at the end, then redirects to its edit page", async () => {
    await expect(createExperience(IDLE, form(NEW_JOB))).rejects.toThrow(
      /^NEXT_REDIRECT \/admin\/experience\/[0-9a-f-]{36}$/,
    );
    expect(mocks.updateTag).toHaveBeenCalledWith("cv");

    const jobs = (await cv()).experience;
    expect(jobs.at(-1)).toMatchObject({
      company: "Nova Labs",
      roleTitle: { value: "Web Developer", lang: "en" },
      highlights: { value: ["First win", "Second win"], lang: "en" },
    });
    expect((await cv("ro")).experience.at(-1)?.roleTitle.lang).toBe("en");
  });

  it("rejects an end date before the start date", async () => {
    const result = await createExperience(
      IDLE,
      form({ ...NEW_JOB, endDate: "2015-01" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { endDate: ["The end date is before the start date"] },
    });
  });

  it("returns 404 when updating an entry that was deleted meanwhile", async () => {
    const result = await updateExperience(
      IDLE,
      form({ ...NEW_JOB, id: "gone" }),
    );

    expect(result).toMatchObject({ status: "error", code: 404 });
  });

  it("moves an entry up and down by swapping neighbours", async () => {
    await moveExperience(IDLE, form({ id: "ferrum-freight", direction: "up" }));
    expect((await cv()).experience.map((job) => job.id)).toEqual([
      "ferrum-freight",
      "ardea-health",
      "studio-meridian",
    ]);

    const result = await moveExperience(
      IDLE,
      form({ id: "ferrum-freight", direction: "up" }),
    );
    expect(result).toEqual({ status: "ok", message: "Already at the edge." });
  });

  it("deletes an entry with its translations", async () => {
    await expect(
      deleteExperience(IDLE, form({ id: "studio-meridian" })),
    ).rejects.toThrow("NEXT_REDIRECT /admin/experience");

    expect(
      await mocks.db
        .select()
        .from(experience)
        .where(eq(experience.id, "studio-meridian")),
    ).toEqual([]);
  });
});
