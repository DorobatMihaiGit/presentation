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
  createProject,
  deleteProject,
  updateProject,
} from "@/server/actions/projects";
import { IDLE } from "@/server/admin/action-result";
import { projectSkill } from "@/server/db/schema";
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

describe("project actions", () => {
  const PROJECT = {
    slug: "orbit",
    year: "2026",
    repoUrl: "",
    liveUrl: "https://example.com/orbit",
    coverMediaId: "",
    featured: "on",
    published: "on",
    skills: ["postgres", "nextjs"],
    "en.title": "Orbit",
    "en.summary": "Satellite dashboard.",
    "en.role": "Lead",
    "en.outcome": "Launched.",
    "en.body": "## Why\n\nBecause.",
    "ro.title": "Orbită",
    "ro.summary": "",
    "ro.role": "",
    "ro.outcome": "",
    "ro.body": "",
  };

  it("creates a published project with ordered skills", async () => {
    await expect(createProject(IDLE, form(PROJECT))).rejects.toThrow(
      "NEXT_REDIRECT /admin/projects/orbit",
    );

    const orbit = (await cv("ro")).projects.find((p) => p.slug === "orbit");
    expect(orbit).toMatchObject({
      title: { value: "Orbită", lang: "ro" },
      summary: { value: "Satellite dashboard.", lang: "en" },
      skills: ["PostgreSQL", "Next.js"],
      featured: true,
    });
  });

  it("refuses a slug that is not lowercase-dashed", async () => {
    const result = await createProject(
      IDLE,
      form({ ...PROJECT, slug: "Orbit Two" }),
    );

    expect(result).toMatchObject({ status: "error", code: 400 });
  });

  it("refuses an unknown skill with 409 and keeps the old skills", async () => {
    const result = await updateProject(
      IDLE,
      form({ ...PROJECT, slug: "tramline", skills: ["no-such-skill"] }),
    );

    expect(result).toMatchObject({ status: "error", code: 409 });
    const rows = await mocks.db
      .select()
      .from(projectSkill)
      .where(eq(projectSkill.projectSlug, "tramline"));
    expect(rows).toHaveLength(3);
  });

  it("unpublishing hides a project from the public CV", async () => {
    const { published: _published, ...draft } = PROJECT;
    await updateProject(IDLE, form({ ...draft, slug: "tramline" }));

    expect((await cv()).projects.map((p) => p.slug)).not.toContain("tramline");
  });

  it("deletes a project", async () => {
    await expect(
      deleteProject(IDLE, form({ slug: "pulse-check" })),
    ).rejects.toThrow("NEXT_REDIRECT /admin/projects");
    expect(
      await deleteProject(IDLE, form({ slug: "pulse-check" })),
    ).toMatchObject({
      status: "error",
      code: 404,
    });
  });
});
