import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";

/** Where admin uploads live. Keys look like `<uuid>.<ext>`. */
export type MediaStore = {
  put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ url: string; pathname: string }>;
  delete(pathname: string): Promise<void>;
};

/** Keys the local store accepts: a UUID plus one of the allowed extensions. */
export const MEDIA_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif|pdf)$/;

/** Vercel Blob (production). Public URLs on the Blob CDN. */
export function createBlobStore(token: string): MediaStore {
  return {
    async put(key, body, contentType) {
      const blob = await put(`media/${key}`, body, {
        access: "public",
        contentType,
        token,
        addRandomSuffix: false,
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      });
      return { url: blob.url, pathname: blob.pathname };
    },
    async delete(pathname) {
      await del(pathname, { token });
    },
  };
}

/**
 * Local filesystem (dev, tests, CI: no BLOB_READ_WRITE_TOKEN). Files are
 * served by src/app/api/media/[key]/route.ts, so they work after `next build`.
 */
export function createLocalStore(dir: string): MediaStore {
  return {
    async put(key, body) {
      assertKey(key);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, key), body);
      return { url: `/api/media/${key}`, pathname: key };
    },
    async delete(pathname) {
      assertKey(pathname);
      await rm(path.join(dir, pathname), { force: true });
    },
  };
}

/** Reads a locally stored file, or null when the key is invalid or missing. */
export async function readLocalMedia(
  dir: string,
  key: string,
): Promise<Buffer | null> {
  if (!MEDIA_KEY.test(key)) {
    return null;
  }
  try {
    return await readFile(path.join(dir, key));
  } catch {
    return null;
  }
}

export const LOCAL_MEDIA_DIR = path.join(process.cwd(), ".data", "media");

function assertKey(key: string) {
  if (!MEDIA_KEY.test(key)) {
    throw new Error(`Invalid media key: ${key}`);
  }
}
