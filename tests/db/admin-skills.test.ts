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
  createSkill,
  deleteSkill,
  saveCategories,
} from "@/server/actions/skills";
import { IDLE } from "@/server/admin/action-result";
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

describe("skill actions", () => {
  const LAYER_NAMES = {
    "en.interface": "Interface",
    "en.api": "API",
    "en.data": "Data",
    "en.infra": "Infrastructure",
    "en.craft": "Craft",
    "ro.interface": "Interfață",
    "ro.api": "",
    "ro.data": "Date",
    "ro.infra": "Infrastructură",
    "ro.craft": "Meșteșug",
  };

  it("renames layers; a blank Romanian name falls back to English", async () => {
    const result = await saveCategories(
      IDLE,
      form({ ...LAYER_NAMES, "en.craft": "Practice" }),
    );

    expect(result).toEqual({ status: "ok", message: "Layer names saved." });
    const stack = (await cv("ro")).stack;
    expect(stack.find((s) => s.layer === "api")?.name).toEqual({
      value: "API",
      lang: "en",
    });
    expect(
      (await cv()).stack.find((s) => s.layer === "craft")?.name.value,
    ).toBe("Practice");
  });

  it("adds a skill to a layer and refuses a duplicate slug with 409", async () => {
    const skill = {
      slug: "rust",
      layer: "api",
      name: "Rust",
      level: "2",
      years: "1",
      featured: "on",
    };

    await expect(createSkill(IDLE, form(skill))).rejects.toThrow(
      "NEXT_REDIRECT /admin/skills",
    );
    const api = (await cv()).stack.find((s) => s.layer === "api");
    expect(api?.skills.at(-1)).toEqual({
      slug: "rust",
      name: "Rust",
      featured: true,
    });

    expect(await createSkill(IDLE, form(skill))).toMatchObject({
      status: "error",
      code: 409,
    });
  });

  it("rejects a level outside 1 to 5", async () => {
    const result = await createSkill(
      IDLE,
      form({
        slug: "cobol",
        layer: "api",
        name: "COBOL",
        level: "9",
        years: "1",
      }),
    );

    expect(result).toMatchObject({ status: "error", code: 400 });
    expect(result.status === "error" && result.fieldErrors?.level).toBeTruthy();
  });

  it("deleting a skill removes it from projects", async () => {
    await expect(deleteSkill(IDLE, form({ slug: "drizzle" }))).rejects.toThrow(
      "NEXT_REDIRECT /admin/skills",
    );

    const ledger = (await cv()).projects.find((p) => p.slug === "ledger-lens");
    expect(ledger?.skills).toEqual([
      "Next.js",
      "PostgreSQL",
      "Vitest and Playwright",
    ]);
  });
});
