import { env } from "@/env";
import {
  createBlobStore,
  createLocalStore,
  LOCAL_MEDIA_DIR,
  type MediaStore,
} from "./store";

/**
 * Vercel Blob when BLOB_READ_WRITE_TOKEN is set, otherwise the local
 * filesystem (dev, tests, CI). Vercel's filesystem is read-only, so a deploy
 * without a token fails loudly instead of losing uploads.
 */
export function getMediaStore(): MediaStore {
  if (env.BLOB_READ_WRITE_TOKEN) {
    return createBlobStore(env.BLOB_READ_WRITE_TOKEN);
  }
  if (process.env.VERCEL) {
    throw new Error(
      "Set BLOB_READ_WRITE_TOKEN: uploads cannot be stored on Vercel's filesystem.",
    );
  }
  return createLocalStore(LOCAL_MEDIA_DIR);
}
