import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMediaStore } from "@/server/media";
import { inspectUpload, MAX_UPLOAD_BYTES } from "@/server/media/inspect";
import {
  createBlobStore,
  createLocalStore,
  readLocalMedia,
} from "@/server/media/store";

const blob = vi.hoisted(() => ({
  put: vi.fn(async (pathname: string) => ({
    url: `https://store.public.blob.vercel-storage.com/${pathname}`,
    pathname,
  })),
  del: vi.fn(async () => {}),
}));
vi.mock("@vercel/blob", () => blob);

const env = vi.hoisted(() => ({
  BLOB_READ_WRITE_TOKEN: undefined as string | undefined,
}));
vi.mock("@/env", () => ({ env }));

const KEY = "0b7e2a8e-4f5a-4c7e-9d0b-1f2e3d4c5b6a.png";

function png(width = 40, height = 20): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  env.BLOB_READ_WRITE_TOKEN = undefined;
});

describe("inspectUpload", () => {
  it("reads size and a tiny blurred preview from a PNG", async () => {
    const result = await inspectUpload(await png());

    expect(result).toMatchObject({
      ok: true,
      kind: "image",
      mime: "image/png",
      ext: "png",
      width: 40,
      height: 20,
    });
    expect(result.ok && result.lqip).toMatch(/^data:image\/webp;base64,/);
  });

  it("accepts a PDF by its signature", async () => {
    expect(await inspectUpload(Buffer.from("%PDF-1.7\n%âãÏÓ\n"))).toMatchObject(
      {
        ok: true,
        kind: "document",
        mime: "application/pdf",
        ext: "pdf",
      },
    );
  });

  it("refuses SVG, which can carry scripts", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );

    expect(await inspectUpload(svg)).toEqual({
      ok: false,
      message: "Upload a JPEG, PNG, WebP, AVIF or PDF file.",
    });
  });

  it("refuses a text file renamed to .png", async () => {
    expect(await inspectUpload(Buffer.from("just text"))).toMatchObject({
      ok: false,
    });
  });

  it("refuses empty and oversized files", async () => {
    expect(await inspectUpload(Buffer.alloc(0))).toEqual({
      ok: false,
      message: "The file is empty.",
    });
    expect(await inspectUpload(Buffer.alloc(MAX_UPLOAD_BYTES + 1))).toEqual({
      ok: false,
      message: "The file is larger than 4 MB.",
    });
  });
});

describe("local media store", () => {
  it("writes, serves and deletes a file by key", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cv-media-"));
    const store = createLocalStore(dir);
    const bytes = await png();

    expect(await store.put(KEY, bytes, "image/png")).toEqual({
      url: `/api/media/${KEY}`,
      pathname: KEY,
    });
    expect(await readLocalMedia(dir, KEY)).toEqual(bytes);

    await store.delete(KEY);
    expect(await readdir(dir)).toEqual([]);
  });

  it("never reads outside its directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cv-media-"));

    expect(await readLocalMedia(dir, "../../etc/passwd")).toBeNull();
    expect(await readLocalMedia(dir, "..%2F..%2Fetc%2Fpasswd")).toBeNull();
    await expect(
      createLocalStore(dir).put("../x.png", Buffer.alloc(1), "image/png"),
    ).rejects.toThrow("Invalid media key");
  });
});

describe("Vercel Blob store", () => {
  it("uploads public, immutable objects under media/ with the given token", async () => {
    const store = createBlobStore("vercel_blob_rw_test");

    const stored = await store.put(KEY, Buffer.from("x"), "image/png");

    expect(blob.put).toHaveBeenCalledWith(`media/${KEY}`, Buffer.from("x"), {
      access: "public",
      contentType: "image/png",
      token: "vercel_blob_rw_test",
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    expect(stored.url).toBe(
      `https://store.public.blob.vercel-storage.com/media/${KEY}`,
    );

    await store.delete(stored.pathname);
    expect(blob.del).toHaveBeenCalledWith(`media/${KEY}`, {
      token: "vercel_blob_rw_test",
    });
  });
});

describe("getMediaStore", () => {
  it("uses Vercel Blob when a token is set", async () => {
    env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_test";

    await getMediaStore().put(KEY, Buffer.from("x"), "image/png");

    expect(blob.put).toHaveBeenCalledOnce();
  });

  it("refuses to store uploads on Vercel's read-only disk without a token", () => {
    vi.stubEnv("VERCEL", "1");

    expect(() => getMediaStore()).toThrow(
      "Set BLOB_READ_WRITE_TOKEN: uploads cannot be stored on Vercel's filesystem.",
    );
  });
});
