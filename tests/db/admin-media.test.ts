import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { deleteMedia, saveMediaAlt, uploadMedia } from "@/server/actions/media";
import { saveProfile } from "@/server/actions/profile";
import { IDLE } from "@/server/admin/action-result";
import { media, profile } from "@/server/db/schema";
import { seedContent } from "@/server/db/seed";
import { createLocalStore } from "@/server/media/store";
import { mocks, OWNER, setupActionDb } from "./action-mocks";
import { form } from "./form";

vi.mock("@/server/db", () => import("./action-mocks").then((m) => m.dbModule));
vi.mock("@/server/auth", () =>
  import("./action-mocks").then((m) => m.authModule),
);
vi.mock("next/cache", () =>
  import("./action-mocks").then((m) => m.cacheModule),
);
vi.mock("@/server/media", () =>
  import("./action-mocks").then((m) => m.mediaModule),
);

let close: () => Promise<void>;
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cv-media-"));
  close = await setupActionDb();
  mocks.media = createLocalStore(dir);
  await seedContent(mocks.db);
});

afterAll(async () => {
  await close();
});

beforeEach(() => {
  mocks.session = OWNER;
});

async function pngFile(name = "avatar.png"): Promise<File> {
  const bytes = await sharp({
    create: { width: 64, height: 48, channels: 3, background: "#7cc5ff" },
  })
    .png()
    .toBuffer();
  return new File([new Uint8Array(bytes)], name, { type: "image/png" });
}

describe("media actions", () => {
  it("stores an image, records its size and shows it in the library", async () => {
    const result = await uploadMedia(
      IDLE,
      form({ file: await pngFile(), altEn: "Portrait", altRo: "Portret" }),
    );

    expect(result).toEqual({ status: "ok", message: "Uploaded." });
    const [row] = await mocks.db.select().from(media);
    expect(row).toMatchObject({
      kind: "image",
      mime: "image/png",
      width: 64,
      height: 48,
      altEn: "Portrait",
      altRo: "Portret",
    });
    expect(row.blobUrl).toBe(`/api/media/${row.pathname}`);
    expect(await readdir(dir)).toEqual([row.pathname]);
  });

  it("judges the file by its bytes, not its name or type", async () => {
    const fake = new File(["<svg onload=alert(1)>"], "cute.png", {
      type: "image/png",
    });

    const result = await uploadMedia(
      IDLE,
      form({ file: fake, altEn: "", altRo: "" }),
    );

    expect(result).toMatchObject({
      status: "error",
      code: 400,
      fieldErrors: { file: ["Upload a JPEG, PNG, WebP, AVIF or PDF file."] },
    });
    expect(await readdir(dir)).toHaveLength(1);
  });

  it("edits alt text", async () => {
    const [row] = await mocks.db.select().from(media);

    await saveMediaAlt(IDLE, form({ id: row.id, altEn: "Me", altRo: "Eu" }));

    const [updated] = await mocks.db
      .select()
      .from(media)
      .where(eq(media.id, row.id));
    expect(updated).toMatchObject({ altEn: "Me", altRo: "Eu" });
  });

  it("deleting a file clears references to it and removes the stored object", async () => {
    const [row] = await mocks.db.select().from(media);
    await mocks.db.update(profile).set({ avatarMediaId: row.id });

    expect(await deleteMedia(IDLE, form({ id: row.id }))).toEqual({
      status: "ok",
      message: "Deleted.",
    });

    const [p] = await mocks.db.select().from(profile);
    expect(p.avatarMediaId).toBeNull();
    expect(await readdir(dir)).toEqual([]);
  });

  it("refuses a profile that points at a media id that does not exist", async () => {
    const result = await saveProfile(
      IDLE,
      form({
        emailPublic: "hello@example.com",
        location: "Cluj-Napoca",
        countryCode: "RO",
        yearsExp: "9",
        avatarMediaId: "00000000-0000-4000-8000-000000000000",
        "en.fullName": "A",
        "en.headline": "B",
        "en.summary": "C",
        "en.seoTitle": "D",
        "en.seoDescription": "E",
        "ro.fullName": "",
        "ro.headline": "",
        "ro.summary": "",
        "ro.seoTitle": "",
        "ro.seoDescription": "",
      }),
    );

    expect(result).toMatchObject({ status: "error", code: 409 });
  });
});
